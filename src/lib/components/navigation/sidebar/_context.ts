// src/lib/components/navigation/sidebar/_context.ts
// Tách SidebarConfigs ra file leaf (KHÔNG import Main/Provider .svelte) để tránh
// circular import khi sidebar item đọc context qua barrel '../sidebar' trong SSR.
// Mirror pattern select/_context.ts + radiogroup/_context.ts.
import { getContext, setContext } from 'svelte';
import type { SidebarConfigs } from './_interface';

const NAME = Symbol('sidebar-context');

export function setSidebarContext(context: SidebarConfigs) {
	setContext(NAME, context);
}

export function getSidebarContext(): SidebarConfigs | undefined {
	return getContext(NAME);
}
