<!-- src/routes/(authorized)/admin/+layout.svelte -->
<!-- Pha 3 (B6.1): layout admin — Sidebar.Provider + Sidebar (brand TeamSwitcher
     + menu 7 routes admin + Settings) + Sidebar.Inset (Breadcrumb + children).
     Gate giữ nguyên ở +layout.server.ts (users:manage). Pages con giữ data flow
     riêng — layout chỉ khung điều hướng. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BreadcrumbItem } from '$components/navigation';
	import { page } from '$app/state';
	import { Breadcrumb, Sidebar, TeamSwitcher } from '$components/navigation';
	import { Separator } from '$components/element';

	let { children, data }: { children: Snippet; data: App.LayoutData } = $props();

	// ── B5: sticky header + đo chiều cao filters (page con) ──
	// ResizeObserver đo .admin-inset-header + .admin-filters (page con render
	// muộn/không có → fallback 0px) → set CSS var trên .admin-inset để sticky
	// thead DataTable + filters sticky dùng đúng chiều cao thật (không hardcode
	// — filters wrap nhiều dòng ở 375px).
	let insetHeaderEl: HTMLDivElement | undefined = $state(undefined);
	let insetEl: HTMLDivElement | undefined = $state(undefined);
	let isScrolled: boolean = $state(false);

	$effect(() => {
		if (typeof document === 'undefined' || !insetEl) return;
		const inset = insetEl;
		const headerEl = insetHeaderEl;
		const setVars = () => {
			const h = headerEl?.getBoundingClientRect().height ?? 0;
			// .admin-filters nằm trong body (page con) — đo khi đã render.
			const filtersEl = inset.querySelector<HTMLElement>('.admin-filters');
			const f = filtersEl?.getBoundingClientRect().height ?? 0;
			inset.style.setProperty('--admin-header-h', `${Math.round(h)}px`);
			inset.style.setProperty('--admin-filters-h', `${Math.round(f)}px`);
		};
		setVars();
		const ro = new ResizeObserver(setVars);
		ro.observe(headerEl ?? inset);
		// MutationObserver: page con mount/unmount (SvelteKit navigate) → đo lại.
		const mo = new MutationObserver(setVars);
		mo.observe(inset, { childList: true, subtree: true });
		return () => {
			ro.disconnect();
			mo.disconnect();
		};
	});

	// Shrink header khi cuộn (chỉ mobile ≤767px áp dụng qua CSS): scroll
	// container là div.w-full.h-full của Container root (window không cuộn).
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
		const onScroll = () => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				isScrolled = (scrollEl?.scrollTop ?? window.scrollY) > 8;
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

	// Brand đầu sidebar — TeamSwitcher 1 team (ứng dụng hiện đơn tenant; mở
	// rộng đa team sau). Tên app lấy từ session user context (fallback hằng).
	const teams = [
		{
			id: 'kit-admin',
			name: 'Kit Admin',
			abbr: 'KA',
			group: 'Hệ thống'
		}
	];
	let team = $state('kit-admin');

	// Menu 7 routes admin — active theo page.url.pathname.
	const pathname = $derived(page.url.pathname);
	const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

	// Breadcrumb derive từ route hiện tại (đơn giản: Home + tên trang).
	const routeNames: Record<string, string> = {
		'/admin': 'Người dùng',
		'/admin/brands': 'Thương hiệu',
		'/admin/categories': 'Danh mục',
		'/admin/products': 'Sản phẩm',
		'/admin/variants': 'Biến thể',
		'/admin/customers': 'Khách hàng',
		'/admin/orders': 'Đơn hàng',
		'/admin/inventory': 'Tồn kho',
		'/admin/suppliers': 'Nhà cung cấp',
		'/admin/promotions': 'Khuyến mãi',
		'/admin/stock-takes': 'Kiểm kê',
		'/admin/pos-sessions': 'Phiên POS',
		'/admin/payments': 'Thanh toán',
		'/admin/shipments': 'Vận chuyển',
		'/admin/fulfillment': 'Xử lý đơn',
		'/admin/posts': 'Bài viết',
		'/admin/post-categories': 'Danh mục bài viết',
		'/admin/campaigns': 'Chiến dịch',
		'/admin/social': 'Social media',
		'/admin/notifications': 'Thông báo',
		'/admin/messages': 'Tin nhắn',
		'/admin/email-logs': 'Email logs',
		'/admin/dashboard': 'Tổng quan',
		'/admin/expenses': 'Chi phí',
		'/admin/cameras': 'Camera',
		'/admin/purchases': 'Nhập hàng',
		'/admin/expiry': 'Hạn sử dụng',
		'/settings': 'Cấu hình hệ thống'
	};
	const crumbs = $derived<BreadcrumbItem[]>([
		{ label: 'Trang chủ', href: '/', icon: 'lucide:home' },
		{ label: routeNames[pathname] ?? 'Admin', icon: 'lucide:layout-dashboard' }
	]);
