import type { BasicConfigs } from "$components/interface"
import { getContext, setContext } from "svelte"

const CONTEXT=Symbol('container-ctx')
export function setContainerContext(ctx:BasicConfigs) {
  setContext(CONTEXT, ctx)
}
export function getContainerContext(): BasicConfigs|undefined{
  return getContext(CONTEXT)
}
