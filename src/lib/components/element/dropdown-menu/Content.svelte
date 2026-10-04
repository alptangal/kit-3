<script lang="ts">
	// src/lib/components/element/dropdown-menu/Content.svelte
	// DropdownMenu.Content — vùng menu (role="menu"), absolute phía dưới trigger,
	// căn theo align (start/center/end) + sideOffset. Roving focus: ArrowUp/Down,
	// Home/End; Enter/Space chọn (native button); Escape/Tab/outside-click đóng
	// (xử lý ở Root). Item tự đặt data-dm-item / data-dm-item-disabled.
	import { browser } from '$app/environment';
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

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'dropdown-menu-content',
			`align-${align}`,
			open ? 'open' : undefined
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
			left: 0;
		}

		&.align-center {
			left: 50%;
			transform: translateX(-50%);
		}

		&.align-end {
			right: 0;
		}

		@media (prefers-color-scheme: dark) {
			border-color: hsl(240 5.9% 20%);
		}
	}
</style>
