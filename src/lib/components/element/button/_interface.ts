import type { BasicProps, Color, Size } from '$components/interface';
import type { Variant } from '$interfaces/basic';

export interface Button extends BasicProps {
	label?:
		| string
		| (Pick<BasicProps, 'events' | 'class' | 'snippet' | 'as' | 'overwriteDefaultStyles'> & {
				text?: string;
		  });
	description?:
		| string
		| (Pick<BasicProps, 'events' | 'class' | 'snippet' | 'as' | 'overwriteDefaultStyles'> & {
				text?: string;
		  });
	// leading?:
	// 	| string
	// 	| (Pick<BasicProps, 'events' | 'class' | 'snippet' | 'as' | 'overwriteDefaultStyles'> & {
	// 			text?: string;
	// 			icon?: string;
	// 	  });
	// trailing?:
	// 	| string
	// 	| (Pick<BasicProps, 'events' | 'class' | 'snippet' | 'as' | 'overwriteDefaultStyles'> & {
	// 			text?: string;
	// 			icon?: string;
	// 	  });
	directive?: 'ltr' | 'rtl';
	icon?:
		| string
		| (Pick<BasicProps, 'events' | 'class' | 'snippet' | 'as' | 'overwriteDefaultStyles'> & {
				string?: string;
		  });
	variant?: Variant;
	color?: Color;
	loading?: boolean;
	loadingIcon?: string;
	loadingLoop?: 'infinite' | `${number}` | number;
	loadingAnimation?:
		| 'style-1'
		| 'style-2'
		| 'style-3'
		| {
				/** Style of the loading animation. */
				style?: 'style-1' | 'style-2' | 'style-3';
				/** Duration of the loading animation in milliseconds. */
				duration?: number | `${number}s` | `${number}ms`;
		  };
	disabled?: boolean;
	radius?: 'full' | 'none' | Size;
	size?: Size;
	width?: `${number}%` | 'full' | 'auto';
	parentRef?: HTMLElement;
	rippleAnimationDisabled?: boolean;
	to?: string;
	'aspect-ratio'?: 'square' | 'auto';
	minWidthDisabled?: boolean;
	alt?: string;
}
