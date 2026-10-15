// $lib/server/channels/types.ts
// Types dùng chung cho hệ thống đồng bộ bán hàng đa kênh (omnichannel).
//
// Mỗi nền tảng (Shopee/TikTok Shop/Facebook/Lazada/Threads/Instagram/
// Telegram/Discord/Google) cài đặt interface ChannelAdapter.
// Vì user CHƯA có API keys thật, mọi adapter chạy ở chế độ MOCK mặc định:
//   - CHANNEL_MOCK_MODE=false   → tắt mock toàn cục (mỗi kênh mới gọi API thật)
//   - CHANNEL_<NAME>_MOCK=true  → bật mock riêng kênh (phủ up mock toàn cục)
// Mock trả về 1-2 đơn mẫu để test flow e2e (sync → import → link order).
// Khi user điền API keys thật vào .env + tắt mock, adapter thật sẽ được
// cài đặt dần vào từng file mà KHÔNG cần sửa service/UI (config-driven).

/** Danh sách kênh được hỗ trợ (khớp channel_accounts.channel). */
export const CHANNEL_IDS = [
	'shopee',
	'tiktok_shop',
	'facebook',
	'google',
	'lazada',
	'threads',
	'instagram',
	'telegram',
	'discord'
] as const;

export type ChannelId = (typeof CHANNEL_IDS)[number];

/** 1 đơn hàng lấy được từ nền tảng (chuẩn hoá, chưa lưu DB). */
export interface ChannelOrderDTO {
	/** Mã đơn trên nền tảng (Shopee order_sn, TikTok order_id...). */
	channelOrderId: string;
	/** Tên khách mua trên kênh (có thể ẩn danh: "Nguyễn Văn A**"). */
	customerName?: string;
	phone?: string;
	address?: string;
	/** Mỗi item khớp SKU nội bộ qua channelSku. */
	items: {
		variantId?: string;
		channelSku: string;
		name: string;
		quantity: number;
		unitPrice: number;
	}[];
	totalAmount: number;
	/** Mặc định 'VND'. */
	currency?: string;
	shippingFee?: number;
	/** Payload gốc từ nền tảng — lưu lại để debug/replay. */
	rawPayload?: Record<string, unknown>;
	/** Thời gian tạo đơn trên nền tảng (ISO string). */
	placedAt?: string;
}

/** Credentials/config đã giải mã của 1 account (chỉ dùng bên trong server). */
export interface ResolvedChannelAccount {
	documentKey: string;
	channel: ChannelId;
	name: string;
	status: string;
	shopId?: string | null;
	syncCursor?: string | null;
	config: Record<string, unknown>;
	credentials: Record<string, string>;
}

/**
 * Interface mỗi kênh phải cài đặt.
 * - fetchNewOrders: lấy đơn MỚI kể từ cursor (tăng dần theo thời gian).
 *   Trả về DTO list + cursor mới (để lần sau lấy tiếp).
 *   KHÔNG cập nhật DB — service lo việc đó (tách I/O khỏi adapter → dễ test).
 * - testConnection: kiểm tra credentials hợp lệ (tuỳ chọn — nếu nền tảng
 *   có endpoint healthcheck thì cài, không thì trả về noop).
 */
export interface ChannelAdapter {
	readonly channel: ChannelId;
	/** Nhãn hiển thị + mô tả kênh (UI dùng). */
	readonly label: { vi: string; en: string };
	/** Định nghĩa fields credentials — UI sinh form connect từ đây. */
	readonly credentialFields: ChannelFieldDef[];
	/** Định nghĩa fields config thêm (không phải secret). */
	readonly configFields: ChannelFieldDef[];
	fetchNewOrders(
		account: ResolvedChannelAccount,
		cursor: string | null
	): Promise<{ orders: ChannelOrderDTO[]; cursor: string | null }>;
	testConnection?(account: ResolvedChannelAccount): Promise<{ ok: boolean; message?: string }>;
}

/** 1 field trong form connect (credentials hoặc config). */
export interface ChannelFieldDef {
	key: string;
	label: { vi: string; en: string };
	/** 'text' | 'password' | 'number' | 'select' | 'checkbox' */
	inputType: 'text' | 'password' | 'number' | 'select' | 'checkbox';
	options?: { value: string; label: { vi: string; en: string } }[];
	placeholder?: { vi: string; en: string };
	required?: boolean;
}
