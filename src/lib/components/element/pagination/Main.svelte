<script lang="ts">
	// src/lib/components/element/pagination/Main.svelte
	// LIGHT ATOM — Pagination (mirror shadcn usePagination): không context, không form.
	// Bindable `page` (clamped 1..totalPages), totalPages suy từ totalItems/pageSize,
	// dải entries: [boundary..., ellipsis-start, sibling..., ellipsis-end, boundary...].
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import type { PaginationConfigs, PaginationEntry, PaginationProps } from './_interface';
	import type { TranslateContent } from '$interfaces/basic';

	let { page = $bindable(1), ...props }: PaginationProps = $props();

	// Resolve TranslateContent | string theo language (fallback en → vi)
	const getText = (content?: TranslateContent | string, fallback?: { en: string; vi: string }): string => {
		if (!content) {
			const lang = client.browser?.language ?? 'en';
			return fallback ? fallback[lang] : '';
		}
		if (typeof content === 'string') return content;
		const lang = client.browser?.language ?? 'en';
		return content[lang] ?? content.en ?? content.vi ?? (fallback ? fallback[lang] : '');
	};

	const prevLabel = $derived(getText(props.prevLabel, { en: 'Previous', vi: 'Trước' }));
	const nextLabel = $derived(getText(props.nextLabel, { en: 'Next', vi: 'Sau' }));
	const siblingCount = $derived(props.siblingCount ?? 1);
	const boundaryCount = $derived(props.boundaryCount ?? 1);
	const pageSize = $derived(props.pageSize ?? 10);
	const totalPages = $derived.by(() => {
		if (props.totalPages != null) return Math.max(1, Math.floor(props.totalPages));
		if (props.totalItems != null) return Math.max(1, Math.ceil(props.totalItems / pageSize));
		return 1;
	});
	const sizeDerived = $derived(props.size ?? 'md');
	const colorDerived = $derived(props.color ?? 'primary');

	// Page luôn nằm trong 1..totalPages (clamp)
	const safePage = $derived(Math.min(Math.max(1, Math.floor(page) || 1), totalPages));

	// ── shadcn usePaginationRange algorithm (mirror 1-1) ──
	// siblingStart = max(2, page - siblingCount); siblingEnd = min(pages - 1, page + siblingCount)
	// Dải hẹp (siblingStart <= 3 && siblingEnd >= pages - 2) → hiện toàn bộ.
	// Ngược lại: firstBoundary + middle + lastBoundary, xen -1 (ellipsis) khi có khoảng trống.
	const entries = $derived.by((): PaginationEntry[] => {
		const total = totalPages;
		const current = safePage;
		const boundary = Math.max(0, boundaryCount);

		const startPages = (count: number): number[] =>
			Array.from({ length: Math.max(0, count) }, (_, i) => i + 1);
		const range = (start: number, end: number): number[] =>
			startPages(Math.max(0, end - start + 1)).map((i) => start + i - 1);

		const siblingStart = Math.max(2, current - siblingCount);
		const siblingEnd = Math.min(total - 1, current + siblingCount);

		let nums: number[];
		if (siblingStart <= 3 && siblingEnd >= total - 2) {
			// Tổng trang ít → hiện đủ, không ellipsis
			nums = startPages(total);
		} else {
			const firstBoundary = total > 0 ? startPages(Math.min(boundary, total)) : [];
			const middle = siblingCount > 0 ? range(siblingStart, siblingEnd) : [current];
			const lastBoundary = total > 0 ? range(Math.max(total - boundary + 1, 1), total) : [];

			const out = [...firstBoundary, ...middle, ...lastBoundary];
			if (firstBoundary[firstBoundary.length - 1] < middle[0]) {
				out.splice(firstBoundary.length, 0, -1);
			}
			if (middle[middle.length - 1] < lastBoundary[0]) {
				out.splice(out.length - lastBoundary.length, 0, -1);
			}
			nums = out;
		}

		const result: PaginationEntry[] = [{ type: 'prev' }];
		let ellipsisToggled = false;
		for (const p of nums) {
			if (p === -1) {
				if (!ellipsisToggled) result.push({ type: 'ellipsis-start' });
				ellipsisToggled = true;
				continue;
			}
			ellipsisToggled = false;
			result.push({ type: 'page', n: p });
		}
		result.push({ type: 'next' });
		return result;
	});

	let configs: PaginationConfigs = $state({
		get page() {
			return safePage;
		},
		get totalPages() {
			return totalPages;
		},
		get entries() {
			return entries;
		},
		get size() {
			return sizeDerived;
		},
		get color() {
			return colorDerived;
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'pagination-root',
				`size-${this.size}`,
				`color-${this.color}`
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get event() {
			return props.events ?? [];
		}
	});

	function goTo(n: number) {
		if (n < 1 || n > totalPages) return;
		page = n;
	}
</script>

<nav
	class={configs.style}
	aria-label={props['aria-label'] ?? { vi: 'Phân trang', en: 'Pagination' }[client.browser?.language ?? 'en']}
	{@attach handleEvents(configs.event)}
>
	<button
		type="button"
		class="pagination-item pagination-prev"
		disabled={safePage <= 1}
		aria-label="Trang trước"
		onclick={() => goTo(safePage - 1)}
	>{prevLabel}</button>

	{#each configs.entries as entry, i (i)}
		{#if entry.type === 'page'}
			<button
				type="button"
				class="pagination-item pagination-page"
				class:active={entry.n === safePage}
				aria-current={entry.n === safePage ? 'page' : undefined}
				onclick={() => goTo(entry.n)}
			>{entry.n}</button>
		{:else if entry.type === 'ellipsis-start' || entry.type === 'ellipsis-end'}
			<span class="pagination-item pagination-ellipsis" aria-hidden="true">…</span>
		{/if}
	{/each}

	<button
		type="button"
		class="pagination-item pagination-next"
		disabled={safePage >= totalPages}
		aria-label="Trang sau"
		onclick={() => goTo(safePage + 1)}
	>{nextLabel}</button>
</nav>

<style lang="scss">
	@use '_styles.scss';
</style>
