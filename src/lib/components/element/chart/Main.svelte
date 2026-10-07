<script lang="ts">
	// $components/element/chart/Main.svelte
	// Chart — SELF-WRITTEN SVG (KHÔNG chart library). Data-driven: tính nice-scale
	// + draw bằng <svg>/<rect>/<path>/<line>. Single series (data) là chủ lực;
	// multiple series (series[]) là stretch (line multi + legend).
	// Nâng cấp: tooltip hover đa thông tin (label/value/%/delta/custom render,
	// portal body + position:fixed + z-index 10500 — pattern Tooltip component)
	// + live data (poll source hoặc mirror data prop, cửa sổ trượt max).
	import { styleSynced, convertToMiliseconds } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { Action } from 'svelte/action';
	import type {
		ChartConfigs,
		ChartDatum,
		ChartExportOptions,
		ChartCopyOptions,
		ChartImportOptions,
		ChartLiveOptions,
		ChartProps,
		ChartSeries,
		ChartSlice,
		ChartTooltipMeta,
		ChartTooltipOptions
	} from './_interface';
	import {
		buildAreaPath,
		buildCsv,
		buildDataJson,
		buildLinePath,
		buildPiePalette,
		buildPieSlices,
		buildTooltipRows,
		defaultFormatter,
		niceScale,
		parseCsv,
		parseDataJson,
		polarToCartesian,
		rnd,
		truncate
	} from './_scale';

	let {
		data = [],
		type = 'bar',
		series,
		width = 600,
		height = 300,
		showGrid = true,
		showXAxis = true,
		showYAxis = true,
		valueFormatter,
		color,
		showPoints = false,
		showArea = false,
		innerRadius = 0.6,
		startAngle = -90,
		padAngle = 0.02,
		tooltip,
		live,
		export: exportProp,
		copyData,
		importData,
		'aria-label': ariaLabelProp,
		title,
		...props
	}: ChartProps = $props();

	// ── Color: map semantic Color → token var; giá trị lạ giữ nguyên (raw var/hex) ──
	const COLOR_MAP: Record<string, string> = {
		primary: 'var(--primary)',
		secondary: 'var(--secondary)',
		success: 'var(--success)',
		warning: 'var(--warning)',
		error: 'var(--error)',
		danger: 'var(--error)',
		info: 'var(--primary)',
		default: 'var(--primary)'
	};
	const resolveColor = (c?: string): string | undefined => (c ? COLOR_MAP[c] ?? c : undefined);
	// Fallback màu theo CẤU TRÚC (fixed order, KHÔNG cycle) cho multi-series.
	const SERIES_FALLBACK = [
		'var(--primary)',
		'var(--secondary)',
		'var(--success)',
		'var(--color-indigo-500)',
		'var(--color-sky-500)'
	];

	// ── Tooltip options (normalize) — TÙY CHỐN, không có → giữ native <title> ──
	const tooltipOpts = $derived.by((): (ChartTooltipOptions & { on: boolean }) | undefined => {
		const t = tooltip;
		if (!t) return undefined;
		if (t === true) return { on: true };
		return { on: true, ...t };
	});
	const tooltipOn = $derived(!!tooltipOpts);
	// Delta so điểm kề: mặc định tự bật cho line (giá trị biến thiên theo thời gian),
	// tắt cho bar (so sánh hạng mục, delta kém nghĩa) + pie (part-to-whole, không thời gian).
	const deltaShown = $derived(
		tooltipOpts ? (tooltipOpts.showDelta ?? (type === 'line' ? true : false)) : false
	);
	const fmtValue = $derived(tooltipOpts?.formatValue ?? valueFormatter ?? defaultFormatter);

	// ── Live options (normalize) — TÙY CHỐN. Có source → chart tự poll theo interval;
	// không source → mirror data prop (demo tự đẩy bằng $state + setInterval). ──
	const liveOpts = $derived.by((): ChartLiveOptions & { enabled: boolean; intervalMs: number } => {
		const l = live;
		if (!l) return { enabled: false, intervalMs: 1000 };
		if (l === true) return { enabled: true, intervalMs: 1000 };
		return {
			enabled: l.enabled ?? true,
			intervalMs: convertToMiliseconds(l.interval) ?? 1000,
			max: l.max,
			source: l.source
		};
	});
	const liveOn = $derived(liveOpts.enabled);

	// Buffer live: mirror data prop HOẶC điểm mới từ source poll (cửa sổ trượt max).
	let liveBuffer: ChartDatum[] = $state([]);

	// Mirror data prop (live bật, không source) — data prop đổi → buffer theo.
	$effect(() => {
		if (!liveOn || liveOpts.source) return;
		liveBuffer = Array.isArray(data) ? data : [];
	});

	// Poll source theo interval + cửa sổ trượt (bỏ điểm cũ nhất khi vượt max).
	$effect(() => {
		if (!liveOn || !liveOpts.source) return;
		const src = liveOpts.source;
		const interval = liveOpts.intervalMs;
		const max = liveOpts.max;
		let alive = true;
		const tick = async () => {
			if (!alive) return;
			const res = await src();
			if (!alive || !res) return;
			const incoming = (Array.isArray(res) ? res : [res]).filter(
				(d): d is ChartDatum => !!d && typeof d.value === 'number' && Number.isFinite(d.value)
			);
			if (!incoming.length) return;
			const merged = [...liveBuffer, ...incoming];
			liveBuffer = typeof max === 'number' && max > 0 ? merged.slice(-max) : merged;
		};
		const id = setInterval(tick, interval);
		return () => {
			alive = false;
			clearInterval(id);
		};
	});

	// ── Validate dữ liệu: bỏ value không phải số, clamp value âm về 0 ──
	// Import file (không live): importedData ưu tiên trên data prop (chart tự giữ data mới).
	const effectiveData = $derived.by(() => {
		if (liveOn) return liveBuffer;
		if (importedData) return importedData;
		return Array.isArray(data) ? data : [];
	});
	const points: ChartDatum[] = $derived.by(() => {
		return effectiveData
			.filter((d): d is ChartDatum => !!d && typeof d.value === 'number' && Number.isFinite(d.value))
			.map((d) => ({ label: String(d.label ?? ''), value: Math.max(0, d.value) }));
	});

	const maxValue = $derived.by(() => {
		let max = points.length ? Math.max(...points.map((p) => p.value)) : 0;
		// Multi-series: scale tính cả values của series[] (data prop chỉ dùng lấy label,
		// thường value 0 → không tính scale từ series thì mọi đường bị clamp ngang đỉnh).
		if (isMulti) {
			for (const s of series as ChartSeries[]) {
				if (s && Array.isArray(s.data)) {
					for (const v of s.data) {
						if (Number.isFinite(v) && v > max) max = v;
					}
				}
			}
		}
		return max;
	});
	const scale = $derived(niceScale(maxValue));
	const fmt = $derived(valueFormatter ?? defaultFormatter);

	// ── Series effective: single (từ data) HOẶC multiple (từ series[]) ──
	const isMulti = $derived(Array.isArray(series) && series.length > 0);
	const effectiveSeries = $derived.by((): { name: string; color: string; data: number[] }[] => {
		if (isMulti) {
			return (series as ChartSeries[])
				.filter((s) => s && Array.isArray(s.data) && s.data.length === points.length)
				.map((s, i) => ({
					name: s.name ?? `Series ${i + 1}`,
					color: resolveColor(s.color) ?? SERIES_FALLBACK[i % SERIES_FALLBACK.length],
					data: s.data.map((v) => (Number.isFinite(v) ? Math.max(0, Number(v)) : 0))
				}));
		}
		return [
			{
				name: 'value',
				color: resolveColor(color as string | undefined) ?? SERIES_FALLBACK[0],
				data: points.map((p) => p.value)
			}
		];
	});

	// ── Geometric (pure) — margins theo viewBox, CSS co giãn width:100% ──
	const M = $derived({ top: 18, right: 14, bottom: 38, left: 46 });
	const plotW = $derived(Math.max(0, width - M.left - M.right));
	const plotH = $derived(Math.max(0, height - M.top - M.bottom));
	const baseline = $derived(M.top + plotH);

	const layout = $derived.by(() => {
		const n = points.length;
		const band = n ? plotW / n : 0;
		const xFor = (i: number) => M.left + i * band + band / 2;
		const yFor = (v: number) => {
			const r = scale.max > 0 ? v / scale.max : 0;
			return M.top + plotH * (1 - Math.min(1, Math.max(0, r)));
		};
		const bw = n ? Math.min(band * 0.5, 40) : 0;
		const bars = points.map((p, i) => {
			const yTop = yFor(p.value);
			return {
				x: rnd(M.left + i * band + (band - bw) / 2),
				yTop: rnd(yTop),
				w: rnd(bw),
				h: rnd(Math.max(0, baseline - yTop)),
				value: p.value,
				label: p.label
			};
		});
		const lineGeoms = effectiveSeries.map((s) => {
			const pts = s.data.map((v, i) => ({ x: rnd(xFor(i)), y: rnd(yFor(v)), v, label: points[i]?.label ?? '' }));
			const coord = pts.map((p) => ({ x: p.x, y: p.y }));
			return {
				name: s.name,
				color: s.color,
				pts,
				linePath: buildLinePath(coord),
				areaPath: buildAreaPath(coord, baseline)
			};
		});
		// Rotate x-label khi nhiều point / band hẹp (tránh overlap)
		const rotateX = n > 8 || band < 46;
		return { n, band, bw, xFor, yFor, bars, lineGeoms, rotateX };
	});

	// ── Pie / donut geometry (type="pie") — dùng `data` prop chính, KHÔNG series[] ──
	const isPie = $derived(type === 'pie');
	// innerRadius: tỉ lệ lỗ giữa 0..1 (clamp 0..0.9; 0 = pie đặc). "0.6" string → số.
	const innerRadiusNum = $derived.by(() => {
		const raw = typeof innerRadius === 'string' ? Number.parseFloat(innerRadius) : innerRadius;
		if (!Number.isFinite(raw)) return 0.6;
		return Math.min(0.9, Math.max(0, raw));
	});
	// Pie center theo viewBox: căn giữa khung (không margin trục — pie không có axis).
	const pieCx = $derived(width / 2);
	const pieCy = $derived(height / 2);
	// Bán kính ngoài: min(width,height)/2 − padding nhỏ (không đụng mép viewBox).
	const pieOuterR = $derived(Math.max(0, Math.min(width, height) / 2 - 8));
	const pieInnerR = $derived(pieOuterR * innerRadiusNum);
	const slices: ChartSlice[] = $derived.by(() => {
		if (!isPie) return [];
		const geoms = buildPieSlices(points, pieCx, pieCy, pieOuterR, pieInnerR, { startAngle, padAngle });
		if (!geoms.length) return [];
		const palette = color
			? geoms.map(() => (resolveColor(color as string) ?? 'var(--primary)'))
			: buildPiePalette(geoms.length);
		return geoms.map((g, i) => ({
			path: g.path,
			color: palette[i],
			value: g.value,
			percent: g.percent,
			label: g.label,
			midAngle: g.midAngle
		}));
	});

	// Legend pie: tên + % từng segment (kênh nhận dạng — KHÔNG chỉ dựa màu).
	const pieTotal = $derived(points.reduce((sum, p) => sum + p.value, 0));

	// Key remount → replay animation khi data/type đổi. Live bật → KHÔNG include values
	// (marks update in-place + CSS transition geometry — mượt, không replay nhảy).
	// Pie: key riêng theo slices (đếm + values) — KHÔNG theo bars/points của bar/line.
	const animKey = $derived.by(() => {
		const seriesNames = effectiveSeries.map((s) => s.name).join('|');
		if (isPie) {
			const sliceSig = `${slices.length}-${slices.map((s) => s.value).join(',')}-${innerRadiusNum}-${startAngle}-${padAngle}`;
			return liveOn ? `pie-live-${sliceSig}` : `pie-${sliceSig}`;
		}
		if (liveOn) {
			return `live-${type}-${isMulti ? 'm' : 's'}-${layout.bars.length}-${seriesNames}`;
		}
		return `${type}-${isMulti ? 'm' : 's'}-${layout.bars.length}-${points.map((p) => p.value).join(',')}-${seriesNames}`;
	});

	// ── A11y label ──
	const ariaLabel = $derived(ariaLabelProp ?? `Biểu đồ ${points.length} điểm`);

	// ── Tooltip hover: index gần nhất theo vị trí chuột (viewBox coords) ──
	let hoverIndex = $state<number | undefined>(undefined);
	let svgRef = $state<SVGSVGElement | undefined>(undefined);

	const onSvgMouseMove = (e: MouseEvent) => {
		if (!tooltipOn) return;
		const svg = svgRef;
		if (!svg) return;
		const rect = svg.getBoundingClientRect();
		if (!rect.width) return;
		const n = points.length;
		if (!n) {
			hoverIndex = undefined;
			return;
		}
		const vx = ((e.clientX - rect.left) / rect.width) * width;
		const band = plotW / n;
		const i = Math.floor((vx - M.left) / band);
		hoverIndex = i >= 0 && i < n ? i : undefined;
	};
	const onSvgMouseLeave = () => {
		hoverIndex = undefined;
	};

	// ── Pie hover: segment dưới chuột theo GÓC (atan2 quanh tâm pie) — KHÔNG theo band X.
	// hoverIndex dùng chung state với bar/line (index slice = index points).
	const onPieMouseMove = (e: MouseEvent) => {
		if (!tooltipOn) return;
		const svg = svgRef;
		if (!svg) return;
		const rect = svg.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		const n = points.length;
		if (!n) {
			hoverIndex = undefined;
			return;
		}
		// Tọa độ viewBox của chuột.
		const vx = ((e.clientX - rect.left) / rect.width) * width;
		const vy = ((e.clientY - rect.top) / rect.height) * height;
		const dx = vx - pieCx;
		const dy = vy - pieCy;
		const dist = Math.sqrt(dx * dx + dy * dy);
		// Ngoài bán kính (kể cả pad ring) → không hover.
		if (dist > pieOuterR || dist < pieInnerR) {
			hoverIndex = undefined;
			return;
		}
		// Góc 0 = 3h, tăng chiều kim đồng hồ (hệ SVG y-down: atan2(dy,dx) đã đúng hướng).
		let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
		// Chuẩn hóa về [0, 360) rồi dịch theo startAngle (mặc định -90 → 12h = 0).
		deg = ((deg - startAngle) % 360 + 360) % 360;
		const total = pieTotal > 0 ? pieTotal : 1;
		let acc = 0;
		let found: number | undefined = undefined;
		for (let i = 0; i < n; i++) {
			const v = Math.max(0, Number.isFinite(points[i].value) ? points[i].value : 0);
			const sweep = (v / total) * 360;
			if (deg >= acc && deg < acc + sweep) {
				found = i;
				break;
			}
			acc += sweep;
		}
		hoverIndex = found;
	};

	// Meta tooltip tại điểm hover (label/value/%/delta từng series) — payload snippet.
	// Pie: 1 series = slice đang hover (KHÔNG delta, % so tổng toàn pie).
	const tooltipMeta = $derived.by((): ChartTooltipMeta | undefined => {
		if (hoverIndex === undefined || !tooltipOn || !points.length) return undefined;
		const i = Math.min(hoverIndex, points.length - 1);
		if (isPie) {
			const s = slices[i];
			if (!s) return undefined;
			return {
				label: s.label,
				index: i,
				total: points.length,
				series: [{ name: 'value', color: s.color, value: s.value, percent: s.percent }]
			};
		}
		const seriesAt = effectiveSeries.map((s) => {
			const v = s.data[i] ?? 0;
			const prev = i > 0 ? s.data[i - 1] : undefined;
			return { name: s.name, color: s.color, value: v, delta: prev === undefined ? undefined : v - prev };
		});
		// % theo ngữ cảnh: multi → so tổng các series tại điểm; single → so tổng toàn chart.
		const atTotal = seriesAt.reduce((sum, s) => sum + s.value, 0);
		const chartTotal = points.reduce((sum, p) => sum + p.value, 0);
		return {
			label: points[i].label,
			index: i,
			total: points.length,
			series: seriesAt.map((s) => ({
				...s,
				percent: (isMulti ? atTotal : chartTotal) > 0 ? s.value / (isMulti ? atTotal : chartTotal) : 0
			}))
		};
	});

	// Rows tooltip mặc định (value/percent/delta đã format qua _scale helper).
	// Pie: % so tổng toàn pie (CHƯNGỊ slice hover = 100% là SAI — truyền percentTotal tường minh).
	const tooltipRows = $derived.by(() => {
		const meta = tooltipMeta;
		if (!meta) return [];
		return buildTooltipRows(meta.series, fmtValue, {
			showPercent: tooltipOpts?.showPercent ?? true,
			showDelta: deltaShown,
			// multi → tổng series tại điểm; single/pie → % so tổng toàn chart
			percentTotal: isMulti ? undefined : points.reduce((sum, p) => sum + p.value, 0)
		});
	});

	// Anchor tooltip pie = điểm mid-arc của slice trên màn hình (giữa segment).
	const pieTooltipAnchor = $derived.by(() => {
		if (!isPie || hoverIndex === undefined) return undefined;
		const s = slices[Math.min(hoverIndex, slices.length - 1)];
		if (!s) return undefined;
		const svg = svgRef;
		if (!svg) return undefined;
		const rect = svg.getBoundingClientRect();
		if (!rect.width || !rect.height) return undefined;
		// Điểm giữa outerR và innerR trên mid-arc (anchor ở giữa ring donut).
		const r = (pieOuterR + pieInnerR) / 2;
		const p = polarToCartesian(pieCx, pieCy, r, s.midAngle);
		return { x: rect.left + (rect.width / width) * p.x, y: rect.top + (rect.height / height) * p.y };
	});

	// Anchor tooltip = điểm data trên màn hình (đỉnh giá trị lớn nhất tại index đó).
	const tooltipAnchor = $derived.by(() => {
		if (hoverIndex === undefined || !points.length) return undefined;
		const svg = svgRef;
		if (!svg) return undefined;
		const rect = svg.getBoundingClientRect();
		if (!rect.width || !rect.height) return undefined;
		const i = Math.min(hoverIndex, points.length - 1);
		const top = Math.max(...effectiveSeries.map((s) => s.data[i] ?? 0));
		const vx = layout.xFor(i);
		const vy = layout.yFor(top);
		return { x: rect.left + (rect.width / width) * vx, y: rect.top + (rect.height / height) * vy };
	});

	// Vị trí tooltip (clamp ngang vào viewport; dọc = phía trên anchor qua CSS translate).
	const tooltipPos = $derived.by(() => {
		const a = isPie ? pieTooltipAnchor : tooltipAnchor;
		if (!a) return undefined;
		const vw = client.browser?.width ?? 1200;
		return { x: Math.min(Math.max(a.x, 90), Math.max(90, vw - 90)), y: a.y };
	});

	// Portal tooltip ra document.body (pattern Tooltip component — position:fixed
	// ngoài stacking context cha; chart-root không transform nên fixed đủ, portal
	// giữ đồng bộ hệ thống + z-index 10500).
	const portalToBody: Action = (node) => {
		document.body.appendChild(node);
		return {
			destroy: () => {
				node.remove();
			}
		};
	};

	// ── Data portability: export CSV/JSON + copy clipboard + import file ──
	// Data từ import (chart không live) — points ưu tiên importedData khi có.
	let importedData = $state<ChartDatum[] | undefined>(undefined);
	// Options normalize (TÙY CHỐN — không có → không render nút).
	const exportOpts = $derived.by((): (ChartExportOptions & { on: boolean }) | undefined => {
		const e = exportProp;
		if (!e) return undefined;
		if (e === true) return { on: true };
		return { on: true, ...e };
	});
	const exportOn = $derived(!!exportOpts);
	const copyOpts = $derived.by((): (ChartCopyOptions & { on: boolean }) | undefined => {
		const c = copyData;
		if (!c) return undefined;
		if (c === true) return { on: true };
		return { on: true, ...c };
	});
	const copyOn = $derived(!!copyOpts);
	const importOpts = $derived.by((): (ChartImportOptions & { on: boolean }) | undefined => {
		const i = importData;
		if (!i) return undefined;
		if (i === true) return { on: true };
		return { on: true, ...i };
	});
	const importOn = $derived(!!importOpts);

	// Series list cho export/copy: single = data points; multi = effectiveSeries
	// (data prop chỉ dùng lấy label). Labels line up 1:1.
	// Labels line up 1:1 với points (multi cũng cùng label của data prop).
	const exportLabels = $derived(points.map((p) => p.label));
	const exportSeriesList = $derived(
		isMulti
			? effectiveSeries.map((s) => ({ name: s.name, data: s.data }))
			: [{ name: 'value', data: points.map((p) => p.value) }]
	);

	// Download blob (pattern chuẩn: Blob + URL.createObjectURL + a[download] click).
	const downloadFile = (content: string, mime: string, filename: string) => {
		if (typeof document === 'undefined') return;
		const blob = new Blob([content], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	};

	// Export theo format: CSV hoặc JSON (filename prop → chart-data.<ext>).
	const handleExport = (format: 'csv' | 'json') => {
		const base = exportOpts?.filename ?? 'chart-data';
		if (format === 'json') {
			downloadFile(buildDataJson(type, exportLabels, exportSeriesList), 'application/json', `${base}.json`);
			return;
		}
		downloadFile(buildCsv(exportLabels, exportSeriesList), 'text/csv;charset=utf-8', `${base}.csv`);
	};

	// Copy data ra clipboard: navigator.clipboard.writeText (headless/permission
	// denied → fallback localStorage 'clipboard' — mirror pattern InputOTP).
	let copiedAt = $state<number | undefined>(undefined);
	const handleCopy = async () => {
		const format = copyOpts?.format ?? 'csv';
		const content =
			format === 'json'
				? buildDataJson(type, exportLabels, exportSeriesList)
				: buildCsv(exportLabels, exportSeriesList);
		if (!content) return;
		let wrote = false;
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(content);
				wrote = true;
			}
		} catch {
			// Headless/permission denied → fallback localStorage bên dưới
		}
		if (!wrote) {
			const date = new Date();
			localStorage.setItem('clipboard', JSON.stringify({ [`${date.getTime()}`]: content }));
			if (!client.browser) client.browser = {};
			if (!client.browser.clipboard) {
				client.browser.clipboard = new SvelteMap<number, string>();
			}
			client.browser.clipboard.set(date.getTime(), content);
		}
		copiedAt = Date.now();
		setTimeout(() => {
			if (copiedAt && Date.now() - copiedAt >= 2000) copiedAt = undefined;
		}, 2100);
	};

	// Import từ file (.csv/.json): parse → thay data (onImport callback). Chỉ chấp
	// nhận chart KHÔNG live — live đang bật → buffer mirror data prop mới qua $effect.
	let fileInputRef = $state<HTMLInputElement | undefined>(undefined);
	let importError = $state<string | undefined>(undefined);
	const handleImportFile = async (file: File | undefined) => {
		if (!file) return;
		const ext = file.name.split('.').pop()?.toLowerCase();
		const text = await file.text();
		let parsed: { label: string; value: number }[] = [];
		if (ext === 'json') {
			parsed = parseDataJson(text);
		} else if (ext === 'csv' || ext === 'txt') {
			parsed = parseCsv(text);
		}
		if (!parsed.length) {
			importError = 'Không đọc được dữ liệu từ file (CSV/JSON không hợp lệ)';
			importOpts?.onError?.(importError);
			setTimeout(() => (importError = undefined), 3000);
			return;
		}
		importError = undefined;
		if (liveOn) {
			// Live bật → ghi buffer trực tiếp (mirror data prop sẽ ghi đè khi data đổi).
			liveBuffer = parsed;
		} else {
			// Không live → dispatch custom event 'chartimport' với points mới (demo/App
			// lắng nghe qua handleEvents hoặc bind — mirror pattern Input actionButtons).
			importedData = parsed;
		}
		importOpts?.onImport?.(parsed);
	};

	let configs: ChartConfigs = $state({
		get type() {
			return type;
		},
		get width() {
			return width;
		},
		get height() {
			return height;
		},
		get showGrid() {
			return showGrid;
		},
		get showXAxis() {
			return showXAxis;
		},
		get showYAxis() {
			return showYAxis;
		},
		get points() {
			return points;
		},
		get maxValue() {
			return maxValue;
		},
		get scale() {
			return scale;
		},
		get ariaLabel() {
			return ariaLabel;
		},
		get hoverIndex() {
			return hoverIndex;
		},
		get tooltipOpen() {
			return tooltipOn && hoverIndex !== undefined && points.length > 0;
		},
		get live() {
			return liveOn;
		},
		get innerRadius() {
			return innerRadiusNum;
		},
		get startAngle() {
			return startAngle;
		},
		get padAngle() {
			return padAngle;
		},
		get slices() {
			return slices;
		},
		get exportOn() {
			return exportOn;
		},
		get copyOn() {
			return copyOn;
		},
		get importOn() {
			return importOn;
		},
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'chart-root',
				`chart-${type}`,
				`size-${this.size}`,
				isMulti ? 'is-multi' : undefined,
				isPie ? 'is-pie' : undefined,
				points.length === 0 ? 'is-empty' : undefined,
				liveOn ? 'is-live' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get event() {
			return props.events;
		},
		ref: undefined as HTMLElement | undefined
	});

	const xLabelText = (i: number) => {
		const raw = points[i]?.label ?? '';
		return layout.rotateX ? truncate(raw, 8) : truncate(raw, 14);
	};

	// series color cho bar single-series (tránh lặp resolve trong template)
	const singleSeriesColor = () => effectiveSeries[0]?.color ?? 'var(--primary)';
