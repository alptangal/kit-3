// Unit test engine highlight (matchSegments / queryMatchesText).
// Ngữ nghĩa nhạy dấu: query có dấu → khớp đúng dấu; query không dấu → wildcard dấu.
import { describe, expect, it } from 'vitest';
import { matchSegments, queryMatchesText } from './highlight';

describe('queryMatchesText', () => {
	it('case-insensitive (không dấu)', () => {
		expect(queryMatchesText('Dashboard', 'DASH')).toBe(true);
		expect(queryMatchesText('Dashboard', 'dash')).toBe(true);
	});

	it('query token CÓ dấu → bắt buộc đúng dấu đó (khác dấu → không khớp)', () => {
		expect(queryMatchesText('Đơn hàng', 'đơn')).toBe(true);
		expect(queryMatchesText('Đơn hàng', 'đợn')).toBe(false); // "ậ" ≠ "ơ"
		expect(queryMatchesText('Tồn kho', 'tỏn')).toBe(false); // "ỏ" ≠ "ỗ"
		expect(queryMatchesText('Tồn kho', 'tồn')).toBe(true);
	});

	it('query không dấu → wildcard dấu (khớp mọi biến thể)', () => {
		expect(queryMatchesText('Tồn kho', 'ton')).toBe(true);
		expect(queryMatchesText('Đơn hàng', 'ơn')).toBe(true); // "o" wildcard "ơ"
		expect(queryMatchesText('Người dùng', 'nguoi')).toBe(true);
	});

	it('"đ" là chữ riêng — "don"/"dơn" KHÔNG khớp "đơn" (wildcard chỉ áp cho DẤU)', () => {
		expect(queryMatchesText('đơn hàng', 'don')).toBe(false);
		expect(queryMatchesText('đơn hàng', 'dơn')).toBe(false);
		expect(queryMatchesText('đơn hàng', 'đơn')).toBe(true);
	});

	it('query rỗng / text rỗng → false', () => {
		expect(queryMatchesText('a', '')).toBe(false);
		expect(queryMatchesText('', 'a')).toBe(false);
	});

	it('match đa từ theo thứ tự token', () => {
		expect(queryMatchesText('sản phẩm tồn kho', 'tồn kho')).toBe(true);
		expect(queryMatchesText('sản phẩm tồn kho', 'kho tồn')).toBe(false);
	});
});

describe('matchSegments', () => {
	it('query rỗng → 1 đoạn isMatch=false (giữ nguyên text)', () => {
		expect(matchSegments('Tồn kho', '')).toEqual([{ text: 'Tồn kho', isMatch: false }]);
	});

	it('không khớp → 1 đoạn duy nhất', () => {
		expect(matchSegments('Tồn kho', 'abc')).toEqual([{ text: 'Tồn kho', isMatch: false }]);
	});

	it('chop đúng vị trí match (giữ các segment còn lại nguyên)', () => {
		// "ton" (không dấu) wildcard khớp "Tồn" từ index 0 → [0,3)
		expect(matchSegments('Tồn kho', 'ton')).toEqual([
			{ text: 'Tồn', isMatch: true },
			{ text: ' kho', isMatch: false }
		]);
		expect(matchSegments('quản lý đơn hàng', 'đơn')).toEqual([
			{ text: 'quản lý ', isMatch: false },
			{ text: 'đơn', isMatch: true },
			{ text: ' hàng', isMatch: false }
		]);
	});

	it('nhiều match rời nhau', () => {
		expect(matchSegments('don hang don', 'don')).toEqual([
			{ text: 'don', isMatch: true },
			{ text: ' hang ', isMatch: false },
			{ text: 'don', isMatch: true }
		]);
	});

	it('match ở đầu + cuối text', () => {
		expect(matchSegments('kho tồn kho', 'kho')).toEqual([
			{ text: 'kho', isMatch: true },
			{ text: ' tồn ', isMatch: false },
			{ text: 'kho', isMatch: true }
		]);
	});
});
