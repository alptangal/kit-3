//$components/element/progress/_interface.ts
import type { BasicConfigs, BasicProps, Color } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

export type ProgressSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ProgressProps extends BasicProps {
	/** Giá trị hiện tại (0–100, clamp). undefined/null = indeterminate (nếu không set indeterminate). */
	value?: number | null;
	/** Giá trị tối đa (default 100). */
	max?: number;
	/** Bắt buộc hiển thị shimmer (dù value có). */
	indeterminate?: boolean;
	/** Màu (default 'primary'). */
	color?: Color;
	/** Kích thước — set CSS var --progress-height (4/6/8/10px). */
	size?: ProgressSize;
	/** Hiện text "NN%" bên phải track. */
	showValue?: boolean;
	/** Accessible label (aria-label). */
	label?: TranslateContent;
}

export interface ProgressConfigs extends BasicConfigs {
	size: ProgressSize;
	color: Color;
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
