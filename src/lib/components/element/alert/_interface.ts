//$components/element/alert/_interface.ts
// Alert — inline notification (element, KHÔNG phải form field):
// thông tin / cảnh báo / lỗi / thành công, theo semantic color.
// Nền: shadcn Alert (variant + title + description + icon).
import type { BasicConfigs, BasicProps, Color, Size } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

export interface AlertProps extends BasicProps {
	/** Passthrough `data-*` attributes (vd `data-test`) — spread lên element gốc. */
	'data-test'?: string;
	/** Semantic color (default 'default'). */
	color?: Color;
	/** Tiêu đề (font 600, màu semantic đậm). */
	title?: TranslateContent | string;
	/** Mô tả (optional, màu mờ hơn title). */
	description?: TranslateContent | string;
	/**
	 * Icon iconify (vd 'lucide:info'). Nếu không truyền → default theo color:
	 * error→lucide:circle-alert, warning→lucide:triangle-alert,
	 * success→lucide:circle-check, khác→lucide:info.
	 */
	icon?: string;
	/** Element gốc (default 'div'). */
	as?: BasicProps['as'];
	/** Kích thước (default 'md') — chỉ ảnh hưởng token padding/gap/font theo size-*. */
	size?: Size;
}

export interface AlertConfigs extends BasicConfigs {
	size: Size;
	color: Color;
	/** ARIA role: error/warning → 'alert' (assertive), khác → 'status' (polite). */
	role: 'alert' | 'status';
	/** aria-live tương ứng role. */
	ariaLive: 'assertive' | 'polite';
	/** Icon đã resolve (prop hoặc default theo color). */
	icon: string;
	/** Title/description đã resolve theo ngôn ngữ ('' nếu không có). */
	title: string;
	description: string;
}