</script>

<div class={configs.style} {@attach handleEvents(configs.event)}>
	{#if title}
		<h2 class="chart-title">{title}</h2>
	{/if}
	{#if liveOn}
		<span class="chart-live-badge" aria-hidden="true"><i class="chart-live-dot"></i>LIVE</span>
	{/if}

	<!-- Toolbar data portability (export/copy/import): hàng nút nhỏ, KHÔNG đè chart.
	     TÙY CHỐN qua prop — không có → không render. -->
	{#if exportOn || copyOn || importOn}
		<div class="chart-toolbar" data-test="chart-toolbar">
			{#if exportOn}
				{#if exportOpts?.trigger}
					{@render exportOpts.trigger(handleExport)}
				{:else}
					<div class="chart-toolbar__group">
						<button
							class="chart-toolbar__btn"
							type="button"
							data-test="chart-export-csv"
							onclick={() => handleExport('csv')}
						>
							Export CSV
						</button>
						<button
							class="chart-toolbar__btn"
							type="button"
							data-test="chart-export-json"
							onclick={() => handleExport('json')}
						>
							Export JSON
						</button>
					</div>
				{/if}
			{/if}
			{#if copyOn}
				{#if copyOpts?.trigger}
					{@render copyOpts.trigger(handleCopy)}
				{:else}
					<button
						class="chart-toolbar__btn"
						type="button"
						data-test="chart-copy"
						onclick={handleCopy}
					>
						{copiedAt ? 'Copied' : 'Copy data'}
					</button>
				{/if}
			{/if}
			{#if importOn}
				{#if importOpts?.trigger}
					{@render importOpts.trigger(() => fileInputRef?.click())}
				{:else}
					<button
						class="chart-toolbar__btn"
						type="button"
						data-test="chart-import"
						onclick={() => fileInputRef?.click()}
					>
						Import file
					</button>
				{/if}
				<input
					class="chart-import-input"
					type="file"
					accept=".csv,.json,.txt"
					aria-label="Import dữ liệu từ file CSV hoặc JSON"
					bind:this={fileInputRef}
					onchange={(e) => {
						const f = (e.currentTarget as HTMLInputElement).files?.[0];
						handleImportFile(f);
						e.currentTarget.value = '';
					}}
				/>
			{/if}
			{#if importError}
				<span class="chart-toolbar__error" role="alert">{importError}</span>
			{/if}
		</div>
	{/if}

	<!-- Legend (multi-series): kênh nhận dạng, KHÔNG chỉ dựa màu. Single series = không legend (title tên nó).
	     Legend pie: tên + % từng segment (kênh nhận dạng — % là định lượng, không chỉ màu). -->
	{#if isPie && slices.length}
		<ul class="chart-legend chart-legend--pie" aria-hidden="true">
			{#each slices as s}
				<li class="chart-legend__item">
					<span class="chart-legend__swatch" style:background={s.color}></span>
					<span class="chart-legend__name">{s.label}</span>
					<span class="chart-legend__percent">{pieTotal > 0 ? Math.round((s.value / pieTotal) * 1000) / 10 : 0}%</span>
				</li>
			{/each}
		</ul>
	{:else if isMulti && effectiveSeries.length}
		<ul class="chart-legend" aria-hidden="true">
			{#each effectiveSeries as s}
				<li class="chart-legend__item">
					<span class="chart-legend__swatch" style:background={s.color}></span>
					<span class="chart-legend__name">{s.name}</span>
				</li>
			{/each}
		</ul>
	{/if}

	<svg
		class="chart-svg"
		viewBox="0 0 {width} {height}"
		preserveAspectRatio="xMidYMid meet"
		role="img"
		aria-label={ariaLabel}
		bind:this={svgRef}
		onmousemove={isPie ? onPieMouseMove : onSvgMouseMove}
		onmouseleave={onSvgMouseLeave}
	>
		{#if points.length}
			<!-- Gridlines (trừ tick=0 — trùng baseline X, tránh vẽ chồng). Pie: không grid/axis. -->
			{#if showGrid && !isPie}
				{#each scale.ticks as tick}
					{#if tick > 0}
						<line
							class="chart-grid"
							x1={M.left}
							y1={layout.yFor(tick)}
							x2={M.left + plotW}
							y2={layout.yFor(tick)}
						></line>
					{/if}
				{/each}
			{/if}

			<!-- Axis lines (baseline X + trục Y) — content3. Pie: không axis. -->
			{#if showYAxis && !isPie}
				<line class="chart-axis" x1={M.left} y1={M.top} x2={M.left} y2={baseline}></line>
				<!-- Y tick labels (format value, vd 2k/2.5M) -->
				{#each scale.ticks as tick}
					<text
						class="chart-y-label"
						x={M.left - 8}
						y={layout.yFor(tick) + 3}
						text-anchor="end"
					>
						{fmt(tick)}
					</text>
				{/each}
			{/if}
			{#if showXAxis && !isPie}
				<line class="chart-axis" x1={M.left} y1={baseline} x2={M.left + plotW} y2={baseline}></line>
			{/if}

			<!-- MARKS ({#key} → replay animation khi data đổi).
			     Bar = single-series; multi-series = line (grouped bar ngoài scope). -->
			{#key animKey}
				<g class="chart-marks">
					{#if isPie}
						{#each slices as s}
							{#if s.path}
								<path
									class="chart-slice"
									d={s.path}
									style:fill={s.color}
								>
									{#if !tooltipOn}
										<title>{s.label}: {fmt(s.value)} ({Math.round((s.value / (pieTotal || 1)) * 1000) / 10}%)</title>
									{/if}
								</path>
							{/if}
						{/each}
					{:else if type === 'bar' && !isMulti}
						{#each layout.bars as bar}
							<rect
								class="chart-bar"
								x={bar.x}
								y={bar.yTop}
								width={bar.w}
								height={bar.h}
								style:fill={singleSeriesColor()}
							>
								{#if !tooltipOn}
									<title>{bar.label}: {fmt(bar.value)}</title>
								{/if}
							</rect>
						{/each}
					{:else}
						{#each layout.lineGeoms as g}
							{#if showArea && !isMulti}
								<path class="chart-area" d={g.areaPath} style:fill={g.color}></path>
							{/if}
							{#if g.linePath}
								<path
									class="chart-line"
									d={g.linePath}
									pathLength={1}
									style:stroke={g.color}
								></path>
							{/if}
							{#if showPoints}
								{#each g.pts as p}
									<circle
										class="chart-point"
										cx={p.x}
										cy={p.y}
										r={4}
										style:fill={g.color}
									>
										{#if !tooltipOn}
											<title>{isMulti ? `${g.name}: ${p.label}` : p.label}: {fmt(p.v)}</title>
										{/if}
									</circle>
								{/each}
							{/if}
						{/each}
					{/if}
				</g>

				<!-- X labels (pie: không có trục X — label nằm trong legend) -->
				{#if showXAxis && !isPie}
					{#each points as p, i}
						<text
							class="chart-x-label"
							x={layout.xFor(i)}
							y={baseline + 18}
							text-anchor={layout.rotateX ? 'end' : 'middle'}
							transform={layout.rotateX ? `rotate(-40 ${layout.xFor(i)} ${baseline + 18})` : undefined}
						>
							{xLabelText(i)}
						</text>
					{/each}
				{/if}
			{/key}
		{:else}
			<text class="chart-empty" x={width / 2} y={height / 2} text-anchor="middle">
				Không có dữ liệu
			</text>
		{/if}
	</svg>

	<!-- Tooltip hover (portal document.body, position:fixed, z-index 10500 —
	     pattern Tooltip component). TÙY CHỐN qua prop tooltip — không có → không render. -->
	{#if tooltipOn && tooltipMeta && tooltipPos}
		<div
			class="chart-tooltip"
			role="tooltip"
			aria-hidden="true"
			data-test="chart-tooltip"
			use:portalToBody
			style:top="{tooltipPos.y}px"
			style:left="{tooltipPos.x}px"
		>
			{#if tooltipOpts?.render}
				{@render tooltipOpts.render(tooltipMeta)}
			{:else}
				<span class="chart-tooltip__label">{tooltipMeta.label}</span>
				<div class="chart-tooltip__rows">
					{#each tooltipRows as row}
						<div class="chart-tooltip__row">
							{#if row.color}
								<span class="chart-tooltip__swatch" style:background={row.color}></span>
							{/if}
							{#if row.name}
								<span class="chart-tooltip__name">{row.name}</span>
							{/if}
							<span class="chart-tooltip__value">{row.value}</span>
							{#if row.percent}
								<span class="chart-tooltip__percent">{row.percent}</span>
							{/if}
							{#if row.delta}
								<span class="chart-tooltip__delta chart-tooltip__delta--{row.deltaDir}">{row.delta}</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Fallback data-table cho screen reader (visually-hidden, KHÔNG aria-hidden) -->
	<table class="chart-data-table">
		<caption>{ariaLabel}</caption>
		<thead>
			<tr>
				<th scope="col">Nhãn</th>
				{#if isMulti}
					{#each effectiveSeries as s}
						<th scope="col">{s.name}</th>
					{/each}
				{:else}
					<th scope="col">Giá trị</th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each points as p, i}
				<tr>
					<td>{p.label}</td>
					{#if isMulti}
						{#each effectiveSeries as s}
							<td>{fmt(s.data[i] ?? 0)}</td>
						{/each}
					{:else}
						<td>{fmt(p.value)}</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style lang="scss">
	@use '_styles.scss';
</style>
