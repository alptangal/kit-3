<script lang="ts">
	// src/lib/components/element/hover-card/Content.svelte
	// HoverCard.Content — card nổi (role="tooltip") absolute bên DƯỚI trigger
	// (position absolute trong Root — Root là position:relative, KHÔNG portal).
	// Keep-alive: chuột vào card huỷ timer hide; rời card → hide (grace 150ms).
	// KHÔNG focus trap (tooltip — content chỉ đọc, không bắt focus). ESC → hide
	// (listener ở Root). Duration animation (prop duration, default 200ms) đọc từ
	// context → truyền inline --hc-duration.
	import { styleSynced } from '$modules';
	import { getHoverCardContext } from './_context';
	import type { HoverCardContentProps } from './_interface';

	let {
		children,
		'aria-label': ariaLabel,
		...props
	}: HoverCardContentProps = $props();

	const ctx = getHoverCardContext();
	const open = $derived(ctx?.open ?? false);
	const contentId = $derived(ctx?.contentId ?? '');
	const duration = $derived(ctx?.duration ?? 200);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = ['hover-card-content', open ? 'open' : undefined];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	// Keep-alive intent: chuột vào card huỷ timer hide; ra ngoài card → hide.
	function handleMouseEnter() {
		ctx?.cancelHide();
	}
	function handleMouseLeave() {
		ctx?.hide();
	}
</script>

{#if open}
	<div
		class={styleDerived}
		id={contentId}
		role="tooltip"
		aria-label={ariaLabel}
		style:--hc-duration={`${duration}ms`}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	>
		<span class="hover-card-arrow" aria-hidden="true"></span>
		{@render children?.()}
	</div>
{/if}

<style lang="scss">
	.hover-card-content {
		--hover-card-arrow-size: 0.75rem; // 12px

		position: absolute;
		top: calc(100% + var(--hover-card-gap, 8px));
		left: 0;
		z-index: 999;
		padding: 0.75rem 1rem;
		min-width: 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--muted, var(--foreground));
		background-color: var(--background, #fff);
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: var(--border-radius-md, 0.375rem);
		box-shadow: var(--box-shadow-lg, 0 10px 15px -3px var(--shadow-color, rgb(0 0 0 / 0.1)));

		// Arrow: ô vuông 12px xoay 45°, 2 cạnh (top+left) tạo "mũi" chỉ lên.
		.hover-card-arrow {
			position: absolute;
			top: calc(var(--hover-card-arrow-size) / -2); // -6px
			left: 1.25rem; // 20px (khớp padding-inline card)
			width: var(--hover-card-arrow-size);
			height: var(--hover-card-arrow-size);
			background-color: var(--background, #fff);
			border: 1px solid var(--border, hsl(240 5.9% 90%));
			border-right: 0;
			border-bottom: 0;
			border-top-left-radius: calc(var(--border-radius-sm, 0.25rem) / 2);
			transform: rotate(45deg);
		}

		animation: hover-card-appear var(--hc-duration, 200ms) cubic-bezier(0.16, 1, 0.3, 1);

		@media (prefers-color-scheme: dark) {
			border-color: hsl(240 5.9% 20%);

			.hover-card-arrow {
				border-color: hsl(240 5.9% 20%);
				background-color: var(--background, hsl(240 10% 10%));
			}
		}

		@media (prefers-reduced-motion: reduce) {
			animation: none;
		}
	}

	@keyframes hover-card-appear {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}

		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
