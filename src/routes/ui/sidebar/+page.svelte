<!-- src/routes/ui/sidebar/+page.svelte -->
<script lang="ts">
	import { Breadcrumb, Sidebar, TeamSwitcher } from '$components/navigation';
	import { Separator } from '$components/element';
	import type { TeamSwitcherTeam } from '$components/navigation';

	const teams: TeamSwitcherTeam[] = [
		{ id: 'acme', name: 'Acme Inc', abbr: 'AC', group: 'Công ty' },
		{ id: 'nxt', name: 'Nebula Corp', abbr: 'NB', group: 'Công ty' },
		{ id: 'mine', name: 'Của tôi', abbr: 'ME', group: 'Cá nhân' }
	];
	let team = $state('acme');

	// P3: tùy chọn rail (điều khiển props của Sidebar.Provider, reactive).
	//  - hideLogo: ẩn LOGO (brand) khi thu gọn → menu Y-align chuẩn (default true).
	//  - animMode: animation "streaming label" khi expand (on/off/auto; auto = PC
	//    bật + mobile tắt + tôn trọng prefers-reduced-motion).
	let hideLogo = $state(true);
	let animMode = $state<'on' | 'off' | 'auto'>('auto');

	// Demo Sidebar (shadcn sidebar-07 + P2 hoàn thiện):
	//  - collapsible="icon" → trigger collapse rail (240 ↔ 72px, hover peek)
	//  - P2: handle resize width (desktop, kéo chuột / phím mũi tên, persist
	//    localStorage 'sidebar-width', clamp 200–480)
	//  - P2: Sidebar.Search (ô tìm kiếm đầu Content) → filter item theo
	//    `match`, group tự mở (auto-expand), group/con không khớp tự ẩn
	//  - P2: MenuButton icon (iconify) + description (Tooltip khi hover)
	//  - P2: MenuGroup đệ quy — "Báo cáo" → "Kênh bán" (2 cấp, lồng snippet)
	//  - Mobile (<=768px) tự chuyển offcanvas (Provider đọc matchMedia)
</script>

