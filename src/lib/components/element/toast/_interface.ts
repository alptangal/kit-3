import type { BasicConfigs, BasicProps, Color, Size, TimeUnits } from '$components/interface';

type Position = 'top' | 'bottom' | 'left' | 'right';
export interface ToastWrapperProps extends BasicProps {
	disabled?: boolean;
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
