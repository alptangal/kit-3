<script lang="ts">
	// src/lib/components/element/dropdown-menu/Root.svelte
	// DropdownMenu.Root — wrapper (position:relative) giữ state `open` + Symbol context +
	// xử lý outside-click / Escape / Tab. Trigger & Content là slot, đọc context.
	// Open là bindable (mặc định uncontrolled; user có thể bind:open để điều khiển).
	import { browser } from '$app/environment';
	import { styleSynced } from '$modules';
	import { setDropdownMenuContext } from './_context';
	import type { DropdownMenuConfigs, DropdownMenuRootProps } from './_interface';

	let {
		open = $bindable(false),
		'aria-label': ariaLabel,
		children,
		...props
	}: DropdownMenuRootProps = $props();

	let rootEl: HTMLDivElement;

	// id nội bộ cho Content (liên kết aria-controls / aria-activedescendant).
	// Math.random đủ duy nhất theo instance, không phụ thuộc crypto (SSR an toàn).
	const contentId = `dm-content-${Math.random().toString(36).slice(2, 10)}`;

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = ['dropdown-menu-root'];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	let configs: DropdownMenuConfigs = $state({
		ref: undefined,
		get open() {
			return open;
		},
		get contentId() {
			return contentId;
		},
		setOpen(v: boolean) {
			open = v;
		},
		toggle() {
			open = !open;
		},
		close() {
			open = false;
			// Chọn item / đóng chủ động → trả focus về trigger (trải nghiệm Radix).
			// Dùng rootEl trực tiếp (cùng scope) thay vì configs.ref để khỏi phụ thuộc
			// thứ tự chạy effect khi menu chưa kịp mount.
			requestAnimationFrame(() =>
				rootEl?.querySelector<HTMLElement>('[data-dm-trigger]')?.focus()
			);
		}
	});

	$effect(() => {
		configs.ref = rootEl;
	});

	setDropdownMenuContext(configs);
	export { configs };

	// Outside-click: chỉ lắng nghe khi đang open (track `open` để tự mount/unmount).
	$effect(() => {
		if (!browser || !open) return;
		function onMousedown(e: MouseEvent) {
			if (rootEl && !rootEl.contains(e.target as Node)) open = false;
		}
		document.addEventListener('mousedown', onMousedown);
		return () => document.removeEventListener('mousedown', onMousedown);
	});

	// Escape (đóng + focus về trigger) / Tab (đóng, cho focus rời đi).
	$effect(() => {
		if (!browser || !open) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.preventDefault();
				open = false;
				rootEl?.querySelector<HTMLElement>('[data-dm-trigger]')?.focus();
			} else if (e.key === 'Tab') {
				open = false;
			}
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});
</script>

<div
	class={styleDerived}
	aria-label={ariaLabel}
	bind:this={rootEl}
	data-open={open || undefined}
>
	{@render children?.()}
</div>

<style lang="scss">
	.dropdown-menu-root {
		position: relative;
		display: inline-flex;
	}
</style>
