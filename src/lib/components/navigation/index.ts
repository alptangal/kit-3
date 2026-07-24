import NavigationMainRoot from '$components/navigation/Main/Root/Main.svelte'
import NavigationMainLeft from '$components/navigation/Main/Left/Main.svelte'
import NavigationMainCenter from '$components/navigation/Main/Center/Main.svelte'
import NavigationMainRight from '$components/navigation/Main/Right/Main.svelte'
export const NavigationMenu = Object.assign(NavigationMainRoot, {
  left: NavigationMainLeft,
  center: NavigationMainCenter,
  right:NavigationMainRight
})
