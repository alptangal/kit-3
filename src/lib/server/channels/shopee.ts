// $lib/server/channels/shopee.ts
// Shopee Open Platform API (open.shopee.com.vn)
// API thật cần: partner_id + partner_key + shop_id + code ủy quyền.
// Doc: https://open.shopee.com/documents/v2/ (OAuth + order.list)
// HIỆN TẠI: mock mode (CHANNEL_SHOPEE_MOCK, mặc định theo CHANNEL_MOCK_MODE).
//
// Env user điền khi có key (đặt vào .env):
//   CHANNEL_SHOPEE_PARTNER_ID, CHANNEL_SHOPEE_PARTNER_KEY,
//   CHANNEL_SHOPEE_SHOP_ID, CHANNEL_SHOPEE_MOCK=false

import type { ChannelAdapter, ChannelFieldDef, ChannelOrderDTO, ResolvedChannelAccount } from './types';
import { buildMockOrders, isChannelMockEnabled, notConfiguredError } from './mock-util';

const credentialFields: ChannelFieldDef[] = [
	{
		key: 'partnerId',
		label: { vi: 'Partner ID', en: 'Partner ID' },
		inputType: 'number',
		placeholder: { vi: 'VD: 123456', en: 'e.g. 123456' },
		required: true
	},
	{
		key: 'partnerKey',
		label: { vi: 'Partner Key', en: 'Partner Key' },
		inputType: 'password',
		placeholder: { vi: 'Secret key từ Shopee Open Platform', en: 'Secret from Shopee Open Platform' },
		required: true
	},
	{
		key: 'shopId',
		label: { vi: 'Shop ID', en: 'Shop ID' },
		inputType: 'number',
		placeholder: { vi: 'ID gian hàng Shopee', en: 'Shopee shop ID' },
		required: true
	},
	{
		key: 'accessToken',
		label: { vi: 'Access Token (tạm thời)', en: 'Access Token (temporary)' },
		inputType: 'password',
		placeholder: { vi: 'Token sau khi ủy quyền shop', en: 'Token after shop authorization' }
	}
];

const configFields: ChannelFieldDef[] = [
	{
		key: 'warehouseId',
		label: { vi: 'Mã kho xuất hàng', en: 'Warehouse ID' },
		inputType: 'text',
		placeholder: { vi: 'VD: 100001', en: 'e.g. 100001' }
	},
	{
		key: 'autoConfirm',
		label: { vi: 'Tự xác nhận đơn mới', en: 'Auto confirm new orders' },
		inputType: 'checkbox'
	}
];

export class ShopeeAdapter implements ChannelAdapter {
	readonly channel = 'shopee' as const;
	readonly label = { vi: 'Shopee', en: 'Shopee' };
	readonly credentialFields = credentialFields;
	readonly configFields = configFields;

	async fetchNewOrders(
		account: ResolvedChannelAccount,
		cursor: string | null
	): Promise<{ orders: ChannelOrderDTO[]; cursor: string | null }> {
		if (isChannelMockEnabled('shopee')) {
			return buildMockOrders('shopee', account, cursor);
		}
		// ===== Adapter thật — cài đặt khi user có API keys =====
		// TODO: GET https://host/openapi/v2/order/get_order_list
		//   params: partner_id, shop_id, sign (HMAC-SHA256 partnerKey), cursor, page_size
		// Khi đó bỏ dòng throw dưới và cài HTTP call thật.
		throw notConfiguredError('shopee');
	}

	async testConnection(account: ResolvedChannelAccount): Promise<{ ok: boolean; message?: string }> {
		if (isChannelMockEnabled('shopee')) {
			return { ok: true, message: 'Shopee mock mode — kết nối giả lập OK' };
		}
		if (!account.credentials.partnerId || !account.credentials.partnerKey) {
			return { ok: false, message: 'Thiếu Partner ID / Partner Key' };
		}
		// Adapter thật: GET /openapi/v2/shop/get_shop_info + verify shop_id
		throw notConfiguredError('shopee');
	}
}

export const shopeeAdapter = new ShopeeAdapter();
