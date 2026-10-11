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
							label="Khách hàng"
							href="/admin/customers"
							active={isActive('/admin/customers')}
							icon="lucide:users"
							data-test="admin-nav-customers"
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
		<div class="admin-inset-header">
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
	</Sidebar.Inset>
</Sidebar.Provider>

<style lang="scss">
	.admin-inset-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1.5rem;

		/* Mobile: bỏ padding-inline — tiết kiệm chiều ngang 375px (yêu cầu user,
		   đồng bộ inset header demo /ui/sidebar). padding-block giữ. */
		@media (max-width: 767px) {
			padding-inline: 0.5rem;
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
	}
</style>
