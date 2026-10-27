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
	import Checkbox from '$components/form/checkbox/Main.svelte';
	import type { MouseEvents } from '$components/interface';

	const ctx = getDataTableContext();
	const configs = ctx?.configs;

	// text hiển thị cho cell (render tùy + fallback String), kèm row/index thật
	// cho callback render.
	const cellText = (
		value: unknown,
		col: DataTableColumn<Record<string, unknown>>,
		row: Record<string, unknown>,
		rowIndex: number
	): string => {
		if (col.render) return String(col.render(value, row as never, rowIndex));
		// Date object (editor date ghi Date vào data) → yyyy-mm-dd GIỜ ĐỊA
		// PHƯƠNG (toISOString là UTC — nửa đêm GMT+7 lùi 1 ngày).
		if (value instanceof Date) {
			const y = value.getFullYear();
			const m = String(value.getMonth() + 1).padStart(2, '0');
			const d = String(value.getDate()).padStart(2, '0');
			return `${y}-${m}-${d}`;
		}
		return String(value ?? '');
	};

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

	// Số cột (gồm cột checkbox + STT + cột actions) cho empty/loading colspan.
	const colCount = $derived(
		(ctx?.columns.length ?? 0) +
			(configs?.selectable && !configs?.indexCheckboxes ? 1 : 0) +
			(configs?.showIndex ? 1 : 0) +
			(ctx?.rowActions ? 1 : 0)
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
		if (ctx?.isMobile) return;
		// cellDetail bật → click cell mở modal chi tiết + focus đúng field (đè edit cell).
		if (ctx?.cellDetail) {
			e.stopPropagation();
			ctx.openRowDetail(rowId, col.id);
			return;
		}
		if (!ctx?.editable) return;
		if (!isCellEditable(col)) return;
		// Đang edit cell/row khác → click cell này chỉ chuyển editor.
		e.stopPropagation();
		ctx.openCellEditor(rowId, col.id, value);
	};

	// ── Row click → modal chi tiết (rowDetail opt-in; không tap control/button/
	// cell editor đang mở) ──
	const onRowTap = (rowId: string, row: Record<string, unknown>, index: number, e: MouseEvent): void => {
		// B5: guard chung mọi nhánh — không tap control/button/cell editor đang mở.
		const target = e.target as HTMLElement;
		if (target.closest('input, button, a, [role="checkbox"], [data-no-tap], .datatable-cell-editor')) return;
		// D6: đã chọn ≥1 row + checkOnRowClick → click bất kỳ đâu trên row toggle chọn.
		if (ctx?.tryToggleRowOnTap(rowId)) return;
		if (ctx?.isMobile) {
			const mode = ctx.configs?.mobileTapMode ?? 'actions';
			if (mode === 'callback') {
				ctx.handleRowClick(row, index);
				return;
			}
			if (mode === 'none') return;
			// mode 'actions' + rowActions → expand action bar (ưu tiên cũ).
			if (ctx.rowActions) ctx.toggleRowActions(rowId);
			return;
		}
		// PC: rowDetail bật → click row mở modal nội bộ; ngược lại bắn callback
		// trang (onRowClick — purchases/customers dùng để mở modal chi tiết).
		if (ctx?.rowDetail) {
			ctx.openRowDetail(rowId);
			return;
		}
		ctx?.handleRowClick(row, index);
	};

	// ── Auto focus input editor ngay khi mount (rAF — caret cuối text) ──
	// Svelte action: chạy khi element mount (input mới render → focus).
	// setSelectionRange THROWS trên input date/number (không hỗ trợ selection)
	// → chỉ set khi selectionStart !== null (text/search/tel/password).
	const autoFocusEditor = (el: HTMLInputElement): void => {
		requestAnimationFrame(() => {
			el.focus();
			if (el.selectionStart === null) return;
			const len = el.value.length;
			el.setSelectionRange(len, len);
		});
	};

	// ── Row checkbox toggle: Checkbox component không có prop onChange —
	// gọi ctx.toggleRow qua events (click + keydown Space/Enter; toggle nội bộ
	// $bindable chỉ đổi hiển thị local, trạng thái thật nằm ở ctx.selected). ──
	const rowCheckEvents = (rowId: string) => [
		{
			events: {
				click: () => ctx?.toggleRow(rowId),
				// Signature đúng EventCompact (MouseEvents là interface object).
				keydown: (e?: Event | MouseEvents | TouchEvent | KeyboardEvent) => {
					const key = (e as KeyboardEvent | undefined)?.key;
					if (key === ' ' || key === 'Enter') ctx?.toggleRow(rowId);
				}
			}
		}
	];
