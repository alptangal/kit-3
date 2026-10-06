<script lang="ts">
	// src/lib/components/element/date-picker/Content.svelte
	// DatePicker.Content — panel lịch (popover: absolute dưới trigger, KHÔNG
	// portal). Cấu trúc WAI-ARIA: role="dialog" (panel, trigger
	// aria-haspopup="dialog") → role="grid" (lưới 7 cột × 6 hàng, tuần bắt đầu
	// thứ Hai — chuẩn VN/ISO) → role="row" × 6 → role="gridcell" (button ô
	// ngày). Roving focus: Left/Right ±1 ngày, Up/Down ±7 ngày, Home/End =
	// đầu/cuối tuần; Enter/Space chọn (native button click); Escape/Tab/
	// outside-click đóng ở Root.
	// Ngày ngoài tháng hiển thị → faded + aria-disabled (không chọn được).
	// Today = ring tròn. Selected = nền --primary. min/max → aria-disabled +
	// cursor not-allowed. PURE JS — buildMonthGrid trong _dates.ts.
	// RANGE mode (props.range): from → nền primary biên trái, to → biên phải,
	// ngày giữa → nền indigo-100 (light) / indigo-950 (dark); hover giữa
	// from/to → preview class (biên to tạm, do Root.setRangePreview quản lý).
	import { browser } from '$app/environment';
	import { styleSynced } from '$modules';
	import { getDatePickerContext } from './_context';
	import {
		addDays,
		ariaDateVN,
		buildMonthGrid,
		dateKey,
		isDisabledDate,
		monthLabel,
		ymd,
		sameDay,
		VN_WEEKDAYS_SHORT
	} from './_dates';
	import type { DatePickerContentProps } from './_interface';

	let {
		'aria-label': ariaLabel,
		...props
	}: DatePickerContentProps = $props();

	const ctx = getDatePickerContext();
	const open = $derived(ctx?.open ?? false);
	const contentId = $derived(ctx?.contentId ?? '');
	const now = new Date();
	const displayMonth = $derived.by(
		() => ctx?.displayMonth ?? { year: now.getFullYear(), month: now.getMonth() }
	);
	const min = $derived(ctx?.min);
	const max = $derived(ctx?.max);
	const selected = $derived(ctx?.selected ?? null);
	const size = $derived(ctx?.size ?? 'md');
	const today = $derived(new Date());
	const range = $derived(ctx?.range ?? false);
	const rangeFrom = $derived(ctx?.rangeFrom ?? null);
	const rangeTo = $derived(ctx?.rangeTo ?? null);
	// Biên hiệu dụng của khoảng highlight: to chốt > preview hover (chỉ khi
	// đang chờ to) > null (không highlight).
	const rangeEnd = $derived(rangeTo ?? (rangeFrom ? ctx?.rangePreview ?? null : null));

	// Lưới 6 hàng × 7 cột (42 ô) của tháng hiển thị.
	const weeks = $derived.by(() => {
		const cells = buildMonthGrid(displayMonth.year, displayMonth.month);
		const out: Date[][] = [];
		for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
		return out;
	});

	let gridEl = $state<HTMLDivElement | undefined>(undefined);

	const panelLabel = $derived(ariaLabel ?? ctx?.ariaLabel ?? 'Chọn ngày');

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'date-picker-panel',
			`size-${size}`,
			open ? 'open' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	// Roving focus: focusDate đổi (seed khi mở / phím mũi tên / shiftMonth /
	// jumpToToday) → đưa DOM focus về cell tương ứng. setTimeout(0): chờ seed
	// effect của Root + panel render xong.
	$effect(() => {
		if (!browser || !open) return;
		const fd = ctx?.focusDate ?? null;
		if (!fd) return;
		const key = dateKey(fd);
		const id = setTimeout(() => {
			gridEl?.querySelector<HTMLElement>(`[data-dp-day="${key}"]`)?.focus();
		}, 0);
		return () => clearTimeout(id);
	});

	// Ngày đang focus: ưu tiên cell đang giữ DOM focus (đúng thực tế), fallback
	// focusDate (khi focus còn ở nút header "Tháng trước/sau").
	function activeDay(): Date {
		const active = document.activeElement as HTMLElement | null;
		const key = active?.dataset?.dpDay;
		if (key) {
			const [y, m, d] = key.split('-').map(Number);
			if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
				return new Date(y, m, d);
			}
		}
		const fd = ctx?.focusDate;
		// Chỉ gọi khi panel open + keydown bên trong grid → luôn có ngày;
		// trả Date (không Date|null) để closure `move` không cần guard null.
		if (!fd) throw new Error('DatePicker: activeDay() — không có ngày đang focus');
		return fd;
	}

	// Roving keyboard trong lưới: Left/Right ±1 ngày, Up/Down ±7 ngày,
	// Home/End = đầu/cuối tuần (thứ Hai → Chủ nhật). Enter/Space = native
	// click button (không cần handle riêng). Mũi tên vượt biên tháng → Root
	// (setFocus) tự động đổi displayMonth.
	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		const day = activeDay();

		function move(n: number) {
			e.preventDefault();
			ctx?.setFocus(addDays(day, n));
		}
		switch (e.key) {
			case 'ArrowLeft':
				move(-1);
				break;
			case 'ArrowRight':
				move(1);
				break;
			case 'ArrowUp':
				move(-7);
				break;
			case 'ArrowDown':
				move(7);
				break;
			case 'Home': {
				e.preventDefault();
				const off = day.getDay() === 0 ? 6 : day.getDay() - 1;
				ctx?.setFocus(addDays(day, -off));
				break;
			}
			case 'End': {
				e.preventDefault();
				const off = day.getDay() === 0 ? 6 : day.getDay() - 1;
				ctx?.setFocus(addDays(day, 6 - off));
				break;
			}
		}
	}
