// $lib/server/channels/mock-util.ts
// Helper dùng chung cho các adapter mock + mock config từ env động.

import { env } from '$env/dynamic/private';
import type { ChannelId, ChannelOrderDTO, ResolvedChannelAccount } from './types';

/**
 * Mock mode mặc định BẬT khi chưa set (dev chưa có API keys).
 * - CHANNEL_MOCK_MODE === 'false' → mock toàn cục TẮT (kênh nào bật mock riêng mới mock)
 * - CHANNEL_<NAME>_MOCK === 'true'  → kênh đó mock bất kể toàn cục
 * - CHANNEL_<NAME>_MOCK === 'false' → kênh đó KHÔNG mock (gọi API thật khi có adapter thật)
 */
export function isChannelMockEnabled(channel: ChannelId): boolean {
	const perChannel = env[`CHANNEL_${channel.toUpperCase()}_MOCK`];
	if (perChannel === 'true') return true;
	if (perChannel === 'false') return false;
	return env.CHANNEL_MOCK_MODE !== 'false';
}

/** Báo lỗi khi adapter thật chưa cài đặt cho kênh (không có mock + chưa có key). */
export function notConfiguredError(channel: ChannelId): Error {
	return new Error(
		`channel-not-configured: Kênh "${channel}" chưa có API key/adapter thật. ` +
			`Điền CHANNEL_${channel.toUpperCase()}_* vào .env hoặc bật CHANNEL_${channel.toUpperCase()}_MOCK=true để test.`
	);
}

/**
 * Sinh 1-2 đơn mẫu cho mock mode — data quay vòng theo cursor để mỗi lần sync
 * luôn có đơn mới (test flow "sync tăng dần" đúng thật).
 */
export function buildMockOrders(
	channel: ChannelId,
	account: ResolvedChannelAccount,
	cursor: string | null
): { orders: ChannelOrderDTO[]; cursor: string | null } {
	// Cursor mock = số lượt sync đã chạy
	const round = Number(cursor ?? '0');
	const nextCursor = String(round + 1);
	// Sau 3 lượt thì hết đơn mới (giống thật — không phải lúc nào cũng có đơn)
	if (round >= 3) return { orders: [], cursor: null };

	const nowIso = new Date().toISOString();
	const orders: ChannelOrderDTO[] = [
		{
			channelOrderId: `${channel.toUpperCase()}-MOCK-${round}-1`,
			customerName: `Khách mock ${channel} #${round}`,
			phone: '0900000000',
			address: '123 Đường Mock, Quận 1, TP.HCM',
			items: [
				{
					channelSku: channel === 'shopee' ? 'MOCK-SKU-001' : 'MOCK-SKU-002',
					name: 'Sản phẩm demo đơn kênh',
					quantity: round + 1,
					unitPrice: 150000
				}
			],
			totalAmount: (round + 1) * 150000,
			currency: 'VND',
			shippingFee: 20000,
			rawPayload: { mock: true, channel, round, accountName: account.name },
			placedAt: nowIso
		}
	];
	// Lượt đầu 2 đơn — test list có nhiều dòng
	if (round === 0) {
		orders.push({
			channelOrderId: `${channel.toUpperCase()}-MOCK-${round}-2`,
			customerName: `Khách mock ${channel} #${round} (đơn 2)`,
			phone: '0911111111',
			items: [
				{
					channelSku: 'MOCK-SKU-001',
					name: 'Sản phẩm demo đơn kênh',
					quantity: 2,
					unitPrice: 150000
				}
			],
			shippingFee: 0,
			totalAmount: 300000,
			currency: 'VND',
			rawPayload: { mock: true, channel, round, accountName: account.name },
			placedAt: nowIso
		});
	}
	return { orders, cursor: nextCursor };
}
