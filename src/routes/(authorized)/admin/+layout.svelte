<!-- src/routes/(authorized)/admin/+layout.svelte -->
<!-- Pha 3 (B6.1): layout admin — Sidebar.Provider + Sidebar (brand TeamSwitcher
     + menu 7 routes admin + Settings) + Sidebar.Inset (Breadcrumb + children).
     Gate giữ nguyên ở +layout.server.ts (users:manage). Pages con giữ data flow
     riêng — layout chỉ khung điều hướng. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BreadcrumbItem } from '$components/navigation';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Breadcrumb, Sidebar, TeamSwitcher } from '$components/navigation';
	import { Separator } from '$components/element';
	import type { LayoutData } from '$store/user-prefs.svelte';
	import type { TranslateContent } from '$interfaces/basic';
	import { client } from '$store/basic.svelte';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	// ── B5: sticky header + đo chiều cao filters (page con) ──
	// ResizeObserver đo .admin-inset-header + .admin-filters (page con render
	// muộn/không có → fallback 0px) → set CSS var trên .admin-inset để sticky
	// thead DataTable + filters sticky dùng đúng chiều cao thật (không hardcode
	// — filters wrap nhiều dòng ở 375px).
	// Mới: đo thêm .admin-header (header trang con) → --admin-page-header-h
	// cho sticky desktop (breadcrumb + header trang + filters dồn 1 hàng sticky).
	let insetHeaderEl: HTMLDivElement | undefined = $state(undefined);
	let insetEl: HTMLDivElement | undefined = $state(undefined);
	let isScrolled: boolean = $state(false);
	// Yêu cầu 1: ẩn inset-header khi cuộn xuống sâu (mobile only qua CSS).
	let headerHidden: boolean = $state(false);

	$effect(() => {
		if (typeof document === 'undefined' || !insetEl) return;
		const inset = insetEl;
		const headerEl = insetHeaderEl;
		const setVars = () => {
			const h = headerEl?.getBoundingClientRect().height ?? 0;
			// .admin-filters nằm trong body (page con) — đo khi đã render.
			const filtersEl = inset.querySelector<HTMLElement>('.admin-filters');
			const f = filtersEl?.getBoundingClientRect().height ?? 0;
			// .admin-header (header trang con) — cho stack sticky desktop.
			const pageHeaderEl = inset.querySelector<HTMLElement>('.admin-header');
			const p = pageHeaderEl?.getBoundingClientRect().height ?? 0;
			inset.style.setProperty('--admin-header-h', `${Math.round(h)}px`);
			inset.style.setProperty('--admin-filters-h', `${Math.round(f)}px`);
			inset.style.setProperty('--admin-page-header-h', `${Math.round(p)}px`);
		};
		setVars();
		const ro = new ResizeObserver(setVars);
		ro.observe(headerEl ?? inset);
		// MutationObserver: page con mount/unmount (SvelteKit navigate) → đo lại.
		const mo = new MutationObserver(setVars);
		mo.observe(inset, { childList: true, subtree: true });
		// ResizeObserver .admin-header (page con) — height đổi khi is-scrolled
		// shrink (subtitle collapse) → theo sát để sticky offset đúng. Re-attach
		// khi page con mount (MutationObserver bắn) — element mới cần observer mới.
		let pageRo: ResizeObserver | undefined;
		let pageRoEl: HTMLElement | undefined;
		const attachPageRo = () => {
			const ph = inset.querySelector<HTMLElement>('.admin-header');
			if (ph && ph !== pageRoEl) {
				pageRo?.disconnect();
				pageRo = new ResizeObserver(setVars);
				pageRo.observe(ph);
				pageRoEl = ph;
			}
		};
		attachPageRo();
		const moPage = new MutationObserver(attachPageRo);
		moPage.observe(inset, { childList: true, subtree: true });
		return () => {
			ro.disconnect();
			mo.disconnect();
			pageRo?.disconnect();
			moPage.disconnect();
		};
	});

	// Shrink header khi cuộn (desktop + mobile — xem .admin-inset.is-scrolled):
	// scroll container là div.w-full.h-full của Container root (window không cuộn).
	// Ngưỡng 80px: user cuộn qua phần đầu trang (header + filters) → header
	// trang con thu gọn; cuộn về gần top → trả nguyên trạng thái.
	// Yêu cầu 1 (mobile): cuộn XUỐNG sâu (> 240px) → ẩn hẳn inset-header
	// (trượt lên bằng margin-top âm, KHÔNG display:none — ResizeObserver vẫn
	// đo được --admin-header-h); cuộn LÊN hoặc gần top → hiện lại.
	$effect(() => {
		if (typeof document === 'undefined') return;
		const findScrollEl = (): HTMLElement | undefined => {
			let cur = insetEl?.parentElement;
			while (cur && cur !== document.body) {
				if (getComputedStyle(cur).overflowY === 'auto') return cur;
				cur = cur.parentElement;
			}
			return document.scrollingElement as HTMLElement | undefined;
		};
		let raf = 0;
		let lastTop = 0;
		const onScroll = () => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				if (!scrollEl) return;
				const top = scrollEl.scrollTop;
				isScrolled = top > 80;
				// Hướng cuộn (delta > 0 = xuống). Sai số 4px chống jitter khi
				// dừng (iOS momentum/firefox smooth sẽ nhấp nhô vài px).
				const delta = top - lastTop;
				// Bỏ qua delta âm do trình duyệt CLAMP scrollTop khi nội dung
				// co lại (ẩn header đổi padding → docH giảm ~14px, đang ở đáy
				// trang → scrollTop bị kéo lùi vài px ≈ "bounce"). Đây không
				// phải cuộn lên thật — nếu không lọc sẽ nháy ẩn→hiện ngay.
				const maxTop = scrollEl.scrollHeight - scrollEl.clientHeight;
				const clampBounce =
					delta < 0 && lastTop >= maxTop - 2 && top >= maxTop - 16;
				if (top < 80) {
					headerHidden = false;
				} else if (delta > 4 && top > 240) {
					headerHidden = true;
				} else if (delta < -4 && !clampBounce) {
					headerHidden = false;
				}
				lastTop = top;
			});
		};
		let scrollEl = findScrollEl();
		scrollEl?.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			scrollEl?.removeEventListener('scroll', onScroll);
			window.removeEventListener('scroll', onScroll);
			if (raf) cancelAnimationFrame(raf);
		};
	});

	// ── i18n: lang theo prefs (client.browser.language — setLanguage/applyUserPrefsFromLayout
	// cập nhật; fallback 'en' khi client chưa seed). Mọi label sidebar/breadcrumb/brand
	// resolve qua dict vi/en dưới đây (component SidebarMenuButton + Breadcrumb đã hỗ
	// trợ TranslateContent; GroupLabel + TeamSwitcher group render inline → derive text).
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : 'en');
	const tc = (vi: string, en: string): TranslateContent => ({ vi, en });

	// Brand đầu sidebar — TeamSwitcher 1 team (ứng dụng hiện đơn tenant; mở
	// rộng đa team sau). Tên app lấy từ session user context (fallback hằng).
	// group resolve theo lang (TeamSwitcher nhận string).
	const teams = $derived([
		{
			id: 'kit-admin',
			name: 'Kit Admin',
			abbr: 'KA',
			group: lang === 'vi' ? 'Hệ thống' : 'System'
		}
	]);
	let team = $state('kit-admin');

	// Menu 7 routes admin — active theo page.url.pathname.
	const pathname = $derived(page.url.pathname);
	const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

	// ── Logout: POST /api/auth/logout (revoke refresh token + xoá cookies) → về /login.
	// Gọi với finally goto để kể cả network fail vẫn rời app (cookies server-side
	// đã cố revoke; client fallback: xoá accessToken DPoP trong sessionStorage).
	const handleLogout = async () => {
		try {
			await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
		} catch {
			// ignore — vẫn điều hướng về login
		}
		try {
			sessionStorage.removeItem('accessToken');
			sessionStorage.removeItem('dpop-keypair-jwk');
		} catch {}
		await goto('/login', { invalidateAll: true });
	};

	// Breadcrumb derive từ route hiện tại (đơn giản: Home + tên trang).
	const routeNames: Record<string, TranslateContent> = {
		'/admin': tc('Người dùng', 'Users'),
		'/admin/brands': tc('Thương hiệu', 'Brands'),
		'/admin/categories': tc('Danh mục', 'Categories'),
		'/admin/products': tc('Sản phẩm', 'Products'),
		'/admin/variants': tc('Biến thể', 'Variants'),
		'/admin/customers': tc('Khách hàng', 'Customers'),
		'/admin/orders': tc('Đơn hàng', 'Orders'),
		'/admin/inventory': tc('Tồn kho', 'Inventory'),
		'/admin/suppliers': tc('Nhà cung cấp', 'Suppliers'),
		'/admin/promotions': tc('Khuyến mãi', 'Promotions'),
		'/admin/stock-takes': tc('Kiểm kê', 'Stock takes'),
		'/admin/pos': tc('Bán hàng POS', 'POS'),
		'/admin/pos-sessions': tc('Phiên POS', 'POS sessions'),
		'/admin/payments': tc('Thanh toán', 'Payments'),
		'/admin/shipments': tc('Vận chuyển', 'Shipments'),
		'/admin/fulfillment': tc('Xử lý đơn', 'Fulfillment'),
		'/admin/posts': tc('Bài viết', 'Posts'),
		'/admin/post-categories': tc('Danh mục bài viết', 'Post categories'),
		'/admin/campaigns': tc('Chiến dịch', 'Campaigns'),
		'/admin/social': tc('Social media', 'Social media'),
		'/admin/channels': tc('Kênh bán', 'Sales channels'),
		'/admin/notifications': tc('Thông báo', 'Notifications'),
		'/admin/messages': tc('Tin nhắn', 'Messages'),
		'/admin/email-logs': tc('Email logs', 'Email logs'),
		'/admin/activity': tc('Lịch sử truy cập', 'Activity log'),
		'/admin/dashboard': tc('Tổng quan', 'Overview'),
		'/admin/analytics': tc('Thống kê', 'Analytics'),
		'/admin/expenses': tc('Chi phí', 'Expenses'),
		'/admin/cameras': tc('Camera', 'Cameras'),
		'/admin/purchases': tc('Nhập hàng', 'Purchases'),
		'/admin/transfers': tc('Chuyển kho', 'Transfers'),
		'/admin/returns': tc('Đổi trả', 'Returns'),
		'/admin/debts': tc('Công nợ', 'Debts'),
		'/admin/expiry': tc('Hạn sử dụng', 'Expiry'),
		'/settings': tc('Cấu hình hệ thống', 'System settings')
	};
	const crumbs = $derived<BreadcrumbItem[]>([
		{ label: lang === 'vi' ? 'Trang chủ' : 'Home', href: '/', icon: 'lucide:home' },
		{ label: routeNames[pathname] ?? tc('Admin', 'Admin'), icon: 'lucide:layout-dashboard' }
	]);
