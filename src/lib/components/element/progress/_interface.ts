//$components/element/progress/_interface.ts
import type { BasicConfigs, BasicProps, Color } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

export type ProgressSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
export type ProgressVariant = 'solid' | 'soft' | 'outline' | 'ghost';

export interface ProgressProps extends Omit<BasicProps, 'size'> {
	/** Giá trị hiện tại (0–100, clamp). undefined/null = indeterminate (nếu không set indeterminate). */
	value?: number | null;
	/** Giá trị tối đa (default 100). */
	max?: number;
	/** Bắt buộc hiển thị shimmer (dù value có). */
	indeterminate?: boolean;
	/** Màu (default 'primary'). */
	color?: Color;
	/** Kích thước — set CSS var --progress-height (2/4/6/8/10/12/14/16px; full = track full container). */
	size?: ProgressSize;
	/** Variant hiển thị (default 'solid'): solid nền đậm, soft nền nhạt, outline viền track, ghost mờ. */
	variant?: ProgressVariant;
	/** Hiện text "NN%" bên phải track. */
	showValue?: boolean;
	/** Text % nằm TRONG track canh phải mép bar (mặc định ngoài track bên phải). */
	valueInside?: boolean;
	/** Accessible label (aria-label). */
	label?: TranslateContent;
}

export interface ProgressConfigs extends Omit<BasicConfigs, 'size' | 'value'> {
	size: ProgressSize;
	color: Color;
	variant: ProgressVariant;
	max: number;
	value: number;
	indeterminate: boolean;
	/** Giá trị đã clamp 0–max. */
	clampedValue: number;
	/** Độ rộng bar theo % (0–100). */
	percent: number;
	/** Text hiển thị khi showValue (vd "65%"). */
	displayText: string;
	/** aria-label resolve theo ngôn ngữ. */
	ariaLabel: string;
}
