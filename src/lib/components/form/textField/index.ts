import { getContext, setContext } from 'svelte';
import type { TextFieldConfigs } from './_interface';

const NAME = Symbol('textfield-context');
export function setTextFieldContext(context: TextFieldConfigs) {
	setContext(NAME, context);
}
export function getTextFieldContext(): TextFieldConfigs | undefined {
	return getContext(NAME);
}
