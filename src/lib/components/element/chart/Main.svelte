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
	import type { Action } from 'svelte/action';
	import type {
		ChartConfigs,
		ChartDatum,
		ChartLiveOptions,
		ChartProps,
		ChartSeries,
		ChartTooltipMeta,
		ChartTooltipOptions
	} from './_interface';
	import {
		buildAreaPath,
		buildLinePath,
		buildTooltipRows,
		defaultFormatter,
		niceScale,
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
		tooltip,
		live,
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
	// tắt cho bar (so sánh hạng mục, delta kém nghĩa).
	const deltaShown = $derived(tooltipOpts ? (tooltipOpts.showDelta ?? type === 'line') : false);
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
	const effectiveData = $derived(liveOn ? liveBuffer : (Array.isArray(data) ? data : []));
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

	// Key remount → replay animation khi data/type đổi. Live bật → KHÔNG include values
	// (marks update in-place + CSS transition geometry — mượt, không replay nhảy).
	const animKey = $derived(
		liveOn
			? `live-${type}-${isMulti ? 'm' : 's'}-${layout.bars.length}-${effectiveSeries.map((s) => s.name).join('|')}`
			: `${type}-${isMulti ? 'm' : 's'}-${layout.bars.length}-${points.map((p) => p.value).join(',')}-${effectiveSeries.map((s) => s.name).join('|')}`
	);

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

	// Meta tooltip tại điểm hover (label/value/%/delta từng series) — payload snippet.
	const tooltipMeta = $derived.by((): ChartTooltipMeta | undefined => {
		if (hoverIndex === undefined || !tooltipOn || !points.length) return undefined;
		const i = Math.min(hoverIndex, points.length - 1);
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
	const tooltipRows = $derived.by(() => {
		const meta = tooltipMeta;
		if (!meta) return [];
		return buildTooltipRows(meta.series, fmtValue, {
			showPercent: tooltipOpts?.showPercent ?? true,
			showDelta: deltaShown,
			// single series → % so tổng toàn chart (không phải giá trị tại điểm = 100%)
			percentTotal: isMulti
				? undefined
				: points.reduce((sum, p) => sum + p.value, 0)
		});
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
		const a = tooltipAnchor;
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
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'chart-root',
				`chart-${type}`,
				`size-${this.size}`,
				isMulti ? 'is-multi' : undefined,
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

	<!-- Legend (multi-series): kênh nhận dạng, KHÔNG chỉ dựa màu. Single series = không legend (title tên nó). -->
	{#if isMulti && effectiveSeries.length}
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
		onmousemove={onSvgMouseMove}
		onmouseleave={onSvgMouseLeave}
	>
		{#if points.length}
			<!-- Gridlines (trừ tick=0 — trùng baseline X, tránh vẽ chồng) -->
			{#if showGrid}
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

			<!-- Axis lines (baseline X + trục Y) — content3 -->
			{#if showYAxis}
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
			{#if showXAxis}
				<line class="chart-axis" x1={M.left} y1={baseline} x2={M.left + plotW} y2={baseline}></line>
			{/if}

			<!-- MARKS ({#key} → replay animation khi data đổi).
			     Bar = single-series; multi-series = line (grouped bar ngoài scope). -->
			{#key animKey}
				<g class="chart-marks">
					{#if type === 'bar' && !isMulti}
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

				<!-- X labels -->
				{#if showXAxis}
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
