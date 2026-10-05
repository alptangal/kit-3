<script lang="ts">
	// src/lib/components/element/tabs/List.svelte
	// Tabs.List — role="tablist" (aria-orientation theo orientation của Root).
	// Roving focus scoped (bubbles từ trigger, e.preventDefault — mẫu
	// form/radiogroup handleKeydown): horizontal ArrowRight/ArrowLeft ·
	// vertical ArrowDown/ArrowUp (wrap, SKIP disabled) + Home/End. Focus trigger
	// kế qua ctx.triggerRefs (không DOM query).
	// activation='automatic' (default): focusin (ở Trigger) → select luôn;
	// 'manual': focus chỉ di chuyển (Trigger tự xử lý Enter/Space).
	// Render <Indicator /> khi type='underline' (Indicator đọc triggerRefs tự position).
	// Layout (pill/underline/vertical) ở Root/_styles.scss qua :global(.tabs-list).
	import { styleSynced } from '$modules';
	import Indicator from './Indicator.svelte';
	import { getTabsContext } from './_context';
	import type { TabsListProps } from './_interface';

	let { children, ...props }: TabsListProps = $props();

	const ctx = getTabsContext();

	let listEl = $state<HTMLDivElement | undefined>(undefined);

	// listEl vào context (Indicator ResizeObserver đo list).
	$effect(() => {
		if (!ctx || !listEl) return;
		ctx.listEl = listEl;
		return () => {
			if (ctx.listEl === listEl) ctx.listEl = undefined;
		};
	});

	const isUnderline = $derived(ctx?.type === 'underline');
	const orientation = $derived(ctx?.orientation ?? 'horizontal');

	const styleDerived = $derived.by(() =>
		styleSynced(
			{
				defaultStyles: [
					'tabs-list',
					`type-${ctx?.type ?? 'default'}`,
					ctx?.orientation === 'vertical' ? 'vertical' : undefined
				],
				propStyles: props.class
			},
			props.overwriteDefaultStyles
		)
	);

	function focusByValue(v: string | undefined) {
		if (v === undefined) return;
		ctx?.triggerRefs.get(v)?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!ctx) return;
		const forward = orientation === 'horizontal' ? ['ArrowRight', 'ArrowDown'] : ['ArrowDown'];
		const backward = orientation === 'horizontal' ? ['ArrowLeft', 'ArrowUp'] : ['ArrowUp'];

		// enabled = trigger chưa <button disabled> (Svelte map giữ thứ tự insert).
		let enabled: string[] = [];
		for (const v of ctx.triggerRefs.keys()) {
			if (!ctx.triggerRefs.get(v)?.hasAttribute('disabled')) enabled.push(v);
		}
		if (!enabled.length) return;

		// index hiện tại từ DOM activeElement (data-tabs-value trên trigger).
		const active = document.activeElement;
		let idx =
			active instanceof HTMLButtonElement && active.hasAttribute('data-tabs-value')
				? enabled.indexOf(active.getAttribute('data-tabs-value') ?? '')
				: enabled.indexOf(ctx.activeValue ?? '');
		if (idx === -1) idx = 0;

		if (forward.includes(e.key)) {
			e.preventDefault();
			focusByValue(enabled[(idx + 1) % enabled.length]);
		} else if (backward.includes(e.key)) {
			e.preventDefault();
			focusByValue(enabled[(idx - 1 + enabled.length) % enabled.length]);
		} else if (e.key === 'Home') {
			e.preventDefault();
			focusByValue(enabled[0]);
		} else if (e.key === 'End') {
			e.preventDefault();
			focusByValue(enabled[enabled.length - 1]);
		}
	}
</script>

<div
	bind:this={listEl}
	class={styleDerived}
	role="tablist"
	aria-orientation={orientation}
	onkeydown={handleKeydown}
>
	{@render children?.()}
	{#if isUnderline}
		<Indicator />
	{/if}
</div>
