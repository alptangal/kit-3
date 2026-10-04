//$components/form/radiogroup/_interface.ts
// RadioGroup — single-select (native `<input type="radio">`), viết lại theo mẫu
// Checkbox: configs $state + Symbol context + form registration + validation.
import type { BasicConfigs, BasicProps, Color, Size, TimeUnits } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

export type RadioOrientation = 'vertical' | 'horizontal';

/**
 * RadioGroup — single-select radio group (giữ native input radio).
 *
 * `value` bindable (string | null): id option đang chọn.
 * `size` cascade: `props.size ?? formContext?.size ?? client.browser?.size ?? 'md'`.
 * `name` — gom native radio cùng group; tự sinh unique nếu không truyền
 * (sửa bug collision khi nhiều group dùng chung name 'radio-group').
 */
export interface RadioGroupProps extends BasicProps {
	/** Giá trị đang chọn (id option). Bindable. */
	value?: string | null;
	/** Custom native `name` (default: tự sinh unique). */
	name?: string;
	/** Layout dọc/ngang. Mặc định 'vertical'. */
	orientation?: RadioOrientation;
	/** Required — kích hoạt validation required (cần chọn ≥ 1 option). */
	required?: boolean;
	/** Delay validation (ms). */
	delay?: TimeUnits;
	/** Duration animation (ms). */
	duration?: TimeUnits;
	/** Màu gốc (mặc định 'default'; error/success do validation sinh). */
	color?: Color;
	/** Accessible name cho role="radiogroup". */
	'aria-label'?: string;
}

/**
 * RadioItem — một option radio (native input + indicator inline + label).
 * Item đọc Symbol context của group (value / disabled / name / orientation).
 */
export interface RadioItemProps extends BasicProps {
	/** Unique id — native `value` + map chọn option. */
	id: string;
	/** Label hiển thị + `aria-label` native input. */
	label: string;
	/** Mô tả phụ (hàng thứ hai, font nhỏ) — UI hiện đại. */
	description?: TranslateContent | string;
}

export interface RadioGroupConfigs extends Omit<BasicConfigs, 'status' | 'value'> {
	/**
	 * Radio dùng `string | null` (null = chưa chọn) — Omit `value` của
	 * BasicConfigs (string | number) để không conflict, mirror checkbox.
	 * Form serialization đọc `value` (string) → an toàn, không phải File[].
	 */
	value: string | null;
	/** Có mặt để union `FormConfigs.childrens` đồng nhất (form đọc .loading / .focus). */
	loading?: boolean;
	/** Tab-nav của TextField gọi `focus()` — radio dùng roving tabindex, có thể undefined. */
	focus?: () => void;
	status: {
		/** Đã chọn khác so với giá trị ban đầu. */
		changed?: boolean;
		/** Có input đang focus trong group. */
		focus?: boolean;
	};
	previousValue?: string | null;
	/** Native `name` — stable, sinh 1 lần (props.name nếu có). */
	name: string;
	/** Id các item, theo thứ tự mount (= DOM order, static children). */
	ids: string[];
	/** Item-level disabled (item tự đăng ký mount/unmount). SvelteMap — reactive. */
	items: Map<string, { disabled?: boolean }>;
	/** Id item enabled theo DOM order (đã lọc disabled item-level + group). */
	readonly enabledIds: string[];
	/** Id nhận tabindex=0 (selected nếu enabled, không thì item đầu). */
	readonly activeId: string | undefined;
	select: (id: string) => void;
	reset: () => void;
	get style(): (string | undefined)[];
	get size(): Size;
	get color(): Color;
	get disabled(): boolean | undefined;
	get duration(): number;
	get delay(): number | undefined;
	get required(): boolean | undefined;
	get orientation(): RadioOrientation;
	validation: {
		_isValid?: boolean | 'pending';
		isValid: boolean | 'pending' | undefined;
		messages?: Map<string, { content?: TranslateContent; kind: 'valid' | 'invalid' }>;
	};
}
