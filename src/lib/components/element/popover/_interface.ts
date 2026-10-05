// src/lib/components/element/popover/_interface.ts
// Popover — floating panel (shadcn popover). Root giữ state `open` (bindable) +
// Symbol context + outside-click/Escape/Tab. Trigger (span) bọc slot (user tự
// render button/link) xử lý intent theo mode: click (toggle) / hover (delay
// show/hide) / focus (focusin/focusout). Content (role=dialog) positioned dưới
// trigger, căn theo position (start/end/center) + arrow + appear animation.
import type { Snippet } from 'svelte';
import type { BasicProps, BasicConfigs } from '$components/interface';

export type PopoverPosition = 'start' | 'end' | 'center';
export type PopoverTriggerMode = 'click' | 'hover' | 'focus';

export interface PopoverConfigs extends BasicConfigs {
	/** id nội bộ của Root (gắn lên element root) */
	readonly rootId: string;
	/** id nội bộ của Content (liên kết aria-controls) */
	readonly contentId: string;
	readonly open: boolean;
	readonly trigger: PopoverTriggerMode;
	readonly position: PopoverPosition;
	/** delay intent (chỉ trigger="hover"): show (ms) / hide (ms) */
	readonly delay: { show?: number; hide?: number } | undefined;
	/** ref element Root (guard focusout + outside-click) */
	rootRef: HTMLElement | undefined;
	/** ref element trigger (trả focus khi đóng) */
	triggerRef: HTMLElement | undefined;
	setOpen: (v: boolean) => void;
	toggle: () => void;
	/** đóng + trả focus về trigger (Escape / outside-click / item act) */
	close: () => void;
	/** intent hover — Trigger (enter/leave) gọi; show delay từ props.delay.show */
	hoverEnter: () => void;
	/** intent hover — Trigger/Content (leave) gọi; hide delay từ props.delay.hide */
	hoverLeave: () => void;
}

export interface PopoverRootProps extends BasicProps {
	/** controlled open (bindable). Mặc định uncontrolled. */
	open?: boolean;
	/** open ban đầu khi chưa bind:open */
	defaultOpen?: boolean;
	/** chế độ trigger: click (mặc định) / hover / focus */
	trigger?: PopoverTriggerMode;
	/** delay intent — chỉ dùng khi trigger="hover": show (default 200ms) / hide (default 150ms) */
	delay?: { show?: number; hide?: number };
	/** căn content theo trigger: start (cạnh trái flush, mặc định) / end (cạnh phải) / center */
	position?: PopoverPosition;
	'aria-label'?: string;
	children?: Snippet;
}

export interface PopoverTriggerProps extends BasicProps {
	disabled?: boolean;
	onclick?: (e: MouseEvent) => void;
	/** aria-label riêng cho trigger (icon-only trigger) */
	'aria-label'?: string;
	children?: Snippet;
}

export interface PopoverContentProps extends BasicProps {
	/** aria-label cho panel (role=dialog) */
	'aria-label'?: string;
	children?: Snippet;
}
