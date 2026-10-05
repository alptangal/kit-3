// src/lib/components/element/hover-card/_context.ts
// Tách HoverCardConfigs ra file leaf (KHÔNG import Root .svelte) để tránh circular
// import khi sub-component đọc context qua barrel (SSR). Mirror popover/_context.ts.
import { getContext, setContext } from 'svelte';
import type { HoverCardConfigs } from './_interface';

const NAME = Symbol('hover-card-context');

export function setHoverCardContext(context: HoverCardConfigs) {
	setContext(NAME, context);
}

export function getHoverCardContext(): HoverCardConfigs | undefined {
	return getContext(NAME);
}
