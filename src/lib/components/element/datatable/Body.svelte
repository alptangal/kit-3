<script lang="ts">
	// src/lib/components/element/datatable/Body.svelte
	// DataTable.Body — tbody: td theo align, row checkbox (selectable),
	// highlight match search (matchSegments, NFD nhạy dấu), status pill, empty state
	// (full-span muted row) khi data rỗng HOẶC không có kết quả khớp filter.
	// Mới: edit cell inline (click cell → input + ✓/✕), row actions PC
	// (hover → ✎/🗑), mobile (tap row → expand action bar), lazy load sentinel
	// (last row → loadMore), visual striped/hover/bordered.
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

	// Cột cho phép edit cell? (config editable.columns — undefined = mọi cột
	// không status/render; có status/render thì edit cell không ý nghĩa).
	const isCellEditable = (col: DataTableColumn<Record<string, unknown>>): boolean => {
		if (!ctx?.editable) return false;
		if (col.status || col.render) return false;
		const allowed = ctx.editableColumns;
		if (allowed && !allowed.includes(col.id)) return false;
		return true;
	};

	// Số cột (gồm cột checkbox + cột actions) cho empty/loading colspan.
	const colCount = $derived(
		(ctx?.columns.length ?? 0) + (configs?.selectable ? 1 : 0) + (ctx?.rowActions ? 1 : 0)
	);
	const hasRows = $derived(ctx ? ctx.pageRows.length > 0 : true);
	// số row skeleton khi loading (mặc định = pageSize, tối thiểu 3).
	const skeletonRows = $derived(ctx ? Math.max(3, ctx.pageSize) : 3);

	// ── Cell editor keyboard (Enter = confirm, Escape = cancel) ──
	const onEditorKeydown = (e: KeyboardEvent): void => {
		if (!ctx) return;
		if (e.key === 'Enter') {
			e.preventDefault();
			ctx.confirmCellEditor();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			ctx.cancelCellEditor();
		}
	};

	// ── Row editor keyboard (Enter = commit cả row, Escape = cancel) ──
	const onRowEditorKeydown = (e: KeyboardEvent): void => {
		if (!ctx) return;
		if (e.key === 'Enter') {
			e.preventDefault();
			ctx.closeRowEditor(true);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			ctx.closeRowEditor(false);
		}
	};

	// ── PC: click cell giá trị → mở inline editor (mobile: tap row → expand) ──
	const onCellClick = (
		rowId: string,
		col: DataTableColumn<Record<string, unknown>>,
		value: unknown,
		e: MouseEvent
	): void => {
		if (!ctx?.editable || ctx.isMobile) return;
		if (!isCellEditable(col)) return;
		// Đang edit cell/row khác → click cell này chỉ chuyển editor.
		e.stopPropagation();
		ctx.openCellEditor(rowId, col.id, value);
	};

	// ── Mobile: tap row → expand actions (không tap checkbox/input) ──
	const onRowTap = (rowId: string, e: MouseEvent): void => {
		if (!ctx?.rowActions || !ctx.isMobile) return;
		const target = e.target as HTMLElement;
		if (target.closest('input, button, a, [data-no-tap]')) return;
		ctx.toggleRowActions(rowId);
	};
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
					{#if ctx.rowActions}
						<td class="datatable-td datatable-td--actions">
							<span class="datatable-skeleton"></span>
						</td>
					{/if}
				</tr>
			{/each}
		{:else if hasRows}
			{#each ctx.pageRows as { row, index }, ri (ctx.getRowId(row, index))}
				{@const rowId = ctx.getRowId(row, index)}
				{@const rowExpanded = ctx.isRowExpanded(rowId)}
				{@const rowEditing = ctx.isRowEditing(rowId)}
				<tr
					class="datatable-row"
					class:selected={ctx.isSelected(rowId)}
					class:alt={ctx.configs.striped && ri % 2 === 1}
					class:row-expanded={rowExpanded}
					class:row-editing={rowEditing}
					data-row-id={rowId}
					onclick={(e) => onRowTap(rowId, e)}
				>
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
						{@const cellEditing = ctx.isEditing(rowId, col.id)}
						{@const rowEditValue = ctx.getRowEditValue(rowId, col.id)}
						<td
							class="datatable-td"
							class:align-left={col.align === 'left' || !col.align}
							class:align-center={col.align === 'center'}
							class:align-right={col.align === 'right'}
							class:cell-editing={cellEditing}
							class:cell-editable={isCellEditable(col) && !cellEditing && !rowEditing}
							data-cell-id={`${rowId}:${col.id}`}
							onclick={(e) => onCellClick(rowId, col, value, e)}
						>
							{#if cellEditing}
								<!-- Inline cell editor: input + confirm/cancel button -->
								<div class="datatable-cell-editor">
									<input
										class="datatable-cell-input"
										type="text"
										aria-label={ctx.configs.editText}
										value={ctx.getEditValue() ?? ''}
										oninput={(e) => ctx.setEditValue((e.target as HTMLInputElement).value)}
										onkeydown={onEditorKeydown}
									/>
									<button
										type="button"
										class="datatable-cell-btn datatable-cell-btn--confirm"
										aria-label={ctx.configs.confirmText}
										title={ctx.configs.confirmText}
										data-test="datatable-cell-confirm"
										onclick={(e) => {
											e.stopPropagation();
											ctx.confirmCellEditor();
										}}
									>
										<span aria-hidden="true">✓</span>
									</button>
									<button
										type="button"
										class="datatable-cell-btn datatable-cell-btn--cancel"
										aria-label={ctx.configs.cancelText}
										title={ctx.configs.cancelText}
										data-test="datatable-cell-cancel"
										onclick={(e) => {
											e.stopPropagation();
											ctx.cancelCellEditor();
										}}
									>
										<span aria-hidden="true">✕</span>
									</button>
								</div>
							{:else if rowEditing && rowEditValue !== undefined && !col.status && !col.render}
								<!-- Row editor: input cho mỗi cell (giữ nguyên cột status/render) -->
								<input
									class="datatable-cell-input datatable-row-input"
									type="text"
									aria-label={`${col.label} — ${ctx.configs.editText}`}
									value={rowEditValue}
									oninput={(e) => ctx.setRowEditValue(rowId, col.id, (e.target as HTMLInputElement).value)}
									onkeydown={onRowEditorKeydown}
								/>
							{:else if status}
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
					{#if ctx.rowActions}
						<td class="datatable-td datatable-td--actions" data-role="row-actions">
							<div class="datatable-row-actions">
								<button
									type="button"
									class="datatable-action-btn datatable-action-btn--edit"
									aria-label={ctx.configs.updateText}
									title={ctx.configs.updateText}
									data-test="datatable-row-edit"
									onclick={() => ctx.openRowEditor(rowId)}
								>
									<span aria-hidden="true">✎</span>
								</button>
								<button
									type="button"
									class="datatable-action-btn datatable-action-btn--delete"
									aria-label={ctx.configs.deleteText}
									title={ctx.configs.deleteText}
									data-test="datatable-row-delete"
									onclick={() => ctx.requestDeleteRow(rowId)}
								>
									<span aria-hidden="true">🗑</span>
								</button>
							</div>
						</td>
					{/if}
				</tr>
				{#if ctx.isMobile && rowExpanded}
					<!-- Mobile: hàng action bar dưới row (tap row → expand) -->
					<tr class="datatable-row-actions-row" data-role="mobile-actions">
						<td colspan={colCount}>
							<div class="datatable-mobile-actions">
								<span class="datatable-mobile-actions-label">{ctx.configs.rowActionsLabel}</span>
								<button
									type="button"
									class="datatable-mobile-action datatable-mobile-action--update"
									onclick={() => {
										ctx.handleRowUpdate(row, rowId);
									}}
								>
									{ctx.configs.updateText}
								</button>
								<button
									type="button"
									class="datatable-mobile-action datatable-mobile-action--delete"
									onclick={() => ctx.requestDeleteRow(rowId)}
								>
									{ctx.configs.deleteText}
				</button>
							</div>
						</td>
					</tr>
				{/if}
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

		// Hover highlight CHỈ khi hoverable (visual.hoverable) — guard PC.
		@media (hover: hover) and (pointer: fine) {
			&:hover .datatable-td {
				background: var(--content2, hsl(240 4.76% 95.88%));
			}
			&.selected:hover .datatable-td {
				background: color-mix(in srgb, var(--primary, var(--color-indigo-500)) 18%, var(--content1, #fff));
			}
		}
	}

	// ── Cell editable (PC cursor text — DNA §3.6) ──
	.datatable-td.cell-editable {
		@media (hover: hover) and (pointer: fine) {
			cursor: text;
		}
	}

	.datatable-td.cell-editing {
		padding: calc(var(--cell-pad-y, 0.75rem) * 0.4) calc(var(--cell-pad-x, 0.75rem) * 0.5);
	}

	// ── Inline cell editor (input + confirm/cancel) ──
	.datatable-cell-editor {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.datatable-cell-input {
		flex: 1;
		min-width: 0;
		height: 1.875rem;
		padding: 0 0.5rem;
		font: inherit;
		font-size: 0.875rem;
		color: var(--content1-foreground, #18181b);
		background: var(--content1, #fff);
		border: 1px solid var(--primary, var(--color-indigo-500));
		border-radius: var(--border-radius-sm, 0.375rem);
		cursor: text;
		@include dt.focus-ring;

		&::placeholder {
			color: var(--muted, #71717a);
		}
	}

	.datatable-cell-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.875rem;
		height: 1.875rem;
		flex-shrink: 0;
		padding: 0;
		font-size: 0.8125rem;
		line-height: 1;
		border: 1px solid transparent;
		border-radius: var(--border-radius-sm, 0.375rem);
		cursor: var(--cursor-interactive);

		&--confirm {
			color: hsl(0 0% 100%);
			background: var(--success, var(--color-green-500));

			&:hover {
				opacity: 0.9;
			}
		}

		&--cancel {
			color: var(--content1-foreground, #18181b);
			background: var(--content2, hsl(240 4.76% 95.88%));

			&:hover {
				opacity: 0.85;
			}
		}

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, hsl(241 100% 68.6%));
			outline-offset: 2px;
		}
	}

	// ── Row actions column (PC: ẩn → hover row hiện; mobile: ẩn — dùng expand) ──
	.datatable-td--actions {
		width: 5rem;
		white-space: nowrap;
	}

	.datatable-row-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		opacity: 0;
		transition: opacity 150ms ease;
	}

	// PC: hover row → hiện action buttons. Mobile: ẩn hẳn (dùng expand bar).
	@media (hover: hover) and (pointer: fine) {
		.datatable-row:hover .datatable-row-actions,
		.datatable-row:focus-within .datatable-row-actions {
			opacity: 1;
		}
	}

	@media (hover: none) and (pointer: coarse) {
		.datatable-td--actions {
			display: none;
		}
	}

	.datatable-action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		font-size: 0.8125rem;
		line-height: 1;
		border: 1px solid var(--content3, hsl(240 5.88% 90%));
		border-radius: var(--border-radius-sm, 0.375rem);
		background: var(--content1, #fff);
		cursor: var(--cursor-interactive);
		transition: background-color 150ms ease;

		&--edit {
			color: var(--content1-foreground, #18181b);

			&:hover {
				background: var(--content2, hsl(240 4.76% 95.88%));
			}
		}

		&--delete {
			color: var(--danger, var(--color-red-500));

			&:hover {
				background: color-mix(in srgb, var(--danger, var(--color-red-500)) 10%, transparent);
			}
		}

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, hsl(241 100% 68.6%));
			outline-offset: 2px;
		}
	}

	// ── Mobile expand action bar (dưới row) ──
	.datatable-row-actions-row {
		> td {
			padding: 0 var(--cell-pad-x, 0.75rem) 0.5rem;
			border-bottom: 1px solid var(--content3, hsl(240 5.88% 90%));
			background: color-mix(in srgb, var(--content2, hsl(240 4.76% 95.88%)) 30%, transparent);
		}
	}

	.datatable-mobile-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.datatable-mobile-actions-label {
		font-size: 0.75rem;
		color: var(--muted, #71717a);
		margin-right: auto;
	}

	.datatable-mobile-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.75rem;
		min-height: 2.75rem; // touch target 44px (DNA §6.2b)
		padding: 0 0.875rem;
		font-size: 0.8125rem;
		font-weight: 600;
		border-radius: var(--border-radius-sm, 0.375rem);
		border: 1px solid var(--content3, hsl(240 5.88% 90%));
		cursor: var(--cursor-interactive);

		&--update {
			color: var(--content1-foreground, #18181b);
			background: var(--content1, #fff);
		}

		&--delete {
			color: var(--danger, var(--color-red-500));
			background: color-mix(in srgb, var(--danger, var(--color-red-500)) 8%, transparent);
			border-color: color-mix(in srgb, var(--danger, var(--color-red-500)) 30%, transparent);
		}

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, hsl(241 100% 68.6%));
			outline-offset: 2px;
		}
	}

	// ── Bordered columns (visual.bordered) ──
	:global(.datatable-root.bordered-columns) .datatable-td,
	:global(.datatable-root.bordered-columns) .datatable-th {
		border-right: 1px solid var(--content3, hsl(240 5.88% 90%));

		&:last-child {
			border-right: 0;
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
