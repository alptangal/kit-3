// import type { BasicConfigs, BasicProps, Color, Size } from '$components/interface';

import type { BasicConfigs, BasicProps, DistanceUnits, TimeUnits, Color, Size } from '$components/interface';
import type { SvelteComponent } from 'svelte';
import type { ButtonConfigs } from '../button/_interface';

// Re-export để các file khác import Color/Size/TooltipVariant từ đây (chỉ import
// thì module không "declare" được cho consumer).
export type { Color, Size };

// export interface TooltipProps_old extends BasicProps {
// 	label?:
// 		| string
// 		| {
// 				text?: string;
// 				icon?: string;
// 				html?: string;
// 				snippet?: SvelteSlots;
// 				class?:
// 					| string
// 					| string[]
// 					| {
// 							value: string | string[];
// 							overwriteDefaultStyles?: boolean;
// 					  };
// 		  };
// 	description?:
// 		| string
// 		| {
// 				text?: string;
// 				icon?: string;
// 				html?: string;
// 				snippet?: SvelteSlots;
// 				class?:
// 					| string
// 					| string[]
// 					| {
// 							value: string | string[];
// 							overwriteDefaultStyles?: boolean;
// 					  };
// 		  };
// 	position?:
// 		| 'top'
// 		| 'bottom'
// 		| 'left'
// 		| 'right'
// 		| 'top-start'
// 		| 'top-end'
// 		| 'bottom-start'
// 		| 'bottom-end'
// 		| 'left-start'
// 		| 'left-end'
// 		| 'right-start'
// 		| 'right-end';
// 	offset?: number;
// 	variant?: 'ghost' | 'solid' | 'faded' | 'bordered' | 'light' | 'flat' | 'shadow';
// 	color?: Color;
// 	radius?: 'full' | 'none' | Size;
// 	size?: Size;
// 	parentRef?: HTMLElement;
// 	withArrow?: boolean;
// }
export type TooltipVariant = 'solid' | 'outline' | 'soft' | 'ghost';
// Kiểu animate khi tooltip đổi trạng thái (hover in, position flip): fade = chỉ
// opacity (mặc định), scale = opacity + scale 0.95, slide = opacity + dịch 4px
// theo hướng position. Prop animate nhận thêm boolean (true = fade).
export type TooltipAnimation = 'fade' | 'scale' | 'slide';
export interface TooltipProps extends BasicProps {
	disabled?: boolean;
	delay?: TimeUnits;
	offset?: DistanceUnits;
	rounded?: Size | 'full' | 'none';
	color?: Color;
	variant?: TooltipVariant;
	/** Anchor cập nhật theo mousemove (rAF throttle) — arrow bám điểm chuột hiện tại. */
	follow?: boolean;
	/** Transition mượt khi đổi trạng thái — 'fade' | 'scale' | 'slide' (true = fade). */
	animate?: TooltipAnimation | boolean;
	actionButtons?: {
		info?: {
			hide?: boolean;
		};
	};
}
export interface TooltipConfigs extends BasicConfigs {
	size: Size;
	color: Color;
	variant: TooltipVariant;
	status: {
		hover?: boolean;
		mousePosition?: {
			x: number;
			y: number;
		};
		/** Điểm neo (mouse lúc bắt đầu hover) — content & arrow cùng bám. */
		anchor?: { x: number; y: number };
	};
	delay: number;
	offset: number;
	rounded: Size | 'full' | 'none';
	/** Anchor bám theo mousemove (rAF) — mousemove block đọc cờ này để cập nhật anchor. */
	follow: boolean;
	previousPosition?: 'top' | 'bottom' | 'left' | 'right';
	actionButtons: {
		info: BasicConfigs & {
			component?: SvelteComponent & { configs: ButtonConfigs };
			actived?: boolean;
		};
	};
}
export interface TooltipContentProps extends BasicProps {
	delay?: TimeUnits;
	size?: Size;
	offset?: DistanceUnits;
	rounded?: Size | 'full' | 'none';
	// Bề mặt màu — override riêng từng content (mặc định bám root qua ctx).
	color?: Color;
	variant?: TooltipVariant;
}
export interface TooltipContentConfigs extends BasicConfigs {
	size: Size;
	delay: number;
	previousPosition?: 'top' | 'bottom' | 'left' | 'right';
	offset: number;
	position?: 'top' | 'bottom' | 'left' | 'right';
	rounded: Size | 'full' | 'none';
	color: Color;
	variant: TooltipVariant;
	/** Class animate (animate-scale / animate-slide) resolve qua _styles.scss. */
	animate?: TooltipAnimation;
	/** Đã định vị + is-shown (opacity 1) — from-state trước đó (opacity 0). */
	shown?: boolean;
}
export interface TooltipArrowProps extends BasicProps {
	size?: Size;
	color?: Color;
	variant?: TooltipVariant;
}
export interface TooltipArrowConfigs extends BasicConfigs {
	size: Size;
	color: Color;
	variant: TooltipVariant;
}
