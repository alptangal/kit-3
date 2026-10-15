// $lib/server/channels/facebook.ts
// Facebook Commerce (Meta) — Catalog + Orders qua Graph API.
// Cần app_id + app_secret + page access token + catalog_id.
// Doc: https://developers.facebook.com/docs/commerce/
// HIỆN TẠI: mock mode (CHANNEL_FACEBOOK_MOCK).
//
// Env khi có key:
//   CHANNEL_FACEBOOK_APP_ID, CHANNEL_FACEBOOK_APP_SECRET,
//   CHANNEL_FACEBOOK_ACCESS_TOKEN, CHANNEL_FACEBOOK_CATALOG_ID,
//   CHANNEL_FACEBOOK_MOCK=false

import type { ChannelAdapter, ChannelFieldDef, ChannelOrderDTO, ResolvedChannelAccount } from './types';
import { buildMockOrders, isChannelMockEnabled, notConfiguredError } from './mock-util';

const credentialFields: ChannelFieldDef[] = [
	{
		key: 'appId',
		label: { vi: 'App ID', en: 'App ID' },
		inputType: 'text',
		required: true
	},
	{
		key: 'appSecret',
		label: { vi: 'App Secret', en: 'App Secret' },
		inputType: 'password',
		required: true
	},
	{
		key: 'accessToken',
		label: { vi: 'Page Access Token', en: 'Page Access Token' },
		inputType: 'password',
		required: true
	}
];

const configFields: ChannelFieldDef[] = [
	{
		key: 'catalogId',
		label: { vi: 'Catalog ID', en: 'Catalog ID' },
		inputType: 'text',
		placeholder: { vi: 'ID danh mục sản phẩm Meta', en: 'Meta product catalog ID' },
		required: true
	}
];

export class FacebookAdapter implements ChannelAdapter {
	readonly channel = 'facebook' as const;
	readonly label = { vi: 'Facebook Shop', en: 'Facebook Shop' };
	readonly credentialFields = credentialFields;
	readonly configFields = configFields;

	async fetchNewOrders(
		account: ResolvedChannelAccount,
		cursor: string | null
	): Promise<{ orders: ChannelOrderDTO[]; cursor: string | null }> {
		if (isChannelMockEnabled('facebook')) {
			return buildMockOrders('facebook', account, cursor);
		}
		// ===== Adapter thật =====
		// TODO: GET https://graph.facebook.com/v19.0/{commerce_merchant_settings_id}/orders
		throw notConfiguredError('facebook');
	}

	async testConnection(account: ResolvedChannelAccount): Promise<{ ok: boolean; message?: string }> {
		if (isChannelMockEnabled('facebook')) {
			return { ok: true, message: 'Facebook mock mode — kết nối giả lập OK' };
		}
		if (!account.credentials.accessToken) {
			return { ok: false, message: 'Thiếu Page Access Token' };
		}
		throw notConfiguredError('facebook');
	}
}

export const facebookAdapter = new FacebookAdapter();
