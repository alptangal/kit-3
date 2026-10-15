// $lib/server/channels/tiktok-shop.ts
// TikTok Shop API (open.tiktokapis.com) — cần app_key/app_secret + access_token
// (OAuth) + shop cipher. Doc: https://partner.tiktokshop.com/docv2/
// HIỆN TẠI: mock mode (CHANNEL_TIKTOK_SHOP_MOCK, mặc định theo CHANNEL_MOCK_MODE).
//
// Env khi có key:
//   CHANNEL_TIKTOK_SHOP_APP_KEY, CHANNEL_TIKTOK_SHOP_APP_SECRET,
//   CHANNEL_TIKTOK_SHOP_ACCESS_TOKEN, CHANNEL_TIKTOK_SHOP_MOCK=false

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
	},
	{
		key: 'shopCipher',
		label: { vi: 'Shop Cipher', en: 'Shop Cipher' },
		inputType: 'text',
		placeholder: { vi: 'Mã gian hàng TikTok (cipher)', en: 'TikTok shop cipher code' },
		required: true
	}
];

const configFields: ChannelFieldDef[] = [
	{
		key: 'warehouseId',
		label: { vi: 'Mã kho xuất hàng', en: 'Warehouse ID' },
		inputType: 'text'
	},
	{
		key: 'autoConfirm',
		label: { vi: 'Tự xác nhận đơn mới', en: 'Auto confirm new orders' },
		inputType: 'checkbox'
	}
];

export class TikTokShopAdapter implements ChannelAdapter {
	readonly channel = 'tiktok_shop' as const;
	readonly label = { vi: 'TikTok Shop', en: 'TikTok Shop' };
	readonly credentialFields = credentialFields;
	readonly configFields = configFields;

	async fetchNewOrders(
		account: ResolvedChannelAccount,
		cursor: string | null
	): Promise<{ orders: ChannelOrderDTO[]; cursor: string | null }> {
		if (isChannelMockEnabled('tiktok_shop')) {
			return buildMockOrders('tiktok_shop', account, cursor);
		}
		// ===== Adapter thật =====
		// TODO: POST https://open.tiktokapis.com/v2/order/list/search
		//   headers: x-tts-access-token; params: shop_cipher, page_size, cursor
		throw notConfiguredError('tiktok_shop');
	}

	async testConnection(account: ResolvedChannelAccount): Promise<{ ok: boolean; message?: string }> {
		if (isChannelMockEnabled('tiktok_shop')) {
			return { ok: true, message: 'TikTok Shop mock mode — kết nối giả lập OK' };
		}
		if (!account.credentials.accessToken || !account.credentials.shopCipher) {
			return { ok: false, message: 'Thiếu Access Token / Shop Cipher' };
		}
		throw notConfiguredError('tiktok_shop');
	}
}

export const tiktokShopAdapter = new TikTokShopAdapter();