</script>

<Sidebar.Provider collapsible="icon">
	<Sidebar>
		<Sidebar.Header>
			<div class="brand-row" data-test="admin-brand-row">
				<TeamSwitcher {teams} bind:value={team} aria-label={lang === 'vi' ? 'Chọn workspace' : 'Select workspace'} />
			</div>
			<div class="trigger-row" data-test="admin-trigger-row">
				<Sidebar.Trigger />
			</div>
		</Sidebar.Header>

		<Sidebar.Content>
			<Sidebar.MenuGroup id="overview" label={lang === 'vi' ? 'Tổng quan' : 'Overview'} icon="lucide:layout-dashboard">
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Tổng quan', 'Overview')}
							href="/admin/dashboard"
							active={isActive('/admin/dashboard')}
							icon="lucide:layout-dashboard"
							data-test="admin-nav-dashboard"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Thanh toán', 'Payments')}
							href="/admin/payments"
							active={isActive('/admin/payments')}
							icon="lucide:credit-card"
							data-test="admin-nav-payments"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Vận chuyển', 'Shipments')}
							href="/admin/shipments"
							active={isActive('/admin/shipments')}
							icon="lucide:package-check"
							data-test="admin-nav-shipments"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Xử lý đơn', 'Fulfillment')}
							href="/admin/fulfillment"
							active={isActive('/admin/fulfillment')}
							icon="lucide:package-open"
							data-test="admin-nav-fulfillment"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Thống kê', 'Analytics')}
							href="/admin/analytics"
							active={isActive('/admin/analytics')}
							icon="lucide:trending-up"
							data-test="admin-nav-analytics"
						/>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.MenuGroup>

			<Sidebar.MenuGroup id="catalog" label={lang === 'vi' ? 'Danh mục' : 'Catalog'} icon="lucide:folder-tree">
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Sản phẩm', 'Products')}
							href="/admin/products"
							active={isActive('/admin/products')}
							icon="lucide:package"
							data-test="admin-nav-products"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Biến thể', 'Variants')}
							href="/admin/variants"
							active={isActive('/admin/variants')}
							icon="lucide:boxes"
							data-test="admin-nav-variants"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Thương hiệu', 'Brands')}
							href="/admin/brands"
							active={isActive('/admin/brands')}
							icon="lucide:tag"
							data-test="admin-nav-brands"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Danh mục', 'Categories')}
							href="/admin/categories"
							active={isActive('/admin/categories')}
							icon="lucide:folder-tree"
							data-test="admin-nav-categories"
						/>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.MenuGroup>

			<Sidebar.MenuGroup id="sales" label={lang === 'vi' ? 'Bán hàng' : 'Sales'} icon="lucide:shopping-cart">
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Đơn hàng', 'Orders')}
							href="/admin/orders"
							active={isActive('/admin/orders')}
							icon="lucide:shopping-cart"
							data-test="admin-nav-orders"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Tồn kho', 'Inventory')}
							href="/admin/inventory"
							active={isActive('/admin/inventory')}
							icon="lucide:warehouse"
							data-test="admin-nav-inventory"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Nhà cung cấp', 'Suppliers')}
							href="/admin/suppliers"
							active={isActive('/admin/suppliers')}
							icon="lucide:truck"
							data-test="admin-nav-suppliers"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Nhập hàng', 'Purchases')}
							href="/admin/purchases"
							active={isActive('/admin/purchases')}
							icon="lucide:package-plus"
							data-test="admin-nav-purchases"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Chuyển kho', 'Transfers')}
							href="/admin/transfers"
							active={isActive('/admin/transfers')}
							icon="lucide:arrow-right-left"
							data-test="admin-nav-transfers"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Đổi trả', 'Returns')}
							href="/admin/returns"
							active={isActive('/admin/returns')}
							icon="lucide:undo-2"
							data-test="admin-nav-returns"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Hạn sử dụng', 'Expiry')}
							href="/admin/expiry"
							active={isActive('/admin/expiry')}
							icon="lucide:calendar-clock"
							data-test="admin-nav-expiry"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Công nợ', 'Debts')}
							href="/admin/debts"
							active={isActive('/admin/debts')}
							icon="lucide:hand-coins"
							data-test="admin-nav-debts"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Khuyến mãi', 'Promotions')}
							href="/admin/promotions"
							active={isActive('/admin/promotions')}
							icon="lucide:badge-percent"
							data-test="admin-nav-promotions"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Kiểm kê', 'Stock takes')}
							href="/admin/stock-takes"
							active={isActive('/admin/stock-takes')}
							icon="lucide:clipboard-list"
							data-test="admin-nav-stock-takes"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Bán hàng POS', 'POS')}
							active={isActive('/admin/pos')}
							icon="lucide:scan-barcode"
							data-test="admin-nav-pos-terminal"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Phiên POS', 'POS sessions')}
							href="/admin/pos-sessions"
							active={isActive('/admin/pos-sessions')}
							icon="lucide:calculator"
							data-test="admin-nav-pos-sessions"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Khách hàng', 'Customers')}
							href="/admin/customers"
							active={isActive('/admin/customers')}
							icon="lucide:users"
							data-test="admin-nav-customers"
						/>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.MenuGroup>

			<Sidebar.MenuGroup id="operations" label={lang === 'vi' ? 'Vận hành' : 'Operations'} icon="lucide:receipt">
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Chi phí', 'Expenses')}
							href="/admin/expenses"
							active={isActive('/admin/expenses')}
							icon="lucide:receipt"
							data-test="admin-nav-expenses"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Camera', 'Cameras')}
							href="/admin/cameras"
							active={isActive('/admin/cameras')}
							icon="lucide:video"
							data-test="admin-nav-cameras"
						/>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.MenuGroup>

			<Sidebar.MenuGroup id="system" label={lang === 'vi' ? 'Hệ thống' : 'System'} icon="lucide:shield-user">
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Người dùng', 'Users')}
							href="/admin"
							active={isActive('/admin')}
							icon="lucide:shield-user"
							data-test="admin-nav-users"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Thông báo', 'Notifications')}
							href="/admin/notifications"
							active={isActive('/admin/notifications')}
							icon="lucide:bell"
							data-test="admin-nav-notifications"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Tin nhắn', 'Messages')}
							href="/admin/messages"
							active={isActive('/admin/messages')}
							icon="lucide:message-square"
							data-test="admin-nav-messages"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Email logs', 'Email logs')}
							href="/admin/email-logs"
							active={isActive('/admin/email-logs')}
							icon="lucide:mail"
							data-test="admin-nav-email-logs"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Lịch sử truy cập', 'Activity log')}
							href="/admin/activity"
							active={isActive('/admin/activity')}
							icon="lucide:history"
							data-test="admin-nav-activity"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Màn hình TV', 'TV display')}
							href="/display"
							active={isActive('/display')}
							icon="lucide:tv"
							data-test="admin-nav-display"
						/>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.MenuGroup>

			<Sidebar.MenuGroup id="content" label={lang === 'vi' ? 'Nội dung' : 'Content'} icon="lucide:newspaper">
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Bài viết', 'Posts')}
							href="/admin/posts"
							active={isActive('/admin/posts')}
							icon="lucide:newspaper"
							data-test="admin-nav-posts"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Danh mục bài viết', 'Post categories')}
							href="/admin/post-categories"
							active={isActive('/admin/post-categories')}
							icon="lucide:tags"
							data-test="admin-nav-post-categories"
						/>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.MenuGroup>

			<Sidebar.MenuGroup id="marketing" label={lang === 'vi' ? 'Marketing' : 'Marketing'} icon="lucide:megaphone">
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Chiến dịch', 'Campaigns')}
							href="/admin/campaigns"
							active={isActive('/admin/campaigns')}
							icon="lucide:megaphone"
							data-test="admin-nav-campaigns"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Social media', 'Social media')}
							href="/admin/social"
							active={isActive('/admin/social')}
							icon="lucide:share-2"
							data-test="admin-nav-social"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label={tc('Kênh bán', 'Sales channels')}
							href="/admin/channels"
							active={isActive('/admin/channels')}
							icon="lucide:shopping-bag"
							data-test="admin-nav-channels"
						/>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.MenuGroup>
		</Sidebar.Content>

		<Sidebar.Footer>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton
						label={tc('Cấu hình hệ thống', 'System settings')}
						href="/settings"
						icon="lucide:settings"
						data-test="admin-nav-settings"
					/>
				</Sidebar.MenuItem>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton
						label={tc('Đăng xuất', 'Log out')}
						onclick={handleLogout}
						icon="lucide:log-out"
						data-test="admin-nav-logout"
					/>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Footer>

		<Sidebar.Rail />
	</Sidebar>

	<Sidebar.Inset>
		<div
			class="admin-inset"
			class:is-scrolled={isScrolled}
			class:admin-header-hidden={headerHidden}
			bind:this={insetEl}
		>
			<div
				class="admin-inset-header"
				class:is-scrolled={isScrolled}
				bind:this={insetHeaderEl}
			>
				<!-- Mobile: nút mở sidebar (aside offcanvas ẩn → trigger trong
				     Sidebar.Header không bấm được trên mobile). Desktop ẩn — đã có
				     trigger-row trong header sidebar (B3: cùng row với brand). -->
				<div class="admin-mobile-trigger">
					<Sidebar.Trigger />
				</div>
				<Breadcrumb items={crumbs} data-test="admin-breadcrumb" />
			</div>
			<Separator decorative class="admin-inset-separator" />
			<div class="admin-inset-body">
				{@render children()}
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

