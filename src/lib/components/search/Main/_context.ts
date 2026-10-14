import type { BasicConfigs, MetaChildren } from '$components/interface';
import { getContext, setContext } from 'svelte';
// InputProps hiện đại không có onBlur/onKeyup… — signature lấy từ input_old
// (handler nhận value?: number | string).
interface SearchMainContext extends BasicConfigs {
	onBlur?: (value?: number | string) => void;
	onChange?: (value?: number | string) => void;
	onFocus?: (value?: number | string) => void;
	onEnter?: (value?: number | string) => void;
	onKeydown?: (value?: number | string) => void;
	onKeyup?: (value?: number | string) => void;
	onClear?: (value?: number | string) => void;
	insertNode?: (data: MetaChildren) => void;
	disabled?: boolean;
}
const CONTEXT = Symbol('search-main-context');
export function setSearchMainContext(ctx: SearchMainContext) {
	setContext(CONTEXT, ctx);
}
export function getSearchMainContext(): SearchMainContext | undefined {
	return getContext(CONTEXT);
}
