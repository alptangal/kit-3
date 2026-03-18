import type { BasicProps, Color, Size } from '$components/interface';

export interface ButtonProps extends BasicProps {
	label?:
		| string
		| (Pick<BasicProps, 'events' | 'class' | 'snippet' | 'as' | 'overwriteDefaultStyles'> & {
				text?: string;
		  });
	leading?:
		| string
		| (Pick<BasicProps, 'events' | 'class' | 'snippet' | 'as' | 'overwriteDefaultStyles'> & {
				text?: string;
				icon?: string;
		  });
	trailing?:
		| string
		| (Pick<BasicProps, 'events' | 'class' | 'snippet' | 'as' | 'overwriteDefaultStyles'> & {
				text?: string;
				icon?: string;
		  });
	variant?: 'ghost' | 'solid' | 'faded' | 'bordered' | 'light' | 'flat' | 'shadow';
	color?: Color;
	loading?: boolean;
	loadingIcon?: string;
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
}
