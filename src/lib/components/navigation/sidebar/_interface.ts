// src/lib/components/navigation/sidebar/_interface.ts
// Sidebar family (shadcn sidebar-07) — cấu trúc lại: Provider (context) +
// Sidebar (aside) + Inset (content) + Header/Content/Footer + Group + Menu* +
// Trigger + Separator. Chạy qua design token, không hardcode.
import type { Snippet } from 'svelte';
import type { BasicProps, BasicConfigs, Size } from '$components/interface';

export type SidebarCollapsible = 'none' | 'offcanvas' | 'icon';

/** Trạng thái Sidebar (do Provider quản lý, reactive) */
export interface SidebarState {
	/** Sidebar mở (mobile offcanvas / desktop offcanvas overlay) */
	open: boolean;
	/** Thu gọn về icon rail (chỉ khi collapsible="icon", desktop) */
	collapsed: boolean;
	/** Đang ở breakpoint mobile */
	isMobile: boolean;
}

export interface SidebarConfigs extends BasicConfigs {
	readonly open: boolean;
	readonly collapsed: boolean;
	readonly isMobile: boolean;
	readonly state: SidebarState;
	readonly collapsible: SidebarCollapsible;
	setOpen: (v: boolean) => void;
	setCollapsed: (v: boolean) => void;
	toggle: () => void;
	toggleMobile: () => void;
	/** true nếu đang ở chế độ offcanvas (mobile hoặc desktop offcanvas open) */
	readonly isOffcanvasActive: boolean;
	/** class root động (desktop vs mobile vs icon vs offcanvas) */
	readonly sidebarClass: string;
}

export interface SidebarProviderProps extends BasicProps {
	collapsible?: SidebarCollapsible;
	/** mở sẵn (mobile) */
	defaultOpen?: boolean;
	children: Snippet;
}

export interface SidebarProps extends BasicProps {
	/** aria-label cho <aside> (mặc định "Sidebar") */
	'aria-label'?: string;
	children?: Snippet;
}

export interface SidebarSectionProps extends BasicProps {
	children?: Snippet;
}

export interface SidebarGroupProps extends BasicProps {
	children?: Snippet;
}

export interface SidebarGroupLabelProps extends BasicProps {
	children?: Snippet;
}

export interface SidebarMenuProps extends BasicProps {
	children?: Snippet;
}

export interface SidebarMenuItemProps extends BasicProps {
	children?: Snippet;
}

export interface SidebarMenuButtonProps extends BasicProps {
	/** href (tạo <a> thay vì <button>) */
	href?: string;
	/** active hiện tại (aria-current) */
	active?: boolean;
	/** đổi kích thước icon khi group collapse */
	badge?: Snippet;
	leading?: Snippet;
	trailing?: Snippet;
	children?: Snippet;
}

export interface SidebarMenuBadgeProps extends BasicProps {
	children?: Snippet;
}

export interface SidebarTriggerProps extends BasicProps {
}
