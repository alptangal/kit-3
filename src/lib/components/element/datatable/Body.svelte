<script lang="ts">
	// src/lib/components/element/datatable/Body.svelte
	// DataTable.Body — tbody: td theo align, row checkbox (selectable),
	// highlight match search (matchSegments, NFD nhạy dấu), status pill, empty state
	// (full-span muted row) khi data rỗng HOẶC không có kết quả khớp filter.
	import { matchSegments, type TextSegment } from '$modules/highlight';
	import { getDataTableContext } from './_context';
	import type { DataTableColumn } from './_interface';

	const ctx = getDataTableContext();
	const configs = ctx?.configs;

	// text hiển thị cho cell (render tùy + fallback String), kèm row/index thật
	// cho callback render.
	const cellText = (
		value: unknown,
		col: DataTableColumn<Record<string, unknown>>,
		row: Record<string, unknown>,
		rowIndex: number
	): string => (col.render ? String(col.render(value, row as never, rowIndex)) : String(value ?? ''));

	// segments highlight: chỉ khi có query + cột filterable (không noHighlight).
	const segmentsFor = (
		value: unknown,
		col: DataTableColumn<Record<string, unknown>>,
		row: Record<string, unknown>,
		rowIndex: number
	): TextSegment[] => {
		const text = cellText(value, col, row, rowIndex);
		if (!ctx?.query || col.noHighlight) return [{ text, isMatch: false }];
		return matchSegments(text, ctx.query);
	};

	// số cột (gồm cột checkbox nếu selectable) cho empty/loading colspan.
	const colCount = $derived((ctx?.columns.length ?? 0) + (configs?.selectable ? 1 : 0));
	const hasRows = $derived(ctx ? ctx.pageRows.length > 0 : true);
	// số row skeleton khi loading (mặc định = pageSize, tối thiểu 3).
	const skeletonRows = $derived(ctx ? Math.max(3, ctx.pageSize) : 3);
</script>

