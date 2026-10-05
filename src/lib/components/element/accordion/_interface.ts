// src/lib/components/element/accordion/_interface.ts
// Accordion — composite (shadcn accordion). Root giữ value (bindable, loose
// typing: single → string, multiple → string[]) + Symbol context; Item giữ
// value (truyền cho Trigger/Content qua item-context); Trigger = button
// aria-expanded/aria-controls (chevron rotate); Content = role=region +
// animation fly/fade.
import type { Snippet } from 'svelte';
import type { BasicProps, TimeUnits } from '$components/interface';

export type AccordionType = 'single' | 'multiple';

export interface AccordionConfigs {
	/** id instance (gắn aria-controls / aria-labelledby) */
	rootId: string;
	/** 'single': 1 item mở · 'multiple': nhiều item mở */
	type: AccordionType;
	/** single: item đang mở có toggle được đóng không (default true) */
	collapsible: boolean | undefined;
	/** duration ms (prefers-reduced-motion → 0) */
	duration: number;
	/** item id có đang mở không (Root normalize value theo type) */
	isOpen: (id: string) => boolean;
	/** toggle item (Trigger click gọi; logic single/multiple + collapsible) */
	toggle: (id: string) => void;
}

export interface AccordionRootProps extends BasicProps {
	/**
	 * Giá trị đang mở (BINDABLE — controlled). Loose typing theo type:
	 * 'single' → string (undefined = không item nào mở); 'multiple' → string[].
	 */
	value?: string | string[];
	/** giá trị ban đầu (khi không bind value) — single: id · multiple: id[] */
	defaultValue?: string | string[];
	/** 'single' (default) · 'multiple' */
	type?: AccordionType;
	/** single: item đang mở click lại có đóng không (default true) */
	collapsible?: boolean;
	/** duration transition open/close (TimeUnits) */
	duration?: TimeUnits;
	children?: Snippet;
}

export interface AccordionItemProps extends BasicProps {
	/** id item (Trigger/Content bên trong Item dùng cùng id) */
	value: string;
}

export interface AccordionHeaderProps extends BasicProps {}

export interface AccordionTriggerProps extends BasicProps {
	/** icon (iconify name, vd 'lucide:help-circle') hiển thị trước label */
	icon?: string;
	onclick?: (e: MouseEvent) => void;
}

export interface AccordionContentProps extends BasicProps {}
