<script lang="ts">
	// src/lib/components/element/pagination/Main.svelte
	// LIGHT ATOM — Pagination (mirror shadcn usePagination): không context, không form.
	// Bindable `page` (clamped 1..totalPages), totalPages suy từ totalItems/pageSize,
	// dải entries: [boundary..., ellipsis-start, sibling..., ellipsis-end, boundary...].
	// Sibling range CLAMP theo boundary → không đè dải biên, không lặp trang.
	// Variant 'compact': chỉ prev + counter (jump-to input) + next — không render entries.
	// Compact counter: pageAtEditStart (blur/xoá rỗng → page trước khi edit, KHÔNG snap 1).
	// Loading: root aria-busy + MỌI item disabled + mờ + cursor not-allowed (đồng bộ data).
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { Icon } from '$components/element/icon';
	import type { PaginationConfigs, PaginationEntry, PaginationProps } from './_interface';
	import type { TranslateContent } from '$interfaces/basic';

	let { page = $bindable(1), ...props }: PaginationProps = $props();

	// Resolve TranslateContent | string theo language (fallback en → vi)
	const getText = (content?: TranslateContent | string, fallback?: { en: string; vi: string }): string => {
		if (!content) {
			const lang: 'en' | 'vi' = (client.browser?.language ?? 'en') === 'vi' ? 'vi' : 'en';
			return fallback ? fallback[lang] : '';
		}
		if (typeof content === 'string') return content;
		const lang: 'en' | 'vi' = (client.browser?.language ?? 'en') === 'vi' ? 'vi' : 'en';
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
	const variant = $derived(props.variant ?? 'default');
	const loading = $derived(props.loading ?? false);
	// Component-level `disabled` (BasicProps) — mọi item vô hiệu khi set.
	const disabled = $derived(!!props.disabled);

	// Page luôn nằm trong 1..totalPages (clamp)
	const safePage = $derived(Math.min(Math.max(1, Math.floor(page) || 1), totalPages));

	// ── Compact counter (jump-to input) ──
	let editing = $state(false);
	let draft = $state('');
	// Trang hiện tại TRƯỚC thời điểm vào edit — blur/xoá rỗng → trả về giá trị này (KHÔNG snap 1)
	let pageAtEditStart = $state(1);
	let inputRef: HTMLInputElement | undefined = $state();

	const counterAria = $derived(getText(undefined, { en: 'Page', vi: 'Trang' }));
	// Icon-only (label rỗng + có icon) → aspect-square (DESIGN_SYSTEM §2.2)
	const prevIconOnly = $derived(!!props.prevIcon && !prevLabel);
	const nextIconOnly = $derived(!!props.nextIcon && !nextLabel);

	// clamp 1..totalPages (draft rỗng/NaN → 1)
	const clampPage = (n: number): number => Math.min(Math.max(1, Math.trunc(n) || 1), totalPages);

	// Click counter / Enter/Space trên button: vào edit mode (draft = page hiện,
	// focus + select-all input qua rAF — KHÔNG dùng autofocus, không tin cậy sau block DOM).
	function startEdit() {
		if (loading || disabled || editing) return;
		draft = String(safePage);
		pageAtEditStart = safePage;
		editing = true;
		requestAnimationFrame(() => {
			inputRef?.focus();
			inputRef?.select();
		});
	}

	// Enter → commit; Escape → revert (không đổi page); ArrowUp/Down → draft ±1 (clamp).
	function counterKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitPage();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			editing = false;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			draft = String(clampPage((parseInt(draft, 10) || 1) + 1));
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			draft = String(clampPage((parseInt(draft, 10) || 1) - 1));
		}
	}

	// Commit (blur hoặc Enter): giá trị RỖNG/không phải số → trả về page TRƯỚC thời điểm
	// vào edit (pageAtEditStart — KHÔNG snap 1); số trong 1..totalPages → commit (clamp).
	// Giá trị ngoài range → không commit vô nghĩa (số âm → snap đầu, quá lớn → snap cuối).
	function commitPage() {
		if (!editing) return;
		editing = false;
		const n = parseInt(draft, 10);
		page = Number.isNaN(n) ? pageAtEditStart : clampPage(n);
	}

	// Blur (click chỗ khác) → commit giá trị hợp lệ
	function onInputBlur() {
		commitPage();
	}

	// oninput: chỉ giữ [0-9] — paste "abc" → rỗng (blur → pageAtEditStart), "abc12" → "12".
	function onDraftInput(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
		draft = (e.currentTarget.value ?? '').replace(/[^0-9]/g, '');
	}

	// ── shadcn usePaginationRange algorithm (mirror) ──
	// Sibling range CLAMP theo boundary: siblingStart = max(boundary+1, page-siblingCount);
	// siblingEnd = min(total-boundary, page+siblingCount) → KHÔNG đè lên dải biên,
	// không bao giờ lặp trang (page 2 chỉ thuộc firstBoundary HOẶC sibling, không cả hai).
	// Dải hẹp (siblingStart <= boundary+2 && siblingEnd >= total-boundary-2) → hiện toàn bộ.
	// Ngược lại: firstBoundary + middle + lastBoundary, xen -1 (ellipsis) khi có khoảng trống.
	const entries = $derived.by((): PaginationEntry[] => {
		const total = totalPages;
		const current = safePage;
		const boundary = Math.max(0, boundaryCount);

		const startPages = (count: number): number[] =>
			Array.from({ length: Math.max(0, count) }, (_, i) => i + 1);
		const range = (start: number, end: number): number[] =>
			startPages(Math.max(0, end - start + 1)).map((i) => start + i - 1);

		const siblingStart = Math.max(boundary + 1, current - siblingCount);
		const siblingEnd = Math.min(total - boundary, current + siblingCount);

		let nums: number[];
		if (siblingStart <= boundary + 2 && siblingEnd >= total - boundary - 2) {
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
		get variant() {
			return variant;
		},
		get loading() {
			return loading;
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'pagination-root',
				`size-${this.size}`,
				`color-${this.color}`,
				this.variant === 'compact' ? 'pagination-compact' : undefined,
				this.loading ? 'loading' : undefined,
				disabled ? 'disabled' : undefined
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
	aria-label={props['aria-label'] ?? getText({ en: 'Pagination', vi: 'Phân trang' })}
	aria-busy={loading ? 'true' : undefined}
	{@attach handleEvents(configs.event)}
>
	{#if variant === 'compact'}
		<!-- ── Compact: prev + counter (jump-to) + next, KHÔNG render entries ── -->
		<button
			type="button"
			class="pagination-item pagination-prev"
			class:aspect-square={prevIconOnly}
			disabled={loading || disabled || safePage <= 1}
			aria-label="Trang trước"
			onclick={() => goTo(safePage - 1)}
		>
			{#if props.prevIcon}
				<Icon icon={props.prevIcon} />
			{/if}
			{prevLabel}
		</button>

		<button
			type="button"
			class="pagination-item pagination-counter"
			data-test="counter"
			disabled={loading || disabled}
			aria-label="{counterAria} {safePage}/{totalPages}"
			aria-live="polite"
			onclick={startEdit}
			class:editing={editing}
		>
			{#if editing}
				<input
					class="pagination-page-input"
					type="text"
					inputmode="numeric"
					autocomplete="off"
					value={draft}
					bind:this={inputRef}
					oninput={onDraftInput}
					onkeydown={counterKeydown}
					onblur={onInputBlur}
					aria-label="{counterAria} — nhập số trang"
				/>
			{:else}
				<span class="counter-current" data-test="counter-current">{safePage}</span>
				<span class="counter-sep" aria-hidden="true">/</span>
				<span class="counter-total" data-test="counter-total">{totalPages}</span>
			{/if}
		</button>

		<button
			type="button"
			class="pagination-item pagination-next"
			class:aspect-square={nextIconOnly}
			disabled={loading || disabled || safePage >= totalPages}
			aria-label="Trang sau"
			onclick={() => goTo(safePage + 1)}
		>
			{#if props.nextIcon}
				<Icon icon={props.nextIcon} />
			{/if}
			{nextLabel}
		</button>
	{:else}
		<button
			type="button"
			class="pagination-item pagination-prev"
			class:aspect-square={prevIconOnly}
			disabled={loading || disabled || safePage <= 1}
			aria-label="Trang trước"
			onclick={() => goTo(safePage - 1)}
		>
			{#if props.prevIcon}
				<Icon icon={props.prevIcon} />
			{/if}
			{prevLabel}
		</button>

		{#each configs.entries as entry, i (i)}
			{#if entry.type === 'page'}
				<button
					type="button"
					class="pagination-item pagination-page"
					class:active={entry.n === safePage}
					aria-current={entry.n === safePage ? 'page' : undefined}
					disabled={loading || disabled}
					onclick={() => goTo(entry.n)}
				>{entry.n}</button>
			{:else if entry.type === 'ellipsis-start' || entry.type === 'ellipsis-end'}
				<span class="pagination-item pagination-ellipsis" aria-hidden="true">…</span>
			{/if}
		{/each}

		<button
			type="button"
			class="pagination-item pagination-next"
			class:aspect-square={nextIconOnly}
			disabled={loading || disabled || safePage >= totalPages}
			aria-label="Trang sau"
			onclick={() => goTo(safePage + 1)}
		>
			{#if props.nextIcon}
				<Icon icon={props.nextIcon} />
			{/if}
			{nextLabel}
		</button>
	{/if}
</nav>

<style lang="scss">
	@use '_styles.scss';
</style>
