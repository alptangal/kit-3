import type { Positions } from '$components/interface';
import { getContext, setContext, type Snippet } from 'svelte';

//-----------------------------BEGIN INTERFACE-----------------------------
//
export interface Provider {
	as?: keyof HTMLElementTagNameMap;
	children?: Snippet;
	/**delay in miliseconds */
	delay?: number | `${number}`;
	disableHoverableContent?: boolean;
	ui?: string | string[];
	position?: Positions;
	/** offset in pixels */
	offset?: number | `${number}`;
	portal?: HTMLElement | Body;
}
interface TooltipContext {
	delay?: number | `${number}`;
	disableHoverableContent?: boolean;
	isHover?: boolean;
	ref?: HTMLElement;
	space?: {
		top?: number;
		bottom?: number;
		left?: number;
		right?: number;
	};
	rect?: {
		top?: number;
		bottom?: number;
		left?: number;
		right?: number;
		width?: number;
		height?: number;
	};
	props?: {
		position?: Positions;
		offset?: number | `${number}`;
		portal?: HTMLElement | Body;
	};
	updateFinalPosition?: (input?: 'bottom' | 'top' | 'right' | 'left') => void;
	mousePosition?: {
		clientX?: number;
		clientY?: number;
	};
	placement?: 'bottom' | 'top' | 'right' | 'left';
	contentRef?: HTMLElement;
	updateContentRef?: (element: HTMLElement) => void;
}

//-----------------------------END INTERFACE-----------------------------

const TOOLTIP_CTX = Symbol('tooltip-provider');
export function setTooltipContext(ctx: TooltipContext) {
	setContext(TOOLTIP_CTX, ctx);
}

export function getTooltipContext(): TooltipContext {
	return getContext(TOOLTIP_CTX);
}

//--------------------------------BEGIN DEFAULT--------------

export const defaults: Provider = {
	ui: ['relative w-fit bg-red-500']
};
