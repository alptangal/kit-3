// src/lib/components/element/alert-dialog/_interface.ts
// AlertDialog — dialog DẠNG XÁC NHẬN (shadcn AlertDialog). Khác Modal:
// - Không layout tự do: chỉ Header (icon + title + description) + Footer (cancel + action).
// - Open là bindable (uncontrolled qua Trigger, hoặc controlled bằng code).
// - Focus trap GIỚI HẠN 2 nút (Action ↔ Cancel); Escape đóng; backdrop click KHÔNG đóng.
// - Default action: nút danger; Cancel: nút ghost.
import type { Snippet } from 'svelte';
import type { BasicProps, BasicConfigs, TimeUnits } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

export interface AlertDialogConfigs extends BasicConfigs {
	/** id nội bộ của Content (role="alertdialog"). */
	rootId: string;
	/** id cho aria-labelledby (Title). */
	titleId: string;
	/** id cho aria-describedby (Description). */
	descriptionId: string;
	/** state open (luôn đồng bộ với prop bindable của Root). */
	get open(): boolean;
	setOpen: (v: boolean) => void;
	/** Content gọi khi mount: ghi element active trước khi focus chuyển. */
	saveLastActive: (el: HTMLElement | null) => void;
	/** close() = setOpen(false) + trả focus về trigger (nếu có trigger uncontrolled). */
	close: () => void;
	/** fallback title (translate-resolved) khi user KHÔNG render `<AlertDialog.Title>`. */
	title?: string;
	/** fallback description (translate-resolved) khi user KHÔNG render `<AlertDialog.Description>`. */
	description?: string;
	/** duration (ms) cho transition mở/đóng. */
	duration: number;
	/** Action đã register (để focus lúc open + trap 2 nút). */
	action?: HTMLElement;
	/** Title đã render (để Content quyết định aria-labelledby). */
	hasTitle?: boolean;
	/** Description đã render (để Content quyết định aria-describedby). */
	hasDescription?: boolean;
}

export interface AlertDialogRootProps extends BasicProps {
	/** Passthrough `data-*` attributes (vd `data-test`) — spread lên element gốc. */
	'data-test'?: string;
	/** controlled open (bindable). Mặc định uncontrolled (mở bằng Trigger). */
	open?: boolean;
	/** Uncontrolled: mở ban đầu khi mount (seed cho `open`). */
	defaultOpen?: boolean;
	/** Fallback title — render nếu user không render `<AlertDialog.Title>`. */
	title?: TranslateContent | string;
	/** Fallback description — render nếu user không render `<AlertDialog.Description>`. */
	description?: TranslateContent | string;
	/** Duration transition (ms). Mặc định 200. */
	duration?: TimeUnits;
	children?: Snippet;
}

export interface AlertDialogTriggerProps extends BasicProps {
	/** tự tắt trigger (không mở dialog). */
	disabled?: boolean;
	onclick?: (e: MouseEvent) => void;
	children?: Snippet;
}

export interface AlertDialogContentProps extends BasicProps {
	children?: Snippet;
}

export interface AlertDialogHeaderProps extends BasicProps {
	/** icon trước title (snippet). Demo truyền icon warning/info. */
	leading?: Snippet;
	/** 'danger' (mặc định, icon màu danger) | 'info' (icon màu primary) | 'default'. */
	variant?: 'danger' | 'info' | 'default';
	children?: Snippet;
}

export interface AlertDialogTitleProps extends BasicProps {
	children?: Snippet;
}

export interface AlertDialogDescriptionProps extends BasicProps {
	children?: Snippet;
}

export interface AlertDialogFooterProps extends BasicProps {
	children?: Snippet;
}

/**
 * Màu nút Action. Mặc định 'danger' (nền đỏ — hành động nguy hiểm).
 * 'primary' cho variant thông tin; 'default' (nền default) cho trường hợp trung tính.
 */
export type AlertDialogActionColor = 'danger' | 'primary' | 'default';

export interface AlertDialogActionProps extends BasicProps {
	/** màu nút. Mặc định 'danger'. */
	color?: AlertDialogActionColor;
	/** gọi TRƯỚC khi close (confirm action — vd xóa dữ liệu). */
	onselect?: () => void;
	onclick?: (e: MouseEvent) => void;
	children?: Snippet;
}

export interface AlertDialogCancelProps extends BasicProps {
	/** Passthrough `data-*` attributes (vd `data-test`) — spread lên <button>. */
	'data-test'?: string;
	onclick?: (e: MouseEvent) => void;
	children?: Snippet;
}
