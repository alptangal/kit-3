import { getContext, setContext } from 'svelte';
import type { FormConfigs } from './_interface';

const NAME = Symbol('form-context');
export function getFormContext(): FormConfigs | undefined {
	return getContext(NAME);
}
export function setFormContext(context: FormConfigs) {
	setContext(NAME, context);
}
