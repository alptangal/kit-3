<script lang="ts">
	// src/lib/components/element/dropdown-menu/Content.svelte
	// DropdownMenu.Content — vùng menu (role="menu"), absolute phía dưới trigger,
	// căn theo align (start/center/end) + sideOffset. Viewport collision:
	// (1) FLIP dọc — chỗ dưới trigger không đủ (menu + margin an toàn) mà chỗ trên
	//     rộng hơn → menu hiện TRÊN trigger (class .flipped);
	// (2) CLAMP ngang — menu vượt mép trái/phải viewport → nudge bằng
	//     var --dm-shift-x. Reposition khi resize/scroll (scroller lồng → capture).
	// Roving focus: ArrowUp/Down, Home/End; Enter/Space chọn (native button);
	// Escape/Tab/outside-click đóng (xử lý ở Root). Item tự đặt data-dm-item /
	// data-dm-item-disabled.
	import { browser } from '$app/environment';
	import { tick } from 'svelte';
	import { styleSynced } from '$modules';
	import { getDropdownMenuContext } from './_context';
	import type { DropdownMenuContentProps } from './_interface';

	let {
		align = 'start',
		sideOffset = 4,
		children,
		...props
	}: DropdownMenuContentProps = $props();

	const ctx = getDropdownMenuContext();
	const open = $derived(ctx?.open ?? false);
	const contentId = $derived(ctx?.contentId ?? '');

	// $state để bind:this không ăn warning non_reactive_update (Svelte 5).
	let contentEl = $state<HTMLDivElement | undefined>(undefined);

	// Viewport collision: MARGIN = 8px "an toàn mép viewport" — đây là định mức
	// layout (menu không tiệm cận mép viewport), không phải design token.
	const MARGIN = 8;
	let flip = $state(false);
	let shiftX = $state(0);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'dropdown-menu-content',
			`align-${align}`,
			open ? 'open' : undefined,
			flip ? 'flipped' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	// Khi mở: focus item đầu (cho keyboard nav bắt đầu ngay trong menu).
	$effect(() => {
		if (!browser || !open || !contentEl) return;
		const id = setTimeout(() => {
			contentEl?.querySelector<HTMLElement>('[data-dm-item]:not([data-dm-item-disabled])')?.focus();
		}, 0);
		return () => clearTimeout(id);
	});

	// Viewport collision — chạy lại khi open/contentEl/anchor/sideOffset/align đổi
	// (tất cả đều được đọc trong body → Svelte track tự động).
	$effect(() => {
		if (!browser || !open || !contentEl || !ctx?.ref) return;
		const anchor = ctx.ref; // root wrapper (bao quanh trigger)

		// Reset collision state mỗi lần mở menu (clean slate).
		flip = false;
		shiftX = 0;

		// FLIP dọc: chỗ dưới trigger (gồm offset) không đủ (menu + MARGIN an toàn)
		// MÀ chỗ trên rộng hơn → menu hiện trên trigger.
		function position() {
			if (!contentEl) return;
			const r = anchor.getBoundingClientRect();
			const offset = sideOffset;
			const menuH = contentEl.offsetHeight;
			const spaceBelow = window.innerHeight - r.bottom - offset;
			const spaceAbove = r.top - offset;
			flip = spaceBelow < menuH + MARGIN && spaceAbove > spaceBelow;
		}

		// CLAMP ngang: menu vượt mép phải → nudge trái; vượt mép trái → nudge phải.
		// Nguồn sự thật = rect thật của content (đã áp align + flip). Dấu delta theo
		// trục left/translate (start/center); align-end ghim qua `right:` nên đảo dấu.
		// Guard: chỉ nudge khi delta > 1px (tránh nudge giả do rounding/đo sớm).
		function clampX() {
			if (!contentEl) return;
			const rect = contentEl.getBoundingClientRect();
			const overRight = rect.right - (window.innerWidth - MARGIN);
			const overLeft = MARGIN - rect.left;
			const delta = overRight > 1 ? -overRight : overLeft > 1 ? overLeft : 0;
			shiftX = align === 'end' ? -delta : delta;
		}

		// Chạy sau DOM mount (setTimeout 0 → layout sẵn có); flip đổi class →
		// phải tick() trước khi đo lại để clampX đọc rect cuối cùng.
		const t1 = setTimeout(async () => {
			position();
			await tick();
			clampX();
		}, 0);

		// Reposition khi resize / scroll (capture → bắt cả scroller lồng).
		// Throttle bằng rAF: chỉ đo 1 lần mỗi frame.
		let rafId = 0;
		function onResizeOrScroll() {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				void (async () => {
					position();
					await tick(); // flip đổi → chờ class apply trước khi đo ngang
					clampX();
				})();
			});
		}
		window.addEventListener('resize', onResizeOrScroll);
		window.addEventListener('scroll', onResizeOrScroll, { capture: true, passive: true });

		return () => {
			clearTimeout(t1);
			cancelAnimationFrame(rafId);
			window.removeEventListener('resize', onResizeOrScroll);
			window.removeEventListener('scroll', onResizeOrScroll, { capture: true });
		};
	});

	// Roving focus trong menu (bubbles từ items — items là nút con trong content).
	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		const items = Array.from(
			contentEl?.querySelectorAll<HTMLElement>('[data-dm-item]:not([data-dm-item-disabled])') ?? []
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
		style:--dm-offset={`${sideOffset}px`}
		style:--dm-shift-x={`${shiftX}px`}
		onkeydown={handleKeydown}
	>
		{@render children?.()}
	</div>
{/if}

<style lang="scss">
	.dropdown-menu-content {
		position: absolute;
		top: calc(100% + var(--dm-offset, 4px));
		z-index: 100;
		min-width: 11rem;
		padding: 0.375rem;
		background-color: var(--background, #fff);
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: var(--border-radius-md, 0.375rem);
		box-shadow: var(--box-shadow-lg, 0 10px 25px -5px rgb(0 0 0 / 0.1));

		&.align-start {
			left: calc(0px + var(--dm-shift-x, 0px));
		}

		&.align-center {
			left: 50%;
			// shift gộp vào cùng transform (content không có animation appear
			// → không xung đột transform).
			transform: translateX(calc(-50% + var(--dm-shift-x, 0px)));
		}

		&.align-end {
			// Ghim qua `right` nên cùng giá trị X dịch menu SANG TRÁI (ngược trục
			// left) — dấu của --dm-shift-x được JS (clampX) đảo sẵn cho align-end.
			right: calc(0px + var(--dm-shift-x, 0px));
		}

		// FLIP dọc: menu hiện TRÊN trigger khi chỗ dưới viewport không đủ.
		&.flipped {
			top: auto;
			bottom: calc(100% + var(--dm-offset, 4px));
		}

		@media (prefers-color-scheme: dark) {
			border-color: hsl(240 5.9% 20%);
		}
	}
</style>
