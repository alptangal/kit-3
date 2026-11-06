// src/lib/components/navigation/sidebar/_interface.ts
// Sidebar family (shadcn sidebar-07) — cấu trúc lại: Provider (context) +
// Sidebar (aside) + Inset (content) + Header/Content/Footer + Group + Menu* +
// Trigger + Separator. Chạy qua design token, không hardcode.
//
// P2 hoàn thiện:
//  - resize width bằng chuột (handle mép phải) → persist localStorage
//  - MenuGroup đệ quy (snippet lồng, không giới hạn cấp)
//  - Search menu item (Input sẵn có, filter + auto-expand)
//  - icon / description cho menu item (leading icon + Tooltip)
import type { Snippet } from 'svelte';
import type { BasicProps, BasicConfigs, Size } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

export type SidebarCollapsible = 'none' | 'offcanvas' | 'icon';

/**
 * P3: chế độ animation label menu khi trở về expanded (streaming text).
 *  - 'auto' (mặc định): PC tự bật (đồng thời tôn trọng prefers-reduced-motion),
 *    mobile tự tắt (tối ưu hiệu năng).
 *  - 'on': PC bật (bỏ qua reduced-motion).
 *  - 'off': không bao giờ chạy.
 */
export type SidebarAnimationMode = 'on' | 'off' | 'auto';

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
	/** rail click: mobile → mở; desktop icon → toggle collapse; offcanvas → toggle */
	railToggle: () => void;
	/** true nếu đang ở chế độ offcanvas (mobile hoặc desktop offcanvas open) */
	readonly isOffcanvasActive: boolean;
	/** true nếu sidebar đang ẨN trên desktop (rail hiển thị — hover peek là CSS :hover) */
	readonly peekActive: boolean;
	/** class root động (desktop vs mobile vs icon vs offcanvas vs peek) */
	readonly sidebarClass: string;
	/** class rail (visible khi sidebar ẩn, desktop) */
	readonly railClass: string;

	// ── P2: resize width (desktop, mouse-drag handle) ──
	/** bật handle resize (từ prop `resizable`, mặc định true). */
	readonly resizable: boolean;
	/** độ rộng hiện tại (px). Khung: 200–480. Immutable mặc định = var --sidebar-width. */
	readonly width: number;
	/** đang kéo resize (true → tắt transition width) */
	readonly resizing: boolean;
	setWidth: (px: number) => void;
	/** bắt đầu kéo (đặt 'user-resizing' để CSS tắt transition + capture startX) */
	startResize: (clientX: number) => void;
	/** kéo: cập nhật width theo deltaX */
	applyResize: (clientX: number) => void;
	/** dừng kéo (persist + bật lại transition) */
	endResize: () => void;

	// ── P2: search menu item ──
	/** từ khóa tìm kiếm (đọc từ Sidebar.Search, filter menu items + auto-expand) */
	readonly searchQuery: string;
	setSearchQuery: (q: string) => void;

	// ── P3: hoàn thiện rail + streaming label + highlight search ──
	/**
	 * P3: logo (nội dung Header) đang ẨN không — prop `hideLogoWhenCollapsed`
	 * (mặc định true) + collapsed + desktop. aside nhận class `sidebar-logo-hidden`;
	 * demo CSS ẩn `.brand` (chỉ còn trigger ở hàng logo → menu Y-align chuẩn rail).
	 */
	readonly hideLogoWhenCollapsed: boolean;
	/** P3: animation label đang BẬT (PC + chế độ prop; mobile luôn off) */
	readonly labelAnimation: boolean;
	/** P3: đang ở KHẮC animation label (user vừa expand từ rail → chạy 1 lần) */
	readonly labelAnimActive: boolean;
}

