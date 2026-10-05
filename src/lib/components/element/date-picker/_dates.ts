// src/lib/components/element/date-picker/_dates.ts
// Helper lịch PURE JS (không date library — quyết định user).
// Mọi so sánh/thao tác ngày theo (year, month, day) ĐỊA PHƯƠNG — KHÔNG
// getTime() (tránh lệch do timezone/DST). Tuần bắt đầu THỨ HAI (chuẩn
// VN/ISO 8601).

/** băm số (y,m,d) — so nhanh không phụ thuộc thời gian. */
export function ymd(date: Date): number {
	return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function sameDay(a: Date, b: Date): boolean {
	return ymd(a) === ymd(b);
}

/** ngày nằm ngoài [min, max] (ràng buộc đóng cả hai đầu) */
export function isDisabledDate(date: Date, min?: Date, max?: Date): boolean {
	const v = ymd(date);
	if (min && v < ymd(min)) return true;
	if (max && v > ymd(max)) return true;
	return false;
}

/** cộng n ngày theo (y,m,d) địa phương (n âm = lùi). */
export function addDays(date: Date, n: number): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function monthOf(date: Date): { year: number; month: number } {
	return { year: date.getFullYear(), month: date.getMonth() };
}

/** 42 ô (6 hàng × 7 cột) của month — tuần bắt đầu thứ Hai. */
export function buildMonthGrid(year: number, month: number): Date[] {
	const first = new Date(year, month, 1);
	// getDay(): 0=CN ... 6=T7 → offset về thứ Hai
	const dow = first.getDay();
	const offset = dow === 0 ? 6 : dow - 1;
	const start = new Date(year, month, 1 - offset);
	const cells: Date[] = [];
	for (let i = 0; i < 42; i++) {
		cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
	}
	return cells;
}

/** số ngày trong month (thuần JS). */
export function daysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate();
}

/** ngày hợp lệ (không bị min/max) đầu tiên trong month — fallback seed focus. */
export function firstEnabledDate(year: number, month: number, min?: Date, max?: Date): Date | null {
	for (let d = 1; d <= daysInMonth(year, month); d++) {
		const date = new Date(year, month, d);
		if (!isDisabledDate(date, min, max)) return date;
	}
	return null;
}

export const VN_MONTHS = [
	'Tháng 1',
	'Tháng 2',
	'Tháng 3',
	'Tháng 4',
	'Tháng 5',
	'Tháng 6',
	'Tháng 7',
	'Tháng 8',
	'Tháng 9',
	'Tháng 10',
	'Tháng 11',
	'Tháng 12'
] as const;

export const VN_WEEKDAYS_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

const VN_WEEKDAYS_FULL = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/** label header month: "Tháng 10, 2026" */
export function monthLabel(year: number, month: number): string {
	return `${VN_MONTHS[month]}, ${year}`;
}

/** dd/mm/yyyy (chuẩn VN) cho trigger. */
export function formatDateVN(date: Date | null): string {
	if (!date) return '';
	const d = String(date.getDate()).padStart(2, '0');
	const m = String(date.getMonth() + 1).padStart(2, '0');
	return `${d}/${m}/${date.getFullYear()}`;
}

/** aria-label đầy đủ cho 1 ngày (screen reader): "Thứ ba, 05 Tháng 10, 2026" */
export function ariaDateVN(date: Date): string {
	return `${VN_WEEKDAYS_FULL[date.getDay()]}, ${String(date.getDate()).padStart(2, '0')} ${VN_MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
}

/** key DOM cho ô ngày (data attribute lookup roving focus). */
export function dateKey(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
