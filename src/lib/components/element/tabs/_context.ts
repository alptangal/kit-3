// src/lib/components/element/tabs/_context.ts
// Tách TabsConfigs ra file leaf (KHÔNG import .svelte) để tránh circular import
// khi sub-component đọc context qua barrel (SSR). Mirror dropdown-menu/_context.ts.
import { getContext, setContext } from 'svelte';
import type { TabsConfigs } from './_interface';

const NAME = Symbol('tabs-context');

export function setTabsContext(context: TabsConfigs) {
	setContext(NAME, context);
}

export function getTabsContext(): TabsConfigs | undefined {
	return getContext(NAME);
}
