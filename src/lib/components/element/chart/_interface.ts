// $components/element/chart/_interface.ts
// LIGHT ATOM — Chart (self-written SVG, KHÔNG dùng chart library).
// Data-driven: single series (data) là chủ lực; multiple series là stretch.
// Scale + axis + mark tự tính bằng pure JS (_scale.ts), render bằng <svg>.
import type { BasicConfigs, BasicProps, Color } from '$components/interface';

export type ChartType = 'bar' | 'line';

/** 1 điểm dữ liệu (single series). */
export interface ChartDatum {
	/** Nhãn trục X. */
	label: string;
	/** Giá trị (>= 0; value âm sẽ clamp về baseline). */
	value: number;
}

/** 1 series cho multiple-series (line). `data` line up 1:1 với label của `data` prop. */
export interface ChartSeries {
	/** Tên series (hiện trong legend khi multi-series). */
	name: string;
	/** Màu override (token CSS var hoặc color). Ưu tiên token semantic. */
	color?: string;
	/** Giá trị mỗi điểm (bắt buộc cùng độ dài với label). */
	data: number[];
}

export interface ChartProps extends BasicProps {
	/** Dữ liệu (single series) — required. Empty → placeholder "Không có dữ liệu". */
	data: ChartDatum[];
	/** Kiểu chart (default 'bar'). */
	type?: ChartType;
	/** Đa series (line multi). Stretch — khi có, `data` chỉ dùng lấy label. */
	series?: ChartSeries[];
	/** Chiều rộng viewBox (default 600). CSS co giãn width:100%. */
	width?: number;
	/** Chiều cao viewBox (default 300). */
	height?: number;
	/** Hiện gridlines Y (default true). */
	showGrid?: boolean;
	/** Hiện trục X (labels) (default true). */
	showXAxis?: boolean;
	/** Hiện trục Y (ticks + labels) (default true). */
	showYAxis?: boolean;
	/** Formatter giá trị trục Y + tooltip (default: ≥1e6 "M", ≥1e3 "k"). */
	valueFormatter?: (n: number) => string;
	/** Override màu series (default var(--primary)). */
	color?: Color | string;
	/** Hiện marker tròn mỗi điểm (line) (default false). */
	showPoints?: boolean;
	/** Hiện nền area dưới đường (line) (default false). */
	showArea?: boolean;
	/** Accessible label (aria-label). Không có → tự sinh "Biểu đồ {n} điểm". */
	'aria-label'?: string;
	/** Tiêu đề hiển thị trên chart. */
	title?: string;
}

export interface ChartConfigs extends Omit<BasicConfigs, 'value' | 'status'> {
	type: ChartType;
	width: number;
	height: number;
	showGrid: boolean;
	showXAxis: boolean;
	showYAxis: boolean;
	/** Dữ liệu đã validate (bỏ value không phải số, value âm clamp 0). */
	points: ChartDatum[];
	/** Giá trị max (đã clamp) dùng tính scale. */
	maxValue: number;
	/** niceScale result (max/step/ticks). */
	scale: { max: number; step: number; ticks: number[] };
	/** aria-label resolved. */
	ariaLabel: string;
}
