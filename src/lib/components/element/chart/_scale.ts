// $components/element/chart/_scale.ts
// Pure JS helpers cho Chart — KHÔNG phụ thuộc DOM/Svelte (test được, SSR-safe).
// Nội dung: nice-scale (1/2/5 × 10^n), formatter mặc định (k/M/B), truncate label,
// path-builder (bar rounded-top / line / area), pie/donut slices + palette,
// data portability (buildCsv/parseCsv/buildDataJson/parseDataJson).

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
	const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${rnd(p.x)} ${rnd(p.y).toFixed(2)}`).join(' ');
	const xFirst = rnd(points[0].x);
	const xLast = rnd(points[points.length - 1].x);
	const b = rnd(baseline);
	return `${line} L ${xLast} ${b} L ${xFirst} ${b} Z`;
}

/** Hướng delta so mốc trước: up/down/flat (deadzone ±1e-9 tránh float noise). */
export function deltaDir(delta: number | undefined): 'up' | 'down' | 'flat' {
	if (delta === undefined || !Number.isFinite(delta)) return 'flat';
	if (delta > 1e-9) return 'up';
	if (delta < -1e-9) return 'down';
	return 'flat';
}

/**
 * Build rows cho tooltip mặc định (pure, test được).
 * - value đã format qua `fmt`; percent = tỉ trọng so `total` ("12%").
 * - delta so điểm kề trước (undefined ở điểm đầu → không hiện; dir up → dấu "+").
 * - opts.percentTotal: base tính % (single series → tổng toàn chart, không phải
 *   giá trị series = 100%); mặc định = tổng value các series truyền vào.
 */
export function buildTooltipRows(
	seriesAtPoint: { name: string; color: string; value: number; delta?: number }[],
	fmt: (n: number) => string,
	opts?: { showPercent?: boolean; showDelta?: boolean; percentTotal?: number }
) {
	const showPercent = opts?.showPercent ?? true;
	const showDelta = opts?.showDelta ?? false;
	const total =
		opts?.percentTotal ??
		seriesAtPoint.reduce((sum, s) => sum + (Number.isFinite(s.value) ? s.value : 0), 0);
	return seriesAtPoint.map((s) => {
		const raw = Number.isFinite(s.value) ? s.value : 0;
		const dir = deltaDir(s.delta);
		const deltaStr =
			showDelta && s.delta !== undefined
				? `${dir === 'up' ? '+' : '-'}${fmt(Math.abs(s.delta))}`
				: undefined;
		return {
			name: s.name,
			color: s.color,
			value: fmt(raw),
			percent:
				showPercent && total > 0 ? `${Math.round((raw / total) * 1000) / 10}%` : undefined,
			delta: deltaStr,
			deltaDir: showDelta && s.delta !== undefined ? dir : undefined
		};
	});
}

// ── Pie / donut (pure JS, KHÔNG library) ──

/** Tọa độ cartesian từ góc cực (độ 0 = 3h, tăng theo chiều kim đồng hồ trong hệ SVG). */
export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
	const rad = (angleDeg * Math.PI) / 180;
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Path 1 slice donut (annular sector): ring giữa innerR → outerR, từ a0 → a1 (độ).
 * innerR <= 0 → pie wedge (tam giác cung, đỉnh ở tâm). Arc lớn >= 180deg → large-arc=1.
 * padAngle đã trừ sẵn bởi caller (a1 đã là mép sau pad).
 */
export function buildSlicePath(cx: number, cy: number, outerR: number, innerR: number, a0: number, a1: number): string {
	const sweep = a1 - a0;
	if (sweep <= 0) return '';
	// Full circle (360deg): path arc đôi không khép → vẽ 2 vòng tròn riêng.
	if (sweep >= 359.999) {
		if (innerR > 0) {
			return (
				`M ${rnd(cx + outerR)} ${rnd(cy)} ` +
				`A ${rnd(outerR)} ${rnd(outerR)} 0 1 1 ${rnd(cx - outerR)} ${rnd(cy)} ` +
				`A ${rnd(outerR)} ${rnd(outerR)} 0 1 1 ${rnd(cx + outerR)} ${rnd(cy)} Z ` +
				`M ${rnd(cx + innerR)} ${rnd(cy)} ` +
				`A ${rnd(innerR)} ${rnd(innerR)} 0 1 0 ${rnd(cx - innerR)} ${rnd(cy)} ` +
				`A ${rnd(innerR)} ${rnd(innerR)} 0 1 0 ${rnd(cx + innerR)} ${rnd(cy)} Z`
			);
		}
		return (
			`M ${rnd(cx + outerR)} ${rnd(cy)} ` +
			`A ${rnd(outerR)} ${rnd(outerR)} 0 1 1 ${rnd(cx - outerR)} ${rnd(cy)} ` +
			`A ${rnd(outerR)} ${rnd(outerR)} 0 1 1 ${rnd(cx + outerR)} ${rnd(cy)} Z`
		);
	}
	const large = sweep > 180 ? 1 : 0;
	const p0 = polarToCartesian(cx, cy, outerR, a0);
	const p1 = polarToCartesian(cx, cy, outerR, a1);
	if (innerR > 0) {
		const q1 = polarToCartesian(cx, cy, innerR, a1);
		const q0 = polarToCartesian(cx, cy, innerR, a0);
		return [
			`M ${rnd(p0.x)} ${rnd(p0.y)}`,
			`A ${rnd(outerR)} ${rnd(outerR)} 0 ${large} 1 ${rnd(p1.x)} ${rnd(p1.y)}`,
			`L ${rnd(q1.x)} ${rnd(q1.y)}`,
			`A ${rnd(innerR)} ${rnd(innerR)} 0 ${large} 0 ${rnd(q0.x)} ${rnd(q0.y)}`,
			'Z'
		].join(' ');
	}
	return [
		`M ${rnd(cx)} ${rnd(cy)}`,
		`L ${rnd(p0.x)} ${rnd(p0.y)}`,
		`A ${rnd(outerR)} ${rnd(outerR)} 0 ${large} 1 ${rnd(p1.x)} ${rnd(p1.y)}`,
		'Z'
	].join(' ');
}

export interface PieSliceGeometry {
	path: string;
	value: number;
	percent: number;
	label: string;
	/** Góc giữa mép sau pad (mid-arc) — anchor label/tooltip. */
	midAngle: number;
	/** Total sweep của segment (độ, trước pad) — test/legend. */
	sweep: number;
}

/**
 * Tính slices pie/donut từ data (pure, test được).
 * - Bỏ value <= 0 (segment 0° rỗng); tổng = tổng value hợp lệ → % từng slice.
 * - startAngle (độ, default -90 = đỉnh 12h), chiều kim đồng hồ (hệ SVG y-down).
 * - padAngle (rad) → gap giữa segments: mỗi mép segment thu vào pad/2 (đối xứng,
 *   giữ tâm segment không dịch); sát nhau khi 0.
 * - innerR là RADIUS (caller tính từ tỉ lệ innerRadius × outerR); 0 → pie đặc.
 */
export function buildPieSlices(
	data: { label: string; value: number }[],
	cx: number,
	cy: number,
	outerR: number,
	innerR: number,
	opts?: { startAngle?: number; padAngle?: number }
): PieSliceGeometry[] {
	const valid = data
		.map((d) => ({ label: String(d?.label ?? ''), value: Number.isFinite(d?.value) ? Math.max(0, d.value) : 0 }))
		.filter((d) => d.value > 0);
	if (!valid.length || outerR <= 0) return [];
	const total = valid.reduce((sum, d) => sum + d.value, 0);
	const startAngle = opts?.startAngle ?? -90;
	const padRad = Math.max(0, opts?.padAngle ?? 0.02);
	// pad per slice (độ): trừ MỖI mép pad/2 → gap pad giữa 2 segments kề nhau.
	const padPerEdge = Math.min(((padRad * 180) / Math.PI) / 2, 180 / valid.length);
	const slices: PieSliceGeometry[] = [];
	let angle = startAngle;
	for (const d of valid) {
		const sweepDeg = (d.value / total) * 360;
		// Mép thu vào padPerEdge, KHÔNG vượt quá giữa segment (sweep nhỏ → tránh mép đảo).
		const edge = Math.min(padPerEdge, sweepDeg / 2);
		const a0 = angle + edge;
		const a1 = angle + sweepDeg - edge;
		const path = buildSlicePath(cx, cy, outerR, innerR, a0, a1);
		slices.push({
			path,
			value: d.value,
			percent: total > 0 ? d.value / total : 0,
			label: d.label,
			midAngle: angle + sweepDeg / 2,
			sweep: sweepDeg
		});
		angle += sweepDeg;
	}
	return slices;
}

/**
 * Palette pie theo hệ thống — token raw `--color-<ref>-N` (KHÔNG đảo theme).
 * Thứ tự màu: default→gray, secondary→cyan, success→green, info→sky,
 * warning→amber, error→red, primary→indigo.
 * <= 7 segment → bậc 500; > 7 → xoay vòng xen kẽ bậc 500/600 (mở rộng capacity,
 * segment kề nhau vẫn phân biệt sáng/tối).
 */
export function buildPiePalette(count: number): string[] {
	const base = [
		'var(--color-gray-500)',
		'var(--color-cyan-500)',
		'var(--color-green-500)',
		'var(--color-sky-500)',
		'var(--color-amber-500)',
		'var(--color-red-500)',
		'var(--color-indigo-500)'
	];
	if (count <= 7) return base.slice(0, Math.max(1, count));
	// > 7 segment: xoay vòng — xen kẽ bậc 500 (base) / 600 (dark) cùng ref.
	const dark = [
		'var(--color-gray-600)',
		'var(--color-cyan-600)',
		'var(--color-green-600)',
		'var(--color-sky-600)',
		'var(--color-amber-600)',
		'var(--color-red-600)',
		'var(--color-indigo-600)'
	];
	const out: string[] = [];
	for (let i = 0; i < count; i++) {
		out.push(i % 2 === 0 ? base[i % base.length] : dark[i % dark.length]);
	}
	return out;
}

// ── Data portability (CSV/JSON) — build/parse PURE (test được, SSR-safe);
// copy là side-effect (clipboard) — nằm ở Main.svelte. ──

/** Escape 1 ô CSV: có dấu phẩy/nháy/xuống dòng → bọc nháy kép, nháy nội lặp đôi. */
export function csvEscape(cell: string): string {
	if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
	return cell;
}

/**
 * Build CSV từ data (single hoặc multi-series).
 * - Header: "label,value" (single) hoặc "label,<name1>,<name2>..." (multi).
 * - Dòng: label + giá trị (multi: data line up 1:1 với label của data prop).
 * - Dòng phân cách "\n" (RFC 4180 dùng \r\n — nhưng \n đủ cho spreadsheet + gọn).
 */
export function buildCsv(
	labels: string[],
	seriesList: { name: string; data: number[] }[]
): string {
	const names = seriesList.map((s) => s.name);
	const header = ['label', ...names].map(csvEscape).join(',');
	const rows = labels.map((label, i) => {
		const cells = [label, ...seriesList.map((s) => String(s.data[i] ?? 0))];
		return cells.map(csvEscape).join(',');
	});
	return [header, ...rows].join('\n');
}

/**
 * Parse CSV → data chart. Dòng đầu = header (bỏ); mỗi dòng sau = 1 điểm.
 * Chỉ lấy cột label (cột 0) + value (cột 1) — CSV multi-series import ngoài scope
 * (chart tự import chỉ single-series `data` prop). Value không hợp lệ → bỏ dòng.
 * Hỗ trợ CSV có BOM + bọc nháy kép (csvEscape).
 */
export function parseCsv(text: string): { label: string; value: number }[] {
	const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines = clean.split('\n').filter((l) => l.trim());
	if (lines.length < 2) return [];
	// Parse từng dòng tôn trọng nháy kép (ô bọc nháy có thể chứa dấu phẩy).
	const parseLine = (line: string): string[] => {
		const cells: string[] = [];
		let cur = '';
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (inQuotes) {
				if (ch === '"' && line[i + 1] === '"') {
					cur += '"';
					i++;
				} else if (ch === '"') {
					inQuotes = false;
				} else {
					cur += ch;
				}
			} else if (ch === '"') {
				inQuotes = true;
			} else if (ch === ',') {
				cells.push(cur);
				cur = '';
			} else {
				cur += ch;
			}
		}
		cells.push(cur);
		return cells;
	};
	const out: { label: string; value: number }[] = [];
	for (let i = 1; i < lines.length; i++) {
		const cells = parseLine(lines[i]);
		if (cells.length < 2) continue;
		const value = Number.parseFloat(cells[1]);
		if (!Number.isFinite(value)) continue;
		out.push({ label: cells[0].trim(), value });
	}
	return out;
}

/**
 * Build JSON payload từ data (single hoặc multi-series).
 * Shape: { type, labels, series: [{ name, data }] } — round-trip với parseDataJson.
 */
export function buildDataJson(
	type: string,
	labels: string[],
	seriesList: { name: string; data: number[] }[]
): string {
	return JSON.stringify({ type, labels, series: seriesList });
}

/**
 * Parse JSON payload → data chart. Chấp nhận:
 * - { labels, series: [...] } (buildDataJson round-trip)
 * - { labels, data: [...] } (single-series shorthand)
 * - [{ label, value }, ...] (mảng điểm trực tiếp)
 * Value không hợp lệ → bỏ điểm. Không đúng shape → [] (onError caller).
 */
export function parseDataJson(text: string): { label: string; value: number }[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return [];
	}
	// Shape 1: mảng điểm trực tiếp
	if (Array.isArray(parsed)) {
		return parsed
			.filter((d): d is { label: string; value: number } => {
				return (
					!!d &&
					typeof d === 'object' &&
					typeof (d as { value?: unknown }).value === 'number' &&
					Number.isFinite((d as { value?: unknown }).value)
				);
			})
			.map((d) => ({
				label: String((d as { label?: unknown }).label ?? ''),
				value: Math.max(0, d.value)
			}));
	}
	if (!parsed || typeof parsed !== 'object') return [];
	const obj = parsed as { labels?: unknown; series?: unknown; data?: unknown };
	// Shape 2: { labels, series: [{ name, data }] } — data series[0] là nguồn value
	if (Array.isArray(obj.labels) && Array.isArray(obj.series) && obj.series.length) {
		const s0 = obj.series[0] as { data?: unknown };
		if (!Array.isArray(s0?.data)) return [];
		const seriesData = s0.data as unknown[];
		return (obj.labels as unknown[])
			.map((label, i) => {
				const v = seriesData[i];
				return {
					label: String(label ?? ''),
					value: typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : NaN
				};
			})
			.filter((d) => Number.isFinite(d.value));
	}
	// Shape 3: { labels, data: [...] } — single-series shorthand
	if (Array.isArray(obj.labels) && Array.isArray(obj.data)) {
		return (obj.labels as unknown[])
			.map((label, i) => ({
				label: String(label ?? ''),
				value: Number.isFinite((obj.data as unknown[])[i])
					? Math.max(0, (obj.data as unknown[])[i] as number)
					: NaN
			}))
			.filter((d) => Number.isFinite(d.value));
	}
	return [];
}
