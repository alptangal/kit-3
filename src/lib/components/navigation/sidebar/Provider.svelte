<script lang="ts">
	// src/lib/components/navigation/sidebar/Provider.svelte
	// SidebarProvider — giữ state (open/collapsed/isMobile) + expose qua Symbol context.
	// Sinh <div class="sidebar-provider"> bọc slot; Sidebar/Inset/Trigger con đọc context.
	// isMobile theo matchMedia(768px), reactive. collapsible="icon" (desktop rail)
	// / "offcanvas" (desktop overlay) / "none" (không thu gọn).
	import { setSidebarContext } from './_context';
	import type { SidebarConfigs, SidebarProviderProps, SidebarState } from './_interface';

	let { children, ...props }: SidebarProviderProps = $props();

	// ĐỌC từ props (không destructure default) để tránh "captures initial value".
	const collapsibleResolved = $derived(props.collapsible ?? 'icon');

	// ── State (giá trị nguồn; getter trong configs đọc phản ứng) ──
	// Khởi tạo false; defaultOpen do $effect matchMedia gán khi vào mobile
	// (update() chạy sync khi mount) — tránh capture initial value của props.
	let open = $state(false);
	let collapsed = $state(false);
	let isMobile = $state(false);
	// peekActive = sidebar ĐANG ẨN trên DESKTOP → rail hiển thị (railClass):
	// offcanvas closed / icon collapsed. (Hiệu ứng "peek" mở rộng tạm giờ là CSS
	// :hover trên .sidebar-aside, không qua state — xem _styles.scss.)
	// Mobile: rail không thấy (child của aside offcanvas, ra ngoài viewport khi đóng)
	// → false, railClass sẽ ẩn rail.
	// Function cục bộ (KHÔNG phải getter trong object configs — getter gọi
	// SIBLING getter bằng tên trần → TS "Cannot find name" + ReferenceError).
	function peekActive() {
		if (isMobile) return false;
		if (collapsibleResolved === 'offcanvas') return !open;
		if (collapsibleResolved === 'icon') return collapsed;
		return false;
	}

	$effect(() => {
		const mq = window.matchMedia('(max-width: 768px)');
		const update = () => {
			isMobile = mq.matches;
			// Ra/vào mobile: giữ defaultOpen (mobile default closed, user bấm trigger)
			if (mq.matches) open = props.defaultOpen ?? false;
		};
		update();
		mq.addEventListener('change', update);
		return () => mq.removeEventListener('change', update);
	});

	let configs: SidebarConfigs = $state({
		get collapsible() {
			return collapsibleResolved;
		},
		get open() {
			return open;
		},
		get collapsed() {
			return collapsed;
		},
		get isMobile() {
			return isMobile;
		},
		get state(): SidebarState {
			return { open, collapsed, isMobile };
		},
		setOpen(v: boolean) {
			open = v;
		},
		setCollapsed(v: boolean) {
			collapsed = v;
		},
		toggle() {
			// desktop icon → collapse rail; offcanvas/mobile → open overlay
			if (isMobile || collapsibleResolved === 'offcanvas') open = !open;
			else collapsed = !collapsed;
		},
		toggleMobile() {
			open = !open;
		},
		railToggle() {
			// mobile: rail như trigger (mở overlay). Desktop: collapse/expand.
			if (isMobile) open = !open;
			else collapsed = !collapsed;
		},
		get isOffcanvasActive() {
			return isMobile || (collapsibleResolved === 'offcanvas' && open);
		},
		get peekActive() {
			// true khi sidebar đang ẨN trên desktop (offcanvas closed / icon
			// collapsed) → rail hiển thị. Hover "peek" giờ là CSS :hover trên aside
			// (không qua state này). Mobile/none → false (rail ẩn).
			return peekActive();
		},
		get sidebarClass() {
			const base = 'sidebar-aside';
			if (isMobile) return `${base} sidebar-mobile ${open ? 'sidebar-open' : ''}`;
			if (collapsibleResolved === 'offcanvas') {
				const cls = open ? 'sidebar-offcanvas-open' : 'sidebar-offcanvas';
				return `${base} ${cls}`;
			}
			if (collapsibleResolved === 'icon' && collapsed) return `${base} sidebar-collapsed`;
			return base;
		},
		get railClass() {
			const cls = ['sidebar-rail'];
			if (!isMobile && !peekActive()) cls.push('sidebar-rail-hidden');
			return cls.join(' ');
		}
	});

	setSidebarContext(configs);

	export { configs };
</script>

<div class="sidebar-provider">
	{@render children?.()}
</div>

<style lang="scss">
	.sidebar-provider {
		position: relative;
		display: flex;
		min-height: 100dvh;
		width: 100%;
	}
</style>
