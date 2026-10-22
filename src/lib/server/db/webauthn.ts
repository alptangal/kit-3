// $lib/server/db/webauthn.ts
// WebAuthnService — passkey / biometric login (Touch ID, Face ID, Windows Hello,
// vân tay Android) qua chuẩn WebAuthn.
//
// Kiến trúc:
// - Thư viện @simplewebauthn/server@13 (đã có trong package.json) cho phần
//   encode/decode + verify attestation/assertion — giảm rủi ro lỗi tự viết.
// - Credential lưu collection 'webauthn_credentials' (1 document / credential),
//   documentKey = `webauthn_credential::<credentialId>` (credentialId là base64url
//   an toàn cho URL path). KHÔNG dùng users.webauthnCredentials (field cũ).
// - Challenge lưu IN-MEMORY (Map + TTL 5 phút) — chấp nhận cho MVP; khi restart
//   server các challenge đang chờ bị huỷ, client chỉ cần thử lại.
//   Backlog production: chuyển sang Couchbase/Redis để sống qua restart + scale.
// - RP ID / origin đọc từ env (webauthn_rp_id / webauthn_origin / webauthn_rp_name,
//   fallback localhost cho dev) — WebAuthn yêu cầu RP ID khớp domain thật.

import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import {
	generateRegistrationOptions,
	verifyRegistrationResponse,
	generateAuthenticationOptions,
	verifyAuthenticationResponse
} from '@simplewebauthn/server';
import type {
	AuthenticatorTransportFuture,
	Base64URLString,
	CredentialDeviceType,
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/server';
import type { TranslateContent } from '$interfaces/basic';
import { cbData } from '$modules/couchbase/clients';
import { webauthn } from '../messages/db';
import type { ActorContext } from './users';
import { Users } from './users';
import { PermissionChecker } from '$modules/rbac/permission-checker';

const cbCredentials = cbData('webauthn_credentials');
const cbUsers = cbData('users');

// ── RP config ──
// RP ID phải là domain (không scheme/port); origin là scheme+host(+port) đầy đủ
// mà client thực sự đang đứng. WebAuthn: RP ID phải là suffix của origin host.
const RP_ID: string = env.webauthn_rp_id || 'localhost';
const RP_NAME: string = env.webauthn_rp_name || 'PhuongDoMega';
const RP_ORIGIN: string =
	env.webauthn_origin || (dev ? 'http://localhost:5173' : `https://${RP_ID}`);

/** Độ dài tối đa tên thiết bị user đặt. */
const MAX_NAME_LENGTH = 64;

/** Số credential tối đa 1 user đăng ký (chặn phình document/query). */
const MAX_CREDENTIALS_PER_USER = 20;

// ── Challenge store (in-memory, TTL 5 phút) ──
// MVP: 1 entry / key. Gọi options lần nữa là ghi đè. single-use: xoá ngay khi verify.
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type ChallengeEntry = {
	challenge: string;
	createdAt: number;
	/** userId ràng buộc (flow register luôn có; flow auth khi có username). */
	userId?: string;
};

const registerChallenges = new Map<string, ChallengeEntry>();
const authChallenges = new Map<string, ChallengeEntry>();

function pruneExpired(map: Map<string, ChallengeEntry>): void {
	const now = Date.now();
	for (const [key, entry] of map) {
		if (now - entry.createdAt > CHALLENGE_TTL_MS) map.delete(key);
	}
}

// ── Helpers ──

/** Uint8Array → base64 (chuẩn, dùng cho publicKey trong DB). */
function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

/** base64 → Uint8Array (đọc lại publicKey từ DB). */
function base64ToUint8Array(b64: string): Uint8Array {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/** base64url → base64 (cho userHandle từ authenticator). */
function base64urlToBase64(input: string): string {
	const padded = input.replace(/-/g, '+').replace(/_/g, '/');
	return padded + '='.repeat((4 - (padded.length % 4)) % 4);
}

// ── Shapes ──
export interface WebAuthnCredentialDocument {
	credentialId: string;
	userId: string;
	/** Public key COSE raw bytes, base64 — decode lại khi verify assertion. */
	publicKey: string;
	counter: number;
	transports?: string[];
	deviceType: CredentialDeviceType | string;
	backedUp: boolean;
	name: string;
	createdAt: string;
	lastUsedAt?: string | null;
}

export interface RegistrationOptionsResult {
	options: PublicKeyCredentialCreationOptionsJSON;
}

export interface AuthenticationOptionsResult {
	options: PublicKeyCredentialRequestOptionsJSON;
}

export type WebAuthnServiceResult<T = undefined> =
	| { success: true; data?: T; message?: TranslateContent }
	| { success: false; message: TranslateContent };

// ── Service ──
export class WebAuthnService {
	/**
	 * Sinh options đăng ký passkey cho user ĐÃ đăng nhập.
	 * Challenge lưu in-memory theo userId, TTL 5 phút, single-use.
	 */
	static async generateRegistrationOptions(
		actor: ActorContext,
		userId: string
	): Promise<WebAuthnServiceResult<RegistrationOptionsResult>> {
		pruneExpired(registerChallenges);

		// Service per-user — actor chỉ đăng ký credential cho chính mình
		if (actor.userId !== userId) {
			return { success: false, message: webauthn.notOwned };
		}

		let userInstance: Users | undefined;
		try {
			userInstance = await Users.getById(userId);
		} catch {
			userInstance = undefined;
		}
		if (!userInstance) {
			return { success: false, message: webauthn.notFound };
		}
		const userDoc = userInstance.user;
		// webauthnUserHandle: định danh ổn định cho authenticator (không đổi khi đổi email)
		const userHandle = userDoc.webauthnUserHandle || userId;

		// Exclude credential đã đăng ký để authenticator không trùng.
		// CHỈ gửi id — Safari iOS 15 không xử lý tốt transports trong excludeCredentials
		// (giá trị lạ như 'hybrid' khiến quy tắc exclude sai → prompt tự huỷ NotAllowedError).
		const existing = await this.listCredentialsRaw(userId);
		const excludeCredentials = existing.map((c) => ({
			id: c.credentialId as Base64URLString
		}));

		let options: PublicKeyCredentialCreationOptionsJSON;
		try {
			options = await generateRegistrationOptions({
				rpName: RP_NAME,
				rpID: RP_ID,
				// username phải ổn định theo user — email đã mã hoá nên dùng userHandle
				userName: userHandle,
				userID: new TextEncoder().encode(userHandle),
				userDisplayName:
					[userDoc.firstname, userDoc.lastname].filter(Boolean).join(' ') || userHandle,
				timeout: 60_000,
				attestationType: 'none',
				// Chỉ ES256: Safari iOS 15 hỗ trợ chắc chắn; EdDSA (-8) đứng đầu có thể
				// chọn alg authenticator cũ không hiểu → create() fail
				supportedAlgorithmIDs: [-257],
				excludeCredentials
			});
		} catch (e) {
			console.error('[WebAuthnService.generateRegistrationOptions]', e);
			return { success: false, message: webauthn.registerOptionsFailed };
		}

		registerChallenges.set(userId, {
			challenge: options.challenge,
			createdAt: Date.now(),
			userId
		});

		return { success: true, data: { options } };
	}

	/**
	 * Verify attestation response sau navigator.credentials.create().
	 * Chỉ user đã đăng nhập được đăng ký credential cho chính mình.
	 */
	static async verifyRegistration(
		actor: ActorContext,
		userId: string,
		response: unknown,
		deviceName?: string
	): Promise<WebAuthnServiceResult<WebAuthnCredentialDocument>> {
		pruneExpired(registerChallenges);

		if (actor.userId !== userId) {
			return { success: false, message: webauthn.notOwned };
		}

		const entry = registerChallenges.get(userId);
		if (!entry) {
			return { success: false, message: webauthn.challengeExpired };
		}
		registerChallenges.delete(userId); // single-use

		let verification;
		try {
			verification = await verifyRegistrationResponse({
				response: response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
				expectedChallenge: entry.challenge,
				expectedOrigin: RP_ORIGIN,
				expectedRPID: RP_ID,
				// Nới UV cho MVP — một số authenticator platform không trả UV=true lúc register
				requireUserVerification: false
			});
		} catch (e) {
			console.error('[WebAuthnService.verifyRegistration] verify threw', e);
			return { success: false, message: webauthn.registerVerifyFailed };
		}

		if (!verification.verified || !verification.registrationInfo) {
			return { success: false, message: webauthn.registerVerifyFailed };
		}

		const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

		// Đã tồn tại credentialId này thì không đăng ký lại
		const dup = await this.findByCredentialId(credential.id);
		if (dup) {
			return { success: false, message: webauthn.registerAlreadyExists };
		}

		// Chặn vượt số credential tối đa mỗi user
		const existing = await this.listCredentialsRaw(userId);
		if (existing.length >= MAX_CREDENTIALS_PER_USER) {
			return { success: false, message: webauthn.registerOptionsFailed };
		}

		const now = new Date().toISOString();
		const name = (deviceName ?? '').trim().slice(0, MAX_NAME_LENGTH) || 'Passkey';

		const doc: WebAuthnCredentialDocument = {
			credentialId: credential.id,
			userId,
			publicKey: uint8ArrayToBase64(credential.publicKey),
			counter: credential.counter,
			transports: (credential.transports ?? []) as string[],
			deviceType: credentialDeviceType,
			backedUp: credentialBackedUp,
			name,
			createdAt: now,
			lastUsedAt: null
		};

		const created = await cbCredentials.document.create({
			documentKey: `webauthn_credential::${credential.id}`,
			content: doc
		});
		if (!created.ok) {
			console.error(
				'[WebAuthnService.verifyRegistration] create failed',
				created.status,
				created.message
			);
			return { success: false, message: webauthn.registerVerifyFailed };
		}

		return { success: true, data: doc, message: webauthn.registerSuccess };
	}

	/**
	 * Sinh options đăng nhập:
	 * (a) có username (blind index) → allowCredentials ràng buộc credential của user đó;
	 * (b) không → discoverable credential (authenticator tự chọn, trả userHandle).
	 * Challenge key: `cred:<userId>` cho (a), 'discoverable' cho (b).
	 */
	static async generateAuthenticationOptions(input: {
		usernameBlindIndex?: string;
		emailBlindIndex?: string;
	}): Promise<WebAuthnServiceResult<AuthenticationOptionsResult>> {
		pruneExpired(authChallenges);

		const { usernameBlindIndex, emailBlindIndex } = input;
		let allowCredentials: { id: Base64URLString }[] | undefined = undefined;
		let sessionKey = 'discoverable';
		let boundUserId: string | undefined;

		if (usernameBlindIndex || emailBlindIndex) {
			const foundUserId = await this.findUserByBlindIndex(usernameBlindIndex, emailBlindIndex);
			if (foundUserId) {
				const creds = await this.listCredentialsRaw(foundUserId);
				if (creds.length) {
					allowCredentials = creds.map((c) => ({
						id: c.credentialId as Base64URLString,
						transports: c.transports as AuthenticatorTransportFuture[] | undefined
					}));
					boundUserId = foundUserId;
					sessionKey = `cred:${foundUserId}`;
				}
			}
			// Không tìm thấy user/credential → vẫn trả options KHÔNG allowCredentials:
			// không tiết lộ user tồn tại hay không; assertion sau đó sẽ bị từ chối ở verify
			// (credentialNotFound) — hành vi tương đương "invalid credentials" của login.
		}

		let options: PublicKeyCredentialRequestOptionsJSON;
		try {
			options = await generateAuthenticationOptions({
				rpID: RP_ID,
				allowCredentials,
				timeout: 60_000,
				userVerification: 'preferred'
			});
		} catch (e) {
			console.error('[WebAuthnService.generateAuthenticationOptions]', e);
			return { success: false, message: webauthn.authOptionsFailed };
		}

		authChallenges.set(sessionKey, {
			challenge: options.challenge,
			createdAt: Date.now(),
			userId: boundUserId
		});

		return { success: true, data: { options } };
	}

	/**
	 * Verify assertion response. Nếu pass → trả userId để route TẠO SESSION
	 * (route tự ký JWT + set cookie, giống login mật khẩu thành công).
	 */
	static async verifyAuthentication(input: {
		response: unknown;
	}): Promise<
		| {
				success: true;
				userId: string;
				credential: WebAuthnCredentialDocument;
				message: TranslateContent;
		  }
		| { success: false; message: TranslateContent }
	> {
		pruneExpired(authChallenges);

		if (!input.response || typeof input.response !== 'object') {
			return { success: false, message: webauthn.authVerifyFailed };
		}
		const assertion = input.response as {
			id?: string;
			rawId?: string;
			response?: { userHandle?: string | null };
		};

		const credentialId = assertion.id ?? assertion.rawId;
		if (!credentialId) {
			return { success: false, message: webauthn.credentialIdRequired };
		}

		const credentialDoc = await this.findByCredentialId(credentialId);
		if (!credentialDoc) {
			return { success: false, message: webauthn.credentialNotFound };
		}

		// Tìm challenge: ưu tiên entry ràng buộc theo user của credential này
		const boundKey = `cred:${credentialDoc.userId}`;
		let entry = authChallenges.get(boundKey) ?? authChallenges.get('discoverable');
		if (!entry) {
			return { success: false, message: webauthn.challengeExpired };
		}

		// Flow discoverable (entry không bound user): userHandle từ authenticator
		// phải map về đúng user của credential — chống dùng credential của user khác
		// để đáp challenge discoverable.
		if (!entry.userId && assertion.response?.userHandle) {
			const userHandle = new TextDecoder().decode(
				base64ToUint8Array(base64urlToBase64(String(assertion.response.userHandle)))
			);
			const handleUserId = await this.findUserByUserHandle(userHandle);
			if (!handleUserId || handleUserId !== credentialDoc.userId) {
				return { success: false, message: webauthn.userHandleMismatch };
			}
		}

		// Xoá challenge single-use TRƯỚC khi verify (chống retry/replay cùng challenge)
		authChallenges.delete(boundKey);
		authChallenges.delete('discoverable');

		let verification;
		try {
			verification = await verifyAuthenticationResponse({
				response: input.response as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
				expectedChallenge: entry.challenge,
				expectedOrigin: RP_ORIGIN,
				expectedRPID: RP_ID,
				credential: {
					id: credentialDoc.credentialId as Base64URLString,
					publicKey: base64ToUint8Array(credentialDoc.publicKey) as Uint8Array<ArrayBuffer>,
					counter: credentialDoc.counter,
					transports: credentialDoc.transports as AuthenticatorTransportFuture[] | undefined
				},
				// MVP: nới UV — thiết bị không có sensor UV vẫn đăng nhập được.
				// Backlog: cho admin bật 'required' qua system settings.
				requireUserVerification: false
			});
		} catch (e) {
			console.error('[WebAuthnService.verifyAuthentication] verify threw', e);
			return { success: false, message: webauthn.authVerifyFailed };
		}

		if (!verification.verified) {
			return { success: false, message: webauthn.authVerifyFailed };
		}

		// Chống replay/clone: counter mới phải LỚN HƠN counter đã lưu
		// (ngoại lệ newCounter=0 — một số authenticator không hỗ trợ counter).
		const { newCounter } = verification.authenticationInfo;
		if (newCounter !== 0 && newCounter <= credentialDoc.counter) {
			console.error(
				`[WebAuthnService] counter mismatch for ${credentialDoc.credentialId}: stored=${credentialDoc.counter} new=${newCounter}`
			);
			return { success: false, message: webauthn.counterMismatch };
		}

		// Cập nhật counter + lastUsedAt — fire-and-forget, không chặn phản hồi
		cbCredentials.document
			.update({
				documentKey: `webauthn_credential::${credentialDoc.credentialId}`,
				content: {
					counter: newCounter,
					lastUsedAt: new Date().toISOString()
				}
			})
			.catch((e) => console.error('[WebAuthnService] update counter failed', e));

		return {
			success: true,
			userId: credentialDoc.userId,
			credential: credentialDoc,
			message: webauthn.authSuccess
		};
	}

	/**
	 * Danh sách credential của 1 user. Actor trùng userId, hoặc có
	 * permission 'users:manage' với target là user đó (admin xem giúp).
	 */
	static async listCredentials(
		actor: ActorContext,
		userId: string
	): Promise<WebAuthnServiceResult<{ credentials: WebAuthnCredentialDocument[] }>> {
		if (actor.userId !== userId) {
			const allowed = await PermissionChecker.can(actor.roleName, 'users:manage', {
				branchId: actor.branchId,
				actorUserId: actor.userId,
				targetUserId: userId
			});
			if (!allowed) {
				return { success: false, message: webauthn.notOwned };
			}
		}
		const credentials = await this.listCredentialsRaw(userId);
		return { success: true, data: { credentials } };
	}

	/** Đổi tên credential — chỉ chủ sở hữu. */
	static async renameCredential(
		actor: ActorContext,
		credentialId: string,
		name: string
	): Promise<WebAuthnServiceResult<WebAuthnCredentialDocument>> {
		const doc = await this.findByCredentialId(credentialId);
		if (!doc) return { success: false, message: webauthn.notFound };
		if (doc.userId !== actor.userId) {
			return { success: false, message: webauthn.notOwned };
		}

		const clean = (name ?? '').trim().slice(0, MAX_NAME_LENGTH);
		if (!clean) return { success: false, message: webauthn.nameTooLong };

		const updated = await cbCredentials.document.update({
			documentKey: `webauthn_credential::${credentialId}`,
			content: { name: clean }
		});
		if (!updated.ok) {
			console.error('[WebAuthnService.renameCredential] update failed', updated.status, updated.message);
			return { success: false, message: webauthn.renameFailed };
		}

		return { success: true, data: { ...doc, name: clean }, message: webauthn.renameSuccess };
	}

	/**
	 * Xoá credential.
	 * MVP: chỉ yêu cầu session hợp lệ của chủ sở hữu.
	 * Backlog: yêu cầu re-auth (password hoặc passkey khác) trước khi xoá.
	 */
	static async deleteCredential(
		actor: ActorContext,
		credentialId: string
	): Promise<WebAuthnServiceResult> {
		const doc = await this.findByCredentialId(credentialId);
		if (!doc) return { success: false, message: webauthn.notFound };
		if (doc.userId !== actor.userId) {
			return { success: false, message: webauthn.notOwned };
		}

		const deleted = await cbCredentials.document.delete({
			documentKey: `webauthn_credential::${credentialId}`
		});
		if (!deleted.ok) {
			console.error('[WebAuthnService.deleteCredential] delete failed', deleted.status, deleted.message);
			return { success: false, message: webauthn.deleteFailed };
		}

		return { success: true, message: webauthn.deleteSuccess };
	}

	// ── Internal ──

	/** Mọi credential của user qua search theo userId (field searchable trong schema). */
	private static async listCredentialsRaw(userId: string): Promise<WebAuthnCredentialDocument[]> {
		try {
			const res = await cbCredentials.query.document.search({
				conditions: [{ fieldName: 'userId', keyword: userId }],
				limit: 100
			});
			if (!res.ok) return [];
			const rows = (res.data ?? []) as WebAuthnCredentialDocument[];
			return rows.filter((r) => r && r.credentialId);
		} catch (e) {
			console.error('[WebAuthnService.listCredentialsRaw] search failed', e);
			return [];
		}
	}

	/** Tìm credential theo credentialId — thử documentKey trực tiếp trước, search sau. */
	private static async findByCredentialId(
		credentialId: string
	): Promise<WebAuthnCredentialDocument | undefined> {
		if (!credentialId) return undefined;
		try {
			const direct = await cbCredentials.document.get({
				documentKey: `webauthn_credential::${credentialId}`
			});
			if (direct.ok && direct.data) {
				return direct.data as WebAuthnCredentialDocument;
			}
		} catch {
			// bỏ qua — rơi xuống search
		}
		try {
			const res = await cbCredentials.query.document.search({
				conditions: [{ fieldName: 'credentialId', keyword: credentialId }],
				limit: 1
			});
			if (!res.ok) return undefined;
			const rows = (res.data ?? []) as WebAuthnCredentialDocument[];
			return rows[0];
		} catch (e) {
			console.error('[WebAuthnService.findByCredentialId] search failed', e);
			return undefined;
		}
	}

	/**
	 * Tìm userId từ blind index (username/email) — chỉ trả user còn active
	 * (không deletedAt), giống logic Users.login.
	 */
	private static async findUserByBlindIndex(
		usernameBlindIndex?: string,
		emailBlindIndex?: string
	): Promise<string | undefined> {
		const fieldName = usernameBlindIndex
			? ('usernameBlindIndex' as const)
			: emailBlindIndex
				? ('emailBlindIndex' as const)
				: undefined;
		const keyword = usernameBlindIndex ?? emailBlindIndex;
		if (!fieldName || !keyword) return undefined;

		try {
			const found = await Users.getBy({ [fieldName]: keyword });
			const doc = found?.find((d) => !d.deletedAt) ?? found?.[0];
			if (!doc || doc.deletedAt) return undefined;
			return doc._id;
		} catch {
			return undefined;
		}
	}

	/** Tìm userId theo webauthnUserHandle (searchable trong schema users). */
	private static async findUserByUserHandle(userHandle: string): Promise<string | undefined> {
		try {
			const res = await cbUsers.query.document.search({
				conditions: [{ fieldName: 'webauthnUserHandle', keyword: userHandle }],
				limit: 1
			});
			if (!res.ok) return undefined;
			const rows = (res.data ?? []) as { _id?: string; deletedAt?: string | null }[];
			const doc = rows.find((d) => !d.deletedAt) ?? rows[0];
			if (!doc || doc.deletedAt) return undefined;
			return doc._id;
		} catch (e) {
			console.error('[WebAuthnService.findUserByUserHandle] search failed', e);
			return undefined;
		}
	}
}
