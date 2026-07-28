import type { Size } from '$interfaces/basic';
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
	};
	rounded?: Size | 'full' | 'none';
	delay?: number;
	offset?: number;
	contentMeta?: ContentMeta;
	updateContentMeta?: (meta: ContentMeta) => void;
	arrowMeta?: ArrowMeta;
	updateArrowMeta?: (meta: ArrowMeta) => void;
}
const TooltipCtx = Symbol('tooltip-ctx');
export function setToolTipCtx(ctx: TooltipContext) {
	setContext(TooltipCtx, ctx);
}
export function getTooltipCtx(): TooltipContext | undefined {
	return getContext(TooltipCtx);
}
