<!-- src/routes/ui/dropdown-menu/+page.svelte -->
<script lang="ts">
	import { DropdownMenu } from '$components/element';
	import { TeamSwitcher } from '$components/navigation';
	import type { TeamSwitcherTeam } from '$components/navigation';

	// Demo DropdownMenu (shadcn dropdown-menu): Trigger + Content (role=menu) +
	// Item/Label/Separator. Keyboard: Escape (đóng + focus trigger), Tab (đóng),
	// ArrowUp/Down + Home/End (roving), Enter/Space (chọn). Outside-click đóng.
	let controlled = $state(false);
	let lastSelected = $state('—');
	let createdCount = $state(0);

	const teams: TeamSwitcherTeam[] = [
		{ id: 'acme', name: 'Acme Inc', abbr: 'AC', group: 'Công ty' },
		{ id: 'nxt', name: 'Nebula Corp', abbr: 'NB', group: 'Công ty' },
		{ id: 'mine', name: 'Của tôi', abbr: 'ME', group: 'Cá nhân' }
	];
	let team = $state('acme');
</script>

<div class="page" data-test="dm-demo">
	<h1 class="page-title">DropdownMenu · shadcn</h1>
	<p class="page-desc">
		Root giữ <code>open</code> (bindable) + Symbol context; outside-click / Escape / Tab tự đóng.
		Menu: <code>role="menu"</code> + roving focus (↑↓ Home End), item <code>role="menuitem"</code>.
	</p>

	<section class="demo">
		<h2>Cơ bản (label + separator + item)</h2>
		<div class="row" data-test="dm-basic">
			<DropdownMenu aria-label="Menu chính">
				<DropdownMenu.Trigger>
					Menu chính
					<span class="demo-chevron" aria-hidden="true">
						<svg viewBox="0 0 24 24" fill="none">
							<path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
						</svg>
					</span>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content>
					<DropdownMenu.Label>Không gian làm việc</DropdownMenu.Label>
					<DropdownMenu.Item onselect={() => (lastSelected = 'Tạo không gian')}>
						{#snippet leading()}
							<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" />
								<rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" />
								<rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" />
								<rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" />
							</svg>
						{/snippet}
						Tạo không gian
					</DropdownMenu.Item>
					<DropdownMenu.Item onselect={() => (lastSelected = 'Dán vào')}>
						Dán vào
						{#snippet trailing()}
							<span class="kbd">⌘V</span>
						{/snippet}
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item onselect={() => (lastSelected = 'Người dùng')}>
						{#snippet leading()}
							<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5" />
								<path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
							</svg>
						{/snippet}
						Người dùng
						{#snippet trailing()}
							<span class="kbd">⌘E</span>
						{/snippet}
					</DropdownMenu.Item>
					<DropdownMenu.Item disabled>Ngừng hoạt động</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu>

			<span class="picked" data-test="dm-picked">Đã chọn: {lastSelected}</span>
		</div>
	</section>

	<section class="demo">
		<h2>Align (start / center / end)</h2>
		<div class="row">
			<DropdownMenu>
				<DropdownMenu.Trigger>Căn trái</DropdownMenu.Trigger>
				<DropdownMenu.Content align="start">
					<DropdownMenu.Item onselect={() => (lastSelected = 'align start')}>Nội dung align start</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu>

			<DropdownMenu>
				<DropdownMenu.Trigger>Căn giữa</DropdownMenu.Trigger>
				<DropdownMenu.Content align="center">
					<DropdownMenu.Item onselect={() => (lastSelected = 'align center')}>Nội dung align center</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu>

			<DropdownMenu>
				<DropdownMenu.Trigger>Căn phải</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					<DropdownMenu.Item onselect={() => (lastSelected = 'align end')}>Nội dung align end</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu>
		</div>
	</section>

	<section class="demo">
		<h2>Variant destructive + inset + disabled trigger</h2>
		<div class="row">
			<DropdownMenu>
				<DropdownMenu.Trigger>Hành động</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" sideOffset={8}>
					<DropdownMenu.Item onselect={() => (lastSelected = 'Chỉnh sửa')}>
						{#snippet leading()}
							<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5" />
								<path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
							</svg>
						{/snippet}
						Chỉnh sửa
					</DropdownMenu.Item>
					<DropdownMenu.Item variant="destructive" onselect={() => (lastSelected = 'Xóa')}>
						{#snippet leading()}
							<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						{/snippet}
						Xóa
					</DropdownMenu.Item>
					<DropdownMenu.Item inset onselect={() => (lastSelected = 'inset item')}>
						Item inset
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu>

			<DropdownMenu>
				<DropdownMenu.Trigger disabled>Trigger disabled</DropdownMenu.Trigger>
				<DropdownMenu.Content>
					<DropdownMenu.Item>Không bao giờ mở</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu>
		</div>
	</section>

	<section class="demo">
		<h2>Controlled (bind:open)</h2>
		<div class="row">
			<div data-test="dm-controlled-trigger">
			<DropdownMenu bind:open={controlled}>
				<DropdownMenu.Trigger>
					{controlled ? 'Đang mở' : 'Đóng bằng trigger'}
					<span class="demo-chevron" aria-hidden="true">
						<svg viewBox="0 0 24 24" fill="none">
							<path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
						</svg>
					</span>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content>
					<DropdownMenu.Item onselect={() => (controlled = false)}>Chép email</DropdownMenu.Item>
					<DropdownMenu.Item onselect={() => (controlled = false)}>Chép link</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu>
			</div>

			<!-- Nút state (parent control): mở menu bằng state; đóng bằng trigger
				 → bind:open đồng bộ 2 chiều (menu đổi → controlled đổi) -->
			<button class="demo-btn" data-test="dm-controlled-toggle" onclick={() => (controlled = true)}>
				Mở bằng state
			</button>
		</div>
	</section>

	<section class="demo" data-test="dm-switcher-section">
		<h2>TeamSwitcher (dùng DropdownMenu)</h2>
		<div class="row">
			<TeamSwitcher
				{teams}
				bind:value={team}
				oncreate={() => (createdCount += 1)}
				aria-label="Chọn team"
			/>
			<span class="picked" data-test="dm-team-value">Team: {team}</span>
			<span class="picked" data-test="dm-team-created">Số lần tạo team: {createdCount}</span>
		</div>
	</section>

	<section class="demo" data-test="dm-mail-section">
		<h2>Menu trong khung hẹp (narrow container)</h2>
		<div class="row">
			<div class="narrow">
				<DropdownMenu>
					<DropdownMenu.Trigger>
						<span class="mail-avatar" aria-hidden="true">
							<svg viewBox="0 0 24 24" fill="none">
								<rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5" />
								<path d="m3 7 9 6 9-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
							</svg>
						</span>
						acme.io
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end">
						<DropdownMenu.Label>Tài khoản acme</DropdownMenu.Label>
						<DropdownMenu.Item onselect={() => (lastSelected = 'Nâng cấp')}>Nâng cấp</DropdownMenu.Item>
						<DropdownMenu.Item onselect={() => (lastSelected = 'Cài đặt')}>Cài đặt</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item variant="destructive" onselect={() => (lastSelected = 'Đăng xuất')}>
							Đăng xuất
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu>
			</div>
		</div>
	</section>
</div>

<style lang="scss">
	.page {
		max-width: 44rem;
		margin: 0 auto;
		padding: 2.5rem 1.5rem 4rem;
		min-height: 100dvh;
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--foreground);
		margin: 0 0 0.5rem;
	}

	.page-desc {
		color: var(--muted, var(--foreground));
		font-size: 0.875rem;
		line-height: 1.6;
		margin: 0 0 1.5rem;
	}

	.demo {
		margin-bottom: 2rem;

		h2 {
			font-size: 1rem;
			font-weight: 600;
			color: var(--foreground);
			margin: 0 0 0.75rem;
		}
	}

	.row {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.demo-chevron {
		display: inline-flex;
		width: 0.75rem;
		height: 0.75rem;
		color: var(--muted, var(--foreground));
	}

	.picked {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
	}

	.kbd {
		font-size: 0.6875rem;
		background: var(--content2, hsl(240 4.76% 95.88%));
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: 0.25rem;
		padding: 0 0.375rem;
		color: var(--foreground);
	}

	.demo-btn {
		display: inline-flex;
		align-items: center;
		min-height: 2.25rem;
		padding: 0 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--foreground);
		background: var(--content2, hsl(240 4.8% 96%));
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: 0.375rem;
		cursor: pointer;

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: 2px;
		}
	}

	.narrow {
		width: 10rem;
		border: 1px dashed var(--border, hsl(240 5.9% 90%));
		border-radius: 0.5rem;
		padding: 0.5rem;
	}

	.mail-avatar {
		display: inline-flex;
		width: 1.125rem;
		height: 1.125rem;
		color: var(--muted, var(--foreground));
	}

	code {
		font-size: 0.8125rem;
		background: var(--content2, hsl(240 4.76% 95.88%));
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}

	@media (prefers-color-scheme: dark) {
		.kbd,
		.demo-btn,
		.narrow {
			border-color: hsl(240 5.9% 20%);
		}
	}
</style>
