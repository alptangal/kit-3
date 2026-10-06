// src/lib/components/element/chart/index.ts
// Export Chart (light atom, self-written SVG). Kèm helpers pure (_scale) để reuse.
export { default as Chart } from './Main.svelte';
export type {
	ChartType,
	ChartDatum,
	ChartSeries,
	ChartProps,
	ChartConfigs,
	ChartTooltipOptions,
	ChartLiveOptions,
	ChartTooltipMeta,
	ChartTooltipSeriesMeta,
	ChartTooltipRow
} from './_interface';
export {
	niceScale,
	defaultFormatter,
	truncate,
	roundedTopBar,
	buildLinePath,
	buildAreaPath,
	buildTooltipRows,
	deltaDir,
	rnd
} from './_scale';
export type { ChartScale, ChartPoint } from './_scale';
