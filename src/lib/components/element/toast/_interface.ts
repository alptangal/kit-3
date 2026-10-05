import type { BasicConfigs, BasicProps, Color, Size, TimeUnits } from '$components/interface';
import type { FlyParams } from 'svelte/transition';

type Position = 'top' | 'bottom' | 'left' | 'right';
export interface ToastWrapperProps extends BasicProps {
	disabled?: boolean;
	'data-test'?: string;
}
export interface ToastWrapperConfigs extends BasicConfigs {
	size: Size;
	disabled?: boolean;
}

export interface ToastProps extends BasicProps {
	color?: Color;
	duration?: TimeUnits | 'infinite';
	id?: string;
	offset?: number;
	position?: Position;
}
export interface ToastConfigs extends BasicConfigs {
	color: Color;
	disabled?: boolean;
	duration: number | 'infinite';
	offset: number;
	position: Position;
	status: {
		hover?: boolean;
	};
	id?: string;
	// A11y: success/error → role="alert" + aria-live="assertive" (urgent);
	// còn lại (info/warning/default) → role="status" + aria-live="polite".
	liveRole: 'alert' | 'status';
	ariaLive: 'assertive' | 'polite';
	// Tham số fly transition (đã honor prefers-reduced-motion: duration 0 khi reduce).
	flyTransition: FlyParams;
}

export interface ToastContentProps extends BasicProps {}
export interface ToastContentConfigs extends BasicConfigs {}

export interface ToastContentTitleProps extends BasicProps {
	color?: Color;
}
export interface ToastContentTitleConfigs extends BasicConfigs {
	color: Color;
}

export interface ToastContentDescriptionProps extends BasicProps {
	color?: Color;
}
export interface ToastContentDescriptionConfigs extends BasicConfigs {
	color: Color;
}

export interface ToastIndicatorProps extends BasicProps {
	icon: string;
}
export interface ToastIndicatorConfigs extends BasicConfigs {}
