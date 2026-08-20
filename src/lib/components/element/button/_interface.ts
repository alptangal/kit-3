import type { ResolvedPathname } from '$app/types';
import type { BasicConfigs, BasicProps, Color, Size } from '$components/interface';
type ButtonTypes = 'button' | 'submit' | 'reset';
type ButtonVariants = 'solid' | 'outline' | 'soft' | 'subtle' | 'link' | 'ghost';
export interface ButtonProps extends Omit<BasicProps, 'class'> {
	type?: ButtonTypes;
	variant?: ButtonVariants;
	size?: Size;
	icon?:
		| string
		| {
				leading?: string;
				trailing?: string;
		  };
	class?:
		| string
		| (string | undefined)[]
		| {
				root?: string | string[];
				icon?:
					| string
					| string[]
					| {
							leading?: string | string[];
							trailing?: string | string[];
					  };
		  };
	'aspect-square'?: boolean;
	rounded?: Size | 'full' | 'none';
	disabled?: boolean;
	actived?: boolean;
	transitionDisabled?: boolean;
	color?: Color;
	onClick?: (event?: Event) => void | Promise<void>;
	delay?: number | `${number}s` | `${number}ms` | 'none';
	transitionDuration?: number | `${number}s` | `${number}ms` | 'none';
	loading?: boolean;
	loadingDuration?: number | `${number}s` | `${number}ms`;
	to?: string;
}
export interface ButtonConfigs extends BasicConfigs {
	type: ButtonTypes;
	style: string[];
	variant: ButtonVariants;
	size: Size;
	'aspect-square'?: boolean;
	color?: Color;
	status?: {
		hover?: boolean;
		tap?: boolean;
	};
	delay?: number;
	transitionDuration: number;
	loadingDuration: number;
	loading?: boolean;
	disabled?: boolean;
}
