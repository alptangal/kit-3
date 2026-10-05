<script lang="ts">
	// src/lib/components/element/popover/Content.svelte
	// Popover.Content — panel nổi (role="dialog") anchor bên DƯỚI trigger
	// (position absolute trong Root — Root là position:relative, KHÔNG portal).
	// Căn theo position: start (left:0) / end (right:0) / center (left:50% - 50%).
	// Arrow = ô vuông 12px xoay 45° trên mép trên. Khi open: focus focusable đầu
	// trong panel (setTimeout 0). Mode hover: chuột vào panel giữ mở (intent
	// keep-alive) — gọi hoverEnter/hoverLeave của Root.
	import { browser } from '$app/environment';
	import { styleSynced } from '$modules';
	import { getPopoverContext } from './_context';
	import type { PopoverContentProps } from './_interface';

	let {
		children,
		'aria-label': ariaLabel,
		...props
	}: PopoverContentProps = $props();

	const ctx = getPopoverContext();
	const open = $derived(ctx?.open ?? false);
	const contentId = $derived(ctx?.contentId ?? '');
	const position = $derived(ctx?.position ?? 'start');

	let contentEl = $state<HTMLDivElement | undefined>(undefined);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'popover-content',
			`position-${position}`,
			open ? 'open' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	// Khi mở: focus focusable đầu tiên trong panel (mở bằng trigger click/keyboard).
	// Mode hover KHÔNG focus — chuột đang hover, lấy focus làm hỏng scroll/trỏ chuột.
	$effect(() => {
		if (!browser || !open || !contentEl || ctx?.trigger === 'hover') return;
		const id = setTimeout(() => {
			contentEl
				?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
				?.focus();
		}, 0);
		return () => clearTimeout(id);
	});

	// Keep-alive intent: chuột vào panel huỷ timer hide; ra ngoài panel → hide.
	// (Chỉ trigger="hover"; mode click/focus do outside-click/ESC ở Root xử lý.)
	function handleMouseEnter() {
		if (ctx?.trigger === 'hover') ctx.hoverEnter();
	}
	function handleMouseLeave() {
		if (ctx?.trigger === 'hover') ctx.hoverLeave();
	}
</script>

{#if open}
	<div
		bind:this={contentEl}
		class={styleDerived}
		id={contentId}
		role="dialog"
		aria-label={ariaLabel}
		aria-hidden={open ? undefined : 'true'}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	>
		<span class="popover-arrow" aria-hidden="true"></span>
		{@render children?.()}
	</div>
{/if}

<style lang="scss">
	.popover-content {
		--popover-arrow-size: 0.75rem; // 12px

		position: absolute;
		top: calc(100% + var(--popover-gap, 8px));
		z-index: 1000;
		padding: 1rem;
		color: var(--foreground);
		background-color: var(--background, #fff);
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: var(--border-radius-md, 0.375rem);
		box-shadow: var(--box-shadow-lg, 0 10px 15px -3px var(--shadow-color, rgb(0 0 0 / 0.1)));
		animation: popover-appear 0.15s cubic-bezier(0.16, 1, 0.3, 1);

		&.position-start {
			left: 0;
		}

		&.position-end {
			right: 0;
		}

		// Center: margin-inline auto (KHÔNG dùng translateX — sẽ xung đột transform
		// của animation appear → giật ngang 150ms khi mở).
		&.position-center {
			left: 0;
			right: 0;
			margin-inline: auto;
		}

		// Arrow: ô vuông 12px xoay 45°, 2 cạnh (top+left) tạo "mũi" chỉ lên;
		// che 1 nửa mép trên của panel. Giữ bg + border khớp panel.
		.popover-arrow {
			position: absolute;
			top: calc(var(--popover-arrow-size) / -2); // -6px (một nửa kích thước)
			width: var(--popover-arrow-size);
			height: var(--popover-arrow-size);
			background-color: var(--background, #fff);
			border: 1px solid var(--border, hsl(240 5.9% 90%));
			border-right: 0;
			border-bottom: 0;
			border-top-left-radius: calc(var(--border-radius-sm, 0.25rem) / 2);
			transform: rotate(45deg);
		}

		&.position-start .popover-arrow {
			left: 1.25rem; // 20px
		}

		&.position-end .popover-arrow {
			right: 1.25rem; // 20px
		}

		&.position-center .popover-arrow {
			left: 50%;
			margin-left: calc(var(--popover-arrow-size) / -2);
		}

		@media (prefers-color-scheme: dark) {
			border-color: hsl(240 5.9% 20%);

			.popover-arrow {
				border-color: hsl(240 5.9% 20%);
				background-color: var(--background, hsl(240 10% 10%));
			}
		}

		@media (prefers-reduced-motion: reduce) {
			animation: none;
		}
	}

	@keyframes popover-appear {
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