export interface SidebarProviderProps extends BasicProps {
	collapsible?: SidebarCollapsible;
	/** mở sẵn (mobile) */
	defaultOpen?: boolean;
	/** độ rộng mặc định (px) khi chưa có giá trị localStorage (khung 200–480) */
	defaultWidth?: number;
	/** key localStorage để persist độ rộng (mặc định 'sidebar-width') */
	storageKey?: string;
	/** bật handle resize (desktop). Mặc định true. */
	resizable?: boolean;
	/**
	 * P3: ẩn LOGO (nội dung Header) khi collapsed (icon rail, desktop)?
	 * Mặc định true: hideLogoWhenCollapsed=true + collapsed + !isMobile → aside
	 * nhận class 'sidebar-logo-hidden' → demo CSS ẩn `.brand` (chỉ còn trigger
	 * ở hàng logo → menu Y-align chuẩn rail, không lệch bởi item rỗng).
	 * false: luôn giữ logo khi collapsed.
	 */
	hideLogoWhenCollapsed?: boolean;
	/** P3: animation label menu khi trở về expanded (mặc định 'auto'). */
	animation?: SidebarAnimationMode;
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
	/** id để search auto-expand (nếu không có, dùng label) */
	id?: string;
	children?: Snippet;
}

export interface SidebarGroupLabelProps extends BasicProps {
	children?: Snippet;
}

export interface SidebarMenuProps extends BasicProps {
	children?: Snippet;
}

export interface SidebarMenuItemProps extends BasicProps {
	/** data-match: nhãn thuần chữ (label + description) để search filter + highlight */
	'match'?: string;
	children?: Snippet;
}

export interface SidebarMenuButtonProps extends BasicProps {
	/** href (tạo <a> thay vì <button>) */
	href?: string;
	/** active hiện tại (aria-current) */
	active?: boolean;
	/**
	 * P3: label menu (i18n hoặc string). Nền cho highlight search
	 * (matchSegments → <mark>). Nếu không có, fallback slot children.
	 */
	label?: string | TranslateContent;
	/** icon (iconify) trước label (thay slot leading đơn giản). Priority: leading > icon. */
	icon?: string;
	/** mô tả item — hiển thị trong Tooltip khi hover (chỉ desktop, width đủ) */
	description?: string | TranslateContent;
	/** đổi kích thước icon khi group collapse */
	badge?: Snippet;
	leading?: Snippet;
	trailing?: Snippet;
	children?: Snippet;
	/** click handler (forward qua restAttrs — dùng cho item không có href, vd logout) */
	onclick?: (event: MouseEvent) => void;
}

export interface SidebarMenuBadgeProps extends BasicProps {
	children?: Snippet;
}

export interface SidebarTriggerProps extends BasicProps {}

export interface SidebarRailProps extends BasicProps {
	/** aria-label (mặc định "Toggle sidebar") */
	'aria-label'?: string;
	onclick?: (e: MouseEvent) => void;
}

/** P2: handle kéo thay đổi độ rộng (dán mép phải aside, desktop only). */
export interface SidebarResizeHandleProps extends BasicProps {
	/** aria-label (mặc định "Resize sidebar") */
	'aria-label'?: string;
}

/** P2: ô tìm kiếm menu item (dùng Input sẵn có). Render trong Sidebar.Header/Content. */
export interface SidebarSearchProps extends BasicProps {
	/** placeholder (i18n hoặc string, mặc định "Tìm kiếm menu…") — cũng là accessible name */
	placeholder?: TranslateContent | string;
}

/**
 * P2: MenuGroup đệ quy — nút cha + submenu (lồng không giới hạn cấp).
 * Nút cha có chevron; bấm/Enter → toggle open; submenu là <ul> thu vào (inset).
 * Khi sidebar collapsed (icon rail): MenuGroup luôn đóng, chevron ẩn, con item
 * hiện bằng cách "peek" (hover) hoặc mở group.
 */
export interface SidebarMenuGroupProps extends BasicProps {
	/** id (dùng cho search auto-expand). Mặc định sinh tự động. */
	id?: string;
	/** aria-label (SR) — nếu không có, dùng label từ nút cha */
	'aria-label'?: string;
	/** label nút cha (i18n hoặc string) */
	label: string | TranslateContent;
	/** icon (iconify) trước label — render qua Icon, fallback Svg inline */
	icon?: string;
	/** badge / chỉ báo phía sau label */
	badge?: Snippet;
	/** mở sẵn submenu */
	defaultOpen?: boolean;
	/** submenu (con Menu.Item / MenuGroup lồng nhau) */
	children: Snippet;
}
