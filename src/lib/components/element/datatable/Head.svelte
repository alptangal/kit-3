<script lang="ts">
	// src/lib/components/element/datatable/Head.svelte
	// DataTable.Head — thead: th scope="col" + aria-sort. Cột sort được
	// render nút button (tránh th inside button = invalid HTML). Nền
	// --content2 (token, không hardcode).
	import { getDataTableContext } from './_context';
	import type { DataTableColumn } from './_interface';

	const ctx = getDataTableContext();
	const configs = ctx?.configs;

	// indeterminate: một số (không phải tất cả) row trang hiện tại đã chọn.
	const indeterminate = $derived.by(
		() => !!ctx && !ctx.allPageSelected && ctx.pageRows.some(({ row, index }) => ctx.isSelected(ctx.getRowId(row, index)))
	);

	// aria-sort: column đang sort → ascending/descending; không → undefined
	// (cột không sortable). Nền: configs.sortable là có cơ chế sort hay không.
	const ariaSort = (col: DataTableColumn<Record<string, unknown>>): 'none' | 'ascending' | 'descending' | undefined => {
		if (!ctx || !configs?.sortable) return undefined;
		if (col.sortable === false) return undefined;
		const active = ctx.activeSort;
		const order = ctx.sortOrder;
		return active === col.id ? (order === 'asc' ? 'ascending' : 'descending') : 'none';
	};
</script>

{#if ctx}
	<thead class="datatable-head">
		<tr>
			{#if configs?.selectable}
				<th class="datatable-th datatable-th--check" scope="col">
					<input
						class="datatable-checkbox datatable-checkbox--all"
						type="checkbox"
						aria-label={configs.selectAllText}
						checked={ctx.allPageSelected}
						{indeterminate}
						onchange={() => ctx.togglePageSelection()}
					/>
				</th>
			{/if}
			{#each ctx.columns as col, ci (col.id)}
				{#if configs?.sortable && col.sortable !== false}
					<th
						class="datatable-th"
						scope="col"
						aria-sort={ariaSort(col)}
						style:width={col.width ?? undefined}
					>
						<button
							type="button"
							class="datatable-sort"
							class:align-left={col.align === 'left' || !col.align}
							class:align-center={col.align === 'center'}
							class:align-right={col.align === 'right'}
							class:active={ctx.activeSort === col.id}
							aria-label={`${col.label} — sort`}
							onclick={() => ctx.toggleSort(col.id)}
						>
							<span class="datatable-sort-label">{col.label}</span>
							<span class="datatable-sort-icon" aria-hidden="true">
								{#if ctx.activeSort === col.id}
									{ctx.sortOrder === 'asc' ? '▲' : '▼'}
								{:else}
									<span class="datatable-sort-idle">↕</span>
								{/if}
							</span>
						</button>
					</th>
				{:else}
					<th
						class="datatable-th"
						scope="col"
						aria-sort={ariaSort(col)}
						class:align-left={col.align === 'left' || !col.align}
						class:align-center={col.align === 'center'}
						class:align-right={col.align === 'right'}
						style:width={col.width ?? undefined}
					>
						<span class="datatable-th-label">{col.label}</span>
					</th>
				{/if}
			{/each}
		</tr>
	</thead>
{/if}

<style lang="scss">
	@use '_styles.scss' as dt;

	.datatable-head {
		display: table-header-group;
	}

	.datatable-th {
		@include dt.cell-tokens;
		padding: var(--cell-pad-y, 0.75rem) var(--cell-pad-x, 0.75rem);
		background: var(--content2, hsl(240 4.76% 95.88%));
		color: var(--content1-foreground, #18181b);
		font-size: 0.8125rem;
		font-weight: 600;
		text-align: left;
		white-space: nowrap;
		border-bottom: 1px solid var(--content3, hsl(240 5.88% 90%));
		vertical-align: middle;

		&.align-center {
			text-align: center;
		}
		&.align-right {
			text-align: right;
		}
	}

	.datatable-th--check {
		width: 2.5rem;
	}

	.datatable-th-label {
		display: block;
	}

	// Nút sort: chiếm trọn ô th, nền trong suốt (thuận tay click).
	.datatable-sort {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		width: 100%;
		padding: 0;
		background: transparent;
		border: 0;
		color: inherit;
		font: inherit;
		cursor: pointer;
		user-select: none;

		&.align-left {
			justify-content: flex-start;
		}
		&.align-center {
			justify-content: center;
		}
		&.align-right {
			justify-content: flex-end;
		}

		@media (hover: hover) and (pointer: fine) {
			&:hover .datatable-sort-label {
				color: var(--primary, var(--color-indigo-500));
			}
		}
		@include dt.focus-ring;
	}

	.datatable-sort-label {
		font-weight: 600;
	}

	.datatable-sort-icon {
		display: inline-flex;
		font-size: 0.625rem;
		color: var(--primary, var(--color-indigo-500));

		.datatable-sort-idle {
			color: var(--muted, #71717a);
			opacity: 0.55;
		}
	}
</style>
