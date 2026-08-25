import { getContext, setContext } from 'svelte';
import type { ToastWrapperConfigs } from '../_interface';

const key = Symbol('toast-wrapper-context');
export function setToastWrapperContext(context: ToastWrapperConfigs) {
	setContext(key, context);
}
export function getToastWrapperContext(): ToastWrapperConfigs | undefined {
	return getContext(key);
}
