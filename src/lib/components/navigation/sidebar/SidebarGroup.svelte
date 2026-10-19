<script lang="ts">
	// SidebarGroup — nhóm menu có label (vd "Chính", "Cấu hình").
	// P2 — search: group cũng là "group cha gần nhất" (registry lồng) cho các
	// MenuItem / MenuGroup con trực tiếp. Khi đang search: group ẨN nếu không
	// có con nào text khớp (query rỗng → luôn hiện).
	// P3: collectProbes (iterative, gộp MenuGroup lồng) + group KHÔNG unmount
	// khi ẩn (CSS display:none) → probe con sống tiếp → gõ lại query đúng,
	// group hiện lại (không chicken-and-egg "group chết").
	import { SvelteSet } from 'svelte/reactivity';
	import { queryMatchesText } from '$modules';
	import {
		getSidebarContext,
		setMenuGroupContext,
		getMenuGroupContext,
		collectProbes,
		setActiveSlot
	} from './_context';
	import type { MenuItemProbe, MenuGroupRegistry } from './_context';
	import type { SidebarGroupProps } from './_interface';

	let { id, children, ...props }: SidebarGroupProps = $props();

	const ctx = getSidebarContext();

	// Con trực tiếp (probe từ MenuItem / MenuGroup lồng trong group này).
	const childProbes = $state(new SvelteSet<MenuItemProbe>());
	// P3: ĐỌC group cha TRƯỚC setMenuGroupContext — Svelte 5: setContext ghi vào
	// context object của CHÍNH component → getContext gọi sau sẽ trả registry
	// CỦA CHÍNH MÌNH (không phải cha) → selfProbe tự register vào chính nó.
	const parentGroup = getMenuGroupContext();
	// Active tracking: slot con điền (MenuButton active) — đồng bộ MenuGroup.
	const activeSlot = $state({ current: false });
	setActiveSlot(activeSlot);
	setMenuGroupContext({
		register: (probe: MenuItemProbe) => {
			childProbes.add(probe);
			return () => {
				childProbes.delete(probe);
			};
		}
	} satisfies MenuGroupRegistry);

	// Group HIỆN khi: query rỗng HOẶC có ≥1 con (ĐỀ QUY) text khớp. P3: engine
	// NFD-token (queryMatchesText, nhạy dấu + wildcard dấu) thay plain lowercase
	// includes. collectProbes: ITERATIVE + 1 Set seen → dừng chắc chắn (không
	// stack overflow); probe con sống trong registry → group KHÉP vẫn biết con.
	const groupVisible = $derived.by(() => {
		const q = (ctx?.searchQuery ?? '').trim();
		if (!q) return true;
		for (const p of collectProbes(childProbes)) if (queryMatchesText(p.matchText, q)) return true;
		return false;
	});

	// PROBE của CHÍNH group lên group cha gần nhất (demo: không có, chuẩn bị
	// cho SidebarGroup lồng) — defer matchText (children reactive, không capture
	// initial), children() phát lại SvelteSet con → ông gộp qua collectProbes.
	// (parentGroup đọc ở đầu script — TRƯỚC setMenuGroupContext, xem comment trên.)
	const selfProbe: MenuItemProbe = {
		get isVisible() {
			return groupVisible;
		},
		get matchText() {
			return '';
		},
		children: () => childProbes
	};
	$effect(() => {
		const dereg = parentGroup?.register(selfProbe);
		return () => dereg?.();
	});
</script>

<!-- P3: KHÔNG {#if groupVisible} — unmount sẽ GIẾT probe của con (deregister)
     → group không bao giờ hiện lại khi gõ query khớp (chicken-and-egg). Ẩn bằng
     class .sb-hidden (CSS display:none) khi không có con khớp. -->
<div
	class="sidebar-group"
	class:sb-hidden={!groupVisible}
	class:active-group={activeSlot.current}
	data-sb-group-id={id}
>
	{@render children?.()}
</div>

<style lang="scss">
	.sidebar-group {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	/* P3: ẩn (không unmount) khi không con khớp search */
	.sb-hidden {
		display: none;
	}
</style>
