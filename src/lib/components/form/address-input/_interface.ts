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
}

export type { InputProps };
