// $lib/server/db/cameras.ts
// Camera giám sát MVP — quản lý + test kết nối + chụp snapshot qua HTTP API camera.
// KHÔNG stream video trong web. Mật khẩu camera mã hóa AES-GCM (pattern social.ts).

import type { TranslateContent } from '$interfaces/basic';
import { createHash, randomBytes } from 'crypto';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { systemVault } from '$lib/store/initSystemVault';
import type { ActorContext } from './suppliers';

const cbCameras = cbData('cameras');
const camerasKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`cameras\``;

const cameraMessages = {
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	} as TranslateContent,
	notFound: { vi: 'Không tìm thấy camera', en: 'Camera not found' } as TranslateContent,
	queryFailed: { vi: 'Truy vấn camera thất bại', en: 'Failed to query cameras' } as TranslateContent,
	createFailed: { vi: 'Tạo camera thất bại', en: 'Failed to create camera' } as TranslateContent,
	updateFailed: { vi: 'Cập nhật camera thất bại', en: 'Failed to update camera' } as TranslateContent,
	deleteFailed: { vi: 'Xóa camera thất bại', en: 'Failed to delete camera' } as TranslateContent,
	invalidBrand: { vi: 'Hãng camera không hợp lệ', en: 'Invalid camera brand' } as TranslateContent,
	invalidHost: { vi: 'Địa chỉ host là bắt buộc', en: 'Host is required' } as TranslateContent,
	invalidPort: { vi: 'Cổng không hợp lệ (1-65535)', en: 'Invalid port (1-65535)' } as TranslateContent,
	invalidChannel: { vi: 'Kênh không hợp lệ (>= 1)', en: 'Invalid channel (>= 1)' } as TranslateContent,
	invalidName: { vi: 'Tên camera là bắt buộc', en: 'Camera name is required' } as TranslateContent,
	testFailed: { vi: 'Kiểm tra kết nối thất bại', en: 'Connection test failed' } as TranslateContent,
	snapshotFailed: { vi: 'Chụp ảnh thất bại', en: 'Snapshot failed' } as TranslateContent
} as const;

export const CAMERA_BRANDS = ['ezviz', 'hikvision', 'dahua', 'other'] as const;
type CameraBrand = (typeof CAMERA_BRANDS)[number];
export type CameraStatus = 'online' | 'offline' | 'unknown';

const CAMERA_SAFE_FIELDS = [
	'name',
	'branchId',
	'brand',
	'model',
	'host',
	'port',
	'channel',
	'username',
	'status',
	'lastTestedAt',
	'lastTestMessage',
	'createdAt',
	'updatedAt'
] as const;

const SNAPSHOT_MAX_BYTES = 2 * 1024 * 1024; // limit 2MB
const HTTP_TIMEOUT_MS = 8000;

function sanitizeCameraForAdmin(doc: Record<string, unknown> & { _id?: string }) {
	const safe: Record<string, unknown> = { _id: doc._id };
	for (const field of CAMERA_SAFE_FIELDS) {
		safe[field] = doc[field];
	}
	// KHÔNG BAO GIỜ trả passwordEncrypted về client — chỉ báo có/không
	safe.hasPassword = Boolean(doc.passwordEncrypted);
	return safe;
}

// ============================================================
// Mã hóa mật khẩu camera — AES-GCM key từ vault indexKey
// (copy pattern social.ts, không import để tránh coupling)
// ============================================================

let cachedAesKey: CryptoKey | null = null;

async function getCameraAesKey(): Promise<CryptoKey> {
	if (cachedAesKey) return cachedAesKey;
	const indexKey = (systemVault as unknown as { indexKey: Uint8Array | ArrayBuffer }).indexKey;
	if (!indexKey) {
		throw new Error('vault-not-initialized');
	}
	const raw = indexKey instanceof Uint8Array ? indexKey : new Uint8Array(indexKey as ArrayBuffer);
	cachedAesKey = await crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, [
		'encrypt',
		'decrypt'
	]);
	return cachedAesKey;
}

