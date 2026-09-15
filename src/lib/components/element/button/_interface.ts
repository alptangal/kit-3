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
	/** Callback khi giữ nút ≥ longPressDuration ms */
	onLongPress?: (event?: PointerEvent) => void | Promise<void>;
	/** Thời gian giữ để kích hoạt long press (ms, default: 500) */
	longPressDuration?: number;
	delay?: number | `${number}s` | `${number}ms` | 'none';
	transitionDuration?: number | `${number}s` | `${number}ms` | 'none';
	loading?: boolean;
	loadingDuration?: number | `${number}s` | `${number}ms`;
	to?: string;
	/** Text tooltip hiện khi hover — cũng được dùng làm aria-label nếu aria-label không set */
	tooltip?: string;
	/** aria-label tường minh cho screen reader */
	'aria-label'?: string;
	/** Phím tắt kích hoạt button (e.g. 'Enter', 'F2', 'k') */
	shortcut?: string | string[];
	/** Hiệu ứng ripple lan tỏa từ vị trí click (material design style) */
	ripple?: boolean;
	/** Hỏi xác nhận trước khi thực hiện action */
	confirmText?: string;
	/** Debounce — chống click spam, thời gian chờ giữa 2 lần click (ms) */
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
}

