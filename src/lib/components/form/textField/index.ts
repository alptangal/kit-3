import { getContext, setContext } from 'svelte';
import type { TextField } from './_interface';
interface TextFieldContext extends TextField {
	ref?: HTMLElement;
	status?: {
		focus?: boolean;
	};
	onBlur?: (value: boolean) => void;
	onFocus?: (
		/**Unique ID */
		id: string,
		fallback: () => void
	) => void;
}

const TEXT_FIELD = Symbol('textfield-context');
export function setTextfieldCtx(ctx: TextFieldContext) {
	setContext(TEXT_FIELD, ctx);
}
export function getTextfieldCtx(): TextFieldContext {
	return getContext(TEXT_FIELD);
}
