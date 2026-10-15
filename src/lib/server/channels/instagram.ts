// $lib/server/channels/instagram.ts
// Instagram Shopping (Meta) — Graph API + catalog.
// Cần access token (Instagram Business) + catalog_id.
// Doc: https://developers.facebook.com/docs/instagram-shopping/
// HIỆN TẠI: mock mode (CHANNEL_INSTAGRAM_MOCK).
//
// Env khi có key:
//   CHANNEL_INSTAGRAM_ACCESS_TOKEN, CHANNEL_INSTAGRAM_BUSINESS_ID,
//   CHANNEL_INSTAGRAM_CATALOG_ID, CHANNEL_INSTAGRAM_MOCK=false

import type { ChannelAdapter, ChannelFieldDef, ChannelOrderDTO, ResolvedChannelAccount } from './types';
import { buildMockOrders, isChannelMockEnabled, notConfiguredError } from './mock-util';

const credentialFields: ChannelFieldDef[] = [
	{
		key: 'accessToken',
		label: { vi: 'Access Token (Business)', en: 'Access Token (Business)' },
		inputType: 'password',
		required: true
	},
	{
		key: 'businessId',
		label: { vi: 'Business Account ID', en: 'Business Account ID' },
		inputType: 'text',
		required: true
	}
];

const configFields: ChannelFieldDef[] = [
	{
		key: 'catalogId',
		label: { vi: 'Catalog ID', en: 'Catalog ID' },
		inputType: 'text'
	}
];

export class InstagramAdapter implements ChannelAdapter {
	readonly channel = 'instagram' as const;
	readonly label = { vi: 'Instagram Shopping', en: 'Instagram Shopping' };
	readonly credentialFields = credentialFields;
	readonly configFields = configFields;

	async fetchNewOrders(
		account: ResolvedChannelAccount,
		cursor: string | null
	): Promise<{ orders: ChannelOrderDTO[]; cursor: string | null }> {
		if (isChannelMockEnabled('instagram')) {
			return buildMockOrders('instagram', account, cursor);
		}
		// ===== Adapter thật =====
		// TODO: GET /{commerce-account-id}/orders qua Graph API
		throw notConfiguredError('instagram');
	}

	async testConnection(account: ResolvedChannelAccount): Promise<{ ok: boolean; message?: string }> {
		if (isChannelMockEnabled('instagram')) {
			return { ok: true, message: 'Instagram mock mode — kết nối giả lập OK' };
		}
		if (!account.credentials.accessToken) {
			return { ok: false, message: 'Thiếu Access Token' };
		}
		throw notConfiguredError('instagram');
	}
}

export const instagramAdapter = new InstagramAdapter();
