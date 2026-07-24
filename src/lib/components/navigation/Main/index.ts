import { getContext, setContext } from "svelte"

type Position='center' | 'left' | 'right'
interface MainContext{
  childrens?: Map<Position, { ref?: HTMLElement }>;
  addNode?:(dataNode:{position:Position,ref?:HTMLElement})=>void|(Map<'center' | 'left' | 'right', { ref?: HTMLElement }>)|Promise<Map<'center' | 'left' | 'right', { ref?: HTMLElement }>>
}
const NAV_MAIN_CTX=Symbol('nav-main-ctx')
export function setNavigationMainCtx(context:MainContext) {
  setContext(NAV_MAIN_CTX, context)
}
export function getNavigationMainCtx():MainContext {
  return getContext(NAV_MAIN_CTX)
}
