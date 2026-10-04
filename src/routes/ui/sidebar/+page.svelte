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

	// Demo Sidebar (shadcn sidebar-07): Provider (state + context) + Sidebar (aside)
	// + Inset (main). collapsible="icon" → trigger collapse rail. Mobile (<=768px)
	// tự chuyển offcanvas (Provider đọc matchMedia).
</script>

<div class="page" data-test="sidebar-demo">
	<Sidebar.Provider collapsible="icon">
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

				<Sidebar.Group>
					<Sidebar.GroupLabel>Chính</Sidebar.GroupLabel>
					<Sidebar.Menu>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton href="/ui/sidebar" active>
								{#snippet leading()}
									<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
										<rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" />
										<rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" />
										<rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" />
										<rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" />
									</svg>
								{/snippet}
								Đashboard
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton href="/ui/select">
								{#snippet leading()}
									<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
										<path d="M6 2v2m12-2v2M9 6h6M7 12h10M7 16h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
									</svg>
								{/snippet}
								Đơn hàng
								{#snippet badge()}
									<Sidebar.MenuBadge>12</Sidebar.MenuBadge>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton href="/ui/table">
								{#snippet leading()}
									<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
										<circle cx="9" cy="9" r="5" stroke="currentColor" stroke-width="1.5" />
										<path d="m16 16 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
									</svg>
								{/snippet}
								Sản phẩm
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				</Sidebar.Group>

				<Separator decorative />

				<Sidebar.Group>
					<Sidebar.GroupLabel>Cấu hình</Sidebar.GroupLabel>
					<Sidebar.Menu>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton href="/ui/input">
								{#snippet leading()}
									<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
										<circle cx="9" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5" />
										<path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
									</svg>
								{/snippet}
								Người dùng
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton disabled>
								{#snippet leading()}
									<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
										<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5" />
										<path d="M8 12h8" stroke="currentColor" stroke-width="1.5" />
									</svg>
								{/snippet}
								Ngừng hoạt động
							</Sidebar.MenuButton>
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
				<h1 class="inset-title">Sidebar · shadcn sidebar-07</h1>
				<p class="inset-desc">
					Provider giữ <code>open / collapsed / isMobile</code> + Symbol context.
					Trigger (góc header) collapse rail về icon (collapsible="icon").
					Độ rộng 240px ↔ 72px. <code>Sidebar.Rail</code> (quai mép phải) hiện
					khi sidebar ẩn: hover → peek mở rộng tạm, tap → toggle.
					Mobile (≤768px) tự offcanvas + overlay.
				</p>

				<section class="demo-block">
					<h2>Thành phần</h2>
					<ul class="part-list">
						<li><code>Sidebar.Provider</code> — state + context (matchMedia 768px)</li>
						<li><code>Sidebar</code> — <code>&lt;aside&gt;</code> sticky 100dvh</li>
						<li><code>Sidebar.Inset</code> — main content (flex:1)</li>
						<li><code>Sidebar.Header / Content / Footer</code></li>
						<li><code>Sidebar.Group / GroupLabel / Menu / MenuItem</code></li>
						<li><code>Sidebar.MenuButton</code> — href→<code>&lt;a&gt;</code>, active→aria-current</li>
						<li><code>Sidebar.MenuBadge / Trigger / Rail</code></li>
						<li><code>Sidebar.Rail</code> — quai cạnh mép: sidebar ẩn → hiện; hover → peek</li>
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

	/* Header: brand + trigger nằm ngang */
	.brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;

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

	/* Footer user */
	.footer-user {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		min-width: 0;

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
	   PAGE nạp vào slot (brand / TeamSwitcher / footer user) phải tự ẩn text,
	   giữ lại icon/avatar và căn giữa — tránh chữ tràn ra ngoài rail.
	   (Mô hình shadcn: user bọc text trong `.text` để CSS sidebar ẩn khi collapse.)
	   PEEK (hover aside) → hiện lại. */
	:global(.sidebar-aside.sidebar-collapsed) {
		.brand {
			flex: none;

			.brand-name {
				display: none;
			}
		}

		.switcher {
			:global(.ts-name),
			:global(.ts-chevron) {
				display: none;
			}

			:global(.dropdown-menu-trigger) {
				width: auto;
				justify-content: center;
				margin-inline: auto;
			}
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

	code {
		font-size: 0.8125rem;
		background: var(--content2, hsl(240 4.76% 95.88%));
		padding: 0.125rem 0.375rem;
		border-radius: var(--border-radius-sm, 0.25rem);
	}

	@media (prefers-color-scheme: dark) {
		.inset-desc,
		.footer-email {
			color: hsl(240 5.03% 64.9%);
		}
	}
</style>
