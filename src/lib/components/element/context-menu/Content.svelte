<script lang="ts">
	// src/lib/components/element/context-menu/Content.svelte
	// ContextMenu.Content — vùng menu (role="menu"), position FIXED tại điểm chuột
	// (mode 'offset', default) hoặc theo cạnh target (mode 'top'/'bottom'). Sau
	// render: đo offsetWidth/Height → clamp không vượt viewport (chừa 8px mỗi cạnh).
	// Roving focus copy dropdown-menu: ArrowUp/Down/Home/End trên
	// [data-cm-item]:not([data-cm-disabled]); focus item đầu khi open (setTimeout 0).
	// Escape / outside-click / Tab → đóng (xử lý ở Root).
	import { browser } from '$app/environment';
	import { styleSynced } from '$modules';
	import { getContextMenuContext } from './_context';
	import type { ContextMenuContentProps } from './_interface';

	let {
		side = 'offset',
		sideOffset = 4,
		'aria-label': ariaLabel,
		children,
		...props
	}: ContextMenuContentProps = $props();

	const ctx = getContextMenuContext();
	const open = $derived(ctx?.open ?? false);
	const contentId = $derived(ctx?.contentId ?? '');

	let contentEl = $state<HTMLDivElement | undefined>(undefined);
	// Vị trí fixed (px) — set từ ctx.pos/ctx.target rồi clamp theo kích thước thật.
	let posStyle = $state({ left: 0, top: 0 });

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'context-menu-content',
			`side-${side}`,
			open ? 'open' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	// Tính điểm neo: 'offset' → điểm chuột + 4px offset (tránh menu che trỏ chuột);
	// 'top'/'bottom' → cạnh target (align start). Clamp viewport xử lý sau khi mount.
	function anchorPosition() {
		const p = ctx?.pos ?? { x: 0, y: 0 };
		const t = ctx?.target;
		if (side === 'offset') return { x: p.x + 4, y: p.y + 4 };
		const r = t?.getBoundingClientRect();
		if (!r) return { x: p.x, y: p.y };
		if (side === 'top') return { x: r.left, y: r.top - sideOffset };
		return { x: r.left, y: r.bottom + sideOffset };
	}

	// Set vị trí ban đầu + clamp sau khi mount (đo offsetWidth/Height + rAF).
	$effect(() => {
		if (!browser || !open || !contentEl) return;
		const el = contentEl;
		const { x, y } = anchorPosition();
		el.style.left = `${x}px`;
		el.style.top = `${y}px`;
		const id = requestAnimationFrame(() => {
			if (!el.isConnected) return;
			const w = el.offsetWidth;
			const h = el.offsetHeight;
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			let left = x;
			let top = y;
			if (w > vw - 16) left = Math.max(8, vw - w - 8); // menu rộng hơn viewport
			else left = Math.max(8, Math.min(left, vw - w - 8));
			if (h > vh - 16) top = Math.max(8, vh - h - 8);
			else top = Math.max(8, Math.min(top, vh - h - 8));
			el.style.left = `${left}px`;
			el.style.top = `${top}px`;
			posStyle = { left, top };
		});
		return () => cancelAnimationFrame(id);
	});

	// Khi mở: focus item đầu (cho keyboard nav bắt đầu ngay trong menu).
	$effect(() => {
		if (!browser || !open || !contentEl) return;
		const id = setTimeout(() => {
			contentEl?.querySelector<HTMLElement>('[data-cm-item]:not([data-cm-disabled])')?.focus();
		}, 0);
		return () => clearTimeout(id);
	});

	// Roving focus trong menu (bubbles từ items — items là nút con trong content).
	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		const items = Array.from(
			contentEl?.querySelectorAll<HTMLElement>('[data-cm-item]:not([data-cm-disabled])') ?? []
		);
		if (items.length === 0) return;
		const active = document.activeElement as HTMLElement | null;
		const idx = active ? items.indexOf(active) : -1;

		function focusAt(n: number) {
			e.preventDefault();
			items[n].focus();
		}
		switch (e.key) {
			case 'ArrowDown':
				focusAt(idx === -1 ? 0 : Math.min(idx + 1, items.length - 1));
				break;
			case 'ArrowUp':
				focusAt(idx === -1 ? items.length - 1 : Math.max(idx - 1, 0));
				break;
			case 'Home':
				focusAt(0);
				break;
			case 'End':
				focusAt(items.length - 1);
				break;
			default:
				break;
		}
	}
</script>

{#if open}
	<div
		bind:this={contentEl}
		class={styleDerived}
		id={contentId}
		role="menu"
		tabindex={-1}
		aria-label={ariaLabel}
		style:left={`${posStyle.left}px`}
		style:top={`${posStyle.top}px`}
		onkeydown={handleKeydown}
	>
		{@render children?.()}
	</div>
{/if}

<style lang="scss">
	.context-menu-content {
		position: fixed;
		z-index: 1002;
		min-width: 11rem;
		max-width: calc(100vw - 16px);
		max-height: calc(100vh - 16px);
		overflow: auto;
		padding: 0.375rem;
		background-color: var(--background, #fff);
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: var(--border-radius-md, 0.375rem);
		box-shadow: var(--box-shadow-lg, 0 10px 25px -5px rgb(0 0 0 / 0.1));
		animation: cm-panel-appear 120ms ease-out;

		@media (prefers-color-scheme: dark) {
			border-color: hsl(240 5.9% 20%);
		}

		@media (prefers-reduced-motion: reduce) {
			animation: none;
		}
	}

	@keyframes cm-panel-appear {
		from {
			opacity: 0;
			transform: scale(0.98);
		}

		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
