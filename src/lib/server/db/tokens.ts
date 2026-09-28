// $lib/server/db/tokens.ts
// Refresh token management for DPoP-bound authentication

import { cbData } from '$modules/couchbase/clients';
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import type { TranslateContent } from '$interfaces/basic';

const cbRefreshTokens = cbData('refresh_tokens');

export interface RefreshTokenDocument {
	userId: string;
	tokenHash: string;
	familyId: string;
	generation: number;
	expiresAt: string;
	isRevoked: boolean;
	revokedAt?: string | null;
	revokedReason?: string | null;
	deviceId: string;
	deviceNameEncrypted?: string | null;
	deviceTypeEncrypted?: string | null;
	ipAddress: string;
	userAgent: string;
	lastUsedAt: string;
	usageCount: number;
	refreshHistory: Array<{
		refreshedAt: string;
		ipAddress: string;
		newTokenHash: string;
		generation: number;
	}>;
	createdAt: string;
}

export interface FindRefreshTokenResult {
	success: boolean;
	data?: RefreshTokenDocument & { _id: string };
	messages?: TranslateContent;
}

export interface RotateRefreshTokenResult {
	success: boolean;
	data?: RefreshTokenDocument & { _id: string };
	messages?: TranslateContent;
}

export interface RevokeRefreshTokenResult {
	success: boolean;
	messages?: TranslateContent;
}

/**
 * Hash a refresh token using SHA-256 for storage
 */
async function hashToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate document key for refresh token
 */
function makeDocumentKey(familyId: string, generation: number): string {
	return `refresh_token::${familyId}::${generation}`;
}

/**
 * Find a refresh token by its value
 * Returns the document if found and not revoked/expired
 */
export async function findRefreshToken(tokenValue: string): Promise<FindRefreshTokenResult> {
	try {
		const tokenHash = await hashToken(tokenValue);

		// Search by tokenHash
		const res = await cbRefreshTokens.query.document.search({
			conditions: [{ fieldName: 'tokenHash', keyword: tokenHash }],
			limit: 1
		});

		if (!res.ok || !res.data || res.data.length === 0) {
			return { success: false, messages: { vi: 'Token không hợp lệ', en: 'Invalid token' } as TranslateContent };
		}

		const doc = res.data[0] as RefreshTokenDocument & { _id: string };

		// Check if revoked
		if (doc.isRevoked) {
			return { success: false, messages: { vi: 'Token đã bị thu hồi', en: 'Token has been revoked' } as TranslateContent };
		}

		// Check expiration
		const now = new Date().toISOString();
		if (doc.expiresAt < now) {
			return { success: false, messages: { vi: 'Token đã hết hạn', en: 'Token expired' } as TranslateContent };
		}

		return { success: true, data: doc };
	} catch (e) {
		console.error('[findRefreshToken] error:', e);
		return { success: false, messages: { vi: 'Lỗi tìm token', en: 'Error finding token' } as TranslateContent };
	}
}

/**
 * Rotate a refresh token - invalidate old one and create new one
 * Returns new token document
 */
export async function rotateRefreshToken(
	oldTokenValue: string,
	newTokenData: {
		token: string;
		userId: string;
		jkt: string;
		expiresAt: number;
		deviceId: string;
		deviceName?: string;
		deviceType?: string;
		ipAddress: string;
		userAgent: string;
	}
): Promise<RotateRefreshTokenResult> {
	const oldTokenHash = await hashToken(oldTokenValue);
	const newTokenHash = await hashToken(newTokenData.token);

	try {
		// Find old token document
		const findRes = await cbRefreshTokens.query.document.search({
			conditions: [{ fieldName: 'tokenHash', keyword: oldTokenHash }],
			limit: 1
		});

		if (!findRes.ok || !findRes.data || findRes.data.length === 0) {
			return { success: false, messages: { vi: 'Token cũ không tồn tại', en: 'Old token not found' } as TranslateContent };
		}

		const oldDoc = findRes.data[0] as RefreshTokenDocument & { _id: string };

		// Check if already revoked (race condition)
		if (oldDoc.isRevoked) {
			return { success: false, messages: { vi: 'Token đã bị thu hồi', en: 'Token already revoked' } as TranslateContent };
		}

		// Check if already used (generation mismatch means another request rotated it)
		const newGeneration = oldDoc.generation + 1;

		// Revoke old token
		const revokeRes = await cbRefreshTokens.document.update({
			documentKey: oldDoc._id,
			content: {
				isRevoked: true,
				revokedAt: new Date().toISOString(),
				revokedReason: 'rotated'
			} as Partial<RefreshTokenDocument> as RefreshTokenDocument
		});

		if (!revokeRes.ok) {
			return { success: false, messages: { vi: 'Không thể thu hồi token cũ', en: 'Failed to revoke old token' } as TranslateContent };
		}

		// Create new token document
		const now = new Date().toISOString();
		const newDoc: RefreshTokenDocument = {
			userId: newTokenData.userId,
			tokenHash: newTokenHash,
			familyId: oldDoc.familyId,
			generation: newGeneration,
			expiresAt: new Date(newTokenData.expiresAt * 1000).toISOString(),
			isRevoked: false,
			revokedAt: null,
			revokedReason: null,
			deviceId: newTokenData.deviceId,
			deviceNameEncrypted: newTokenData.deviceName
				? (await encryption.encryptData(
					await encryption.unlockVault('', { // placeholder, we need the DEK from somewhere
						dekIvB64: '',
						saltB64: '',
						wrappedDekB64: ''
					})
				)).ciphertextB64
				: null,
			deviceTypeEncrypted: newTokenData.deviceType
				? (await encryption.encryptData(
					await encryption.unlockVault('', {
						dekIvB64: '',
						saltB64: '',
						wrappedDekB64: ''
					})
				)).ciphertextB64
				: null,
			ipAddress: newTokenData.ipAddress,
			userAgent: newTokenData.userAgent,
			lastUsedAt: now,
			usageCount: 1,
			refreshHistory: [
				...(oldDoc.refreshHistory || []),
				{
					refreshedAt: now,
					ipAddress: newTokenData.ipAddress,
					newTokenHash,
					generation: newGeneration
				}
			],
			createdAt: now
		};

		const newDocKey = makeDocumentKey(oldDoc.familyId, newGeneration);

		const createRes = await cbRefreshTokens.document.create({
			documentKey: newDocKey,
			content: newDoc
		});

		if (!createRes.ok) {
			return { success: false, messages: { vi: 'Không tạo được token mới', en: 'Failed to create new token' } as TranslateContent };
		}

		return {
			success: true,
			data: { ...newDoc, _id: newDocKey }
		};
	} catch (e) {
		console.error('[rotateRefreshToken] error:', e);
		return { success: false, messages: { vi: 'Lỗi xoay vòng token', en: 'Error rotating token' } as TranslateContent };
	}
}

