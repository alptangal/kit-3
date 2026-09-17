import type { BasicConfigs, BasicProps, Color, Size } from '$components/interface';
import type { ButtonVariant } from './composables/useButtonVariant';
import type { ButtonColor } from './composables/useButtonColor';

// ── Re-export composed types ──
export type ButtonTypes = 'button' | 'submit' | 'reset';
export type ButtonVariants = ButtonVariant;
export type ButtonSize = Size;
export type ButtonColorAlias = ButtonColor;

// ── Icon prop (unchanged for backward compat) ──
export type ButtonIcon =
	| string
	| {
			leading?: string;
			trailing?: string;
	  };

export type ButtonClass =
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

// ── Main props — composed from sub-systems ──
export interface ButtonProps extends Omit<BasicProps, 'class'> {
	type?: ButtonTypes;
	variant?: ButtonVariants;
	size?: Size;
	icon?: ButtonIcon;
	class?: ButtonClass;
	'aspect-square'?: boolean;
	rounded?: Size | 'full' | 'none';
	disabled?: boolean;
	actived?: boolean;
	transitionDisabled?: boolean;
	color?: Color;
	onClick?: (event?: MouseEvent | Event) => void | Promise<void>;
	onclick?: (event?: MouseEvent | Event) => void | Promise<void>;
	onLongPress?: (event?: PointerEvent) => void | Promise<void>;
	longPressDuration?: number;
	delay?: number | `${number}s` | `${number}ms` | 'none';
	transitionDuration?: number | `${number}s` | `${number}ms` | 'none';
	loading?: boolean;
	loadingSpinner?: boolean;
	loadingDuration?: number | `${number}s` | `${number}ms`;
	to?: string;
	target?: '_blank' | '_self' | '_parent' | '_top';
	rel?: string;
	tooltip?: string;
	'aria-label'?: string;
	shortcut?: string | string[];
	ripple?: boolean;
	confirmText?: string;
	debounce?: number;
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
		longPress?: boolean;
		longPressFired?: boolean;
		pointerStartX?: number;
		pointerStartY?: number;
		debouncing?: boolean;
	};
	delay?: number;
	transitionDuration: number;
	loadingDuration: number;
	loading?: boolean;
	disabled?: boolean;
	/** tooltip text — used by useButtonState / has-tooltip class */
	tooltip?: string;
	transitionDisabled?: boolean;
}

/** Alias for backward compatibility */
export type Button = ButtonProps;
