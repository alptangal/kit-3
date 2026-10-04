// src/lib/components/element/dropdown-menu/_context.ts
// Tách DropdownMenuConfigs ra file leaf (KHÔNG import Root .svelte) để tránh circular
// import khi sub-component đọc context qua barrel (SSR). Mirror sidebar/_context.ts.
import { getContext, setContext } from 'svelte';
import type { DropdownMenuConfigs } from './_interface';

const NAME = Symbol('dropdown-menu-context');

export function setDropdownMenuContext(context: DropdownMenuConfigs) {
	setContext(NAME, context);
}

export function getDropdownMenuContext(): DropdownMenuConfigs | undefined {
	return getContext(NAME);
}
