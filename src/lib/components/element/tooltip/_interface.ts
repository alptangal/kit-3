import type { BasicProps, Color, Size } from '$components/interface';

export interface TooltipProps extends BasicProps {
	label?:
		| string
		| {
				text?: string;
				icon?: string;
				html?: string;
				snippet?: SvelteSlots;
				class?:
					| string
					| string[]
					| {
							value: string | string[];
							overwriteDefaultStyles?: boolean;
					  };
		  };
	description?:
		| string
		| {
				text?: string;
				icon?: string;
				html?: string;
				snippet?: SvelteSlots;
				class?:
					| string
					| string[]
					| {
							value: string | string[];
							overwriteDefaultStyles?: boolean;
					  };
		  };
	position?:
		| 'top'
		| 'bottom'
		| 'left'
		| 'right'
		| 'top-start'
		| 'top-end'
		| 'bottom-start'
		| 'bottom-end'
		| 'left-start'
		| 'left-end'
		| 'right-start'
		| 'right-end';
	offset?: number;
	variant?: 'ghost' | 'solid' | 'faded' | 'bordered' | 'light' | 'flat' | 'shadow';
	color?: Color;
	radius?: 'full' | 'none' | Size;
	size?: Size;
	parentRef?: HTMLElement;
}
