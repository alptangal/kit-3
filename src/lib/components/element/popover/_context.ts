// src/lib/components/element/popover/_context.ts
// Tách PopoverConfigs ra file leaf (KHÔNG import Root .svelte) để tránh circular
// import khi sub-component đọc context qua barrel (SSR). Mirror dropdown-menu/_context.ts.
import { getContext, setContext } from 'svelte';
import type { PopoverConfigs } from './_interface';

const NAME = Symbol('popover-context');

export function setPopoverContext(context: PopoverConfigs) {
	setContext(NAME, context);
}

export function getPopoverContext(): PopoverConfigs | undefined {
	return getContext(NAME);
}