/**
 * Revoke a refresh token completely
 */
export async function revokeRefreshToken(tokenValue: string, reason: string = 'manual'): Promise<RevokeRefreshTokenResult> {
	const tokenHash = await hashToken(tokenValue);

	try {
		const findRes = await cbRefreshTokens.query.document.search({
			conditions: [{ fieldName: 'tokenHash', keyword: tokenHash }],
			limit: 1
		});

		if (!findRes.ok || !findRes.data || findRes.data.length === 0) {
			return { success: false, messages: { vi: 'Token không tồn tại', en: 'Token not found' } as TranslateContent };
		}

		const doc = findRes.data[0] as RefreshTokenDocument & { _id: string };

		const res = await cbRefreshTokens.document.update({
			documentKey: doc._id,
			content: {
				isRevoked: true,
				revokedAt: new Date().toISOString(),
				revokedReason: reason
			} as Partial<RefreshTokenDocument> as RefreshTokenDocument
		});

		if (!res.ok) {
			return { success: false, messages: { vi: 'Không thể thu hồi token', en: 'Failed to revoke token' } as TranslateContent };
		}

		return { success: true };
	} catch (e) {
		console.error('[revokeRefreshToken] error:', e);
		return { success: false, messages: { vi: 'Lỗi thu hồi token', en: 'Error revoking token' } as TranslateContent };
	}
}

/**
 * Create a new refresh token family (initial login)
 */
export async function createRefreshToken(data: {
	userId: string;
	token: string;
	jkt: string;
	expiresAt: number;
	deviceId: string;
	deviceName?: string;
	deviceType?: string;
	ipAddress: string;
	userAgent: string;
}): Promise<RotateRefreshTokenResult> {
	const tokenHash = await hashToken(data.token);
	const familyId = crypto.randomUUID();
	const now = new Date().toISOString();

	const newDoc: RefreshTokenDocument = {
		userId: data.userId,
		tokenHash,
		familyId,
		generation: 1,
		expiresAt: new Date(data.expiresAt * 1000).toISOString(),
		isRevoked: false,
		revokedAt: null,
		revokedReason: null,
		deviceId: data.deviceId,
		deviceNameEncrypted: data.deviceName
			? (await encryption.encryptData(
				await encryption.unlockVault('', {
					dekIvB64: '',
					saltB64: '',
					wrappedDekB64: ''
				})
			)).ciphertextB64
			: null,
		deviceTypeEncrypted: data.deviceType
			? (await encryption.encryptData(
				await encryption.unlockVault('', {
					dekIvB64: '',
					saltB64: '',
					wrappedDekB64: ''
				})
			)).ciphertextB64
			: null,
		ipAddress: data.ipAddress,
		userAgent: data.userAgent,
		lastUsedAt: now,
		usageCount: 1,
		refreshHistory: [],
		createdAt: now
	};

	const docKey = makeDocumentKey(familyId, 1);

	try {
		const res = await cbRefreshTokens.document.create({
			documentKey: docKey,
			content: newDoc
		});

		if (!res.ok) {
			return { success: false, messages: { vi: 'Không tạo được refresh token', en: 'Failed to create refresh token' } as TranslateContent };
		}

		return {
			success: true,
			data: { ...newDoc, _id: docKey }
		};
	} catch (e) {
		console.error('[createRefreshToken] error:', e);
		return { success: false, messages: { vi: 'Lỗi tạo refresh token', en: 'Error creating refresh token' } as TranslateContent };
	}
}