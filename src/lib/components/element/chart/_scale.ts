// $components/element/chart/_scale.ts
// Pure JS helpers cho Chart — KHÔNG phụ thuộc DOM/Svelte (test được, SSR-safe).
// Nội dung: nice-scale (1/2/5 × 10^n), formatter mặc định (k/M/B), truncate label,
// và path-builder (bar rounded-top / line / area).

export interface ChartPoint {
	/** Pixel x (đã gom về tọa độ viewBox). */
	x: number;
	/** Pixel y (đã gom về tọa độ viewBox). */
	y: number;
}

/** Làm tròn 2 chữ số thập phân để DOM gọn, tránh float noise. */
export function rnd(n: number): number {
	return Math.round(n * 100) / 100;
}

/**
 * "Nice number" theo Hackerson/D3: làm tròn range về (1|2|5|10) × 10^exponent.
 * round=true → chọn số gần nhất đẹp; round=false → luôn làm tròn lên (cho tick step).
 */
function niceNum(range: number, round: boolean): number {
	if (range <= 0 || !Number.isFinite(range)) return 1;
	const exponent = Math.floor(Math.log10(range));
	const fraction = range / Math.pow(10, exponent);
	let niceFraction: number;
	if (round) {
		if (fraction < 1.5) niceFraction = 1;
		else if (fraction < 3) niceFraction = 2;
		else if (fraction < 7) niceFraction = 5;
		else niceFraction = 10;
	} else {
		if (fraction <= 1) niceFraction = 1;
		else if (fraction <= 2) niceFraction = 2;
		else if (fraction <= 5) niceFraction = 5;
		else niceFraction = 10;
	}
	return niceFraction * Math.pow(10, exponent);
}

export interface ChartScale {
	/** Giá trị tối đa "đẹp" của trục Y (round lên 1/2/5 × 10^n). */
	max: number;
	/** Bước mỗi tick ( đều ). */
	step: number;
	/** Danh sách tick từ 0 → max (đều, >=1). */
	ticks: number[];
}

/**
 * Tính nice-scale cho trục Y.
 * - max <= 0 / không hợp lệ → fallback max=1 (tránh chia 0 / NaN).
 * - step = niceNum(max/target, round=true) → cho ~target khoảng tick đều.
 * - max = ceil(maxValue/step)*step; ticks = 0, step, 2*step ... max.
 */
export function niceScale(maxValue: number, target = 4): ChartScale {
	let raw = Number.isFinite(maxValue) ? maxValue : 0;
	if (raw < 0) raw = 0;
	if (raw <= 0) raw = 1; // floor: trục vẫn hiện 0→1 thay vì NaN/rỗng
	const step = niceNum(raw / target, true);
	const max = Math.ceil(raw / step) * step;
	const count = Math.max(1, Math.round(max / step));
	const ticks: number[] = [];
	for (let i = 0; i <= count; i++) ticks.push(i * step);
	return { max, step, ticks };
}

/** Format gọn: >=1e9 → "1.2B", >=1e6 → "1.2M", >=1e3 → "1.2k", khác → làm tròn. */
function shortNumber(n: number): string {
	const abs = Math.abs(n);
	const fmt = (v: number) => {
		const r = Math.round(v * 10) / 10;
		return String(r);
	};
	if (abs >= 1e9) return fmt(n / 1e9) + 'B';
	if (abs >= 1e6) return fmt(n / 1e6) + 'M';
	if (abs >= 1e3) return fmt(n / 1e3) + 'k';
	return String(Math.round(n));
}

/** Formatter mặc định. Nhưng cho 0 trả '0' (không phải '0k'). */
export function defaultFormatter(n: number): string {
	if (!Number.isFinite(n)) return '0';
	if (n === 0) return '0';
	return shortNumber(n);
}

/** Truncate string dài: cắt về maxChars + '…'. */
export function truncate(str: string, maxChars = 12): string {
	if (!str) return '';
	if (str.length <= maxChars) return str;
	return str.slice(0, maxChars - 1).trimEnd() + '…';
}

/** Path cho 1 bar "rounded top" (tròn trên, vuông baseline) — không cần clip. */
export function roundedTopBar(x: number, yTop: number, width: number, baseline: number, r: number): string {
	const rr = Math.max(0, Math.min(r, width / 2, Math.max(0, baseline - yTop)));
	const X = x;
	const W = width;
	if (rr <= 0) {
		// Bar bằng chữ nhật thường (r<=0 hoặc bar quá thấp)
		return `M ${rnd(X)} ${rnd(baseline)} L ${rnd(X)} ${rnd(yTop)} L ${rnd(X + W)} ${rnd(yTop)} L ${rnd(X + W)} ${rnd(baseline)} Z`;
	}
	return [
		`M ${rnd(X)} ${rnd(baseline)}`,
		`L ${rnd(X)} ${rnd(yTop + rr)}`,
		`Q ${rnd(X)} ${rnd(yTop)} ${rnd(X + rr)} ${rnd(yTop)}`,
		`L ${rnd(X + W - rr)} ${rnd(yTop)}`,
		`Q ${rnd(X + W)} ${rnd(yTop)} ${rnd(X + W)} ${rnd(yTop + rr)}`,
		`L ${rnd(X + W)} ${rnd(baseline)}`,
		'Z'
	].join(' ');
}

/** Polyline line: "M x0 y0 L x1 y1 ...". 1 điểm → "M x y" (không có đoạn nào). */
export function buildLinePath(points: ChartPoint[]): string {
	if (points.length === 0) return '';
	if (points.length === 1) return `M ${rnd(points[0].x)} ${rnd(points[0].y)}`;
	const body = points.map((p) => `${rnd(p.x)} ${rnd(p.y)}`).join(' L ');
	return `M ${body}`;
}

/** Area path: polyline + khép xuống baseline (2 cạnh dọc đầu/cuối). */
export function buildAreaPath(points: ChartPoint[], baseline: number): string {
	if (points.length === 0) return '';
	const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${rnd(p.x)} ${rnd(p.y)}`).join(' ');
	const xFirst = rnd(points[0].x);
	const xLast = rnd(points[points.length - 1].x);
	const b = rnd(baseline);
	return `${line} L ${xLast} ${b} L ${xFirst} ${b} Z`;
}
