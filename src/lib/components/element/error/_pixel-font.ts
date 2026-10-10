// $components/element/error/_pixel-font.ts
// Bitmap font 5×7 cho digit 0-9 — dùng để ghép mã lỗi thành hình ảnh "micro-pixel"
// đè trên matrix rain. Mỗi digit là mảng 7 hàng × 5 cột (1 = pixel on, 0 = off).

/** Bitmap 5×7 per digit: 1 = pixel on. */
export const DIGIT_BITMAPS: Record<string, number[][]> = {
	'0': [
		[0, 1, 1, 1, 0],
		[1, 1, 0, 1, 1],
		[1, 1, 0, 1, 1],
		[1, 1, 0, 1, 1],
		[1, 1, 0, 1, 1],
		[1, 1, 0, 1, 1],
		[0, 1, 1, 1, 0]
	],
	'1': [
		[0, 0, 1, 0, 0],
		[0, 1, 1, 0, 0],
		[0, 0, 1, 0, 0],
		[0, 0, 1, 0, 0],
		[0, 0, 1, 0, 0],
		[0, 0, 1, 0, 0],
		[0, 1, 1, 1, 0]
	],
	'2': [
		[0, 1, 1, 1, 0],
		[1, 1, 0, 1, 1],
		[0, 0, 0, 1, 1],
		[0, 0, 1, 1, 0],
		[0, 1, 1, 0, 0],
		[1, 1, 0, 0, 0],
		[1, 1, 1, 1, 1]
	],
	'3': [
		[0, 1, 1, 1, 0],
		[1, 1, 0, 1, 1],
		[0, 0, 0, 1, 1],
		[0, 0, 1, 1, 0],
		[0, 0, 0, 1, 1],
		[1, 1, 0, 1, 1],
		[0, 1, 1, 1, 0]
	],
	'4': [
		[0, 0, 1, 1, 0],
		[0, 1, 1, 1, 0],
		[0, 1, 0, 1, 0],
		[1, 1, 1, 1, 1],
		[0, 0, 0, 1, 0],
		[0, 0, 0, 1, 0],
		[0, 0, 0, 1, 0]
	],
	'5': [
		[1, 1, 1, 1, 1],
		[1, 1, 0, 0, 0],
		[1, 1, 1, 1, 0],
		[0, 0, 0, 1, 1],
		[0, 0, 0, 1, 1],
		[1, 1, 0, 1, 1],
		[0, 1, 1, 1, 0]
	],
	'6': [
		[0, 0, 1, 1, 0],
		[0, 1, 0, 0, 0],
		[1, 1, 0, 0, 0],
		[1, 1, 1, 1, 0],
		[1, 1, 0, 1, 1],
		[1, 1, 0, 1, 1],
		[0, 1, 1, 1, 0]
	],
	'7': [
		[1, 1, 1, 1, 1],
		[0, 0, 0, 1, 1],
		[0, 0, 0, 1, 0],
		[0, 0, 1, 0, 0],
		[0, 0, 1, 0, 0],
		[0, 0, 1, 0, 0],
		[0, 0, 1, 0, 0]
	],
	'8': [
		[0, 1, 1, 1, 0],
		[1, 1, 0, 1, 1],
		[1, 1, 0, 1, 1],
		[0, 1, 1, 1, 0],
		[1, 1, 0, 1, 1],
		[1, 1, 0, 1, 1],
		[0, 1, 1, 1, 0]
	],
	'9': [
		[0, 1, 1, 1, 0],
		[1, 1, 0, 1, 1],
		[1, 1, 0, 1, 1],
		[0, 1, 1, 1, 1],
		[0, 0, 0, 1, 1],
		[0, 0, 1, 1, 0],
		[0, 1, 1, 0, 0]
	]
};

/** Đếm số pixel "on" của một digit (dùng probe + kiểm tra nhanh). */
export function digitPixelCount(digit: string): number {
	const bmp = DIGIT_BITMAPS[digit];
	if (!bmp) return 0;
	return bmp.reduce((sum, row) => sum + row.reduce((s, v) => s + (v ? 1 : 0), 0), 0);
}

/**
 * Trả danh sách cell "on" cho MỘT digit, đặt vào bitmap cols×rows tại offset.
 * Kết quả: mảng { col, row } (tọa độ cell trong matrix grid).
 */
export function digitCells(
	digit: string,
	cols: number,
	rows: number,
	offsetCol: number,
	offsetRow: number
): { col: number; row: number }[] {
	const bmp = DIGIT_BITMAPS[digit];
	if (!bmp) return [];
	const out: { col: number; row: number }[] = [];
	for (let r = 0; r < bmp.length; r++) {
		for (let c = 0; c < bmp[r].length; c++) {
			if (!bmp[r][c]) continue;
			const col = offsetCol + c;
			const row = offsetRow + r;
			if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
			out.push({ col, row });
		}
	}
	return out;
}
