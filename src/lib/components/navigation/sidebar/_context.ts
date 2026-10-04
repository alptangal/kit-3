// src/lib/components/navigation/sidebar/_context.ts
// Tách SidebarConfigs ra file leaf (KHÔNG import Main/Provider .svelte) để tránh
// circular import khi sidebar item đọc context qua barrel '../sidebar' trong SSR.
// Mirror pattern select/_context.ts + radiogroup/_context.ts.
//
// P2 — registry "menu group gần nhất" (Symbol context lồng):
//  Mỗi nút MenuItem register probe (isVisible + text khớp) vào group cha gần
//  nhất (MenuGroup hoặc SidebarGroup). Group cha giữ SvelteSet<probe> con →
//  auto-expand khi đang search && có con khớp; ẩn hẳn khi con rỗng. Đệ quy:
//  MenuGroup lồng nhau = chuỗi context lồng nhau → cấp nào cũng thấy đúng con.
import { getContext, setContext } from 'svelte';
import type { SidebarConfigs } from './_interface';

const NAME = Symbol('sidebar-context');

export function setSidebarContext(context: SidebarConfigs) {
	setContext(NAME, context);
}

export function getSidebarContext(): SidebarConfigs | undefined {
	return getContext(NAME);
}

/**
 * Probe 1 MenuItem (nút lá) / MenuGroup / SidebarGroup (nút cha) — con register
 * lên group cha gần nhất. Nhóm cha giữ SvelteSet probe con → auto-expand + filter.
 */
export interface MenuItemProbe {
	/** visible sau khi filter theo searchQuery (query rỗng → luôn true) */
	readonly isVisible: boolean;
	/** nhãn thuần chữ để highlight kết quả (label [+ description]) */
	readonly matchText: string;
	/**
	 * CON TRỰC TIẾP (chỉ nhóm cha implement — trả SvelteSet probe con, reactive).
	 * Combine ĐỀ QUY toàn cây do `collectProbes` (iterative + 1 Set seen) — KHÔNG
	 * self-descend, tránh recursion vô hạn / tràn stack (bẫy: descend() wrapper
	 * `() => collect` != collect → tick guard vô hiệu; seen mới mỗi lần gọi).
	 */
	readonly children?: () => Iterable<MenuItemProbe>;
}

/**
 * Gộp ĐỀ QUY toàn bộ cây con từ các root probe — ITERATIVE (không đệ quy) +
 * MỘT Set `seen` dùng chung cho cả quá trình → DỪNG chắc chắn kể cả khi cây
 * có CHUỖI (vd group lỡ tự register probe vào chính nó — vẫn không lặp vô hạn).
 * `kids` (children getter) đọc SvelteSet reactive của từng nhóm → `collectProbes`
 * gọi trong $derived vẫn recompute đúng.
 */
export function collectProbes(roots: Iterable<MenuItemProbe>): MenuItemProbe[] {
	const seen = new Set<MenuItemProbe>();
	const out: MenuItemProbe[] = [];
	const stack: MenuItemProbe[] = [];
	for (const r of roots) stack.push(r);
	while (stack.length > 0) {
		const p = stack.pop()!;
		if (seen.has(p)) continue;
		seen.add(p);
		out.push(p);
		const kids = p.children?.();
		if (kids) for (const k of kids) stack.push(k);
	}
	return out;
}

/** Group cha (MenuGroup hoặc SidebarGroup) giữ danh sách probe con trực tiếp. */
export interface MenuGroupRegistry {
	register: (probe: MenuItemProbe) => () => void;
}

const GROUP_NAME = Symbol('sidebar-menu-group-context');

export function setMenuGroupContext(registry: MenuGroupRegistry) {
	setContext(GROUP_NAME, registry);
}

export function getMenuGroupContext(): MenuGroupRegistry | undefined {
	return getContext(GROUP_NAME);
}
