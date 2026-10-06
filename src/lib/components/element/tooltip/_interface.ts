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
export interface TooltipProps extends BasicProps {
	disabled?: boolean;
	delay?: TimeUnits;
	offset?: DistanceUnits;
	rounded?: Size | 'full' | 'none';
	color?: Color;
	variant?: TooltipVariant;
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
