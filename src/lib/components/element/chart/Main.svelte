<script lang="ts">
	// $components/element/chart/Main.svelte
	// Chart — SELF-WRITTEN SVG (KHÔNG chart library). Data-driven: tính nice-scale
	// + draw bằng <svg>/<rect>/<path>/<line>. Single series (data) là chủ lực;
	// multiple series (series[]) là stretch (line multi + legend).
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import type { ChartConfigs, ChartDatum, ChartProps, ChartSeries } from './_interface';
	import {
		buildAreaPath,
		buildLinePath,
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

	// ── Validate dữ liệu: bỏ value không phải số, clamp value âm về 0 ──
	const points: ChartDatum[] = $derived.by(() => {
		const arr = Array.isArray(data) ? data : [];
		return arr
			.filter((d): d is ChartDatum => !!d && typeof d.value === 'number' && Number.isFinite(d.value))
			.map((d) => ({ label: String(d.label ?? ''), value: Math.max(0, d.value) }));
	});

	const maxValue = $derived(points.length ? Math.max(...points.map((p) => p.value)) : 0);
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

	// Key remount → replay animation khi data/type đổi.
	const animKey = $derived(
		`${type}-${isMulti ? 'm' : 's'}-${layout.bars.length}-${points.map((p) => p.value).join(',')}-${effectiveSeries.map((s) => s.name).join('|')}`
	);

	// ── A11y label ──
	const ariaLabel = $derived(ariaLabelProp ?? `Biểu đồ ${points.length} điểm`);

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
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'chart-root',
				`chart-${type}`,
				`size-${this.size}`,
				isMulti ? 'is-multi' : undefined,
				points.length === 0 ? 'is-empty' : undefined
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
								<title>{bar.label}: {fmt(bar.value)}</title>
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
										<title>{isMulti ? `${g.name}: ${p.label}` : p.label}: {fmt(p.v)}</title>
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
