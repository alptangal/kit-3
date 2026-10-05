// src/lib/components/element/alert-dialog/_context.ts
// Tách AlertDialogConfigs ra file leaf (KHÔNG import .svelte) để tránh circular
// import khi sub-component đọc context (SSR). Mirror dropdown-menu/_context.ts.
import { getContext, setContext } from 'svelte';
import type { AlertDialogConfigs } from './_interface';

const NAME = Symbol('alert-dialog-context');

export function setAlertDialogContext(context: AlertDialogConfigs) {
	setContext(NAME, context);
}

export function getAlertDialogContext(): AlertDialogConfigs | undefined {
	return getContext(NAME);
}
