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
	// Hover-expand group: Toast item gọi qua context khi mouseenter/mouseleave trên
	// toast. Wrapper quản delay collapse (150ms) chống flicker khi chuột đi qua khoảng
	// trống giữa các toast đang expand. releaseGroupHover gọi khi toast bị xóa khi đang
	// hover (mouseleave không kịp bắn) — chống group kẹt expanded.
	setGroupHover?: (hovering: boolean, id?: string) => void;
	releaseGroupHover?: (id?: string) => void;
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
		// Hover-expand group: true khi CẢ group đang expand (mouseenter trên vùng toast).
		groupHover?: boolean;
	};
	id?: string;
	// Thời điểm toast load (performance.now()) — auto-dismiss timer dùng elapsed-based
	// để PAUSE khi hover (timer chỉ cộng dồn khi không hover).
	startAt?: number;
	// Tổng thời gian đã trôi (không tính thời gian hover) — dùng với startAt.
	elapsed?: number;
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
