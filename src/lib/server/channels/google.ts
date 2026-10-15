// $lib/server/channels/google.ts
// Google Shopping / Merchant Center — Content API for Shopping.
// Cần merchant_id + service account JSON (hoặc OAuth access token).
// Doc: https://developers.google.com/shopping-content/guides/quickstart
// LƯU Ý: Merchant Center chủ yếu quản lý product feed; đơn (orders)
// qua Google Shopping cần local inventory ads / order flow — adapter này
// để khung chuẩn bị, tạm thời chỉ fetch feed status.
// HIỆN TẠI: mock mode (CHANNEL_GOOGLE_MOCK).
//
// Env khi có key:
//   CHANNEL_GOOGLE_MERCHANT_ID, CHANNEL_GOOGLE_ACCESS_TOKEN,
//   CHANNEL_GOOGLE_MOCK=false

import type { ChannelAdapter, ChannelFieldDef, ChannelOrderDTO, ResolvedChannelAccount } from './types';
import { buildMockOrders, isChannelMockEnabled, notConfiguredError } from './mock-util';

const credentialFields: ChannelFieldDef[] = [
	{
		key: 'merchantId',
		label: { vi: 'Merchant ID', en: 'Merchant ID' },
		inputType: 'text',
		required: true
	},
	{
		key: 'accessToken',
		label: { vi: 'Access Token (OAuth)', en: 'Access Token (OAuth)' },
		inputType: 'password',
		required: true
	}
];

const configFields: ChannelFieldDef[] = [
	{
		key: 'country',
		label: { vi: 'Quốc gia feed', en: 'Feed country' },
		inputType: 'select',
		options: [
			{ value: 'VN', label: { vi: 'Việt Nam', en: 'Vietnam' } },
			{ value: 'US', label: { vi: 'Mỹ', en: 'United States' } },
			{ value: 'SG', label: { vi: 'Singapore', en: 'Singapore' } }
		]
	}
];

export class GoogleAdapter implements ChannelAdapter {
	readonly channel = 'google' as const;
	readonly label = { vi: 'Google Shopping', en: 'Google Shopping' };
	readonly credentialFields = credentialFields;
	readonly configFields = configFields;

	async fetchNewOrders(
		account: ResolvedChannelAccount,
		cursor: string | null
	): Promise<{ orders: ChannelOrderDTO[]; cursor: string | null }> {
		if (isChannelMockEnabled('google')) {
			return buildMockOrders('google', account, cursor);
		}
		// ===== Adapter thật =====
		// TODO: GET content/v2.1/{merchantId}/orders (merchantOrders.list)
		throw notConfiguredError('google');
	}

	async testConnection(account: ResolvedChannelAccount): Promise<{ ok: boolean; message?: string }> {
		if (isChannelMockEnabled('google')) {
			return { ok: true, message: 'Google Shopping mock mode — kết nối giả lập OK' };
		}
		if (!account.credentials.merchantId || !account.credentials.accessToken) {
			return { ok: false, message: 'Thiếu Merchant ID / Access Token' };
		}
		throw notConfiguredError('google');
	}
}

export const googleAdapter = new GoogleAdapter();