<style lang="scss">
	.admin-inset {
		/* B5: var sticky đo bằng ResizeObserver (fallback 0 — thead top = filters). */
		--admin-header-h: 0px;
		--admin-filters-h: 0px;
		--admin-page-header-h: 0px;
		/* Padding-top của .admin-inset-body — dùng trong công thức sticky filters
		   mobile (page tự khai top calc(header + body-pad-top)); define tại đây
		   để mọi trang cùng nguồn sự thật. */
		--admin-body-pad-top: 1.5rem;
		display: flex;
		flex-direction: column;
		width: 100%;

		@media (max-width: 767px) {
			--admin-body-pad-top: 0.5rem;
		}
	}

	.admin-inset-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1.5rem;
		background: var(--background, #fff);

		/* Desktop: sticky breadcrumb bar — user luôn thấy vị trí đang đứng.
		   1 scroll container duy nhất (.admin-inset body cuộn trong Container
		   root) → sticky hoạt động mà không tạo scroll lồng. z-500 dưới
		   sidebar overlay (999). Khi cuộn (.is-scrolled) thu padding-block để
		   bar mỏng tối đa — mục tiêu: tối đa dòng data hiển thị trên màn hình
		   (wide screen), breadcrumb vẫn đủ nhận biết vị trí. ResizeObserver đo
		   .admin-inset-header → --admin-header-h tự theo chiều cao mới. */
		@media (min-width: 768px) {
			position: sticky;
			top: 0;
			z-index: 500;
			transition: padding 200ms ease, box-shadow 200ms ease;

			&.is-scrolled {
				padding-block: 0.35rem;
				box-shadow: 0 1px 3px rgb(0 0 0 / 0.08);
			}
		}

		/* Mobile: bỏ padding-inline — tiết kiệm chiều ngang 375px (yêu cầu user,
		   đồng bộ inset header demo /ui/sidebar). padding-block giữ. */
		@media (max-width: 767px) {
			padding-inline: 0.5rem;
		}

		/* B5: mobile sticky top + shrink khi cuộn (is-scrolled qua scroll listener).
		   z-500: dưới sidebar overlay (999) — đúng khi sidebar mobile mở. */
		@media (max-width: 767px) {
			position: sticky;
			top: 0;
			z-index: 500;
			transition: padding 200ms ease, box-shadow 200ms ease;

			&.is-scrolled {
				padding-block: 0.35rem;
				box-shadow: 0 1px 3px rgb(0 0 0 / 0.08);
			}
		}
	}

	/* Mobile: hiện nút mở sidebar trong inset header. Desktop ẩn (trigger-row
	   trong sidebar header đã có — B3 brand + trigger cùng row). */
	/* ── Yêu cầu 10: brand-row chiếm toàn bộ width còn lại của sidebar header
	   sau trigger-row (expanded 1-row: TeamSwitcher giãn full, trigger sát mép
	   phải — như demo /ui/sidebar). Collapsed/peek: _styles.scss đã có rule
	   riêng (width 100% / auto + min-height) đè qua specificity cao hơn. */
	:global(.sidebar-header .brand-row) {
		flex: 1;
		min-width: 0;
	}

	:global(.sidebar-header .trigger-row) {
		flex: none;
	}

	.admin-mobile-trigger {
		display: none;

		@media (max-width: 767px) {
			display: inline-flex;
		}
	}

	/* G: thu gọn header trang con khi cuộn xuống (desktop + mobile, ngưỡng
	   80px — class .is-scrolled do scroll listener đặt trên .admin-inset).
	   Header trang con giữ KHÔNG sticky (tránh vỡ layout trang có filters/
	   toolbar sticky riêng) — chỉ thu gọn: subtitle collapse height 0 +
	   title nhỏ lại. Scoped layout không match markup trang con → :global()
	   qua anchor .admin-inset (element của chính layout này). */
	.admin-inset :global(.admin-header) {
		transition: gap 200ms ease;
	}
	.admin-inset :global(.admin-header .admin-title) {
		transition: font-size 200ms ease;
	}

	.admin-inset :global(.admin-header .admin-subtitle) {
		max-height: 3rem;
		opacity: 1;
		overflow: hidden;
		transition:
			max-height 200ms ease,
			opacity 200ms ease,
			margin-top 200ms ease;
	}

	.admin-inset.is-scrolled :global(.admin-header) {
		gap: 0.5rem;
	}

	.admin-inset.is-scrolled :global(.admin-header .admin-title) {
		font-size: 1.25rem;
	}

	.admin-inset.is-scrolled :global(.admin-header .admin-subtitle) {
		max-height: 0;
		opacity: 0;
		margin-top: 0;
	}

	/* ── Sticky desktop (mới): stack bar dọc — breadcrumb (z-500) → header trang
	   con (z-400) → filter bar (z-390) → pagination dính đáy (z-390). Chỉ data
	   rows cuộn; các bar luôn nhìn thấy. Mobile đã có riêng (B5 + trang tự khai)
	   — không đụng. :global() qua anchor .admin-inset (markup trang con ngoài
	   scope layout). Nền đặc var(--background) chống row lòi xuyên.
	   Wide screen (yêu cầu user): khi cuộn — separator ẩn (trống 1px), body
	   padding-top thu lại, gap giữa header/filters/bảng nén để tối đa rows. */
	/* Separator giữa header + body: element render trong component Separator
	   (hash riêng) → scoped selector layout không khớp. :global() qua anchor
	   .admin-inset (trong template layout, hash khớp) — ẩn khi cuộn. */
	.admin-inset :global(.admin-inset-separator) {
		transition: opacity 200ms ease;
	}

	@media (min-width: 768px) {
		.admin-inset.is-scrolled :global(.admin-inset-separator) {
			opacity: 0;
		}
	}

	@media (min-width: 768px) {
		.admin-inset :global(.admin-header) {
			position: sticky;
			top: var(--admin-header-h, 0px);
			z-index: 400;
			background: var(--background, #fff);
			padding-block: 0.25rem;
			transition: padding 200ms ease;
		}

		.admin-inset :global(.admin-page) {
			transition: gap 200ms ease;
		}

		.admin-inset.is-scrolled :global(.admin-page) {
			gap: 0.5rem;
		}

		/* Cuộn sâu: co padding-block trang lại để bảng chiếm nhiều không gian hơn
		   (padding-inline giữ nguyên, căn giữa max-width không đổi). */
		.admin-inset.is-scrolled :global(.admin-page) {
			padding-block: 0.5rem;
		}

		.admin-inset :global(.admin-filters) {
			position: sticky;
			top: calc(var(--admin-header-h, 0px) + var(--admin-page-header-h, 0px));
			z-index: 390;
			background: var(--background, #fff);
			transition: box-shadow 200ms ease;
		}

		.admin-inset.is-scrolled :global(.admin-filters) {
			box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
		}

		.admin-inset :global(.admin-pagination) {
			position: sticky;
			bottom: 0;
			z-index: 390;
			background: var(--background, #fff);
		}
	}

	/* Mobile: sticky CHUNG cho .admin-filters trên mọi trang (trước đây chỉ
	   6 trang tự khai rule riêng) — search/lọc luôn thấy khi cuộn. margin-block
	   âm bù gap 1.25rem của .admin-page: dính sát header (top = header +
	   body-pad-top), chừa 0.25rem nhịp thở — không lộ data giữa 2 lớp sticky. */
	@media (max-width: 767px) {
		.admin-inset :global(.admin-filters) {
			position: sticky;
			top: var(--admin-header-h, 0px);
			z-index: 400;
			background: var(--background, #fff);
			padding-block: 0.25rem;
			margin-block: -1rem;
		}
	}

	/* ── Yêu cầu 1 (mobile): ẩn inset-header khi cuộn XUỐNG sâu ──
	   Dùng transform (KHÔNG margin-top âm, KHÔNG display:none): transform
	   không đổi layout/scrollHeight → không gây scroll-anchoring loop (bẫy
	   thực tế: margin âm làm header co layout → browser clamp/anchor scrollTop
	   → sinh scroll event ngược → nhấp nháy ẩn/hiện vô hạn). Element vẫn trong
	   flow → ResizeObserver vẫn đo --admin-header-h; các sticky offset khác
	   không nhảy. Header trượt lên mượt qua transition transform. Khi ẩn:
	   filters sticky top về 0 (trượt lên chiếm chỗ header). Desktop không
	   áp — sticky stack desktop đã tối ưu. */
	@media (max-width: 767px) {
		/* transition đặt trên base (không chỉ .admin-header-hidden) để cả
		   lúc HIỆN lại (cuộn lên) cũng mượt. */
		.admin-inset .admin-inset-header {
			transition: transform 0.25s ease;
		}

		.admin-inset.admin-header-hidden .admin-inset-header {
			transform: translateY(calc(var(--admin-header-h, 0px) * -1));
		}

		.admin-inset.admin-header-hidden :global(.admin-filters) {
			top: 0;
		}

		/* ── Yêu cầu 7 (mobile): khi cuộn sâu, bỏ đệm dọc → pagination sticky
		   sát đáy viewport, tối đa dòng data hiển thị. Chỉ khi header ẩn
		   (đang ở vùng cuộn sâu); cuộn lên → trả đệm. LƯU Ý: KHÔNG đổi padding
		   của .admin-page khi ẩn — padding thay đổi giữa chừng cuộn cũng gây
		   scroll-anchor loop như margin âm (đã thử, bỏ). Padding-top body
		   (--admin-body-pad-top) đủ để nhường chỗ. */
		.admin-inset.admin-header-hidden .admin-inset-body {
			--admin-body-pad-top: 0;
		}
		/* Pagination sticky bottom đã sát đáy sẵn — không cần đụng padding
		   .admin-page (tránh anchor loop). */
	}

	.admin-inset-body {
		/* Padding do .admin-page trên từng trang đảm nhiệm (chuẩn 1.5rem,
		   mobile 1rem). Layout giữ min-height để footer không dính sát. */
		min-height: 60dvh;
	}
</style>
