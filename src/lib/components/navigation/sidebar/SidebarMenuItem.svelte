<script lang="ts">
	// SidebarMenuItem — <li> wrapper cho 1 menu item (nút lá, không đệ quy).
	// P2 — search filter: item TỰ ẨN khi searchQuery ≠ '' mà matchText không
	// khớp (case-insensitive, includes). `match` = nhãn thuần chữ để filter
	// (demo truyền label [+ description]).
	// Item register 1 probe (getter → reactive) vào group cha gần nhất
	// (MenuGroup/SidebarGroup qua context lồng) → group auto-expand + ẩn theo con.
	import { queryMatchesText } from '$modules';
	import { getSidebarContext, getMenuGroupContext, setMenuItemLabelSlot } from './_context';
	import type { MenuItemProbe } from './_context';
	import type { SidebarMenuItemProps } from './_interface';

	let { children, 'match': match, ...props }: SidebarMenuItemProps = $props();

	const ctx = getSidebarContext();
	const group = getMenuGroupContext();

	// Label bridge: MenuButton CON điền labelText vào slot qua $effect (setContext
	// từ con lên cha KHÔNG được — bẫy hướng context; slot $state reactive 2 chiều
	// ghi từ effect con). Fallback khi `match` không truyền (admin layout chỉ có
	// label — không bridge thì search ẩn TOÀN BỘ item).
	const labelSlot = $state({ current: '' });
	setMenuItemLabelSlot(labelSlot);

	// P3: matchText giữ NGUYÊN (không lowercase) — engine queryMatchesText tự
	// NFD-token hóa (nhạy dấu + wildcard dấu), đồng bộ Select/Input.
	const matchText = $derived(match ?? labelSlot.current);

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
	<li class="sidebar-menu-item" class:sb-hidden={!isVisible} data-match={match}>
		{@render children?.()}
	</li>
{:else}
	<!-- P3: KHÔNG unmount khi ẩn — unmount giết mount của MenuButton con →
	     label bridge không bao giờ điền (chicken-and-egg, tương tự group P3).
	     Render LIỀN + ẩn bằng .sb-hidden (display:none); MenuButton vẫn mount
	     → effect điền labelSlot → matchText cập nhật → item hiện lại. -->
	<li class="sidebar-menu-item sb-hidden" data-match={match}>
		{@render children?.()}
	</li>
{/if}

<style lang="scss">
	/* P3: ẩn item không khớp search bằng class (KHÔNG unmount — probe MenuButton
	   con phải sống để bridge label hoạt động từ trạng thái group đóng). */
	.sidebar-menu-item.sb-hidden {
		display: none;
	}
</style>
