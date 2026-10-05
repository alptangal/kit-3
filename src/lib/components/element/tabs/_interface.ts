// src/lib/components/element/tabs/_interface.ts
// Tabs — tabs composite (shadcn tabs). Root giữ value (bindable) + Symbol context;
// Trigger = role="tab" (roving focus, activation automatic/manual); Content =
// role="tabpanel" (hidden khi không active); Indicator = vạch trượt (type='underline').
import type { Snippet } from 'svelte';
import type { BasicProps, BasicConfigs } from '$components/interface';

export type TabsType = 'default' | 'underline';
export type TabsOrientation = 'horizontal' | 'vertical';
export type TabsActivation = 'automatic' | 'manual';

export interface TabsConfigs extends BasicConfigs {
	/** id instance (gắn aria-controls / aria-labelledby) */
	rootId: string;
	/** giá trị tab active (value ?? defaultValue ?? trigger đầu) */
	activeValue: string | undefined;
	duration: number;
	orientation: TabsOrientation;
	type: TabsType;
	activation: TabsActivation;
	/** chọn tab (Trigger click/focus-automatic gọi) */
	select: (v: string) => void;
	/** Trigger mount/unmount đăng ký ref */
	register: (v: string, ref: HTMLElement) => void;
	unregister: (v: string, ref: HTMLElement) => void;
	/** ref trigger (value → button) — Indicator đọc để tính vị trí; roving focus */
	triggerRefs: {
		keys(): IterableIterator<string>;
		get(v: string): HTMLElement | undefined;
		set(v: string, ref: HTMLElement): void;
		delete(v: string): void;
	};
	/** ref tablist (List set) — Indicator ResizeObserver */
	listEl: HTMLDivElement | undefined;
}

export interface TabsRootProps extends BasicProps {
	/** giá trị tab active (BINDABLE — controlled) */
	value?: string;
	/** giá trị ban đầu (khi không bind value) */
	defaultValue?: string;
	/** 'default': trigger active có nền pill · 'underline': indicator line trượt */
	type?: TabsType;
	orientation?: TabsOrientation;
	/** 'automatic': focus trigger → chọn luôn · 'manual': focus chỉ di chuyển */
	activation?: TabsActivation;
	/** duration transition indicator (TimeUnits) */
	duration?: import('$components/interface').TimeUnits;
	children?: Snippet;
}

export interface TabsListProps extends BasicProps {
	children?: Snippet;
}

export interface TabsTriggerProps extends BasicProps {
	/** giá trị tab (liên kết Content value cùng nhau) */
	value: string;
	disabled?: boolean;
	/** icon (iconify name, vd 'lucide:house') hiển thị trước label */
	icon?: string;
	onclick?: (e: MouseEvent) => void;
	children?: Snippet;
}

export interface TabsContentProps extends BasicProps {
	/** giá trị tab (khớp Trigger value) */
	value: string;
	children?: Snippet;
}

export interface TabsIndicatorProps {}
