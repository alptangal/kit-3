<script lang="ts">
	// src/lib/components/element/tabs/Trigger.svelte
	// Tabs.Trigger — <button role="tab">. ARIA: aria-selected / aria-controls
	// ("tabs-pn-{rootId}-{value}") / aria-disabled; roving focus (tabindex 0 chỉ tab
	// active, -1 tab khác — quản lý bởi List). activation='automatic' (default):
	// FOCUS (click / keyboard arrow) → chọn luôn; 'manual': chỉ Enter/Space/click
	// chọn, focus chỉ di chuyển. icon (iconify name) render qua Icon component
	// (aria-hidden — label đọc bởi text).
	import { styleSynced } from '$modules';
	import { Icon } from '../icon/index.ts';
	import { getTabsContext } from './_context';
	import type { TabsTriggerProps } from './_interface';

	let {
		value,
		disabled = false,
		icon,
		onclick: onClick,
		children,
		...props
	}: TabsTriggerProps = $props();

	const ctx = getTabsContext();
	const active = $derived(ctx?.activeValue === value);
	const rootId = $derived(ctx?.rootId ?? '');

	// $state + bind:this (tránh warning non_reactive_update Svelte 5).
	let el = $state<HTMLElement | undefined>(undefined);

	// Register/unregister ref (Root dùng cho roving focus + Indicator position).
	$effect(() => {
		if (!ctx || !el) return;
		ctx.register(value, el);
		return () => {
			// el narrow không giữ trong closure — guard lại
			if (el) ctx.unregister(value, el);
		};
	});

	const styleDerived = $derived.by(() =>
		styleSynced(
			{
				defaultStyles: [
					'tabs-trigger',
					ctx?.type === 'underline' ? 'type-underline' : undefined,
					active ? 'active' : undefined,
					disabled ? 'disabled' : undefined
				],
				propStyles: props.class
			},
			props.overwriteDefaultStyles
		)
	);

	function handleClick(e: MouseEvent) {
		if (disabled || !ctx) return;
		onClick?.(e);
		ctx.select(value);
	}

	function handleFocusin() {
		// automatic: FOCUS → chọn luôn. manual: focus chỉ di chuyển.
		if (disabled || !ctx) return;
		if (ctx.activation === 'automatic') ctx.select(value);
	}

	function handleKeydown(e: KeyboardEvent) {
		// manual: Enter/Space chọn (preventDefault suppress native click double-select).
		if (disabled || !ctx || ctx.activation !== 'manual') return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			ctx.select(value);
		}
	}
</script>

<button
	type="button"
	role="tab"
	id={`tabs-tr-${rootId}-${value}`}
	data-tabs-value={value}
	aria-selected={active}
	aria-controls={`tabs-pn-${rootId}-${value}`}
	aria-disabled={disabled || undefined}
	{disabled}
	class={styleDerived}
	tabindex={active ? 0 : -1}
	bind:this={el}
	onclick={handleClick}
	onfocusin={handleFocusin}
	onkeydown={handleKeydown}
	{...props}
>
	{#if icon}
		<Icon icon={icon} class="tabs-trigger__icon" />
	{/if}
	{#if children}
		<span class="tabs-trigger__label">{@render children()}</span>
	{/if}
</button>

<style lang="scss">
	.tabs-trigger {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		min-height: 2.25rem;
		padding-inline: 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.25rem;
		color: var(--muted, var(--foreground));
		background: transparent;
		border: 0;
		border-radius: var(--border-radius-full, 999px);
		cursor: var(--cursor-interactive);
		user-select: none;
		white-space: nowrap;
		touch-action: manipulation;
		transition:
			background-color var(--duration, 300ms) cubic-bezier(0.65, 0, 0.35, 1),
			color var(--duration, 300ms) cubic-bezier(0.65, 0, 0.35, 1);

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: 2px;
		}

		@media (hover: hover) and (pointer: fine) {
			&:not(.disabled):not(.active):hover {
				color: var(--foreground);
			}
		}

		// ── type 'default' (pill container, active = nền background + shadow) ──
		&:not(.type-underline) {
			&.active {
				color: var(--foreground);
				background-color: var(--background);
				box-shadow: var(--box-shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05));
			}
		}

		// ── type 'underline' (trigger plain, active = foreground + indicator) ──
		&.type-underline {
			border-radius: 0;

			&.active {
				color: var(--primary, var(--foreground));
			}
		}

		&.disabled {
			opacity: var(--disabled-opacity, 0.5);
			cursor: var(--cursor-disabled);
			pointer-events: none;
		}

		.tabs-trigger__icon {
			display: inline-flex;
			font-size: 1rem;
			color: inherit;
		}
	}
</style>