{#if ctx}
	<tbody class="datatable-body">
		{#if configs?.loading}
			{#each Array.from({ length: skeletonRows }) as _, si (si)}
				<tr class="datatable-row datatable-row--skeleton" aria-hidden="true">
					{#if configs?.selectable}
						<td class="datatable-td datatable-td--check">
							<span class="datatable-skeleton datatable-skeleton--check"></span>
						</td>
					{/if}
					{#each ctx.columns as col (col.id)}
						<td class="datatable-td">
							<span class="datatable-skeleton"></span>
						</td>
					{/each}
				</tr>
			{/each}
		{:else if hasRows}
			{#each ctx.pageRows as { row, index }, ri (ctx.getRowId(row, index))}
				{@const rowId = ctx.getRowId(row, index)}
				<tr class="datatable-row" class:selected={ctx.isSelected(rowId)} class:alt={ri % 2 === 1}>
					{#if configs?.selectable}
						<td class="datatable-td datatable-td--check">
							<input
								class="datatable-checkbox"
								type="checkbox"
								aria-label={configs.rowSelectText.replace('{index}', String(index + 1))}
								checked={ctx.isSelected(rowId)}
								onchange={() => ctx.toggleRow(rowId)}
							/>
						</td>
					{/if}
					{#each ctx.columns as col (col.id)}
						{@const value = ctx.getCellValue(row, col)}
						{@const status = col.status ? col.status(value, row) : undefined}
						{@const segments = segmentsFor(value, col, row, index)}
						<td
							class="datatable-td"
							class:align-left={col.align === 'left' || !col.align}
							class:align-center={col.align === 'center'}
							class:align-right={col.align === 'right'}
						>
							{#if status}
								<span
									class="datatable-status datatable-status--{status}"
									>{#each segments as seg, si (si)}
										{#if seg.isMatch}<mark class="datatable-mark">{seg.text}</mark>{:else}{seg.text}{/if}
									{/each}</span>
							{:else}
								{#each segments as seg, si (si)}
									{#if seg.isMatch}<mark class="datatable-mark">{seg.text}</mark>{:else}{seg.text}{/if}
								{/each}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		{:else}
			<tr class="datatable-empty-row">
				<td class="datatable-empty" colspan={colCount}>{configs?.emptyText}</td>
			</tr>
		{/if}
	</tbody>
{/if}

<style lang="scss">
	@use '_styles.scss' as dt;

	.datatable-body {
		display: table-row-group;
	}

	.datatable-row {
		cursor: default;

		.datatable-td {
			@include dt.cell-tokens;
			padding: var(--cell-pad-y, 0.75rem) var(--cell-pad-x, 0.75rem);
			color: var(--content1-foreground, #18181b);
			border-bottom: 1px solid var(--content3, hsl(240 5.88% 90%));
			vertical-align: middle;
		}

		&.alt .datatable-td {
			background: color-mix(in srgb, var(--content2, hsl(240 4.76% 95.88%)) 45%, transparent);
		}

		&.selected .datatable-td {
			background: color-mix(in srgb, var(--primary, var(--color-indigo-500)) 12%, var(--content1, #fff));
		}

		@media (hover: hover) and (pointer: fine) {
			&:hover .datatable-td {
				background: var(--content2, hsl(240 4.76% 95.88%));
			}
			&.selected:hover .datatable-td {
				background: color-mix(in srgb, var(--primary, var(--color-indigo-500)) 18%, var(--content1, #fff));
			}
		}
	}

	.datatable-td--check {
		width: 2.5rem;
	}

	.datatable-td {
		&.align-center {
			text-align: center;
		}
		&.align-right {
			text-align: right;
		}
	}

	.datatable-checkbox {
		width: 1rem;
		height: 1rem;
		margin: 0;
		vertical-align: middle;
		accent-color: var(--primary, var(--color-indigo-500));
		cursor: var(--cursor-interactive);
	}

	// Highlight match search (nền amber nhạt, không đổi chữ).
	.datatable-mark {
		padding: 0 0.1em;
		margin: 0;
		background: color-mix(in srgb, var(--warning, hsl(37 91% 55%)) 24%, transparent);
		color: inherit;
		border-radius: 0.125rem;
	}

	// Status pill (map token semantic).
	.datatable-status {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.4;
		border-radius: 9999px;

		&--success {
			color: var(--success, var(--color-indigo-500));
			background: color-mix(in srgb, var(--success, var(--color-indigo-500)) 14%, transparent);
		}
		&--danger {
			color: var(--danger, var(--color-indigo-500));
			background: color-mix(in srgb, var(--danger, var(--color-indigo-500)) 14%, transparent);
		}
		&--warning {
			color: var(--warning, var(--color-indigo-500));
			background: color-mix(in srgb, var(--warning, var(--color-indigo-500)) 18%, transparent);
		}
		&--info {
			color: var(--content2-foreground, #18181b);
			background: var(--content2, hsl(240 4.76% 95.88%));
		}
		&--default {
			color: var(--muted, #71717a);
			background: var(--content2, hsl(240 4.76% 95.88%));
		}
	}

	.datatable-empty-row {
		.datatable-empty {
			@include dt.cell-tokens;
			padding: 2.5rem var(--cell-pad-x, 0.75rem);
			color: var(--muted, #71717a);
			font-size: 0.875rem;
			text-align: center;
			border-bottom: 0;
		}
	}

	// ── Loading skeleton (row muted, pulse nhẹ; reduced-motion: tĩnh) ──
	.datatable-row--skeleton {
		&:hover .datatable-td {
			background: transparent;
		}
		.datatable-td {
			border-bottom: 1px solid var(--content3, hsl(240 5.88% 90%));
		}
	}

	.datatable-skeleton {
		display: block;
		height: 0.75rem;
		max-width: 75%;
		margin: 0 auto 0;
		border-radius: 9999px;
		background: var(--content2, hsl(240 4.76% 95.88%));
		animation: datatable-shimmer 1.4s ease-in-out infinite;

		&--check {
			width: 1rem;
			height: 1rem;
			max-width: 1rem;
			border-radius: 0.2rem;
			margin: 0;
		}
	}

	@keyframes datatable-shimmer {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.datatable-skeleton {
			animation: none;
		}
	}
</style>
