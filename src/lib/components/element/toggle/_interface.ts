// src/lib/components/element/toggle/_interface.ts
// Toggle (element — KHÔNG phải form field): nút nhấn 2 trạng thái pressed/unpressed,
// theo shadcn base/toggle (pressed state + variant default/outline + size sm/default/lg).
// Atom nhẹ (mẫu alert/tag): $derived cho style — không context, không form, không validate.
//
// A11y: native <button type="button"> + aria-pressed (không role="switch" —
// switch là form field riêng ở form/switch; toggle base chỉ "đã nhấn/chưa nhấn").
// Keyboard: Space/Enter native button behavior (browser tự handle) → không cần
// keydown handler riêng. Icon aria-hidden (trang trí).
import type { BasicConfigs, BasicProps, Color, Size } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

/** Variant bề mặt toggle — đồng bộ ngôn ngữ variant của Button (solid/outline). */
export type ToggleVariant = 'default' | 'outline';
/** Kích thước toggle base — shadcn sm/default/lg (map về token size-* hệ thống). */
export type ToggleSize = 'sm' | 'default' | 'lg';

/**
 * Toggle — nút nhấn 2 trạng thái (element, aria-pressed).
 *
 * `pressed` bindable (boolean) — source of truth. Controlled qua
 * `bind:pressed` hoặc uncontrolled (component tự giữ state nội bộ).
 * `label` (TranslateContent | string) hoặc `children` snippet — text trong nút.
 * Không có label/children → `aria-label` bắt buộc (icon-only).
 */
export interface ToggleProps extends Omit<BasicProps, 'size'> {
	/** Trạng thái đã nhấn — BINDABLE (source of truth). */
	pressed?: boolean;
	/** Bề mặt (default = nền nhạt đổi màu khi pressed; outline = viền + nền trong suốt). */
	variant?: ToggleVariant;
	/** Kích thước (sm/default/lg — cascade props → browser → 'default'). */
	size?: ToggleSize;
	/** Màu semantic khi pressed (default/primary/success/warning/error...). */
	color?: Color;
	/** Icon iconify hiển thị cạnh text (hoặc icon-only khi không label/children). */
	icon?: string;
	/** Disabled (cascade props → formContext.disabled). */
	disabled?: boolean;
	/** Text trong nút (rich hơn → dùng `children`). */
	label?: TranslateContent | string;
	/** ARIA label (bắt buộc khi không có label/children — icon-only). */
	'aria-label'?: string;
	/** Tương thích legacy — KHUYẾN KHÍCH dùng `bind:pressed`. */
	onchange?: (pressed: boolean) => void;
}
export interface ToggleConfigs extends Omit<BasicConfigs, 'size'> {
	/** Trạng thái đã nhấn — getter phản chiếu $bindable `pressed`. */
	pressed?: boolean;
	variant?: ToggleVariant;
	size?: ToggleSize;
	color?: Color;
	disabled?: boolean;
	loading?: boolean;
	label?: string;
}
