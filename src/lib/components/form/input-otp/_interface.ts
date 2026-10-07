// src/lib/components/form/input-otp/_interface.ts
// FORM FIELD — mirror mẫu textarea: InputOtpProps extends BasicProps;
// InputOtpConfigs có `value`/`name`/`loading`/`validation`/`reset` (Form serialize
// đọc `'value' in children` → string an toàn).
import type { BasicConfigs, BasicProps, Color, Size, TimeUnits } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

/** 'numeric' → chỉ nhận số (inputmode=numeric + filter oninput); 'text' → ký tự thường (không whitespace). */
export type OtpType = 'text' | 'numeric';

export interface InputOtpProps extends BasicProps {
	/** Mã OTP — BINDABLE (string compact của các ô, form serialize an toàn). */
	value?: string;
	/** Số ô hiển thị, default 6. */
	length?: number;
	/** Loại ký tự nhận: 'numeric' (mặc định) | 'text'. */
	type?: OtpType;
	/** Bắt buộc → validation "đủ `length` ký tự" + màu validation tự động. */
	required?: boolean;
	/** Hiện nút xóa nhanh toàn bộ (bên phải các ô) khi ≥ 1 ô chứa dữ liệu. Default false. */
	clearable?: boolean;
	size?: Size;
	color?: Color;
	duration?: TimeUnits;
	/** Delay validation (ms / TimeUnits) — cascade `props.delay ?? client.browser?.delay ?? 300`. */
	delay?: TimeUnits;
	/** ARIA label cho group + prefix cho label từng ô. */
	'aria-label'?: string;
}

export interface InputOtpConfigs extends Omit<BasicConfigs, 'status' | 'value'> {
	value: string;
	name?: string;
	loading?: boolean;
	required?: boolean;
	clearable?: boolean;
	length?: number;
	type?: OtpType;
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
