import { getContext, setContext } from 'svelte';
import type { Form } from './_interface';

const FORM_CONTEXT = Symbol('form-context');
export function setFormContext(ctx: Form) {
	setContext(FORM_CONTEXT, ctx);
}
export function getFormContext(): Form {
	return getContext(FORM_CONTEXT);
}
