<script lang="ts">
	// src/lib/components/element/datatable/Head.svelte
	// DataTable.Head — thead: th scope="col" + aria-sort. Cột sort được
	// render nút button (tránh th inside button = invalid HTML). Nền
	// --content2 (token, không hardcode).
	// Mới: select-all dùng Checkbox component (indeterminate khi một phần
	// chọn — aria-checked="mixed" + dash indicator).
	import Checkbox from '$components/form/checkbox/Main.svelte';
	import type { MouseEvents } from '$components/interface';
	import { getDataTableContext } from './_context';
	import type { DataTableColumn } from './_interface';

	const ctx = getDataTableContext();
	const configs = ctx?.configs;

	// indeterminate: một số (không phải tất cả) row trang hiện tại đã chọn.
	const indeterminate = $derived.by(
		() => !!ctx && !ctx.allPageSelected && ctx.pageRows.some(({ row, index }) => ctx.isSelected(ctx.getRowId(row, index)))
	);

	// ── Select-all toggle: Checkbox component không có prop onChange —
	// gọi ctx.togglePageSelection qua events (click + keydown Space/Enter). ──
	const selectAllEvents = () => [
		{
			events: {
				click: () => ctx?.togglePageSelection(),
				// Signature đúng EventCompact (MouseEvents là interface object).
				keydown: (e?: Event | MouseEvents | TouchEvent | KeyboardEvent) => {
					const key = (e as KeyboardEvent | undefined)?.key;
					if (key === ' ' || key === 'Enter') ctx?.togglePageSelection();
				}
			}
		}
	];

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
			{#if configs?.selectable && !configs?.indexCheckboxes}
				<th class="datatable-th datatable-th--check" scope="col">
					<Checkbox
						checked={ctx.allPageSelected}
						indeterminate={indeterminate}
						size={configs.size}
						color="primary"
						aria-label={configs.selectAllText}
						class="datatable-selectall-checkbox"
						events={selectAllEvents()}
					/>
				</th>
			{/if}
			{#if configs?.showIndex}
				<th class="datatable-th datatable-th--index" scope="col">
					{#if configs?.indexCheckboxes}
						<span class="datatable-index-num">#</span>
						<span class="datatable-index-check">
							<Checkbox
								checked={ctx.allPageSelected}
								indeterminate={indeterminate}
								size={configs.size}
								color="primary"
								aria-label={configs.selectAllText}
								class="datatable-selectall-checkbox"
								events={selectAllEvents()}
							/>
						</span>
					{:else}
						#
					{/if}
				</th>
			{/if}
			{#each ctx.columns as col, ci (col.id)}
				{#if configs?.sortable && col.sortable !== false}
					<th
						class="datatable-th"
						scope="col"
						aria-sort={ariaSort(col)}
						style:width={ctx.columnWidth(col.id) !== undefined
							? `${ctx.columnWidth(col.id)}px`
							: (col.width ?? undefined)}
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
						{#if configs?.resizable}
							<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
							<!-- Handle resize mép phải th: mousedown drag + dblclick reset -->
							<span
								class="datatable-resize-handle"
								role="separator"
								aria-orientation="vertical"
								aria-label={`Resize ${col.label}`}
								data-test={`datatable-resize-${col.id}`}
								onmousedown={(e) => ctx.startResize(col.id, e)}
								ondblclick={() => ctx.resetColumnWidth(col.id)}
							></span>
						{/if}
					</th>
				{:else}
					<th
						class="datatable-th"
						scope="col"
						aria-sort={ariaSort(col)}
						class:align-left={col.align === 'left' || !col.align}
						class:align-center={col.align === 'center'}
						class:align-right={col.align === 'right'}
						style:width={ctx.columnWidth(col.id) !== undefined
							? `${ctx.columnWidth(col.id)}px`
							: (col.width ?? undefined)}
					>
						<span class="datatable-th-label">{col.label}</span>
						{#if configs?.resizable}
							<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
							<span
								class="datatable-resize-handle"
								role="separator"
								aria-orientation="vertical"
								aria-label={`Resize ${col.label}`}
								data-test={`datatable-resize-${col.id}`}
								onmousedown={(e) => ctx.startResize(col.id, e)}
								ondblclick={() => ctx.resetColumnWidth(col.id)}
							></span>
						{/if}
					</th>
				{/if}
			{/each}
			{#if ctx.rowActions}
				<!-- B6.2: th cột actions — tbody luôn render td cuối (built-in 4 nút
				     hoặc snippet actionsContent) nên thead cần cột tương ứng. -->
				<th class="datatable-th datatable-th--actions" scope="col">
					<span class="datatable-th-label">{configs?.actionsText}</span>
				</th>
			{/if}
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
		position: relative;
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

	// Cột STT (showIndex): hẹp, căn giữa.
	.datatable-th--index {
		width: 3rem;
		text-align: center;
	}

	// ── indexCheckboxes: th '#' đổi thành checkbox select-all khi hover ──
	// Cùng pattern td--index (Body): 2 lớp num/check chồng nhau.
	.datatable-th--index {
		position: relative;
	}

	.datatable-index-num,
	.datatable-index-check {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	.datatable-index-num {
		opacity: 1;
		transition: opacity 120ms ease;
	}

	.datatable-index-check {
		opacity: 0;
		transition: opacity 120ms ease;

		:global(.datatable-selectall-checkbox) {
			pointer-events: auto;
		}
	}

	@media (hover: hover) and (pointer: fine) {
		:global(.datatable-root.datatable-index-check)
			.datatable-th--index:hover
			.datatable-index-num,
		:global(.datatable-root.datatable-index-check)
			.datatable-th--index:focus-within
			.datatable-index-num {
			opacity: 0;
		}

		:global(.datatable-root.datatable-index-check)
			.datatable-th--index:hover
			.datatable-index-check,
		:global(.datatable-root.datatable-index-check)
			.datatable-th--index:focus-within
			.datatable-index-check {
			opacity: 1;
		}
	}

	// Có row trang nào được chọn → select-all luôn hiện (mirror indeterminate).
	:global(.datatable-root.datatable-index-check.has-selection)
		.datatable-th--index
		.datatable-index-num {
		opacity: 0;
	}

	:global(.datatable-root.datatable-index-check.has-selection)
		.datatable-th--index
		.datatable-index-check {
		opacity: 1;
	}

	// B6.2: th cột actions — căn phải khớp td, không kẹp width.
	.datatable-th--actions {
		text-align: right;
	}

	// Mobile: ẩn th actions — mirror td (hover:none)(pointer:coarse)
	// trong Body (td display:none) để thead/tbody cùng số cột.
	@media (hover: none) and (pointer: coarse) {
		.datatable-th--actions {
			display: none;
		}
	}

	// Class .datatable-selectall-checkbox nằm trên root Checkbox component
	// (khác scope hash — scoped CSS ở đây không match, căn giữa từ
	// .datatable-th vertical-align: middle). Giữ class làm hook DOM.

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
		cursor: var(--cursor-interactive);
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

	// ── Resize handle (mép phải th: drag đổi width, dblclick reset) ──
	.datatable-resize-handle {
		position: absolute;
		top: 0;
		right: 0;
		width: 8px;
		height: 100%;
		cursor: col-resize;
		user-select: none;
		touch-action: none;
		z-index: 2;

		// Visual cue 1px line giữa (nền trong suốt — hover hiện rõ hơn).
		&::after {
			content: '';
			position: absolute;
			top: 25%;
			right: 3px;
			width: 2px;
			height: 50%;
			background: transparent;
			border-radius: 9999px;
			transition: background-color 150ms ease;
		}

		@media (hover: hover) and (pointer: fine) {
			&:hover::after {
				background: var(--primary, var(--color-indigo-500));
			}
		}

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, hsl(241 100% 68.6%));
			outline-offset: -2px;
		}
	}
</style>
