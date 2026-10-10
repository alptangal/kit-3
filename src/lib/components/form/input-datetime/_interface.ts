// src/lib/components/form/input-datetime/_interface.ts
// FORM FIELD — mirror mẫu input-otp: InputDatetimeProps extends BasicProps;
// InputDatetimeConfigs có `value`/`name`/`loading`/`validation`/`reset` (Form serialize
// đọc `'value' in children` → string an toàn).
import type { BasicConfigs, BasicProps, Color, Size, TimeUnits } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

/**
 * Nhóm ô hiển thị, theo thứ tự tuần tự: năm (4 số) → tháng (2) → ngày (2)
 * → giờ (2) → phút (2). Value ISO `YYYY-MM-DDTHH:MM`.
 */
export interface InputDatetimeProps extends BasicProps {
	/** Giá trị ISO `YYYY-MM-DDTHH:MM` — BINDABLE (form serialize an toàn). */
	value?: string;
	/** Bắt buộc → validation "đủ + ngày hợp lệ" + màu validation tự động. */
	required?: boolean;
	/** Hiện nút xóa nhanh toàn bộ (bên phải các ô) khi ≥ 1 ô chứa dữ liệu. Default false. */
	clearable?: boolean;
	/** Ẩn nhóm GIỜ (giờ + phút) — chỉ nhập ngày. Default false. */
	hideTime?: boolean;
	size?: Size;
	color?: Color;
	duration?: TimeUnits;
	/** Delay validation (ms / TimeUnits) — cascade `props.delay ?? client.browser?.delay ?? 300`. */
	delay?: TimeUnits;
	/** ARIA label cho group + prefix cho label từng ô. */
	'aria-label'?: string;
}

export interface InputDatetimeConfigs extends Omit<BasicConfigs, 'status' | 'value'> {
	value: string;
	name?: string;
	loading?: boolean;
	required?: boolean;
	clearable?: boolean;
	hideTime?: boolean;
	size: Size;
	color: Color;
	disabled?: boolean;
	duration: number;
	delay?: number;
	status: {
		/** dirty so với mốc ban đầu — Button/Form submit disabled-logic đọc qua formContext.childrens */
		changed?: boolean;
		focus?: boolean;
	};
	validation: {
		isValid?: boolean | 'pending';
		messages?: Map<string, { content?: TranslateContent; kind: 'valid' | 'invalid' }>;
	};
	reset: () => void;
}
