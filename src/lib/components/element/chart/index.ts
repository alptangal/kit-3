// src/lib/components/element/chart/index.ts
// Export Chart (light atom, self-written SVG). Kèm helpers pure (_scale) để reuse.
export { default as Chart } from './Main.svelte';
export type {
	ChartType,
	ChartDatum,
	ChartSeries,
	ChartProps,
	ChartConfigs
} from './_interface';
export {
	niceScale,
	defaultFormatter,
	truncate,
	roundedTopBar,
	buildLinePath,
	buildAreaPath,
	rnd
} from './_scale';
export type { ChartScale, ChartPoint } from './_scale';
