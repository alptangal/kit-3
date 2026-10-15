// $lib/server/channels/lazada.ts
// Lazada Open Platform (open.lazada.com) — app_key/app_secret + access_token.
// Doc: https://open.lazada.com/doc/
// HIỆN TẠI: mock mode (CHANNEL_LAZADA_MOCK).
//
// Env khi có key:
//   CHANNEL_LAZADA_APP_KEY, CHANNEL_LAZADA_APP_SECRET,
//   CHANNEL_LAZADA_ACCESS_TOKEN, CHANNEL_LAZADA_MOCK=false

import type { ChannelAdapter, ChannelFieldDef, ChannelOrderDTO, ResolvedChannelAccount } from './types';
import { buildMockOrders, isChannelMockEnabled, notConfiguredError } from './mock-util';

const credentialFields: ChannelFieldDef[] = [
	{
		key: 'appKey',
		label: { vi: 'App Key', en: 'App Key' },
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
		label: { vi: 'Access Token', en: 'Access Token' },
		inputType: 'password',
		required: true
	}
];

const configFields: ChannelFieldDef[] = [
	{
		key: 'sellerId',
		label: { vi: 'Seller ID', en: 'Seller ID' },
		inputType: 'text'
	}
];

export class LazadaAdapter implements ChannelAdapter {
	readonly channel = 'lazada' as const;
	readonly label = { vi: 'Lazada', en: 'Lazada' };
	readonly credentialFields = credentialFields;
	readonly configFields = configFields;

	async fetchNewOrders(
		account: ResolvedChannelAccount,
		cursor: string | null
	): Promise<{ orders: ChannelOrderDTO[]; cursor: string | null }> {
		if (isChannelMockEnabled('lazada')) {
			return buildMockOrders('lazada', account, cursor);
		}
		// ===== Adapter thật =====
		// TODO: GET /orders/get (created_after = cursor) + /order/items/get
		throw notConfiguredError('lazada');
	}

	async testConnection(account: ResolvedChannelAccount): Promise<{ ok: boolean; message?: string }> {
		if (isChannelMockEnabled('lazada')) {
			return { ok: true, message: 'Lazada mock mode — kết nối giả lập OK' };
		}
		if (!account.credentials.accessToken) {
			return { ok: false, message: 'Thiếu Access Token' };
		}
		throw notConfiguredError('lazada');
	}
}

export const lazadaAdapter = new LazadaAdapter();
