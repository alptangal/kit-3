// src/lib/components/form/slider/_interface.ts
// FORM FIELD — mirror mẫu textarea/radiogroup: SliderProps extends BasicProps,
// SliderConfigs có `value`/`name`/`loading`/`status.changed`/`validation`/`reset`
// (Form serialize đọc `'value' in children`).
import type { BasicConfigs, BasicProps, Color, Size, TimeUnits } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

/**
 * Slider — form field single-value (native `<input type="range">`).
 *
 * Render: native range input (source of truth + screen-reader/keyboard chuẩn)
 * + visual layer (track/fill/thumb/ticks) phủ cùng box, `pointer-events:none`
 * (input vẫn nhận toàn bộ event — KHÔNG `:has()`, es2020 + safari15).
 *
 * `value` bindable (number) — LUÔN clamp vào [min, max] + snap theo step.
 * Giá trị ngoài range truyền từ page → clamp về biên gần nhất.
 */
export interface SliderProps extends BasicProps {
	/** Giá trị đang chọn — BINDABLE (source of truth), luôn clamp [min, max] + snap step. */
	value?: number;
	/** Giá trị nhỏ nhất (default 0). */
	min?: number;
	/** Giá trị lớn nhất (default 100). */
	max?: number;
	/** Bước nhảy (default 1). */
	step?: number;
	/**
	 * Required — kích hoạt pipeline validation (validator `required`).
	 * Note: slider LUÔN có value (number) → required luôn pass;
	 * prop giữ để form gate + label * indicator đồng bộ mẫu form field.
	 */
	required?: boolean;
	/** Ngưỡng validator `minValue` (value < minValue → invalid, message vi/en). */
	minValue?: number;
	/** Ngưỡng validator `maxValue` (value > maxValue → invalid, message vi/en). */
	maxValue?: number;
	/** Hiển thị marker dọc track (điểm tick đều từ min → max). */
	showTicks?: boolean;
	/** Số đoạn chia track (default 10 → 11 tick). */
	tickCount?: number;
	/** Hiện value bên cạnh track (duplicate decorative, aria-hidden — native value đã báo). */
	showValue?: boolean;
	/** Delay validation (ms / TimeUnits) — cascade `props.delay ?? client.browser?.delay ?? 300`. */
	delay?: TimeUnits;
	/** Duration animation (ms / TimeUnits). */
	duration?: TimeUnits;
	/** HTML id (association cho <Label> tự manage). */
	id?: string;
	/** Override màu semantic (khi không dùng validation auto). */
	color?: Color;
	'aria-label'?: string;
}

export interface SliderConfigs extends Omit<BasicConfigs, 'status' | 'value'> {
	/**
	 * Slider value là NUMBER (khác textarea/radiogroup string) — Form serialize
	 * đọc `'value' in children` → ghi số thẳng vào payload JSON; page muốn chuỗi
	 * thì cast `String(value)` khi serial (CONTRACT §7.5 chỉ string|boolean an toàn).
	 */
	value: number;
	name?: string;
	loading?: boolean;
	required?: boolean;
	min?: number;
	max?: number;
	step?: number;
	minValue?: number;
	maxValue?: number;
	size: Size;
	color: Color;
	disabled?: boolean;
	duration: number;
	delay?: number;
	status: {
		/** dirty so với mốc ban đầu (khi mount) — form submit gate đọc qua formContext.childrens. */
		changed?: boolean;
		/** Native input đang focus. */
		focus?: boolean;
	};
	validation: {
		isValid?: boolean | 'pending';
		messages?: Map<string, { content?: TranslateContent; kind: 'valid' | 'invalid' }>;
	};
	reset: () => void;
	/** Ref native input range — dùng cho focus() (TextField onEnter navigation). */
	ref?: HTMLInputElement;
	/** Focus native input (union form-child field: TextField/Main.svelte:105). */
	focus: () => void;
}
