// src/lib/components/element/datatable/Pagination.svelte
// DataTable.Pagination — thanh footer: page size select (5/10/20), nút prev/next
// (aria-label), page info "Trang X / Y". Trống thông minh: chỉ hiện khi
// filteredCount > pageSize (tránh 1 trang thừa). Nền/line token, không hardcode.
<script lang="ts">
	import { getDataTableContext } from './_context';

	const ctx = getDataTableContext();
	const configs = ctx?.configs;

	const showPage = $derived(ctx ? ctx.filteredCount > ctx.pageSize : false);

	const pageInfo = $derived(
		configs
			? configs.pageInfoText.replace('{page}', String(ctx?.page ?? 1)).replace('{total}', String(ctx?.totalPages ?? 1))
			: ''
	);
</script>

{#if ctx && showPage && configs}
	<div class="datatable-pagination">
		<div class="datatable-pagination-left">
			{#if ctx.pageSizeOptions.length > 0}
				<label class="datatable-pagesize">
					<span class="datatable-pagesize-label">{configs.pageSizeLabelText}</span>
					<select
						class="datatable-pagesize-select"
						aria-label={configs.pageSizeLabelText}
						value={String(ctx.pageSize)}
						onchange={(e) => ctx.changePageSize(Number((e.target as HTMLSelectElement).value))}
					>
						{#each ctx.pageSizeOptions as opt (opt)}
							<option value={String(opt)}>{opt}</option>
						{/each}
					</select>
				</label>
			{/if}
		</div>

		<div class="datatable-pagination-right">
			<span class="datatable-pageinfo" aria-live="polite">{pageInfo}</span>
			<button
				type="button"
				class="datatable-pg-btn"
				disabled={ctx.page <= 1}
				aria-label={configs.previousText}
				onclick={() => ctx.goToPage(ctx.page - 1)}
			>
				<abbr aria-label={configs.previousText}><span aria-hidden="true">‹</span></abbr>
			</button>
			<button
				type="button"
				class="datatable-pg-btn"
				disabled={ctx.page >= ctx.totalPages}
				aria-label={configs.nextText}
				onclick={() => ctx.goToPage(ctx.page + 1)}
			>
				<abbr aria-label={configs.nextText}><span aria-hidden="true">›</span></abbr>
			</button>
		</div>
	</div>
{/if}

<style lang="scss">
	@use '_styles.scss' as dt;

	.datatable-pagination {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.5rem var(--cell-pad-x, 0.75rem);
		border-top: 1px solid var(--content3, hsl(240 5.88% 90%));
		background: var(--content1, #fff);
	}

	.datatable-pagesize {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
		color: var(--muted, #71717a);
		cursor: pointer;
	}

	.datatable-pagesize-select {
		height: 2rem;
		padding: 0 0.4rem;
		font: inherit;
		font-size: 0.8125rem;
		color: var(--content1-foreground, #18181b);
		background: var(--content1, #fff);
		border: 1px solid var(--content3, hsl(240 5.88% 90%));
		border-radius: var(--border-radius-sm, 0.375rem);
		cursor: pointer;
		@include dt.focus-ring;
	}

	.datatable-pageinfo {
		font-size: 0.8125rem;
		color: var(--muted, #71717a);
	}

	.datatable-pg-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2rem;
		height: 2rem;
		padding: 0 0.4rem;
		font-size: 1.125rem;
		line-height: 1;
		color: var(--content1-foreground, #18181b);
		background: transparent;
		border: 1px solid var(--content3, hsl(240 5.88% 90%));
		border-radius: var(--border-radius-sm, 0.375rem);
		cursor: pointer;
		transition: background-color 150ms ease, opacity 150ms ease;

		&:disabled {
			opacity: var(--disabled-opacity, 0.5);
			cursor: not-allowed;
		}

		@media (hover: hover) and (pointer: fine) {
			&:hover:not(:disabled) {
				background: var(--content2, hsl(240 4.76% 95.88%));
			}
		}
		@include dt.focus-ring;

		abbr {
			text-decoration: none;
		}
	}
</style>
