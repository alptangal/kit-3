import NavigationMainRoot from '$components/navigation/Main/Root/Main.svelte'
import NavigationMainLeft from '$components/navigation/Main/Left/Main.svelte'
import NavigationMainCenter from '$components/navigation/Main/Center/Main.svelte'
import NavigationMainRight from '$components/navigation/Main/Right/Main.svelte'
export const NavigationMenu = Object.assign(NavigationMainRoot, {
  left: NavigationMainLeft,
  center: NavigationMainCenter,
  right:NavigationMainRight
})

export { default as Breadcrumb } from './breadcrumb/Main.svelte'
export type { BreadcrumbProps, BreadcrumbConfigs, BreadcrumbItem } from './breadcrumb/_interface'

export { Sidebar, getSidebarContext, setSidebarContext } from './sidebar'
export type {
  SidebarProps,
  SidebarProviderProps,
  SidebarConfigs,
  SidebarState,
  SidebarCollapsible
} from './sidebar'

export { default as TeamSwitcher } from './team-switcher/TeamSwitcher.svelte'
export type { TeamSwitcherProps, TeamSwitcherTeam } from './team-switcher/_interface'
