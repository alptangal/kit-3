<script lang="ts">
	// src/lib/components/element/date-picker/Root.svelte
	// DatePicker.Root — composite wrapper (position:relative, mẫu popover).
	// Giữ state: `value` (bindable — Date|null single, hoặc {from,to} khi
	// props.range) + `open` (bindable) + `displayMonth` (tháng hiển thị) +
	// `focusDate` (roving focus trong lưới) + range state (from/to/preview).
	// Symbol context + outside-click + Escape (đóng + focus trả trigger).
	// PURE JS calendar — helper trong _dates.ts (KHÔNG date library).
	import { browser } from '$app/environment';
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { setDatePickerContext } from './_context';
	import { dateKey, firstEnabledDate, isDisabledDate, monthOf, sameDay, ymd } from './_dates';
	import type { DatePickerConfigs, DatePickerRangeValue, DatePickerRootProps } from './_interface';

	let {
		value = $bindable<Date | null>(),
		defaultOpen = false,
		open = $bindable(defaultOpen),
		range = false,
		min,
		max,
		initialMonth,
		placeholder = 'Chọn ngày',
		'aria-label': ariaLabel,
		children,
		...props
	}: DatePickerRootProps = $props();

	let rootEl: HTMLDivElement;

	// id nội bộ (SSR an toàn — không phụ thuộc crypto).
	const triggerId = `dp-trigger-${Math.random().toString(36).slice(2, 10)}`;
	const contentId = `dp-content-${Math.random().toString(36).slice(2, 10)}`;

	// Range state (chỉ dùng khi props.range): from/to là biên đã chốt (to ≥ from),
	// pendingTo = ngày thứ 2 đang chờ chốt (click 1 → from + pendingTo = null,
	// click 2 → to). preview = ngày đang hover (biên to tạm — highlight từ from
	// tới ngày hover). KHÔNG nằm trong `value` (value chỉ nhận {from,to} chốt).
	let rangeFrom = $state<Date | null>(null);
	let rangeTo = $state<Date | null>(null);
	let rangePreview = $state<Date | null>(null);

	// Normalize value (single | range) → selected/rangeFrom/rangeTo nội bộ.
	// Props.value đổi từ ngoài (bind:value) → đồng bộ lại state range.
	$effect(() => {
		if (!range) return;
		const v = value;
		if (v && typeof v === 'object' && 'from' in (v as object)) {
			const rv = v as DatePickerRangeValue;
			rangeFrom = rv.from ?? null;
			rangeTo = rv.to ?? null;
		} else {
			// value không phải range shape (Date|null hoặc rỗng) → reset range.
			rangeFrom = null;
			rangeTo = null;
		}
	});

	// Tháng hiển thị ban đầu: initialMonth > tháng của value > tháng hiện tại.
	const now = new Date();
	const initialMonthRes = initialMonth ?? (value instanceof Date ? value : value && typeof value === 'object' && 'from' in value && value.from ? value.from : null) ?? now;
	let displayMonth = $state({ year: initialMonthRes.getFullYear(), month: initialMonthRes.getMonth() });
	let focusDate = $state<Date | null>(null);

	// Seed roving focus CHỈ khi open chuyển false→true: selected (nếu đang ở
	// tháng hiển thị) > hôm nay (nếu hợp lệ) > ngày valid đầu tháng. KHÔNG
	// re-seed khi displayMonth/focusDate đổi (shiftMonth/setFocus tự quản lý
	// focusDate) — nếu không, roam phím qua tháng khác sẽ bị "hút" về seed.
	let wasOpen = false;
	$effect(() => {
		const isOpen = open;
		const y = displayMonth.year;
		const m = displayMonth.month;
		const v = value instanceof Date ? value : null;
		const mn = min;
		const mx = max;
		if (!isOpen) {
			wasOpen = false;
			return;
		}
		if (wasOpen) return;
		wasOpen = true;
		const today = new Date();
		const inMonth = (d: Date) => monthOf(d).year === y && monthOf(d).month === m;
		// seed: range từ (nếu đang ở tháng) > selected single > hôm nay > valid đầu tháng
		if (range && rangeFrom && inMonth(rangeFrom) && !isDisabledDate(rangeFrom, mn, mx)) {
			focusDate = rangeFrom;
			return;
		}
		if (v && inMonth(v) && !isDisabledDate(v, mn, mx)) {
			focusDate = v;
			return;
		}
		if (inMonth(today) && !isDisabledDate(today, mn, mx)) {
			focusDate = today;
			return;
		}
		focusDate = firstEnabledDate(y, m, mn, mx) ?? new Date(y, m, 1);
	});

	const configs: DatePickerConfigs = $state({
		triggerId,
		contentId,
		ariaLabel,
		get displayMonth() {
			return displayMonth;
		},
		get range() {
			return range;
		},
		get selected() {
			return value instanceof Date ? value : null;
		},
		get rangeFrom() {
			return range ? rangeFrom : null;
		},
		get rangeTo() {
			return range ? rangeTo : null;
		},
		get rangePreview() {
			return range ? rangePreview : null;
		},
		get initialMonth() {
			return initialMonth ?? null;
		},
		get min() {
			return min;
		},
		get max() {
			return max;
		},
		get placeholder() {
			return placeholder;
		},
		get open() {
			return open;
		},
		get focusDate() {
			return focusDate;
		},
		get disabled() {
			return props.disabled ?? false;
		},
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		get style() {
			const hasRangeValue = range && !!rangeFrom;
			const defaultStyles: (string | undefined)[] = [
				'date-picker-root',
				`size-${this.size}`,
				this.disabled ? 'disabled' : undefined,
				open ? 'open' : undefined,
				(value instanceof Date && value) || hasRangeValue ? 'has-value' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		openPanel() {
			if (props.disabled) return;
			open = true;
		},
		close() {
			open = false;
		},
		toggle() {
			if (props.disabled) return;
			open = !open;
		},
		closeAndFocusTrigger() {
			open = false;
			// rAF: đợi panel unmount rồi mới focus trigger (focus ngay → bị nuốt).
			requestAnimationFrame(() => {
				rootEl?.querySelector<HTMLElement>('[data-dp-trigger]')?.focus();
			});
		},
		select(date: Date) {
			if (props.disabled) return;
			if (isDisabledDate(date, min, max)) return;
			// ngày chọn chuẩn (bỏ phần giờ — so sánh theo (y,m,d) địa phương).
			const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
			if (range) {
				// RANGE — click 1 → from (reset to cũ), click 2 → to (swap nếu
				// to<from), click 3 → reset from. Panel GIỮ mở cho tới khi
				// from+to chốt xong (đóng ở click 2).
				if (rangeFrom && !rangeTo) {
					// click 2: chốt to
					if (ymd(day) === ymd(rangeFrom)) return; // trùng from → giữ from, chờ chọn khác
					const [a, b] = ymd(day) < ymd(rangeFrom) ? [day, rangeFrom] : [rangeFrom, day];
					rangeFrom = a;
					rangeTo = b;
					rangePreview = null;
					value = { from: a, to: b };
					open = false;
					requestAnimationFrame(() => {
						rootEl?.querySelector<HTMLElement>('[data-dp-trigger]')?.focus();
					});
				} else {
					// click 1 (hoặc click 3 sau khi range chốt): bắt đầu lại từ from
					rangeFrom = day;
					rangeTo = null;
					rangePreview = null;
					value = { from: day };
				}
				return;
			}
			// SINGLE — giữ nguyên hành vi mặc định.
			value = day;
			open = false;
			requestAnimationFrame(() => {
				rootEl?.querySelector<HTMLElement>('[data-dp-trigger]')?.focus();
			});
		},
		setRangePreview(date: Date | null) {
			if (props.disabled || !range) return;
			// chỉ preview khi đang chờ to (from đã chốt, to chưa) + ngày khác from.
			rangePreview = rangeFrom && !rangeTo && date && ymd(date) !== ymd(rangeFrom) ? date : null;
		},
		shiftMonth(n: 1 | -1) {
			const d = new Date(displayMonth.year, displayMonth.month + n, 1);
			displayMonth = { year: d.getFullYear(), month: d.getMonth() };
			// giữ focusDate nếu còn thuộc tháng mới + hợp lệ; không thì reseed.
			// anchor: selected single > range from > focusDate > hôm nay.
			const anchor = value instanceof Date ? value : (range && rangeFrom) || focusDate || new Date();
			const inMonth = monthOf(anchor).year === displayMonth.year && monthOf(anchor).month === displayMonth.month;
			focusDate =
				inMonth && !isDisabledDate(anchor, min, max)
					? anchor
					: firstEnabledDate(displayMonth.year, displayMonth.month, min, max) ??
						new Date(displayMonth.year, displayMonth.month, 1);
		},
		setFocus(date: Date) {
			// Guard chống vòng lặp effect: onfocus của cell gọi lại setFocus
			// cùng ngày → không làm thay đổi state (không re-trigger $effect focus).
			if (focusDate && sameDay(focusDate, date)) return;
			focusDate = date;
			// roving focus tự động đổi tháng khi day +/- vượt biên tháng.
			const m = monthOf(date);
			if (m.year !== displayMonth.year || m.month !== displayMonth.month) {
				displayMonth = m;
			}
		},
		jumpToToday() {
			const today = new Date();
			const m = monthOf(today);
			displayMonth = { year: m.year, month: m.month };
			focusDate = isDisabledDate(today, min, max) ? null : today;
			if (focusDate) {
				// focus cell hôm nay sau khi DOM cập nhật.
				requestAnimationFrame(() => {
					rootEl?.querySelector<HTMLElement>(`[data-dp-day="${dateKey(today)}"]`)?.focus();
				});
			}
		}
	});

	setDatePickerContext(configs);
	export { configs };

	// Outside-click: chỉ khi đang open.
	$effect(() => {
		if (!browser || !open) return;
		function onMousedown(e: MouseEvent) {
			if (rootEl && !rootEl.contains(e.target as Node)) configs.closeAndFocusTrigger();
		}
		document.addEventListener('mousedown', onMousedown);
		return () => document.removeEventListener('mousedown', onMousedown);
	});

	// Escape: đóng + focus trả trigger.
	$effect(() => {
		if (!browser || !open) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.preventDefault();
				configs.closeAndFocusTrigger();
			}
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});
</script>

<div class={configs.style} data-dp-root bind:this={rootEl}>
	{@render children?.()}
</div>

<style lang="scss">
	.date-picker-root {
		position: relative;
		display: inline-flex;
		min-width: 0;
		max-width: 100%;

		&.disabled {
			pointer-events: none;
			opacity: var(--disabled-opacity, 0.5);
		}
	}
</style>