</script>

{#if ctx}
	<tbody class="datatable-body">
		{#if configs?.loading}
			{#each Array.from({ length: skeletonRows }) as _, si (si)}
				<tr class="datatable-row datatable-row--skeleton" aria-hidden="true">
					{#if configs?.selectable && !configs?.indexCheckboxes}
						<td class="datatable-td datatable-td--check">
							<span class="datatable-skeleton datatable-skeleton--check"></span>
						</td>
					{/if}
					{#if configs?.showIndex}
						<td class="datatable-td datatable-td--index">
							{#if configs?.indexCheckboxes}
								<span class="datatable-index-num"></span>
							{/if}
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
					onclick={(e) => onRowTap(rowId, row, index, e)}
				>
					{#if configs?.selectable && !configs?.indexCheckboxes}
						<td class="datatable-td datatable-td--check">
											<Checkbox
								checked={ctx.isSelected(rowId)}
								size={configs.size}
								color="primary"
								aria-label={configs.rowSelectText.replace('{index}', String(index + 1))}
								class="datatable-row-checkbox"
								events={rowCheckEvents(rowId)}
							/>
						</td>
					{/if}
					{#if configs?.showIndex}
						<td class="datatable-td datatable-td--index">
							{#if configs?.indexCheckboxes}
								<span class="datatable-index-num">{ctx.rowIndexText(ri)}</span>
								<span class="datatable-index-check">
									<Checkbox
										checked={ctx.isSelected(rowId)}
										size={configs.size}
										color="primary"
										aria-label={configs.rowSelectText.replace('{index}', String(index + 1))}
										class="datatable-row-checkbox"
										events={rowCheckEvents(rowId)}
									/>
				</span>
							{:else}
								{ctx.rowIndexText(ri)}
							{/if}
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
							class:datatable-td--status={!!status}
							data-cell-id={`${rowId}:${col.id}`}
							title={segments.length > 0 ? segments.map((seg) => seg.text).join('') : undefined}
							onclick={(e) => onCellClick(rowId, col, value, e)}
						>
							{#if cellEditing}
								<!-- Inline cell editor: theo kiểu giá trị (wave 8) + auto focus caret cuối -->
								{@const editorType = ctx.getEditorType(col, value)}
								<div class="datatable-cell-editor">
									{#if editorType === 'boolean'}
										<!-- Checkbox nhỏ (role=switch — value 2-way qua setEditValue) -->
										<input
											class="datatable-cell-check"
											type="checkbox"
											role="switch"
											aria-label={ctx.configs.editText}
											checked={ctx.getEditValue() === 'true'}
											onchange={(e) =>
												ctx.setEditValue((e.target as HTMLInputElement).checked ? 'true' : 'false')}
											onkeydown={onEditorKeydown}
										/>
									{:else if editorType === 'date'}
										<!-- Native input[type=date] (panel DatePicker composite bị clip
										     trong td overflow:hidden — modal detail dùng DatePicker) -->
										<input
											use:autoFocusEditor
											class="datatable-cell-input"
											type="date"
											aria-label={ctx.configs.editText}
											value={ctx.getEditValue() ?? ''}
											oninput={(e) => ctx.setEditValue((e.target as HTMLInputElement).value)}
											onkeydown={onEditorKeydown}
											data-test="datatable-cell-input-date"
										/>
									{:else if editorType === 'select'}
										<!-- Select options (col.options) -->
										<select
											class="datatable-cell-input datatable-cell-select"
											aria-label={ctx.configs.editText}
											value={ctx.getEditValue() ?? ''}
											onchange={(e) => ctx.setEditValue((e.target as HTMLSelectElement).value)}
											onkeydown={onEditorKeydown}
										>
											{#each col.options ?? [] as opt (opt)}
												<option value={opt}>{opt}</option>
											{/each}
										</select>
									{:else}
										<!-- text | number (oldValue number → input type=number) -->
										<input
											use:autoFocusEditor
											class="datatable-cell-input"
											type={editorType === 'number' ? 'number' : 'text'}
											aria-label={ctx.configs.editText}
											value={ctx.getEditValue() ?? ''}
											oninput={(e) => ctx.setEditValue((e.target as HTMLInputElement).value)}
											onkeydown={onEditorKeydown}
											data-test="datatable-cell-input"
										/>
									{/if}
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
							{#if ctx.actionsContent}
								<!-- B6.2: snippet actions custom (đè nút built-in) — page admin
								     truyền nút đặc thù (Edit/Role/Status/Reset/Delete/Restore). -->
								{@render ctx.actionsContent(row, rowId)}
							{:else}
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
										class="datatable-action-btn datatable-action-btn--copy"
										aria-label={ctx.configs.copyText}
										title={ctx.configs.copyText}
										data-test="datatable-row-copy"
										onclick={() => ctx.copyRow(rowId)}
									>
										<span aria-hidden="true">⧉</span>
									</button>
									<button
										type="button"
										class="datatable-action-btn datatable-action-btn--clone"
										aria-label={ctx.configs.cloneText}
										title={ctx.configs.cloneText}
										data-test="datatable-row-clone"
										onclick={() => ctx.cloneRow(rowId)}
									>
										<span aria-hidden="true">⎘</span>
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
							{/if}
						</td>
					{/if}
				</tr>
				{#if ctx.isMobile && rowExpanded}
					<!-- Mobile: hàng action bar dưới row (tap row → expand) -->
					<tr class="datatable-row-actions-row" data-role="mobile-actions">
						<td colspan={colCount}>
							<div class="datatable-mobile-actions">
								<span class="datatable-mobile-actions-label">{ctx.configs.rowActionsLabel}</span>
								{#if ctx.actionsContent}
									<!-- B6.2: snippet actions custom cho mobile (nút built-in
									     Update/Delete gọi onRowUpdate/onRowDelete — page dùng
									     snippet thường không truyền 2 callback đó → nút chết). -->
									{@render ctx.actionsContent(row, rowId)}
								{:else}
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
								{/if}
							</div>
						</td>
					</tr>
				{/if}
			{/each}
		{:else}
			<tr class="datatable-empty-row">
				<td class="datatable-empty" colspan={colCount}>
					<span class="datatable-empty-text">{configs?.emptyText}</span>
				</td>
			</tr>
		{/if}
	</tbody>
{/if}

<style lang="scss">
	@use '$styles/theme-mixins' as *;
	@use '_styles.scss' as dt;

	.datatable-body {
		display: table-row-group;
	}

	// Cột STT (showIndex): hẹp, căn giữa, số tabular.
	.datatable-td--index {
		text-align: center;
		font-variant-numeric: tabular-nums;
		color: var(--muted, #71717a);
	}

	// Align theo cột (col.align — td mặc định kế thừa left; Head đã có rule riêng).
	.datatable-td.align-right {
		text-align: right;
	}
	.datatable-td.align-center {
		text-align: center;
	}

	// ── indexCheckboxes: checkbox gộp vào ô STT — 2 lớp chồng nhau ──
	// num = số STT; check = checkbox. Mặc định num hiện, check ẩn (opacity 0
	// vẫn nhận click/tap). Hover/focus td → swap. Position relative trên td.
	.datatable-td--index {
		position: relative;
	}

	.datatable-index-num,
	.datatable-index-check {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		pointer-events: none; // span chỉ là lớp phủ — tương tác thuộc td/checkbox con
	}

	.datatable-index-num {
		opacity: 1;
		transition: opacity 120ms ease;
	}

	.datatable-index-check {
		opacity: 0;
		transition: opacity 120ms ease;

		// checkbox con nhận click riêng (span phủ pointer-events none).
		:global(.datatable-row-checkbox) {
			pointer-events: auto;
		}
	}

	// Hover/focus ô STT → hiện check, ẩn num (chỉ thiết bị hover thật).
	@media (hover: hover) and (pointer: fine) {
		:global(.datatable-root.datatable-index-check)
			.datatable-td--index:hover
			.datatable-index-num {
			opacity: 0;
		}

		:global(.datatable-root.datatable-index-check)
			.datatable-td--index:hover
			.datatable-index-check {
			opacity: 1;
		}

		// Focus keyboard vào checkbox trong ô STT.
		:global(.datatable-root.datatable-index-check)
			.datatable-td--index:focus-within
			.datatable-index-num {
			opacity: 0;
		}

		:global(.datatable-root.datatable-index-check)
			.datatable-td--index:focus-within
			.datatable-index-check {
			opacity: 1;
		}
	}

	// Row đã chọn: check luôn hiện (kể cả không hover).
	:global(.datatable-root.datatable-index-check)
		.datatable-row.selected
		.datatable-td--index
		.datatable-index-num {
		opacity: 0;
	}

	:global(.datatable-root.datatable-index-check)
		.datatable-row.selected
		.datatable-td--index
		.datatable-index-check {
		opacity: 1;
	}

	// Touch (không hover): tap ô STT vẫn được — checkbox pointer-events auto
	// đè lên num, tap = toggle (behavior ghi chú cho probe).

	// ── D6: checkbox hover-only — ẩn (opacity 0), hiện khi hover row hoặc row
	// đã chọn. Root class .datatable-check-hover (Main render), td--check scoped
	// ở đây; :global() root vì khác scope hash. Checkbox root class
	// .datatable-row-checkbox do prop class của Checkbox → :global() (khác hash). ──
	:global(.datatable-root.datatable-check-hover) .datatable-td--check :global(.datatable-row-checkbox) {
		opacity: 0;
		transition: opacity 120ms ease;
	}

	@media (hover: hover) and (pointer: fine) {
		:global(.datatable-root.datatable-check-hover) .datatable-row:hover .datatable-td--check :global(.datatable-row-checkbox),
		:global(.datatable-root.datatable-check-hover) .datatable-row:focus-within .datatable-td--check :global(.datatable-row-checkbox) {
			opacity: 1;
		}
	}

	// Row đã chọn: checkbox LUÔN hiện (kể cả không hover).
	:global(.datatable-root.datatable-check-hover) .datatable-row.selected .datatable-td--check :global(.datatable-row-checkbox) {
		opacity: 1;
	}

	.datatable-row {
		cursor: default;

		.datatable-td {
			@include dt.cell-tokens;
			padding: var(--cell-pad-y, 0.75rem) var(--cell-pad-x, 0.75rem);
			color: var(--content1-foreground, #18181b);
			border-bottom: 1px solid var(--content3, hsl(240 5.88% 90%));
			vertical-align: middle;
			// ── Ellipsis text tràn (auto-fit width — title attr đầy đủ) ──
			// Chỉ khi cột có width (auto-fit/resize) — table-layout auto không
			// tràn khi không có width cố định.
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			max-width: 0; // force td co theo width khi table-layout auto
		}

		&.alt .datatable-td {
			background: color-mix(in srgb, var(--content2, hsl(240 4.76% 95.88%)) 45%, transparent);
		}

		&.selected .datatable-td {
			background: color-mix(in srgb, var(--primary, var(--color-indigo-500)) 12%, var(--content1, #fff));
		}

		// Mobile: dòng đang expand action bar — highlight nhẹ (primary mix)
		// để user biết bar dưới nó thuộc dòng nào (bar nền content1 đặc).
		&.row-expanded .datatable-td {
			background: color-mix(in srgb, var(--primary, var(--color-indigo-500)) 8%, var(--content1, #fff));
		}
	}

	// Hover highlight CHỈ khi hoverable (visual.hoverable) — guard PC.
	// .hoverable nằm trên root (render bởi Main.svelte — scope hash khác
	// Body) nên phải match qua :global như pattern bordered-columns.
	@media (hover: hover) and (pointer: fine) {
		:global(.datatable-root.hoverable) .datatable-row:hover .datatable-td {
			background: var(--content2, hsl(240 4.76% 95.88%));
		}
		:global(.datatable-root.hoverable) .datatable-row.selected:hover .datatable-td {
			background: color-mix(in srgb, var(--primary, var(--color-indigo-500)) 18%, var(--content1, #fff));
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

		// ── Editor number: không spinner lớn, giữ font mono nhẹ ──
		&[type='number'] {
			font-variant-numeric: tabular-nums;
		}

		// ── Editor select: cursor pointer + appearance giữ native (đơn giản) ──
		&.datatable-cell-select {
			cursor: var(--cursor-interactive);
			padding-right: 0.5rem;
		}
	}

	// ── Editor boolean (Checkbox nhỏ trong cell) ──
	.datatable-cell-check {
		width: 1.125rem;
		height: 1.125rem;
		margin: 0;
		cursor: var(--cursor-interactive);
		accent-color: var(--primary, var(--color-indigo-500));
		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, hsl(241 100% 68.6%));
			outline-offset: 2px;
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

	// ── Status pill column (B6.2 orders: pill bị clip ~15px trên mobile 375) ──
	// Rule ellipsis của .datatable-td (max-width:0 + overflow:hidden) cho phép
	// table-layout auto nén cột status dưới min-content pill khi tổng nội dung
	// vượt viewport — pill nền tròn bị cắt chữ ("Chờ xác nhâ|n"). Thoát ellipsis
	// cho td có pill: min-width:fit-content ép cột giữ đúng rộng pill, text tràn
	// chuyển sang td khác (ellipsis đúng chỗ của nó). Cùng cấp nesting với rule
	// actions dưới đây → hòa cùng số classes, thắng theo source order.
	.datatable-row {
		.datatable-td--status {
			// max-width:none bắt buộc: rule ellipsis đặt max-width:0 — table-layout
			// auto phân phối cột theo max-width nên fit-content một mình vô hiệu
			// (đo thực tế: max-width 0 thắng → td vẫn 86px, pill 90px tràn đè).
			max-width: none;
			min-width: fit-content;
			overflow: visible;
		}
	}

	// ── Row actions column (PC: ẩn → hover row hiện; mobile: ẩn — dùng expand) ──
	// B6.2: thoát rule ellipsis của .datatable-td (max-width:0 + overflow:hidden
	// kẹp cột còn ~24px → snippet actionsContent 5 nút tràn đè td kế bên —
	// elementFromPoint rơi vào td created, click nút không bao giờ tới).
	// LƯU Ý specificity: rule dưới NẰM TRONG .datatable-row để compile thành
	// `.datatable-row.svelte-x .datatable-td--actions.svelte-x` (4 classes,
	// hòa với rule ellipsis `.datatable-row.svelte-x .datatable-td:where(...)`
	// và thắng theo source order). Nếu viết phẳng `.datatable-td--actions`
	// (2 classes) rule ellipsis kẹp max-width:0 thắng → nút actions bị nén
	// 39px, text clip giữa ("imer d|nge st|e cust").
	// width:1% + min-width:fit-content: table-layout auto co cột về đúng
	// rộng nội dung nút (fit-content) thay vì max-width:none để cột nuốt
	// toàn bộ phần dư (~50% bảng) đẩy pill status/data clip mép. Đo thực
	// tế customers 6 cột: actions 406px (vừa 3 nút text), data cột đủ rộng.
	.datatable-row {
		.datatable-td--actions {
			width: 1%;
			max-width: none;
			min-width: fit-content;
			overflow: visible;
			text-overflow: clip;
			white-space: nowrap;
			text-align: right;
		}
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

		&--copy {
			color: var(--content1-foreground, #18181b);

			&:hover {
				background: var(--content2, hsl(240 4.76% 95.88%));
			}
		}

		&--clone {
			color: var(--primary, var(--color-indigo-500));

			&:hover {
				background: color-mix(in srgb, var(--primary, var(--color-indigo-500)) 10%, transparent);
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
		// B14: bar nằm trong <td colspan> trải theo table width — khi table
		// nhiều cột rộng hơn viewport (vd products 7 cột = 413px > 375px),
		// block fill-full-width khiến nút bị đẩy ra ngoài vùng nhìn thấy.
		// fit-content hút div về nội dung (nút không tràn); sticky pin vào
		// mép trái vùng cuộn để bar vẫn hiển thị khi user cuộn table ngang.
		position: sticky;
		left: 0;
		width: fit-content;
		max-width: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;

		// B6.2: snippet actionsContent (vd .row-actions của page admin) cũng
		// phải wrap bên trong bar — mobile 375px không đủ 1 hàng cho 5 nút text.
		> :global(.row-actions),
		> :global(.admin-row-actions) {
			flex-wrap: wrap;
			justify-content: flex-start;
		}
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

	// ── Checkbox component (thay native input — đồng bộ hệ thống) ──
	// Class .datatable-row-checkbox nằm trên root Checkbox component (khác
	// scope hash — scoped CSS ở đây không match; căn giữa từ td
	// vertical-align: middle). Giữ class làm hook DOM.

	// Highlight match search (nền amber nhạt, không đổi chữ).
	.datatable-mark {
		padding: 0 0.1em;
		margin: 0;
		background: color-mix(in srgb, var(--warning, hsl(37 91% 55%)) 24%, transparent);
		color: inherit;
		border-radius: 0.125rem;
	}

	// Status pill (map token semantic).
	// AA 12px/600 (cần 4.5:1): chữ dùng bậc đậm hơn token gốc — light --success-500
	// chỉ 3.19:1 trên tint 14% tự trộn; --success-700 đạt 5.37:1. Dark token sẵn pass
	// (7+:1) — giữ nguyên. Cùng pattern cho danger (5.58) / warning (4.63 trên tint 10).
	.datatable-status {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.4;
		border-radius: 9999px;

		&--success {
			color: var(--success-700, hsl(150 100% 20.98%));
			background: color-mix(in srgb, var(--success, var(--color-indigo-500)) 14%, transparent);

			@include theme-dark {
				color: var(--success, var(--color-indigo-500));
			}
		}
		&--danger {
			color: var(--danger-700, hsl(353.32 100% 34.72%));
			background: color-mix(in srgb, var(--danger, var(--color-indigo-500)) 14%, transparent);

			@include theme-dark {
				color: var(--danger-500, hsl(339 90% 60.78%));
			}
		}
		&--warning {
			color: var(--warning-700, hsl(31.95 100% 32.16%));
			background: color-mix(in srgb, var(--warning, var(--color-indigo-500)) 14%, transparent);

			@include theme-dark {
				color: var(--warning, hsl(37.03 91.27% 55.1%));
			}
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

		.datatable-empty-text {
			display: block;
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
			width: 1.25rem;
			height: 1.25rem;
			max-width: 1.25rem;
			border-radius: var(--border-radius-2xs, 0.2rem);
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
