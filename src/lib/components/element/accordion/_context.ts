// src/lib/components/element/accordion/_context.ts
// Accordion — Symbol context (leaf, KHÔNG import .svelte → tránh circular SSR).
// 2 layer: ROOT (Root.setContext — type/collapsible/isOpen/toggle/duration)
// + ITEM (Item.setContext — value, để Trigger/Content bên trong Item dùng id).
import { setContext, getContext } from 'svelte';
import type { AccordionConfigs } from './_interface';

export interface AccordionItemConfigs {
	/** id item (item parent) — Trigger/Content liên kết aria-controls/labelledby */
	value: string;
}

const ROOT_NAME = Symbol('accordion-context');
const ITEM_NAME = Symbol('accordion-item-context');

export function setAccordionContext(configs: AccordionConfigs) {
	setContext(ROOT_NAME, configs);
}

export function getAccordionContext(): AccordionConfigs | undefined {
	return getContext(ROOT_NAME);
}

export function setAccordionItemContext(configs: AccordionItemConfigs) {
	setContext(ITEM_NAME, configs);
}

export function getAccordionItemContext(): AccordionItemConfigs | undefined {
	return getContext(ITEM_NAME);
}
