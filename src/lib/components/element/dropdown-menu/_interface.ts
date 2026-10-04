// src/lib/components/element/dropdown-menu/_interface.ts
// DropdownMenu — menu dropdown (shadcn dropdown-menu). Root giữ state open + Symbol
// context; Trigger toggle; Content (role=menu) positioned dưới trigger, tự đóng khi
// click ra ngoài / Escape / Tab, roving focus theo phím.
import type { Snippet } from 'svelte';
import type { BasicProps, BasicConfigs } from '$components/interface';

export type DropdownMenuAlign = 'start' | 'center' | 'end';

export interface DropdownMenuConfigs extends BasicConfigs {
	readonly open: boolean;
	/** id nội bộ của Content (liên kết aria-controls / aria-activedescendant) */
	readonly contentId: string;
	setOpen: (v: boolean) => void;
	toggle: () => void;
	close: () => void;
}

export interface DropdownMenuRootProps extends BasicProps {
	/** controlled open (bindable). Mặc định uncontrolled. */
	open?: boolean;
	/** aria-label cho nhóm menu (hiện lên SR) */
	'aria-label'?: string;
	children?: Snippet;
}

export interface DropdownMenuTriggerProps extends BasicProps {
	disabled?: boolean;
	onclick?: (e: MouseEvent) => void;
	children?: Snippet;
}

export interface DropdownMenuContentProps extends BasicProps {
	/** căn lề tương đối trigger: start (trái, mặc định) / center / end (phải) */
	align?: DropdownMenuAlign;
	/** khoảng cách từ trigger (px) */
	sideOffset?: number;
	children?: Snippet;
}

export interface DropdownMenuItemProps extends BasicProps {
	disabled?: boolean;
	/** lùi vào (đính kèm sub / grouped item) */
	inset?: boolean;
	variant?: 'default' | 'destructive';
	/** sự kiện chọn (item tự gọi + đóng menu) */
	onselect?: (e: Event) => void;
	onclick?: (e: MouseEvent) => void;
	/** icon / chỉ báo trước label */
	leading?: Snippet;
	/** phím tắt / chỉ báo phía sau label (vd "⌘K", dấu check) */
	trailing?: Snippet;
	children?: Snippet;
}

export interface DropdownMenuLabelProps extends BasicProps {
	/** kiểu nhỏ (subtitle trong item) */
	variant?: 'default' | 'sub';
	children?: Snippet;
}

export interface DropdownMenuSeparatorProps extends BasicProps {}
