// $components/element/chart/_interface.ts
// LIGHT ATOM — Chart (self-written SVG, KHÔNG dùng chart library).
// Data-driven: single series (data) là chủ lực; multiple series là stretch.
// Scale + axis + mark tự tính bằng pure JS (_scale.ts), render bằng <svg>.
// Nâng cấp: tooltip hover đa thông tin (label/value/%/delta/custom render) +
// live data (poll source hoặc mirror prop, cửa sổ trượt max) — cả hai TÙY CHỌN
// qua prop, KHÔNG đổi hành vi mặc định khi không truyền.
import type { Snippet } from 'svelte';
import type { BasicConfigs, BasicProps, Color, TimeUnits } from '$components/interface';

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

/** Meta 1 series tại điểm đang hover — payload cho custom render snippet. */
export interface ChartTooltipSeriesMeta {
	/** Tên series (single series = 'value'). */
	name: string;
	/** Màu series (đã resolve token var). */
	color: string;
	/** Giá trị raw (chưa format). */
	value: number;
	/** Tỉ trọng 0..1 (multi: so tổng các series tại điểm; single: so tổng toàn chart). */
	percent: number;
	/** Chênh lệch so điểm kề trước (undefined ở điểm đầu). */
	delta?: number;
	/** Hướng delta so điểm kề (auto từ delta; undefined khi không có delta). */
	deltaDir?: 'up' | 'down' | 'flat';
}

/** Meta tooltip hover — truyền vào snippet custom render ({@render render(meta)}). */
export interface ChartTooltipMeta {
	/** Nhãn trục X của điểm đang hover. */
	label: string;
	/** Index điểm đang hover. */
	index: number;
	/** Tổng số điểm data. */
	total: number;
	/** Giá trị từng series tại điểm đó. */
	series: ChartTooltipSeriesMeta[];
}

/** 1 dòng trong tooltip mặc định (đã format). */
export interface ChartTooltipRow {
	/** Tên series (single series = không tên — header đã là label). */
	name?: string;
	/** Màu swatch (token var). */
	color?: string;
	/** Giá trị đã format. */
	value: string;
	/** Tỉ trọng đã format ("12%"). */
	percent?: string;
	/** Delta đã format ("+120"). */
	delta?: string;
	/** Hướng delta. */
	deltaDir?: 'up' | 'down' | 'flat';
}

export interface ChartTooltipOptions {
	/** Hiện % so tổng (default true — multi: so tổng series tại điểm; single: so tổng chart). */
	showPercent?: boolean;
	/** Hiện delta so điểm kề (default: tự bật cho type="line", tắt cho bar). */
	showDelta?: boolean;
	/** Override formatter giá trị (fallback valueFormatter ?? defaultFormatter). */
	formatValue?: (n: number) => string;
	/** Custom render toàn bộ tooltip — nhận ChartTooltipMeta (ăn lineback default). */
	render?: Snippet<[ChartTooltipMeta]>;
}

export interface ChartLiveOptions {
	/** Bật live (default true khi có prop live). */
	enabled?: boolean;
	/** Chu kỳ poll khi có `source` (default 1s). Không có source → mirror `data` prop. */
	interval?: TimeUnits;
	/** Cửa sổ trượt: giữ tối đa N điểm cuối, bỏ điểm cũ nhất khi vượt (default: không giới hạn). */
	max?: number;
	/**
	 * Nguồn data — chart tự poll theo `interval`. Trả 1 điểm hoặc mảng điểm mới để
	 * append (null/undefined → bỏ qua tick). Không có source → chart mirror `data` prop
	 * (demo tự đẩy bằng $state + setInterval) và vẫn áp cửa sổ `max`.
	 */
	source?: () =>
		| ChartDatum
		| ChartDatum[]
		| null
		| undefined
		| Promise<ChartDatum | ChartDatum[] | null | undefined>;
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
	/** Tooltip hover đa thông tin (label/value/%/delta/custom render). TÙY CHỌN — không có → giữ native <title>. */
	tooltip?: boolean | ChartTooltipOptions;
	/** Live data — poll source hoặc mirror data prop, cửa sổ trượt max. TÙY CHỌN. */
	live?: boolean | ChartLiveOptions;
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
	/** Dữ liệu hiệu dụng đã validate (live-aware khi bật live; bỏ value không phải số, value âm clamp 0). */
	points: ChartDatum[];
	/** Giá trị max (đã clamp) dùng tính scale. */
	maxValue: number;
	/** niceScale result (max/step/ticks). */
	scale: { max: number; step: number; ticks: number[] };
	/** aria-label resolved. */
	ariaLabel: string;
	/** Index điểm đang hover (tooltip) — undefined khi không hover. */
	hoverIndex: number | undefined;
	/** Tooltip đang mở. */
	tooltipOpen: boolean;
	/** Live data đang bật. */
	live: boolean;
}
