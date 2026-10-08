// src/lib/components/form/switch/_interface.ts
// FORM FIELD — mirror mẫu checkbox/_interface.ts: SwitchProps extends BasicProps;
// SwitchConfigs extends Omit<BasicConfigs,'status'|'value'> (Switch chỉ có
// `checked` boolean — Form serialize đọc `'checked' in children` → boolean payload).
//
// A11y (khác checkbox): render native <button type="button" role="switch">
// (browser tự handle Space/Enter + focus) → configs KHÔNG cần `event` mousedown
// debounce / handleEvents như checkbox.
import type { BasicConfigs, BasicProps, Color, Size, TimeUnits } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

/**
 * Switch — form field boolean (native `<button role="switch">`).
 *
 * `checked` bindable (boolean) — source of truth. `name` dùng cho Form
 * serialize (boolean vào payload JSON) + validation field name.
 * `label` (TranslateContent | string) hoặc `children` snippet — text cạnh
 * switch; click label → toggle. Không có label/children → `aria-label` bắt buộc.
 */
export interface SwitchProps extends BasicProps {
	/** Giá trị on/off — BINDABLE (source of truth). */
	checked?: boolean;
	/** Tên field (Form serialize boolean + validation message). */
	name?: string;
	/** Text cạnh switch (click → toggle). Rich hơn → dùng `children`. */
	label?: TranslateContent | string;
	/** Icon iconify hiển thị trên thumb (cố định cả on/off nếu không truyền iconOn/iconOff). */
	icon?: string;
	/** Icon iconify khi ON (ưu tiên hơn `icon`) — ghép với iconOff thành cặp đổi state. */
	iconOn?: string;
	/** Icon iconify khi OFF (ưu tiên hơn `icon`) — ghép với iconOn thành cặp đổi state. */
	iconOff?: string;
	/** Màu semantic on-state (default/primary/success/warning/error...). */
	color?: Color;
	/** Kích thước (cascade props → form → browser → 'md'). */
	size?: Size;
	/** Disabled (cascade props → formContext.disabled). */
	disabled?: boolean;
	/** Loading — block interaction + opacity giảm (không block từ formContext). */
	loading?: boolean;
	/** Required — kích hoạt pipeline validation (isValid = checked truthy). */
	required?: boolean;
	/** Delay validation (ms / TimeUnits) — cascade `props.delay ?? browser.delay ?? 300`. */
	delay?: TimeUnits;
	/** Duration animation (ms / TimeUnits). */
	duration?: TimeUnits;
	/**ARIA label (bắt buộc khi không có label/children — icon-only/no-text). */
	'aria-label'?: string;
	/** Tương thích legacy — KHUYẾN KHÍCH dùng `bind:checked`. */
	onchange?: (checked: boolean) => void;
}

export interface SwitchConfigs extends Omit<BasicConfigs, 'status' | 'value'> {
	status: {
		/** dirty so với mốc ban đầu (khi mount / formContext.data) — form status đọc. */
		changed?: boolean;
	};
	/** Giá trị on/off — getter phản chiếu $bindable `checked` (Form serialize đọc). */
	checked?: boolean;
	/** Tên field (Form serialize: `'checked' in children` → `jsonData[name] = checked`). */
	name?: string;
	previousValue?: boolean;
	loading?: boolean;
	required?: boolean;
	delay?: number;
	disabled?: boolean;
	size: Size;
	color: Color;
	duration: number;
	validation: {
		_isValid?: boolean | 'pending';
		isValid?: boolean | 'pending';
		messages?: Map<
			string | ((output?: string) => boolean | Promise<boolean>),
			{ content?: TranslateContent; kind: 'valid' | 'invalid' }
		>;
	};
	reset: () => void;
	focus?: () => void;
}
