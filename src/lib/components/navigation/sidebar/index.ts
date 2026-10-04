// src/lib/components/navigation/sidebar/index.ts
// Sidebar family — Provider giữ state + context; Sidebar = aside; Inset = main.
// Object.assign để user dùng `<Sidebar.Header />` (mirror Tooltip/NavigationMenu).
// Import root thành `SidebarRoot` (KHÔNG đặt tên 'Sidebar') để tránh conflict
// với `export const Sidebar` (merged declaration).
import SidebarRoot from './Sidebar.svelte';
import SidebarProvider from './Provider.svelte';
import SidebarInset from './SidebarInset.svelte';
import SidebarHeader from './SidebarHeader.svelte';
import SidebarContent from './SidebarContent.svelte';
import SidebarFooter from './SidebarFooter.svelte';
import SidebarGroup from './SidebarGroup.svelte';
import SidebarGroupLabel from './SidebarGroupLabel.svelte';
import SidebarMenu from './SidebarMenu.svelte';
import SidebarMenuItem from './SidebarMenuItem.svelte';
import SidebarMenuButton from './SidebarMenuButton.svelte';
import SidebarMenuBadge from './SidebarMenuBadge.svelte';
import SidebarTrigger from './SidebarTrigger.svelte';
import SidebarRail from './SidebarRail.svelte';

export const Sidebar = Object.assign(SidebarRoot, {
	Provider: SidebarProvider,
	Inset: SidebarInset,
	Header: SidebarHeader,
	Content: SidebarContent,
	Footer: SidebarFooter,
	Group: SidebarGroup,
	GroupLabel: SidebarGroupLabel,
	Menu: SidebarMenu,
	MenuItem: SidebarMenuItem,
	MenuButton: SidebarMenuButton,
	MenuBadge: SidebarMenuBadge,
	Trigger: SidebarTrigger,
	Rail: SidebarRail
});

export { SidebarProvider, SidebarMenuButton, SidebarTrigger, SidebarRail };

export { getSidebarContext, setSidebarContext } from './_context';
export type {
	SidebarProps,
	SidebarProviderProps,
	SidebarConfigs,
	SidebarState,
	SidebarCollapsible,
	SidebarSectionProps,
	SidebarGroupProps,
	SidebarGroupLabelProps,
	SidebarMenuProps,
	SidebarMenuItemProps,
	SidebarMenuButtonProps,
	SidebarMenuBadgeProps,
	SidebarTriggerProps,
	SidebarRailProps
} from './_interface';
