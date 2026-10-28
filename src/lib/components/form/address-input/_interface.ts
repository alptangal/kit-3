import type { InputProps } from '../input/_interface';

/** Địa chỉ đã nhận dạng — chọn qua select/option từ data VN */
export interface AddressBreakdown {
	province: string;
	district: string;
	/** Phường/Xã — từ static/data/vn-geo-wards.json (2026-10-21) */
	ward?: string;
}

/** Địa chỉ theo hệ ĐVHC MỚI (34 tỉnh, 2 cấp tỉnh→xã, sau sáp nhập 2025) */
export interface NewAddressBreakdown {
	province: string;
	ward: string;
}

export interface AddressInputProps {
	/** Chuỗi địa chỉ chi tiết (số nhà, tên đường...) — 2 chiều */
	value?: string;
	/** Địa chỉ đã nhận dạng — 2 chiều (parent bind) */
	breakdown?: AddressBreakdown;
	/** Địa chỉ hệ MỚI (bind → bật toggle cũ/mới + gen 2 chiều qua mapping) */
	newBreakdown?: NewAddressBreakdown;
	/** Nhãn hiển thị */
	label?: string;
	placeholder?: string;
	disabled?: boolean;
	/** Batch 16 (mục 8): breadcrumb 3 cấp trong header step modal (mobile) — chỉ
	 *  render khi breadcrumbHome có giá trị (trang khác không truyền → không đổi gì) */
	breadcrumbHome?: string | null;
	/** Phần 2 — tên bản ghi (vd tên supplier) / nhãn hành động (vd 'Create') */
	breadcrumbName?: string | null;
	/** Phần 3 — mặc định i18n 'Địa chỉ'/'Address' khi null và breadcrumbHome có giá trị */
	breadcrumbCurrent?: string | null;
	/** Tap phần 1 (home) → callback (trang suppliers: đóng TẤT CẢ modal về datatable) */
	onBreadcrumbHomeTap?: () => void;
	/** Batch 17: tap phần 2 (name/create) → callback riêng (mặc định dùng
	 *  onBreadcrumbHomeTap — trang chỉ cần quay lại form thì không cần truyền) */
	onBreadcrumbNameTap?: () => void;
}

export type { InputProps };
