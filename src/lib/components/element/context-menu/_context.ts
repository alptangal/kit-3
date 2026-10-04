// src/lib/components/element/context-menu/_context.ts
// Tách ContextMenuConfigs ra file leaf (KHÔNG import Root .svelte) để tránh
// circular import khi sub-component đọc context qua barrel (SSR).
// Mirror dropdown-menu/_context.ts.
import { getContext, setContext } from 'svelte';
import type { ContextMenuConfigs } from './_interface';

const NAME = Symbol('context-menu-context');

export function setContextMenuContext(context: ContextMenuConfigs) {
	setContext(NAME, context);
}

export function getContextMenuContext(): ContextMenuConfigs | undefined {
	return getContext(NAME);
}
