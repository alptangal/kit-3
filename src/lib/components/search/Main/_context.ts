
import type { BasicConfigs, MetaChildren } from '$components/interface';
import { getContext, setContext } from 'svelte';
import type { InputProps } from '$components/form/input/_interface';

interface SearchMainContext extends BasicConfigs, Pick<InputProps, 'onBlur' | 'onChange' | 'onFocus' | 'onEnter' | 'onKeydown' | 'onKeyup'|"onClear">{
  insertNode?: (data: MetaChildren) => void;
  disabled?:boolean
}
const CONTEXT = Symbol('search-main-context');
export function setSearchMainContext(ctx:SearchMainContext) {
  setContext(CONTEXT, ctx)
}
export function getSearchMainContext():SearchMainContext|undefined {
  return getContext(CONTEXT)
}
