// Size không được export từ $interfaces/basic — lấy từ $components/interface
import type { Size } from '$components/interface';
import type { Color, TooltipAnimation, TooltipVariant } from './_interface';
import { getContext, setContext } from 'svelte';

export interface ContentMeta {
	size?: Size;
	ref?: HTMLElement;
	position?: 'top' | 'bottom' | 'left' | 'right';
	offset?: number;
}
export interface ArrowMeta {
	size?: Size;
	ref?: HTMLElement;
}
interface TooltipContext {
	size?: Size;
	ref?: HTMLElement | null | Element;
	status?: {
		hover?: boolean;
		mousePosition?: {
			x: number;
			y: number;
		};
		/** Điểm "neo" (mouse lúc bắt đầu hover) — content & arrow CÙNG bám điểm này
		   để không lệch nhau (arrow không chạy theo chuột, content đứng yên).
		   follow=true: điểm này CẬP NHẬT theo mousemove (rAF throttle). */
		anchor?: { x: number; y: number };
	};
	rounded?: Size | 'full' | 'none';
	color?: Color;
	variant?: TooltipVariant;
	delay?: number;
	offset?: number;
	/** Anchor bám theo mousemove (rAF) — arrow + content re-position theo chuột. */
	follow?: boolean;
	/** Transition mượt khi tooltip đổi trạng thái ('fade' | 'scale' | 'slide'). */
	animate?: TooltipAnimation;
	contentMeta?: ContentMeta;
	updateContentMeta?: (meta: ContentMeta) => void;
	arrowMeta?: ArrowMeta;
	updateArrowMeta?: (meta: ArrowMeta) => void;
	/** Tăng mỗi lần content reposition (resize/mutation) → arrow re-sync theo. */
	contentVersion?: number;
	/** Content gọi sau khi reposition xong để arrow bám lại. */
	bumpContentVersion?: () => void;
}
const TooltipCtx = Symbol('tooltip-ctx');
export function setToolTipCtx(ctx: TooltipContext) {
	setContext(TooltipCtx, ctx);
}
export function getTooltipCtx(): TooltipContext | undefined {
	return getContext(TooltipCtx);
}
