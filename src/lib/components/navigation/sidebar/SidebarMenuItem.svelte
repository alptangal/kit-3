<script lang="ts">
	// SidebarMenuItem — <li> wrapper cho 1 menu item (nút lá, không đệ quy).
	// P2 — search filter: item TỰ ẨN khi searchQuery ≠ '' mà matchText không
	// khớp (case-insensitive, includes). `match` = nhãn thuần chữ để filter
	// (demo truyền label [+ description]).
	// Item register 1 probe (getter → reactive) vào group cha gần nhất
	// (MenuGroup/SidebarGroup qua context lồng) → group auto-expand + ẩn theo con.
	import { queryMatchesText } from '$modules';
	import { getSidebarContext, getMenuGroupContext } from './_context';
	import type { MenuItemProbe } from './_context';
	import type { SidebarMenuItemProps } from './_interface';

	let { children, 'match': match, ...props }: SidebarMenuItemProps = $props();

	const ctx = getSidebarContext();
	const group = getMenuGroupContext();

	// P3: matchText giữ NGUYÊN (không lowercase) — engine queryMatchesText tự
	// NFD-token hóa (nhạy dấu + wildcard dấu), đồng bộ Select/Input.
	const matchText = $derived(match ?? '');

	// visible: query rỗng → luôn hiện; có query → engine NFD-token (nhạy dấu).
	const isVisible = $derived.by(() => {
		const q = (ctx?.searchQuery ?? '').trim();
		if (!q) return true;
		return queryMatchesText(matchText, q);
	});

	// Probe (tạo 1 lần) — getter read-on-access: parent đọc trong $derived của
	// họ → chain reactive đến tận giá trị isVisible / matchText (không capture
	// initial value của prop `match`).
	const probe: MenuItemProbe = {
		get isVisible() {
			return isVisible;
		},
		get matchText() {
			return matchText;
		}
	};

	$effect(() => {
		const dereg = group?.register(probe);
		return () => dereg?.();
	});
</script>

{#if isVisible}
	<li class="sidebar-menu-item" data-match={match}>
		{@render children?.()}
	</li>
{/if}
