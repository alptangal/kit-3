// src/lib/components/element/context-menu/_interface.ts
// ContextMenu — menu context (shadcn context-menu). Root bọc "target" (vùng bị
// right-click) + giữ state open/pos/target + Symbol context. Content (role=menu)
// render fixed tại vị trí chuột (offset, default) hoặc theo cạnh target (top/
// bottom), clamp viewport. Item chọn qua onselect (callback, không navigate).
import type { Snippet } from 'svelte';
import type { BasicProps, BasicConfigs } from '$components/interface';

export type ContextMenuSide = 'offset' | 'top' | 'bottom';

export interface ContextMenuConfigs extends BasicConfigs {
	readonly rootId: string;
	readonly open: boolean;
	readonly contentId: string;
	readonly pos: { x: number; y: number };
	readonly target: HTMLElement | undefined;
	/** `restoreFocus` (mặc định true): trả focus về target — Escape/chọn item; false cho outside-click. */
	close: (restoreFocus?: boolean) => void;
}

export interface ContextMenuRootProps extends BasicProps {
	/**
	 * controlled open (bindable). Lưu ý: Root luôn tự mở khi right-click trên
	 * target (mặc định uncontrolled) — khi bind, Root đồng bộ `open = true`
	 * (pos luôn theo chuột); việc đóng chủ động (state = false) được tôn trọng.
	 */
	open?: boolean;
	/** aria-label cho menu (đọc bởi screen reader) */
	'aria-label'?: string;
	children?: Snippet;
}

export interface ContextMenuContentProps extends BasicProps {
	/**
	 * `offset` (default): menu tại đúng điểm chuột (top-left = điểm chuột + 4px).
	 * `top`: bên TRÊN target element (align start — cho element nhỏ như icon).
	 * `bottom`: bên DƯỚI target element (align start).
	 */
	side?: ContextMenuSide;
	/** khoảng cách (px) cho chế độ top/bottom */
	sideOffset?: number;
	/** aria-label riêng cho vùng menu */
	'aria-label'?: string;
	children?: Snippet;
}

export interface ContextMenuItemProps extends BasicProps {
	disabled?: boolean;
	/** style phá hủy (màu danger) */
	destructive?: boolean;
	/** icon (iconify) bên trái label (vd "lucide:copy") */
	icon?: string;
	/** sự kiện chọn (callback — item tự gọi + đóng menu) */
	onselect?: () => void;
	onclick?: (e: MouseEvent) => void;
	children?: Snippet;
}

export interface ContextMenuLabelProps extends BasicProps {
	/** kiểu nhỏ (subtitle) */
	variant?: 'default' | 'sub';
	children?: Snippet;
}

export interface ContextMenuSeparatorProps extends BasicProps {}