<div class="page" data-test="sidebar-demo">
	<Sidebar.Provider collapsible="icon" hideLogoWhenCollapsed={hideLogo} animation={animMode}>
		<Sidebar>
			<Sidebar.Header>
				<div class="brand" data-test="sb-brand">
					<svg class="brand-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" opacity="0.15" />
						<path d="M8 8h8v8H8z" stroke="currentColor" stroke-width="1.5" />
					</svg>
					<span class="brand-name">RetailApp</span>
				</div>
				<div class="brand-actions">
					<Sidebar.Trigger />
				</div>
			</Sidebar.Header>

			<Sidebar.Content>
				<div class="switcher" data-test="sb-switcher">
					<TeamSwitcher {teams} bind:value={team} aria-label="Chọn team" />
				</div>

				<!-- P2: ô tìm kiếm menu (Input sẵn có, filter theo `match`) -->
				<div class="sb-search">
					<Sidebar.Search placeholder={{ en: 'Search menu…', vi: 'Tìm kiếm menu…' }} />
				</div>

				<Sidebar.Group id="main">
					<Sidebar.GroupLabel>Chính</Sidebar.GroupLabel>
					<Sidebar.Menu>
						<Sidebar.MenuItem match="dashboard overview home">
							<Sidebar.MenuButton
								label="Đashboard"
								href="/ui/sidebar"
								active
								icon="lucide:layout-dashboard"
								description={{ en: 'Overview of your store', vi: 'Tổng quan cửa hàng' }}
							/>
						</Sidebar.MenuItem>
						<Sidebar.MenuItem match="orders order đơn hàng cart">
							<Sidebar.MenuButton label="Đơn hàng" href="/ui/select" icon="lucide:shopping-cart"
								description={{ en: 'Manage incoming orders', vi: 'Quản lý đơn hàng vào' }}>
								{#snippet badge()}
									<Sidebar.MenuBadge>12</Sidebar.MenuBadge>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
						<Sidebar.MenuItem match="products inventory sản phẩm kho">
							<Sidebar.MenuButton label="Sản phẩm" href="/ui/table" icon="lucide:package"
								description={{ en: 'Products & inventory', vi: 'Sản phẩm và kho' }} />
						</Sidebar.MenuItem>

						<!-- P2: MenuGroup đệ quy — <li> con trực tiếp của <ul>
						     (Sidebar.Menu), cùng cấp MenuItem. Submenu tự render
						     <ul> riêng. Lồng MenuGroup "Kênh bán" (cấp 2). -->
						<Sidebar.MenuGroup
							id="reports"
							label="Báo cáo"
							icon="lucide:bar-chart-3"
						>
							<Sidebar.MenuItem match="sales doanh thu revenue">
								<Sidebar.MenuButton label="Doanh thu" href="/ui/table" icon="lucide:line-chart" />
							</Sidebar.MenuItem>
							<Sidebar.MenuItem match="inventory kho tồn kho">
								<Sidebar.MenuButton label="Tồn kho" href="/ui/table" icon="lucide:boxes" />
							</Sidebar.MenuItem>
							<Sidebar.MenuGroup id="channels" label="Kênh bán" icon="lucide:globe">
								<Sidebar.MenuItem match="website website online">
									<Sidebar.MenuButton label="Website" href="/ui/table" />
								</Sidebar.MenuItem>
								<Sidebar.MenuItem match="shopee marketplace sàn">
									<Sidebar.MenuButton label="Shopee" href="/ui/table" />
								</Sidebar.MenuItem>
								<Sidebar.MenuItem match="tiktok tiktok">
									<Sidebar.MenuButton label="TikTok" href="/ui/table" />
								</Sidebar.MenuItem>
							</Sidebar.MenuGroup>
						</Sidebar.MenuGroup>
					</Sidebar.Menu>
				</Sidebar.Group>

				<Separator decorative />

				<Sidebar.Group id="settings">
					<Sidebar.GroupLabel>Cấu hình</Sidebar.GroupLabel>
					<Sidebar.Menu>
						<Sidebar.MenuItem match="users users người dùng account">
							<Sidebar.MenuButton label="Người dùng" href="/ui/input" icon="lucide:users"
								description={{ en: 'Manage user accounts', vi: 'Quản lý tài khoản người dùng' }} />
						</Sidebar.MenuItem>
						<Sidebar.MenuItem match="disabled suspended ngừng hoạt động">
							<Sidebar.MenuButton label="Ngừng hoạt động" disabled icon="lucide:circle-minus" />
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				</Sidebar.Group>
			</Sidebar.Content>

			<Sidebar.Footer>
				<div class="footer-user">
					<span class="footer-avatar" aria-hidden="true">U</span>
					<div class="footer-meta">
						<span class="footer-name">User</span>
						<span class="footer-email">user@example.com</span>
					</div>
				</div>
			</Sidebar.Footer>

			<!-- Quai: hiện khi sidebar ẩn (collapsed/offcanvas), hover → peek mở rộng tạm -->
			<Sidebar.Rail />
		</Sidebar>

		<Sidebar.Inset>
			<!-- Content chính: Breadcrumb (derive từ URL) + Separator + body -->
			<div class="inset-header">
				<Breadcrumb />
			</div>
			<Separator decorative />
			<div class="inset-body">
				<h1 class="inset-title">Sidebar · shadcn sidebar-07 + P2</h1>
				<p class="inset-desc">
					Provider giữ <code>open / collapsed / isMobile / width / searchQuery</code>
					+ Symbol context. Trigger (góc header) collapse rail về icon (collapsible="icon").
					Độ rộng 240px ↔ 72px. <code>Sidebar.Rail</code> (quai mép phải) hiện
					khi sidebar ẩn: hover → peek mở rộng tạm, tap → toggle.
					Mobile (≤768px) tự offcanvas + overlay.
				</p>
				<p class="inset-desc">
					<b>P2</b>: kéo handle mép phải đổi độ rộng (clamp 200–480, persist
					<code>localStorage['sidebar-width']</code>, phím ← → ±16px khi focus).
					Ô tìm kiếm filter item theo <code>match</code>, group tự mở/khép.
					MenuGroup đệ quy ("Báo cáo" → "Kênh bán", lồng không giới hạn cấp).
					MenuItem có <code>icon</code> (iconify) + <code>description</code>
					(Tooltip khi hover, chỉ desktop + sidebar mở).
				</p>

				<!-- P3: điều khiển rail (ẩn logo + animation streaming label) -->
				<section class="demo-block" data-test="sb-p3-controls">
					<h2>Rail (thu gọn) — P3</h2>
					<p class="inset-desc">
						Bấm trigger góc header để thu gọn về icon rail (72px), rồi chỉnh:
					</p>
					<div class="p3-row">
						<label class="p3-toggle">
							<input
								type="checkbox"
								checked={hideLogo}
								onchange={(e) => (hideLogo = e.currentTarget.checked)}
								data-test="sb-hide-logo"
							/>
							<span>Ẩn LOGO khi thu gọn</span>
							<small>Off → giữ logo; On → menu item căn thẳng trục Y</small>
						</label>
					</div>
					<div class="p3-row">
						<span class="p3-label">Animation label (khi mở rộng)</span>
						<div class="p3-seg" role="group" data-test="sb-anim-seg">
							{#each (['auto', 'on', 'off'] as const) as mode (mode)}
								<button
									type="button"
									class:p3-on={animMode === mode}
									aria-pressed={animMode === mode}
									onclick={() => (animMode = mode)}
									data-test="sb-anim-{mode}"
								>
									{mode}
								</button>
							{/each}
						</div>
						<small class="p3-hint">
							auto = PC bật + mobile tắt + tôn trọng reduced-motion
						</small>
					</div>
				</section>

				<section class="demo-block">
					<h2>Thành phần</h2>
					<ul class="part-list">
						<li><code>Sidebar.Provider</code> — state + context (matchMedia 768px, width resize)</li>
						<li><code>Sidebar</code> — <code>&lt;aside&gt;</code> sticky 100dvh</li>
						<li><code>Sidebar.Inset</code> — main content (flex:1)</li>
						<li><code>Sidebar.Header / Content / Footer</code></li>
						<li><code>Sidebar.Group / GroupLabel / Menu / MenuItem</code></li>
						<li><code>Sidebar.MenuButton</code> — href→<code>&lt;a&gt;</code>, active→aria-current, icon + description</li>
						<li><code>Sidebar.MenuGroup</code> — nút cha + submenu đệ quy (lồng không giới hạn)</li>
						<li><code>Sidebar.MenuBadge / Trigger / Rail</code></li>
						<li><code>Sidebar.Rail</code> — quai cạnh mép: sidebar ẩn → hiện; hover → peek</li>
						<li><code>Sidebar.Search</code> — tìm kiếm menu (Input, filter + auto-expand)</li>
						<li><code>Sidebar.ResizeHandle</code> — kéo width (pointer capture, persist localStorage)</li>
					</ul>
				</section>

				<section class="demo-block">
					<h2>Breadcrumb (từ <code>$app/state</code> page.url)</h2>
					<Breadcrumb items={[
						{ label: { en: 'Home', vi: 'Trang chủ' }, href: '/' },
						{ label: 'UI', href: '/ui' },
						{ label: 'API', href: 'https://example.com/api' },
						{ label: 'Sidebar' }
					]} />
				</section>
			</div>
		</Sidebar.Inset>
	</Sidebar.Provider>
</div>

<style lang="scss">
	.page {
		min-height: 100dvh;
	}

	/* Wave10: 3 section (header/content/footer) không còn padding-inline —
	   nội dung con tự mang spacing riêng (item tự có spacing, section "flush"). */
	.brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
		padding-inline: 0.75rem;

		.brand-icon {
			width: 1.5rem;
			height: 1.5rem;
			flex-shrink: 0;
			color: var(--primary, var(--foreground));
		}

		.brand-name {
			font-weight: 700;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}

	.brand-actions {
		display: flex;
		align-items: center;
	}

	/* Team switcher (trên menu) */
	.switcher {
		width: 100%;
		padding: 0.5rem 0.75rem;
		margin-bottom: 0.5rem;

		:global(.dropdown-menu-trigger) {
			width: 100%;
			font-weight: 600;
		}
	}

	/* P2: ô tìm kiếm — padding bám hệ thống (đồng bộ switcher/group) */
	.sb-search {
		width: 100%;
		padding: 0 0.75rem;
		margin-bottom: 0.5rem;
	}

	/* Footer user — Wave10: section không còn padding-inline → user menu tự mang
	   spacing (padding-inline 0.75rem, đồng bộ brand/search/switcher). */
	.footer-user {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		min-width: 0;
		padding-inline: 0.75rem;

		.footer-avatar {
			width: 2rem;
			height: 2rem;
			border-radius: 50%;
			flex-shrink: 0;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			background: var(--primary, var(--foreground));
			color: var(--background, #fff);
			font-size: 0.75rem;
			font-weight: 600;
		}

		.footer-meta {
			display: flex;
			flex-direction: column;
			min-width: 0;
		}

		.footer-name {
			font-size: 0.875rem;
			font-weight: 500;
			color: var(--foreground);
		}

		.footer-email {
			font-size: 0.75rem;
			color: var(--muted, var(--foreground));
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}

	/* COLLAPSED (icon rail 72px): component Sidebar chỉ ẩn label menu; nội dung
	   PAGE nạp vào slot (brand / TeamSwitcher / search / footer user) phải tự ẩn
	   text, giữ lại icon/avatar và căn giữa — tránh chữ tràn ra ngoài rail.
	   (Mô hình shadcn: user bọc text trong `.text` để CSS sidebar ẩn khi collapse.)
	   PEEK (hover aside) → hiện lại. Search: rail hẹp (72px) không đủ chỗ →
	   ẩn cả ô, hiện lại khi peek. */
	:global(.sidebar-aside.sidebar-collapsed) {
		.brand {
			flex: none;

			.brand-name {
				display: none;
			}
		}

		.switcher {
			/* P3: bỏ padding ngang (0.75rem) khi rail → trigger 48px cùng cột
			   với menu button (cũng 48px) → hover-background + avatar nhất quán. */
			padding-inline: 0;

			:global(.ts-name),
			:global(.ts-chevron) {
				display: none;
			}

			/* P3: CĂN CHUẨN tâm rail. Root cause: .team-switcher/.dropdown-menu-trigger
			   là inline-flex (inline-level) → `margin-inline: auto` VÔ HIỆU, avatar
			   dính lề trái → lệch khỏi tâm rail (x=36). Ép width 100% (block) +
			   justify-content center → avatar 1.5rem căn đúng tâm 72px rail, thẳng
			   trục Y với icon menu. */
			:global(.team-switcher) {
				display: block;
				width: 100%;
			}

			:global(.dropdown-menu-trigger) {
				width: 100%;
				justify-content: center;
			}
		}

		/* Rail 72px: ô search không đủ chỗ → ẩn hẳn (peek sẽ hiện lại) */
		.sb-search {
			display: none;
		}

		.footer-user {
			width: auto;
			margin-inline: auto;
			justify-content: center;
		}

		.footer-meta {
			display: none;
		}
	}

	/* PEEK: hover khi collapsed → trở lại layout đầy đủ (đồng bộ với rule
	   .sidebar-collapsed:hover của _styles.scss cho label menu). */
	:global(.sidebar-aside.sidebar-collapsed:hover) {
		.brand {
			flex: 1;

			.brand-name {
				display: block;
			}
		}

		.switcher {
			:global(.ts-name) {
				display: block;
			}

			:global(.ts-chevron) {
				display: inline-flex;
			}

			:global(.dropdown-menu-trigger) {
				width: 100%;
				justify-content: flex-start;
				margin-inline: 0;
			}
		}

		.footer-user {
			width: 100%;
			margin-inline: 0;
			justify-content: flex-start;
		}

		.footer-meta {
			display: flex;
		}
	}

	/* Inset: header (breadcrumb) + body scroll */
	.inset-header {
		padding: 1rem 1.5rem 0;
	}

	.inset-body {
		padding: 1.5rem;
	}

	.inset-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--foreground);
		margin: 0 0 0.5rem;
	}

	.inset-desc {
		color: var(--muted, var(--foreground));
		font-size: 0.875rem;
		line-height: 1.6;
		margin: 0 0 1.5rem;

		code {
			font-size: 0.8125rem;
			background: var(--content2, hsl(240 4.76% 95.88%));
			padding: 0.125rem 0.375rem;
			border-radius: var(--border-radius-sm, 0.25rem);
		}
	}

	.demo-block {
		margin-bottom: 1.5rem;

		h2 {
			font-size: 1rem;
			font-weight: 600;
			color: var(--foreground);
			margin: 0 0 0.75rem;
		}
	}

	/* P3: panel điều khiển rail (ẩn logo + animation mode) */
	.p3-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;

		.p3-label {
			font-size: 0.875rem;
			color: var(--foreground);
			min-width: 11rem;
		}

		.p3-hint {
			font-size: 0.75rem;
			color: var(--muted, var(--foreground));
		}
	}

	.p3-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--foreground);
		cursor: pointer;

		input[type='checkbox'] {
			width: 1rem;
			height: 1rem;
			accent-color: var(--primary, var(--color-indigo-500, hsl(243 75% 59%)));
			cursor: pointer;
		}

		small {
			color: var(--muted, var(--foreground));
		}
	}

	/* Segmented control (auto/on/off) — style bám design system (content2 + primary) */
	.p3-seg {
		display: inline-flex;
		border: 1px solid var(--border, hsl(0 0% 88%));
		border-radius: var(--border-radius-sm, 0.375rem);
		overflow: hidden;

		@media (prefers-color-scheme: dark) {
			border-color: var(--border, hsl(0 0% 24%));
		}

		button {
			padding: 0.25rem 0.75rem;
			font-size: 0.8125rem;
			color: var(--foreground);
			background: transparent;
			border: 0;
			cursor: pointer;
			transition: background-color var(--transition-duration, 150ms) ease;

			&:not(:first-child) {
				border-left: 1px solid var(--border, hsl(0 0% 88%));
			}

			&.p3-on {
				background: var(--primary, var(--color-indigo-500, hsl(243 75% 59%)));
				color: var(--background, #fff);
			}
		}
	}

	.part-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;

		li {
			font-size: 0.875rem;
			color: var(--foreground);
		}

		code {
			font-size: 0.8125rem;
			background: var(--content2, hsl(240 4.76% 95.88%));
			padding: 0.125rem 0.375rem;
			border-radius: var(--border-radius-sm, 0.25rem);
		}
	}

	@media (prefers-color-scheme: dark) {
		.inset-desc,
		.footer-email {
			color: hsl(240 5.03% 64.9%);
		}
	}
</style>