</script>

{#if open}
	<div
		id={contentId}
		class={styleDerived}
		role="dialog"
		aria-label={panelLabel}
		data-dp-panel
	>
		<div class="date-picker-header" role="presentation">
			<button
				type="button"
				class="date-picker-nav"
				data-dp-prev
				aria-label="Tháng trước"
				onclick={() => ctx?.shiftMonth(-1)}
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M15 18l-6-6 6-6" />
				</svg>
			</button>
			<div class="date-picker-month" data-dp-month-label aria-live="polite">
				{monthLabel(displayMonth.year, displayMonth.month)}
			</div>
			<button
				type="button"
				class="date-picker-nav"
				data-dp-next
				aria-label="Tháng sau"
				onclick={() => ctx?.shiftMonth(1)}
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M9 18l6-6-6-6" />
				</svg>
			</button>
		</div>

		<div
			class="date-picker-grid"
			role="grid"
			aria-label={`Lịch ${monthLabel(displayMonth.year, displayMonth.month)}`}
			bind:this={gridEl}
			onkeydown={handleKeydown}
		>
			<div class="date-picker-weekdays" role="row">
				{#each VN_WEEKDAYS_SHORT as wd}
					<div class="date-picker-weekday" role="columnheader" aria-hidden="true">
						{wd}
					</div>
				{/each}
			</div>
			{#each weeks as week}
				<div class="date-picker-row" role="row">
					{#each week as day}
						{@const inMonth =
							day.getMonth() === displayMonth.month && day.getFullYear() === displayMonth.year}
						{@const isDisabled = !inMonth || isDisabledDate(day, min, max)}
						{@const isSelected = selected ? sameDay(day, selected) : false}
						{@const isToday = sameDay(day, today)}
						{@const isFocused = ctx?.focusDate ? sameDay(day, ctx.focusDate) : false}
						<!-- RANGE: biên lo/hi theo ymd (hover trước from → from thành biên phải) -->
						{@const rLo =
							range && rangeFrom && rangeEnd ? (ymd(rangeFrom) <= ymd(rangeEnd) ? rangeFrom : rangeEnd) : null}
						{@const rHi =
							range && rangeFrom && rangeEnd ? (ymd(rangeFrom) <= ymd(rangeEnd) ? rangeEnd : rangeFrom) : null}
						{@const isRangeStart = rLo ? sameDay(day, rLo) : false}
						{@const isRangeEnd = rHi ? sameDay(day, rHi) : false}
						{@const isRangeMid = rLo && rHi ? ymd(day) > ymd(rLo) && ymd(day) < ymd(rHi) : false}
						{@const isRangePendingStart =
							range && rangeFrom && !rangeEnd ? sameDay(day, rangeFrom) : false}
						<button
							type="button"
							role="gridcell"
							class="date-picker-day {inMonth ? '' : 'out-of-month'} {isToday ? 'today' : ''} {isSelected ? 'selected' : ''} {isDisabled ? 'disabled' : ''} {isFocused ? 'focused' : ''} {isRangeStart ? 'range-start' : ''} {isRangeEnd && !isRangeStart ? 'range-end' : ''} {isRangeMid ? 'range-mid' : ''} {isRangePendingStart ? 'range-pending' : ''}"
							data-dp-day={dateKey(day)}
							aria-label={ariaDateVN(day)}
							aria-selected={isSelected || (range ? isRangeStart || isRangeEnd || isRangePendingStart : false)}
							aria-disabled={isDisabled || undefined}
							tabindex={isFocused ? 0 : -1}
							onclick={() => {
								// chỉ chọn được ngày trong tháng hiển thị + không bị min/max.
								if (isDisabled) return;
								ctx?.select(day);
							}}
							onmouseenter={() => ctx?.setRangePreview(day)}
							onmouseleave={() => ctx?.setRangePreview(null)}
							onfocus={() => {
								ctx?.setFocus(day);
								// keyboard preview: focus di chuyển → band preview theo focus.
								ctx?.setRangePreview(day);
							}}
						>
							{day.getDate()}
						</button>
					{/each}
				</div>
			{/each}
		</div>

		<div class="date-picker-footer" role="presentation">
			<button
				type="button"
				class="date-picker-today"
				data-dp-today
				onclick={() => ctx?.jumpToToday()}
			>
				Hôm nay
			</button>
		</div>
	</div>
{/if}

<style lang="scss">
	@use '_styles.scss';
</style>
