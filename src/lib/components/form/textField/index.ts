import { getContext, setContext } from 'svelte';
import type { TextField } from './_interface';
import type { EventListener } from '$components/interface';

export type MetaNode = {
	name?: string;
	ref?: HTMLElement;
	isValid?: () => void;
	reset?: () => void;
	loading?: boolean;
	focus?: () => void;
};
interface TextFieldContext extends TextField {
	ref?: HTMLElement;
	status?: {
		focus?: boolean;
		hover?: boolean;
	};
	onBlur?: (value: boolean) => void;
	onFocus?: (
		/**Unique ID */
		id: string,
		fallback: () => void
	) => void;
	insertErrorMessage?: (messageObj: { eventName: keyof EventListener; message?: string }) => void;
	updateValue?: (value?: number | string) => void;
	insertMetaNode?: (data: MetaNode) => void;
}

const TEXT_FIELD = Symbol('textfield-context');
export function setTextfieldCtx(ctx: TextFieldContext) {
	setContext(TEXT_FIELD, ctx);
}
export function getTextfieldCtx(): TextFieldContext|undefined {
	return getContext(TEXT_FIELD);
}
