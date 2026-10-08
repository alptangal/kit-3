<script lang="ts">
	// src/lib/components/element/toggle/Main.svelte
	// Toggle (element — KHÔNG phải form field): nút nhấn 2 trạng thái pressed/unpressed,
	// theo shadcn base/toggle (pressed state + variant default/outline + size sm/default/lg).
	// Atom nhẹ (mẫu alert/tag/button): $derived cho style — không context, không form.
	//
	// A11y: native button type=button + aria-pressed (browser tự handle
	// Space/Enter + focus) → KHÔNG cần keydown handler riêng. KHÔNG role="switch"
	// (switch là form field riêng ở form/switch — toggle base chỉ pressed state).
	//
	// Controlled/uncontrolled: `pressed` $bindable — bind:pressed → controlled
	// (parent giữ source of truth); không bind → uncontrolled ($state cục bộ,
	// toggle() đổi nội bộ). `onchange` callback cả 2 mode.
	//
	// Icon: prop `icon` (iconify) hiển thị cạnh text (span.toggle-icon → Icon
	// component, aria-hidden). Không label/children → icon-only (aria-label bắt buộc).
import { styleSynced } from '$modules';
import { handleEvents } from '$modules/_attachments';
import { client } from '$store/basic.svelte';
// Import TRỰC TIẾP icon/Main.svelte — KHÔNG qua barrel element/index.ts
// (barrel kéo cả DropdownMenu/Modal/Toast... vào → vòng tròn import ở layer mới).
import { Icon } from '$components/element/icon';
import type { Color } from '$components/interface';
import type { ToggleConfigs, ToggleProps, ToggleSize, ToggleVariant } from './_interface';
import type { TranslateContent } from '$interfaces/basic';

let {
	pressed = $bindable(false),
	variant,
	size,
	color,
	icon,
	disabled,
	label,
	class: classProp,
	overwriteDefaultStyles,
	events,
	children,
	...props
}: ToggleProps = $props();

// `pressed` $bindable(false): parent bind:pressed → 2 chiều (controlled, parent
// giữ source of truth qua binding); parent KHÔNG bind → `pressed` hoạt động như
// $state cục bộ (uncontrolled — component tự sở hữu, toggle() đổi nội bộ).
// KHÔNG cần state nội bộ riêng — $bindable tự xử lý cả 2 mode (mẫu Switch checked).
const pressedDerived = $derived(pressed);

const lang = $derived(client.browser?.language ?? 'en');

// Label: TranslateContent | string (giữ convention alert title/description)
const labelText = $derived.by(() => {
	if (!label) return undefined;
	if (typeof label === 'string') return label;
	const text = (label as TranslateContent)[lang] ?? (label as TranslateContent).en ?? (label as TranslateContent).vi;
	return text ? text : undefined;
});

// aria-label: prop trực tiếp, fallback text label. Không có label/children + không
// aria-label → undefined (icon-only BẮT buộc truyền `aria-label` — contract §6).
const ariaLabel = $derived(props['aria-label'] ?? labelText);

const variantDerived = $derived<ToggleVariant>(variant ?? 'default');
const sizeDerived = $derived<ToggleSize>(size ?? 'default');
const colorDerived = $derived<Color>(color ?? 'default');
const disabledDerived = $derived(disabled ?? false);

function toggle() {
	if (disabledDerived) return;
	pressed = !pressedDerived;
	props.onchange?.(!pressedDerived);
}

const styleDerived = $derived.by(() => {
	const defaultStyles: (string | undefined)[] = [
		'toggle-root',
		`variant-${variantDerived}`,
		`size-${sizeDerived}`,
		`color-${colorDerived}`,
		pressedDerived ? 'pressed' : undefined,
		disabledDerived ? 'disabled' : undefined
	];
	return styleSynced({ defaultStyles, propStyles: classProp }, overwriteDefaultStyles);
});

let configs: ToggleConfigs = $state({
	get style() {
		return styleDerived;
	},
	get event() {
		return events;
	},
	get size() {
		return sizeDerived;
	},
	get color() {
		return colorDerived;
	},
	get variant() {
		return variantDerived;
	},
	get pressed() {
		return pressedDerived;
	},
	get disabled() {
		return disabledDerived;
	},
	get label() {
		return labelText;
	}
});

export { configs };
</script>

<button
	type="button"
	aria-pressed={pressedDerived ? 'true' : 'false'}
	aria-label={ariaLabel}
	disabled={disabledDerived || undefined}
	class={configs.style}
	data-test="toggle-button"
	onclick={toggle}
	{@attach handleEvents(configs.event)}
>
	{#if icon}
		<span class="toggle-icon" aria-hidden="true">
			<Icon icon={icon} />
		</span>
	{/if}
	{#if children}
		{@render children?.()}
	{:else if labelText}
		<span class="toggle-label">{labelText}</span>
	{/if}
</button>

<style lang="scss">
	@use '_styles.scss';
</style>
