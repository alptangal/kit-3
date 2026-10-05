// src/lib/components/element/hover-card/_interface.ts
// HoverCard — floating card (shadcn hover-card). Root giữ state `open` (bindable)
// + intent timers (show delay mặc định 300ms, hide 150ms). Trigger = span bọc
// control user (mouseenter/leave + focusin/out). Content = role="tooltip"
// absolute bên dưới trigger; KHÔNG focus trap; ESC → ẩn. Duration animation
// (TimeUnits, default 200ms) truyền vào content qua context.
import type { Snippet } from 'svelte';
import type { BasicProps, BasicConfigs, TimeUnits } from '$components/interface';

export interface HoverCardConfigs extends BasicConfigs {
	readonly rootId: string;
	readonly contentId: string;
	readonly open: boolean;
	/** animation duration (ms) — từ props.duration (TimeUnits) */
	readonly duration: number;
	/** show delay (ms) — từ props.delay (TimeUnits), default 300 */
	readonly showDelay: number;
	readonly show: () => void;
	readonly hide: () => void;
	/** huỷ timer show (gọi khi trigger focusout / content mouseleave) */
	readonly cancelShow: () => void;
	/** huỷ timer hide (gọi khi content mouseenter — keep-alive) */
	readonly cancelHide: () => void;
	rootRef: HTMLElement | undefined;
	triggerRef: HTMLElement | undefined;
}

export interface HoverCardRootProps extends BasicProps {
	/** controlled open (bindable). Mặc định uncontrolled. */
	open?: boolean;
	/** delay show (TimeUnits — number ms | `${n}ms` | `${n}s`). Default 300ms. */
	delay?: TimeUnits;
	/** duration animation content (TimeUnits). Default 200ms. */
	duration?: TimeUnits;
	'aria-label'?: string;
	children?: Snippet;
}

export interface HoverCardTriggerProps extends BasicProps {
	disabled?: boolean;
	'aria-label'?: string;
	children?: Snippet;
}

export interface HoverCardContentProps extends BasicProps {
	'aria-label'?: string;
	children?: Snippet;
}
