// src/lib/components/element/badge/_interface.ts
// Badge — "mặt hàng" nhỏ (pill/chip) cho trạng thái, phân loại, số lượng.
// Đơn giản hơn Tag: dot + icon + label, không removable.
import type { BasicConfigs, BasicProps, Color, Size } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

export type BadgeVariant = 'soft' | 'solid' | 'outline' | 'ghost';

export interface BadgeProps extends Omit<BasicProps, 'as'> {
	/** Passthrough `data-*` attributes (vd `data-test`) — spread lên element gốc. */
	'data-test'?: string;
	/** Nội dung hiển thị của badge (i18n). */
	label?: TranslateContent | string;
	/** Kích thước (default 'sm'). Khuyến nghị 'xs' / 'sm' / 'md'. */
	size?: Size;
	/** Màu (default 'primary'). */
	color?: Color;
	/** Kiểu bề mặt (default 'soft'). */
	variant?: BadgeVariant;
	/** Hiện chấm tròn nhỏ phía trước label (màu theo --color). */
	dot?: boolean;
	/** Icon iconify (string) phía trước label (vd "ph:star-fill"). */
	icon?: string;
	/** Element gốc (default 'span'); 'a' cần truyền `href`. */
	as?: 'span' | 'a' | 'button';
	/** href khi as='a'. */
	href?: string;
}

export interface BadgeConfigs extends BasicConfigs {
	size: Size;
	color: Color;
	variant: BadgeVariant;
	dot: boolean;
	icon?: string;
	/** Nội dung đã resolve theo ngôn ngữ. */
	text: string;
}
