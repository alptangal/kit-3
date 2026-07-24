// import type { BasicConfigs, BasicProps, Color, Size } from '$components/interface';

import type {
	BasicConfigs,
	BasicProps,
	DistanceUnits,
	Positions,
	TimeUnits
} from '$components/interface';
import type { Color, Size } from '$interfaces/basic';

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
export interface TooltipProps extends BasicProps {
	disabled?: boolean;
	delay?: TimeUnits;
	offset?: DistanceUnits;
	rounded?: Size | 'full' | 'none';
}
export interface TooltipConfigs extends BasicConfigs {
	size: Size;
	status?: {
		hover?: boolean;
		mousePosition?: {
			x: number;
			y: number;
		};
	};
	delay: number;
	offset: number;
	rounded: Size | 'full' | 'none';
	previousPosition?: 'top' | 'bottom' | 'left' | 'right';
}
export interface TooltipContentProps extends BasicProps {
	delay?: TimeUnits;
	size?: Size;
	offset?: DistanceUnits;
	rounded?: Size | 'full' | 'none';
}
export interface TooltipContentConfigs extends BasicConfigs {
	size: Size;
	delay: number;
	previousPosition?: 'top' | 'bottom' | 'left' | 'right';
	offset: number;
	position?: 'top' | 'bottom' | 'left' | 'right';
	rounded: Size | 'full' | 'none';
}
export interface TooltipArrowProps extends BasicProps {
	size?: Size;
	color?: Color;
}
export interface TooltipArrowConfigs extends BasicConfigs {
	size: Size;
	color: Color;
}
