<script lang="ts">
	// src/lib/components/element/accordion/Trigger.svelte
	// Accordion.Trigger — <button class="accordion-trigger"> aria-expanded /
	// aria-controls="acc-ct-{rootId}-{value}"; id="acc-hd-{rootId}-{value}"
	// (Content aria-labelledby). onclick → ctx.toggle(value) (Root là source of
	// truth logic single/multiple + collapsible). icon (iconify) + chevron
	// inline svg 16px (rotate 180 khi open, transition transform var(--duration)).
	// disabled → aria-disabled + không toggle.
	import { styleSynced } from '$modules';
	import { Icon } from '../icon/index.ts';
	import { getAccordionContext, getAccordionItemContext } from './_context';
	import type { AccordionTriggerProps } from './_interface';

	let { icon, disabled = false, onclick: onClick, children, ...props }: AccordionTriggerProps = $props();

	const ctx = getAccordionContext();
	const item = getAccordionItemContext();
	// value từ ITEM context (Item parent) — Trigger/Content cùng 1 item dùng 1 id.
	const value = $derived(item?.value ?? '');
	const rootId = $derived(ctx?.rootId ?? '');
	// isOpen gọi từ $derived → track value (Root) → aria-expanded reactive.
	const open = $derived(value ? ctx?.isOpen(value) ?? false : false);
	// disabled merge: props.disabled (component) + BasicProps.disabled
	const isDisabled = $derived(disabled);

	const styleDerived = $derived.by(() =>
		styleSynced(
			{
				defaultStyles: ['accordion-trigger', open ? 'open' : undefined, isDisabled ? 'disabled' : undefined],
				propStyles: props.class
			},
			props.overwriteDefaultStyles
		)
	);

	function handleClick(e: MouseEvent) {
		if (isDisabled || !ctx || !value) return;
		onClick?.(e);
		ctx.toggle(value);
	}
</script>

<button
	type="button"
	id={`acc-hd-${rootId}-${value}`}
	data-accordion-value={value}
	aria-expanded={open}
	aria-controls={`acc-ct-${rootId}-${value}`}
	aria-disabled={isDisabled || undefined}
	class={styleDerived}
	onclick={handleClick}
	{...props}
>
	{#if icon}
		<Icon icon={icon} class="accordion-trigger__icon" />
	{/if}
	{#if children}
		<span class="accordion-trigger__label">{@render children()}</span>
	{/if}
	<svg
		class="accordion-trigger__chevron"
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<polyline points="6 9 12 15 18 9" />
	</svg>
</button>

<style lang="scss">
	.accordion-trigger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.75rem 0;
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.5;
		color: var(--foreground);
		text-align: start;
		background: transparent;
		border: 0;
		cursor: var(--cursor-interactive);
		user-select: none;
		touch-action: manipulation;

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: 2px;
			border-radius: 0.25rem;
		}

		@media (hover: hover) and (pointer: fine) {
			&:not(.disabled):hover {
				color: var(--foreground);
				opacity: 0.85;
			}
		}

		&.disabled {
			opacity: var(--disabled-opacity, 0.5);
			cursor: var(--cursor-disabled);
			pointer-events: none;
		}

		.accordion-trigger__icon {
			display: inline-flex;
			font-size: 1rem;
			color: inherit;
		}

		.accordion-trigger__label {
			flex: 1;
		}

		.accordion-trigger__chevron {
			flex-shrink: 0;
			color: var(--muted, var(--foreground));
			transition: transform var(--duration, 300ms) cubic-bezier(0.65, 0, 0.35, 1);

			@media (prefers-reduced-motion: reduce) {
				transition: none;
			}
		}

		&.open .accordion-trigger__chevron {
			transform: rotate(180deg);
		}
	}
</style>