export async function encryptCameraPassword(
	plaintext: string
): Promise<{ ivB64: string; ciphertextB64: string }> {
	const key = await getCameraAesKey();
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
	return {
		ivB64: btoa(String.fromCharCode(...iv)),
		ciphertextB64: btoa(
			Array.from(new Uint8Array(ciphertext))
				.map((b) => String.fromCharCode(b))
				.join('')
		)
	};
}

export async function decryptCameraPassword(record: {
	ivB64: string;
	ciphertextB64: string;
}): Promise<string> {
	const key = await getCameraAesKey();
	const iv = Uint8Array.from(atob(record.ivB64), (c) => c.charCodeAt(0));
	const ciphertext = Uint8Array.from(atob(record.ciphertextB64), (c) => c.charCodeAt(0));
	const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
	return new TextDecoder().decode(plaintext);
}

// ============================================================
// HTTP auth helpers — Node không có builtin digest client tiện dùng,
// tự viết minimal digest auth: parse WWW-Authenticate → tính md5 response.
// Chiến lược: thử Basic auth trước (một số camera nhận), fallback Digest nếu 401.
// ============================================================

function md5Hex(input: string): string {
	return createHash('md5').update(input, 'utf8').digest('hex');
}

/** Parse header WWW-Authenticate Digest thành map tham số. */
function parseDigestHeader(header: string): Record<string, string> {
	const params: Record<string, string> = {};
	// Bỏ prefix "Digest " rồi tách từng cặp key="value" hoặc key=value
	const body = header.replace(/^\s*Digest\s+/i, '');
	const re = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|([^\s,]+))/g;
	let match = re.exec(body);
	while (match) {
		params[match[1].toLowerCase()] = match[2] ?? match[3] ?? '';
		match = re.exec(body);
	}
	return params;
}

