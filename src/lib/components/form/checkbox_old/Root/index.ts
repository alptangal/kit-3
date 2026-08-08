import { getContext, setContext } from 'svelte';
import type { Checkbox } from './_interface';

interface CheckboxCtx extends Checkbox {
	status?: {
		hover?: boolean;
		valid?: boolean;
	};
}
const CHECKBOX_CTX = Symbol('checkbox');
export function setCheckboxCtx(ctx: CheckboxCtx) {
	setContext(CHECKBOX_CTX, ctx);
}
export function getCheckboxCtx(): CheckboxCtx {
	return getContext(CHECKBOX_CTX);
}
