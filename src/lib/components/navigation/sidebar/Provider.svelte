<script lang="ts">
	// src/lib/components/navigation/sidebar/Provider.svelte
	// SidebarProvider — giữ state (open/collapsed/isMobile) + expose qua Symbol context.
	// Sinh <div class="sidebar-provider"> bọc slot; Sidebar/Inset/Trigger con đọc context.
	// isMobile theo matchMedia(768px), reactive. collapsible="icon" (desktop rail)
	// / "offcanvas" (desktop overlay) / "none" (không thu gọn).
	import { browser } from '$app/environment';
	import { setSidebarContext } from './_context';
	import type { SidebarConfigs, SidebarProviderProps, SidebarState } from './_interface';

	let { children, ...props }: SidebarProviderProps = $props();

	// ĐỌC từ props (không destructure default) để tránh "captures initial value".
	const collapsibleResolved = $derived(props.collapsible ?? 'icon');

	// ── P2: resize width (desktop, mouse-drag) ──
	// Khung clamp 200–480. defaultWidth fallback 240 (= CSS --sidebar-width).
	const SIDEBAR_MIN_W = 200;
	const SIDEBAR_MAX_W = 480;
	const SIDEBAR_DEFAULT_W = 240;
	const clampWidth = (px: number) =>
		Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, Math.round(px)));

	// storageKey đọc 1 lần khi init (ổn định) để load width đã persist.
	const storageKey = props.storageKey ?? 'sidebar-width';
	// width: null = chưa resize (dùng CSS default). GHI CHÚ Svelte 5: `$state`
	// nhận VALUE (không nhận thunk) → gọi function trả number|null rồi gán.
	// SSR: browser=false → null (dùng CSS 240px). Browser: đọc localStorage.
	function loadInitialWidth(): number | null {
		if (!browser) return null;
		try {
			const raw = localStorage.getItem(storageKey);
			const parsed = raw ? Number(raw) : NaN;
			return Number.isFinite(parsed) ? clampWidth(parsed) : null;
		} catch {
			return null;
		}
	}
	let width = $state<number | null>(loadInitialWidth());
	let resizing = $state(false);
	//(bookkeeping kéo — không reactive, chỉ dùng trong event handler)
	let _resizeStartX = 0;
	let _resizeStartWidth = 0;

	// ── P2: search menu item ──
	// Chỉ giữ query. Lọc + auto-expand do MenuItem/MenuGroup/SidebarGroup đọc
	// ctx.searchQuery (reactive) — auto-expand dùng registry đệ quy trong item
	// (không cần danh sách id nhóm ở đây).
	let searchQuery = $state('');

	// ── P3: animation label (streaming text khi expand từ rail) ──
	// labelAnimActive = user VỪA expand (collapsed → false) trên desktop → CSS chạy
	// transition 1 lần; flip false ngay (1 tick) để CSS deterministic. offcanvas /
	// mobile: slide do transform (riêng) → không set flag.
	let labelAnimActive = $state(false);
	// labelAnimation: chế độ prop (on/off/auto) + PC + reduced-motion (effect trên).
	let labelAnimation = $state(false);

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

	// P3: user VỪA expand từ icon rail (desktop, collapsible="icon") → bật
	// labelAnimActive 1 tick (500ms = --sb-label-reveal-duration) để CSS
	// transition "streaming text" (mở label) chạy 1 lần. Offcanvas/mobile:
	// không chạy (slide do transform riêng). _prevCollapsed = bookkeeping
	// non-reactive (mirror _resizeStartX).
	let _prevCollapsed = false;
	$effect(() => {
		const c = collapsed;
		if (!c && _prevCollapsed && !isMobile && collapsibleResolved === 'icon') {
			labelAnimActive = true;
			setTimeout(() => {
				labelAnimActive = false;
			}, 500);
		}
		_prevCollapsed = c;
	});

	// ── P2: resize handlers (gọi bởi SidebarResizeHandle qua pointer capture) ──
	// setPointerCapture trên handle → onpointermove/up fire TRÊN handle kể cả khi
	// chuột rời nó (không cần listener document thủ công, không leak).
	function startResize(clientX: number) {
		if (resizing) return;
		// Bắt đầu kéo: width hiện tại (bắt event khi chưa đổi nên chưa set resizing)
		_resizeStartX = clientX;
		_resizeStartWidth = width ?? SIDEBAR_DEFAULT_W;
		width = _resizeStartWidth; // "khoá" về giá trị số (không còn dùng CSS default)
		resizing = true;
	}

	function applyResize(clientX: number) {
		if (!resizing) return;
		width = clampWidth(_resizeStartWidth + (clientX - _resizeStartX));
	}

	function endResize() {
		if (!resizing) return;
		resizing = false;
		// Persist RỘNG CŨNG NHƯ THU GỌN (user kéo lại 240 vẫn giữ key = intent).
		try {
			if (width != null) localStorage.setItem(storageKey, String(width));
		} catch {
			/* storage full / private mode — bỏ qua */
		}
	}

	// Programmatic set (khác kéo): clamp + persist ngay.
	function setWidth(px: number) {
		const clamped = clampWidth(px);
		width = clamped;
		try {
			localStorage.setItem(storageKey, String(clamped));
		} catch {
			/* noop */
		}
	}

	// ── P3: chế độ animation label (on/off/auto) ──
	// 'auto' (mặc định): PC bật + tôn trọng prefers-reduced-motion; mobile tắt.
	// 'on': PC bật (bỏ qua reduced-motion); 'off': không bao giờ.
	const animMode = props.animation ?? 'auto';
	$effect(() => {
		if (!browser) return;
		const mq = window.matchMedia('(max-width: 768px)');
		let mobile = mq.matches;
		const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
		let reduced = rm.matches;
		const update = () => {
			mobile = mq.matches;
			reduced = rm.matches;
		};
		update();
		mq.addEventListener('change', update);
		rm.addEventListener('change', update);
		labelAnimation = !mobile && (animMode === 'on' || (animMode === 'auto' && !reduced));
		return () => {
			mq.removeEventListener('change', update);
			rm.removeEventListener('change', update);
		};
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
		},
		// ── P2: resize width (desktop) ──
		// CSS width đặt inline trên <aside> (100% thắng var --sb-width) → width hiệu
		// dụng: width (nếu user kéo) → defaultWidth (prop) → null (CSS 240px).
		get resizable() {
			return props.resizable !== false;
		},
		get width() {
			return width ?? props.defaultWidth ?? SIDEBAR_DEFAULT_W;
		},
		get resizing() {
			return resizing;
		},
		setWidth,
		startResize,
		applyResize,
		endResize,
		// ── P2: search menu item ──
		get searchQuery() {
			return searchQuery;
		},
		setSearchQuery(q: string) {
			searchQuery = q;
		},
		// ── P3: hoàn thiện rail + streaming label + highlight search ──
		// Logo ẨN: prop (mặc định true) + collapsed + desktop (icon rail).
		// Mobile offcanvas: sidebar mở full-width (không "rail") → luôn giữ logo.
		get hideLogoWhenCollapsed() {
			return props.hideLogoWhenCollapsed !== false && collapsed && !isMobile;
		},
		get labelAnimation() {
			return labelAnimation;
		},
		get labelAnimActive() {
			return labelAnimActive;
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