</script>

<Sidebar.Provider collapsible="icon">
	<Sidebar>
		<Sidebar.Header>
			<div class="brand-row" data-test="admin-brand-row">
				<TeamSwitcher {teams} bind:value={team} aria-label="Chọn workspace" />
			</div>
			<div class="trigger-row" data-test="admin-trigger-row">
				<Sidebar.Trigger />
			</div>
		</Sidebar.Header>

		<Sidebar.Content>
			<Sidebar.Group id="overview">
				<Sidebar.GroupLabel>Tổng quan</Sidebar.GroupLabel>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Tổng quan"
							href="/admin/dashboard"
							active={isActive('/admin/dashboard')}
							icon="lucide:layout-dashboard"
							data-test="admin-nav-dashboard"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Thanh toán"
							href="/admin/payments"
							active={isActive('/admin/payments')}
							icon="lucide:credit-card"
							data-test="admin-nav-payments"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Vận chuyển"
							href="/admin/shipments"
							active={isActive('/admin/shipments')}
							icon="lucide:package-check"
							data-test="admin-nav-shipments"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Xử lý đơn"
							href="/admin/fulfillment"
							active={isActive('/admin/fulfillment')}
							icon="lucide:package-open"
							data-test="admin-nav-fulfillment"
						/>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.Group>

			<Sidebar.Group id="catalog">
				<Sidebar.GroupLabel>Danh mục</Sidebar.GroupLabel>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Sản phẩm"
							href="/admin/products"
							active={isActive('/admin/products')}
							icon="lucide:package"
							data-test="admin-nav-products"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Biến thể"
							href="/admin/variants"
							active={isActive('/admin/variants')}
							icon="lucide:boxes"
							data-test="admin-nav-variants"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Thương hiệu"
							href="/admin/brands"
							active={isActive('/admin/brands')}
							icon="lucide:tag"
							data-test="admin-nav-brands"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Danh mục"
							href="/admin/categories"
							active={isActive('/admin/categories')}
							icon="lucide:folder-tree"
							data-test="admin-nav-categories"
						/>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.Group>

			<Sidebar.Group id="sales">
				<Sidebar.GroupLabel>Bán hàng</Sidebar.GroupLabel>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Đơn hàng"
							href="/admin/orders"
							active={isActive('/admin/orders')}
							icon="lucide:shopping-cart"
							data-test="admin-nav-orders"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Tồn kho"
							href="/admin/inventory"
							active={isActive('/admin/inventory')}
							icon="lucide:warehouse"
							data-test="admin-nav-inventory"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Nhà cung cấp"
							href="/admin/suppliers"
							active={isActive('/admin/suppliers')}
							icon="lucide:truck"
							data-test="admin-nav-suppliers"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Nhập hàng"
							href="/admin/purchases"
							active={isActive('/admin/purchases')}
							icon="lucide:package-plus"
							data-test="admin-nav-purchases"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Hạn sử dụng"
							href="/admin/expiry"
							active={isActive('/admin/expiry')}
							icon="lucide:calendar-clock"
							data-test="admin-nav-expiry"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Khuyến mãi"
							href="/admin/promotions"
							active={isActive('/admin/promotions')}
							icon="lucide:badge-percent"
							data-test="admin-nav-promotions"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Kiểm kê"
							href="/admin/stock-takes"
							active={isActive('/admin/stock-takes')}
							icon="lucide:clipboard-list"
							data-test="admin-nav-stock-takes"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Phiên POS"
							href="/admin/pos-sessions"
							active={isActive('/admin/pos-sessions')}
							icon="lucide:calculator"
							data-test="admin-nav-pos-sessions"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Khách hàng"
							href="/admin/customers"
							active={isActive('/admin/customers')}
							icon="lucide:users"
							data-test="admin-nav-customers"
						/>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.Group>

			<Sidebar.Group id="operations">
				<Sidebar.GroupLabel>Vận hành</Sidebar.GroupLabel>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Chi phí"
							href="/admin/expenses"
							active={isActive('/admin/expenses')}
							icon="lucide:receipt"
							data-test="admin-nav-expenses"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Camera"
							href="/admin/cameras"
							active={isActive('/admin/cameras')}
							icon="lucide:video"
							data-test="admin-nav-cameras"
						/>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.Group>

			<Sidebar.Group id="system">
				<Sidebar.GroupLabel>Hệ thống</Sidebar.GroupLabel>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Người dùng"
							href="/admin"
							active={isActive('/admin')}
							icon="lucide:shield-user"
							data-test="admin-nav-users"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Thông báo"
							href="/admin/notifications"
							active={isActive('/admin/notifications')}
							icon="lucide:bell"
							data-test="admin-nav-notifications"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Tin nhắn"
							href="/admin/messages"
							active={isActive('/admin/messages')}
							icon="lucide:message-square"
							data-test="admin-nav-messages"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Email logs"
							href="/admin/email-logs"
							active={isActive('/admin/email-logs')}
							icon="lucide:mail"
							data-test="admin-nav-email-logs"
						/>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.Group>

			<Sidebar.Group id="content">
				<Sidebar.GroupLabel>Nội dung</Sidebar.GroupLabel>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Bài viết"
							href="/admin/posts"
							active={isActive('/admin/posts')}
							icon="lucide:newspaper"
							data-test="admin-nav-posts"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Danh mục bài viết"
							href="/admin/post-categories"
							active={isActive('/admin/post-categories')}
							icon="lucide:tags"
							data-test="admin-nav-post-categories"
						/>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.Group>

			<Sidebar.Group id="marketing">
				<Sidebar.GroupLabel>Marketing</Sidebar.GroupLabel>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Chiến dịch"
							href="/admin/campaigns"
							active={isActive('/admin/campaigns')}
							icon="lucide:megaphone"
							data-test="admin-nav-campaigns"
						/>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							label="Social media"
							href="/admin/social"
							active={isActive('/admin/social')}
							icon="lucide:share-2"
							data-test="admin-nav-social"
						/>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.Group>
		</Sidebar.Content>

		<Sidebar.Footer>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton
						label="Cấu hình hệ thống"
						href="/settings"
						icon="lucide:settings"
						data-test="admin-nav-settings"
					/>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Footer>

		<Sidebar.Rail />
	</Sidebar>

	<Sidebar.Inset>
		<div class="admin-inset" bind:this={insetEl}>
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
			<Separator decorative />
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
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.admin-inset-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1.5rem;
		background: var(--background, #fff);

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
	.admin-mobile-trigger {
		display: none;

		@media (max-width: 767px) {
			display: inline-flex;
		}
	}

	.admin-inset-body {
		padding: 1.5rem;
		min-height: 60dvh;

		/* B5 (5a): mobile bỏ padding dày — viền tổng với .admin-page (1rem)
		   còn 1.5rem thay vì 2.5rem. */
		@media (max-width: 767px) {
			padding: 0.5rem 0.5rem 0.75rem;
		}
	}
</style>
