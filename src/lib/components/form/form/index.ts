import { getContext, setContext } from 'svelte';
import type { Form } from './_interface';
import type { MetaNode } from '../textField';
export interface TextfieldToForm extends MetaNode {
	name: string;
}
interface FormContext extends Form {
	insertMetaNode?: (childrenNode: TextfieldToForm) => void;
	valid?: boolean;
}

const FORM_CONTEXT = Symbol('form-context');
export function setFormContext(ctx: FormContext) {
	setContext(FORM_CONTEXT, ctx);
}
export function getFormContext(): FormContext {
	return getContext(FORM_CONTEXT);
}
