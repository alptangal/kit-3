//$components/element/spinner/_interface.ts
import type { BasicConfigs, BasicProps, Color, TimeUnits } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

export type SpinnerPattern = 'circle' | 'dots' | 'bars' | 'square';
export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SpinnerProps extends BasicProps {
	/** Kiểu đồ họa spinner (default 'circle'). */
	pattern?: SpinnerPattern;
	/** Kích thước — set CSS var --spinner-size (14/18/24/32px). */
	size?: SpinnerSize;
	/** Màu (default 'primary'). */
	color?: Color;
	/** Accessible label — có → root role="status" + text sr-only; không có → decorative (aria-hidden). */
	label?: TranslateContent;
	/** Chu kỳ animation (default 900ms). */
	duration?: TimeUnits;
}

export interface SpinnerConfigs extends BasicConfigs {
	pattern: SpinnerPattern;
	size: SpinnerSize;
	color: Color;
	duration: number;
	/** Label resolve theo ngôn ngữ (mặc định "Đang tải…"/"Loading…"). */
	labelText: string;
}