/** Xây header Authorization cho Digest auth (RFC 2617, qop=auth). */
function buildDigestAuthorization(
	params: Record<string, string>,
	method: string,
	uri: string,
	username: string,
	password: string
): string {
	const realm = params['realm'] ?? '';
	const nonce = params['nonce'] ?? '';
	const qop = (params['qop'] ?? '').split(',')[0]?.trim() || 'auth';
	const opaque = params['opaque'];
	const algorithm = (params['algorithm'] ?? 'MD5').toUpperCase();

	// Chỉ hỗ trợ MD5 / MD5-sess (phổ biến trên camera Hikvision/Dahua)
	let ha1: string;
	if (algorithm === 'MD5-SESS') {
		ha1 = md5Hex(`${md5Hex(`${username}:${realm}:${password}`)}:${nonce}:cnonce`);
	} else {
		ha1 = md5Hex(`${username}:${realm}:${password}`);
	}
	const ha2 = md5Hex(`${method}:${uri}`);

	const cnonce = randomBytes(8).toString('hex');
	const nc = '00000001';
	const response =
		qop === 'auth' || qop === 'auth-int'
			? md5Hex(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
			: md5Hex(`${ha1}:${nonce}:${ha2}`);

	let authorization = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
	if (qop) authorization += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
	if (opaque) authorization += `, opaque="${opaque}"`;
	authorization += `, algorithm=${algorithm}`;
	return authorization;
}

/** Basic auth header value. */
function buildBasicAuthorization(username: string, password: string): string {
	return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

interface CameraHttpResult {
	ok: boolean;
	status: number;
	body: ArrayBuffer | null;
	contentType: string | null;
	errorMessage?: TranslateContent;
}

/**
 * GET một URL trên camera với auth Basic-then-Digest.
 * - Lần 1: Basic auth (một số camera Dahua/Hikvision chấp nhận).
 * - Nếu 401 + có WWW-Authenticate: Digest → tính response và gọi lại.
 */
async function cameraAuthedGet(
	url: string,
	username: string,
	password: string,
	expectBinary: boolean
): Promise<CameraHttpResult> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

	try {
		const headers: Record<string, string> = { authorization: buildBasicAuthorization(username, password) };
		let res = await fetch(url, { headers, signal: controller.signal, redirect: 'manual' });

		// 401 → thử Digest
		if (res.status === 401) {
			const wwwAuth = res.headers.get('www-authenticate') ?? '';
			if (/digest/i.test(wwwAuth)) {
				const parsed = parseDigestHeader(wwwAuth);
				const path = new URL(url).pathname + new URL(url).search;
				const digestHeaders: Record<string, string> = {
					authorization: buildDigestAuthorization(parsed, 'GET', path, username, password)
				};
				res = await fetch(url, { headers: digestHeaders, signal: controller.signal, redirect: 'manual' });
			}
		}

		const contentType = res.headers.get('content-type');
		if (res.status < 400) {
			if (expectBinary) {
				return { ok: true, status: res.status, body: await res.arrayBuffer(), contentType };
			}
			// Đọc text (giới hạn 64KB đủ cho XML/JSON deviceInfo)
			return { ok: true, status: res.status, body: null, contentType };
		}

		return {
			ok: false,
			status: res.status,
			body: null,
			contentType,
			errorMessage: {
				vi: `Camera trả về mã HTTP ${res.status}`,
				en: `Camera returned HTTP status ${res.status}`
			}
		};
	} catch (e) {
		const aborted = e instanceof Error && e.name === 'AbortError';
		return {
			ok: false,
			status: 0,
			body: null,
			contentType: null,
			errorMessage: aborted
				? {
						vi: 'Camera không phản hồi trong thời gian cho phép',
						en: 'Camera did not respond within the allowed time'
					}
				: {
						vi: 'Không thể kết nối tới camera',
						en: 'Could not connect to the camera'
					}
		};
	} finally {
		clearTimeout(timer);
	}
}

// ============================================================
// Brand-specific endpoints
// ============================================================

interface DeviceInfo {
	model?: string;
	serial?: string;
}

/** Lấy model/serial từ XML/JSON body (Hikvision ISAPI XML, Dahua CGI text). */
function parseDeviceInfo(body: string): DeviceInfo {
	const info: DeviceInfo = {};
	const modelMatch = body.match(/<(?:model|deviceModel|Model)>([^<]+)</i);
	if (modelMatch) info.model = modelMatch[1];
	const serialMatch = body.match(/<(?:serialNumber|serialNo|SerialNumber|deviceID)>([^<]+)</i);
	if (serialMatch) info.serial = serialMatch[1];
	return info;
}

interface BrandRequest {
	url: string;
	expectBinary: boolean;
}

/** Test kết nối — trả request descriptor theo brand. */
function buildTestRequest(brand: string, host: string, port: number, username: string, password: string): BrandRequest {
	switch (brand) {
		case 'hikvision':
			// Hikvision ISAPI — digest auth chuẩn
			return { url: `http://${host}:${port}/ISAPI/System/deviceInfo`, expectBinary: false };
		case 'dahua':
			// Dahua CGI — auth qua query param (user=...&password=...)
			return {
				url: `http://${host}:${port}/cgi-bin/magicBox.cgi?action=getSystemInfo&user=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
				expectBinary: false
			};
		case 'ezviz':
			// Ezviz không có HTTP local API công khai → caller xử lý riêng (status 'unsupported')
			return { url: '', expectBinary: false };
		default:
			// 'other' — thử endpoint ISAPI phổ biến nhất
			return { url: `http://${host}:${port}/ISAPI/System/deviceInfo`, expectBinary: false };
	}
}

/** Snapshot — trả request descriptor theo brand. */
function buildSnapshotRequest(
	brand: string,
	host: string,
	port: number,
	channel: number,
	username: string,
	password: string
): BrandRequest {
	switch (brand) {
		case 'hikvision':
			// /ISAPI/Streaming/channels/{channel+1}01/picture — channel 1 → 101
			return {
				url: `http://${host}:${port}/ISAPI/Streaming/channels/${channel + 1}01/picture`,
				expectBinary: true
			};
		case 'dahua':
			return {
				url: `http://${host}:${port}/cgi-bin/snapshot.cgi?user=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&channel=${channel}`,
				expectBinary: true
			};
		case 'ezviz':
			return { url: '', expectBinary: true };
		default:
			return {
				url: `http://${host}:${port}/ISAPI/Streaming/channels/${channel + 1}01/picture`,
				expectBinary: true
			};
	}
}

function validateCameraInput(data: {
	name?: string;
	brand?: string;
	host?: string;
	port?: number;
	channel?: number;
}): { success: false; messages: TranslateContent } | null {
	if (!data.name || !data.name.trim()) return { success: false, messages: cameraMessages.invalidName };
	if (!data.brand || !CAMERA_BRANDS.includes(data.brand as CameraBrand)) {
		return { success: false, messages: cameraMessages.invalidBrand };
	}
	if (!data.host || !data.host.trim()) return { success: false, messages: cameraMessages.invalidHost };
	if (
		data.port !== undefined &&
		(!Number.isInteger(data.port) || data.port < 1 || data.port > 65535)
	) {
		return { success: false, messages: cameraMessages.invalidPort };
	}
	if (data.channel !== undefined && (!Number.isInteger(data.channel) || data.channel < 1)) {
		return { success: false, messages: cameraMessages.invalidChannel };
	}
	return null;
}

export class CameraService {
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string,
		targetBranchId?: string | null
	): Promise<{ success: false; messages: TranslateContent } | null> {
		const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			targetBranchId,
			actorUserId: actor.userId
		});
		if (!allowed) return { success: false, messages: cameraMessages.permissionDenied };
		return null;
	}

	/** Liệt kê camera — filter branch/brand/status + paginate. */
	static async list(
		actor: ActorContext,
		options: {
			branchId?: string;
			brand?: string;
			status?: string;
			page?: number;
			pageSize?: number;
		} = {}
	): Promise<
		| { success: false; messages: TranslateContent }
		| {
				success: true;
				items: Record<string, unknown>[];
				total: number;
				page: number;
				pageSize: number;
		  }
	> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'cameras:read');
		if (!scope) return { success: false, messages: cameraMessages.permissionDenied };

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50));
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		const args: (string | number)[] = [];
		if (scope === 'own_branch') {
			if (!actor.branchId) return { success: false, messages: cameraMessages.permissionDenied };
			conditions.push('branchId = $' + (args.length + 1));
			args.push(actor.branchId);
		}
		if (options.branchId) {
			conditions.push('branchId = $' + (args.length + 1));
			args.push(options.branchId);
		}
		if (options.brand) {
			conditions.push('brand = $' + (args.length + 1));
			args.push(options.brand);
		}
		if (options.status) {
			conditions.push('status = $' + (args.length + 1));
			args.push(options.status);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
		const selectClause = 'META().id AS _id, ' + CAMERA_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

		try {
			const [countRes, dataRes] = await Promise.all([
				cbCameras.document.query({
					statement: `SELECT RAW COUNT(*) FROM ${camerasKeyspace} ${whereClause}`,
					args,
					readonly: true
				}),
				cbCameras.document.query({
					statement: `SELECT ${selectClause} FROM ${camerasKeyspace} ${whereClause} ORDER BY createdAt DESC LIMIT ${pageSize} OFFSET ${offset}`,
					args,
					readonly: true
				})
			]);

			if (!countRes.ok || !dataRes.ok) {
				return { success: false, messages: cameraMessages.queryFailed };
			}

			const total = Number(countRes.data?.results?.[0] ?? 0);
			const items = (dataRes.data?.results ?? []).map((doc: Record<string, unknown>) =>
				sanitizeCameraForAdmin(doc)
			);

			return { success: true, items, total, page, pageSize };
		} catch {
			return { success: false, messages: cameraMessages.queryFailed };
		}
	}

	/** Tạo camera — password plaintext từ payload encrypted API, mã hóa ngay. */
	static async create(
		actor: ActorContext,
		data: {
			name: string;
			branchId: string;
			brand: string;
			model?: string;
			host: string;
			port?: number;
			channel?: number;
			username?: string;
			password?: string; // plaintext (đã qua encrypted transport của API)
		}
	): Promise<
		{ success: false; messages: TranslateContent } | { success: true; camera: Record<string, unknown> }
	> {
		const validationError = validateCameraInput(data);
		if (validationError) return validationError;

		const permError = await this.requirePermission(actor, 'cameras:manage', data.branchId);
		if (permError) return permError;

		let passwordEncrypted: { ivB64: string; ciphertextB64: string } | null = null;
		if (data.password) {
			passwordEncrypted = await encryptCameraPassword(data.password);
		}

		const cameraId = `camera_${Date.now()}_${Math.random().toString(36).substring(7)}`;
		const now = new Date().toISOString();

		const camera = {
			name: data.name.trim(),
			branchId: data.branchId,
			brand: data.brand,
			model: data.model ?? null,
			host: data.host.trim(),
			port: data.port ?? (data.brand === 'hikvision' ? 80 : data.brand === 'dahua' ? 80 : 80),
			channel: data.channel ?? 1,
			username: data.username ?? null,
			passwordEncrypted,
			status: 'unknown' as CameraStatus,
			lastTestedAt: null,
			lastTestMessage: null,
			createdAt: now,
			updatedAt: now
		};

		const createRes = await cbCameras.document.create({ documentKey: cameraId, content: camera });
		if (!createRes.ok) return { success: false, messages: cameraMessages.createFailed };

		return { success: true, camera: sanitizeCameraForAdmin({ ...camera, _id: cameraId }) };
	}

	/** Cập nhật camera. password undefined → giữ nguyên; '' → xóa password; string → đổi. */
	static async update(
		actor: ActorContext,
		cameraId: string,
		data: {
			name?: string;
			brand?: string;
			model?: string | null;
			host?: string;
			port?: number;
			channel?: number;
			username?: string | null;
			password?: string;
			clearPassword?: boolean;
		}
	): Promise<
		{ success: false; messages: TranslateContent } | { success: true; camera: Record<string, unknown> }
	> {
		const getRes = await cbCameras.document.get({ documentKey: cameraId });
		if (!getRes.ok) return { success: false, messages: cameraMessages.notFound };

		const existing = (getRes as { data?: Record<string, unknown> }).data ?? {};
		const permError = await this.requirePermission(actor, 'cameras:manage', existing.branchId as string);
		if (permError) return permError;

		const validationError = validateCameraInput({
			name: data.name ?? (existing.name as string),
			brand: data.brand ?? (existing.brand as string),
			host: data.host ?? (existing.host as string),
			port: data.port ?? (existing.port as number | undefined),
			channel: data.channel ?? (existing.channel as number | undefined)
		});
		if (validationError) return validationError;

		let passwordEncrypted = existing.passwordEncrypted as
			| { ivB64: string; ciphertextB64: string }
			| null
			| undefined;
		if (data.clearPassword) {
			passwordEncrypted = null;
		} else if (data.password) {
			passwordEncrypted = await encryptCameraPassword(data.password);
		}

		const now = new Date().toISOString();
		const updated: Record<string, unknown> = {
			...existing,
			name: data.name?.trim() ?? existing.name,
			brand: data.brand ?? existing.brand,
			model: data.model !== undefined ? data.model : existing.model,
			host: data.host?.trim() ?? existing.host,
			port: data.port ?? existing.port,
			channel: data.channel ?? existing.channel,
			username: data.username !== undefined ? data.username : existing.username,
			passwordEncrypted: passwordEncrypted ?? null,
			updatedAt: now
		};

		const updateRes = await cbCameras.document.update({ documentKey: cameraId, content: updated });
		if (!updateRes.ok) return { success: false, messages: cameraMessages.updateFailed };

		return { success: true, camera: sanitizeCameraForAdmin({ ...updated, _id: cameraId }) };
	}

	/** Xóa camera. */
	static async delete(
		actor: ActorContext,
		cameraId: string
	): Promise<{ success: false; messages: TranslateContent } | { success: true }> {
		const getRes = await cbCameras.document.get({ documentKey: cameraId });
		if (!getRes.ok) return { success: false, messages: cameraMessages.notFound };

		const existing = (getRes as { data?: Record<string, unknown> }).data ?? {};
		const permError = await this.requirePermission(actor, 'cameras:manage', existing.branchId as string);
		if (permError) return permError;

		const deleteRes = await cbCameras.document.delete({ documentKey: cameraId });
		if (!deleteRes.ok) return { success: false, messages: cameraMessages.deleteFailed };
		return { success: true };
	}

	/** Cập nhật kết quả test vào DB. */
	private static async persistTestResult(
		cameraId: string,
		existing: Record<string, unknown>,
		status: CameraStatus,
		lastTestMessage: string
	): Promise<void> {
		try {
			await cbCameras.document.update({
				documentKey: cameraId,
				content: {
					...existing,
					status,
					lastTestedAt: new Date().toISOString(),
					lastTestMessage,
					updatedAt: new Date().toISOString()
				}
			});
		} catch {
			// persist fail không chặn response — status đã trả về client
		}
	}

	/**
	 * Kiểm tra kết nối theo brand.
	 * - Hikvision: ISAPI GET /ISAPI/System/deviceInfo (Basic → fallback Digest)
	 * - Dahua: CGI magicBox.cgi (query-param auth)
	 * - Ezviz: không có local HTTP API → status 'unsupported' + hướng dẫn OpenAPI
	 */
	static async testConnection(
		actor: ActorContext,
		cameraId: string
	): Promise<
		| { success: false; messages: TranslateContent }
		| {
				success: true;
				status: CameraStatus | 'unsupported';
				message: TranslateContent;
				model?: string;
				serial?: string;
				camera: Record<string, unknown>;
		  }
	> {
		const getRes = await cbCameras.document.get({ documentKey: cameraId });
		if (!getRes.ok) return { success: false, messages: cameraMessages.notFound };

		const existing = (getRes as { data?: Record<string, unknown> }).data ?? {};
		const scope = await PermissionChecker.getScope(actor.roleName, 'cameras:read');
		if (!scope) return { success: false, messages: cameraMessages.permissionDenied };
		if (scope === 'own_branch' && actor.branchId && existing.branchId !== actor.branchId) {
			return { success: false, messages: cameraMessages.permissionDenied };
		}

		const brand = String(existing.brand ?? 'other');
		const host = String(existing.host ?? '');
		const port = Number(existing.port ?? 80);
		const channel = Number(existing.channel ?? 1);
		const username = String(existing.username ?? '');
		const passwordEnc = existing.passwordEncrypted as
			| { ivB64: string; ciphertextB64: string }
			| null
			| undefined;
		const password = passwordEnc ? await decryptCameraPassword(passwordEnc) : '';

		if (brand === 'ezviz') {
			const message: TranslateContent = {
				vi: 'Ezviz không có HTTP local API công khai — vui lòng dùng Ezviz OpenAPI (chưa hỗ trợ trong MVP)',
				en: 'Ezviz has no public local HTTP API — please use Ezviz OpenAPI (not supported in MVP)'
			};
			await this.persistTestResult(cameraId, existing, 'unknown', message.en ?? '');
			return {
				success: true,
				status: 'unsupported',
				message,
				camera: sanitizeCameraForAdmin({ ...existing, _id: cameraId })
			};
		}

		const request = buildTestRequest(brand, host, port, username, password);
		const result = await cameraAuthedGet(request.url, username, password, request.expectBinary);

		if (!result.ok) {
			const message = result.errorMessage ?? cameraMessages.testFailed;
			await this.persistTestResult(cameraId, existing, 'offline', message.en ?? '');
			return {
				success: true,
				status: 'offline',
				message,
				camera: sanitizeCameraForAdmin({
					...existing,
					_id: cameraId,
					status: 'offline',
					lastTestMessage: message.en
				})
			};
		}

		// Parse model/serial nếu được (body text đã đọc ở cameraAuthedGet cho expectBinary=false)
		let model: string | undefined;
		let serial: string | undefined;
		if (result.body) {
			const text = new TextDecoder().decode(new Uint8Array(result.body));
			const info = parseDeviceInfo(text);
			model = info.model;
			serial = info.serial;
		}

		const message: TranslateContent = {
			vi: `Kết nối thành công${model ? ` — model ${model}` : ''}`,
			en: `Connection successful${model ? ` — model ${model}` : ''}`
		};
		await this.persistTestResult(cameraId, existing, 'online', message.en ?? '');

		const updatedDoc = {
			...existing,
			status: 'online',
			lastTestMessage: message.en
		};
		return {
			success: true,
			status: 'online',
			message,
			model,
			serial,
			camera: sanitizeCameraForAdmin({ ...updatedDoc, _id: cameraId })
		};
	}

	/**
	 * Chụp ảnh qua HTTP — KHÔNG lưu DB, chỉ trả base64 về client.
	 * - Hikvision: GET /ISAPI/Streaming/channels/{channel+1}01/picture
	 * - Dahua: GET /cgi-bin/snapshot.cgi?user=...&password=...
	 */
	static async snapshot(
		actor: ActorContext,
		cameraId: string
	): Promise<
		| { success: false; messages: TranslateContent }
		| { success: true; imageBase64: string; mimeType: string }
	> {
		const getRes = await cbCameras.document.get({ documentKey: cameraId });
		if (!getRes.ok) return { success: false, messages: cameraMessages.notFound };

		const existing = (getRes as { data?: Record<string, unknown> }).data ?? {};
		const scope = await PermissionChecker.getScope(actor.roleName, 'cameras:read');
		if (!scope) return { success: false, messages: cameraMessages.permissionDenied };
		if (scope === 'own_branch' && actor.branchId && existing.branchId !== actor.branchId) {
			return { success: false, messages: cameraMessages.permissionDenied };
		}

		const brand = String(existing.brand ?? 'other');
		const host = String(existing.host ?? '');
		const port = Number(existing.port ?? 80);
		const channel = Number(existing.channel ?? 1);
		const username = String(existing.username ?? '');
		const passwordEnc = existing.passwordEncrypted as
			| { ivB64: string; ciphertextB64: string }
			| null
			| undefined;

		if (!passwordEnc) {
			return {
				success: false,
				messages: {
					vi: 'Camera chưa có mật khẩu — vui lòng cập nhật mật khẩu trước',
					en: 'Camera has no password set — please update the password first'
				}
			};
		}
		const password = await decryptCameraPassword(passwordEnc);

		if (brand === 'ezviz') {
			return {
				success: false,
				messages: {
					vi: 'Ezviz không hỗ trợ snapshot qua HTTP local — dùng Ezviz OpenAPI (MVP chưa làm)',
					en: 'Ezviz snapshot over local HTTP is not supported — use Ezviz OpenAPI (not in MVP)'
				}
			};
		}

		const request = buildSnapshotRequest(brand, host, port, channel, username, password);
		const result = await cameraAuthedGet(request.url, username, password, request.expectBinary);

		if (!result.ok || !result.body) {
			return {
				success: false,
				messages: result.errorMessage ?? cameraMessages.snapshotFailed
			};
		}

		const mimeType = result.contentType ?? 'image/jpeg';
		if (!mimeType.startsWith('image/')) {
			return {
				success: false,
				messages: {
					vi: 'Camera trả về dữ liệu không phải ảnh',
					en: 'Camera returned non-image data'
				}
			};
		}
		if (result.body.byteLength > SNAPSHOT_MAX_BYTES) {
			return {
				success: false,
				messages: {
					vi: 'Ảnh chụp vượt quá giới hạn 2MB',
					en: 'Snapshot exceeds the 2MB limit'
				}
			};
		}

		const bytes = new Uint8Array(result.body);
		const imageBase64 = btoa(String.fromCharCode(...bytes));
		return { success: true, imageBase64, mimeType };
	}
}
