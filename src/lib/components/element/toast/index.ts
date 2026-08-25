import { getContext, setContext } from 'svelte';
import type { ToastConfigs } from './_interface';

const key = Symbol('toast-context');
export function setToastContext(context: ToastConfigs) {
	setContext(key, context);
}
export function getToastContext(): ToastConfigs | undefined {
	return getContext(key);
}
