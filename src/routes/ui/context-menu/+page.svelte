<!-- src/routes/ui/context-menu/+page.svelte -->
<script lang="ts">
	// Demo ContextMenu (shadcn context-menu): right-click trên target → menu fixed
	// tại điểm chuột (clamp viewport). 3 case: bảng user (1 menu chung, label theo
	// row click), image card, disabled items. Log action vào <pre data-test="cm-log">.
	import { ContextMenu } from '$components/element';

	const users = [
		{ id: 1, name: 'Anh Tuấn', email: 'anh.tuan@acme.io' },
		{ id: 2, name: 'Minh Khoa', email: 'minh.khoa@acme.io' },
		{ id: 3, name: 'Thu Hà', email: 'thu.ha@acme.io' },
		{ id: 4, name: 'Quốc Bảo', email: 'quoc.bao@acme.io' }
	];

	// Row bị right-click (label menu "User N" theo target).
	let activeUser = $state(0);
	let log = $state<string[]>([]);
	let lastAction = $state('—');

	function pushLog(msg: string) {
		log = [msg, ...log].slice(0, 5);
		lastAction = msg;
	}

	const userName = $derived(activeUser ? `User ${activeUser} · ${users[activeUser - 1].name}` : '—');
</script>

<div class="page" data-test="contextmenu-demo">
	<h1 class="page-title">ContextMenu · shadcn</h1>
	<p class="page-desc">
		Right-click (chữ A phải) lên bảng / hình / ô → menu <code>role="menu"</code> fixed tại điểm
		chuột, clamp viewport. Item <code>role="menuitem"</code> + roving focus (↑↓ Home End),
		Escape / Tab / outside-click tự đóng.
	</p>

	<section class="demo" data-test="cm-users">
		<h2>Bảng user (1 menu chung — label theo row click)</h2>
		<p class="demo-hint">Right-click vào 1 dòng → label hiện "User N".</p>
		<ContextMenu aria-label="Menu user">
			<div class="table-area" role="list">
				{#each users as u, i (u.id)}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex (target nhận focus khi menu đóng) -->
					<div
						role="listitem"
						class="row"
						data-user={i + 1}
						tabindex="0"
						oncontextmenu={() => (activeUser = i + 1)}
					>
						<span class="row-name">{u.name}</span>
						<span class="row-email">{u.email}</span>
					</div>
				{/each}
			</div>
			<ContextMenu.Content>
				<ContextMenu.Label>{userName}</ContextMenu.Label>
				<ContextMenu.Separator />
				<ContextMenu.Item
					icon="lucide:copy"
					onselect={() =>
						pushLog(`users: Copy ${users[activeUser - 1]?.email ?? '—'} → clipboard`)}
				>
					Sao chép
				</ContextMenu.Item>
				<ContextMenu.Item icon="lucide:pencil" onselect={() => pushLog(`users: Edit ${userName}`)}>
					Chỉnh sửa
				</ContextMenu.Item>
				<ContextMenu.Item
					destructive
					icon="lucide:trash-2"
					onselect={() => pushLog(`users: Delete ${userName}`)}
				>
					Xóa
				</ContextMenu.Item>
			</ContextMenu.Content>
		</ContextMenu>
	</section>

	<section class="demo" data-test="cm-image">
		<h2>Image card</h2>
		<p class="demo-hint">Right-click vào card → menu hành động ảnh.</p>
		<ContextMenu aria-label="Menu ảnh">
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (target nhận focus khi menu đóng) -->
			<div class="image-card" tabindex="0">
				<div class="image-ph" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none">
						<rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.5" />
						<circle cx="9" cy="10" r="1.75" fill="currentColor" />
						<path d="m3 17 5-4 4 3 4-5 5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</div>
				<span class="image-name">product-hero.png</span>
			</div>
			<ContextMenu.Content>
				<ContextMenu.Label>product-hero.png</ContextMenu.Label>
				<ContextMenu.Separator />
				<ContextMenu.Item icon="lucide:maximize" onselect={() => pushLog('image: View full')}>Xem toàn bộ</ContextMenu.Item>
				<ContextMenu.Item icon="lucide:download" onselect={() => pushLog('image: Download')}>Tải xuống</ContextMenu.Item>
				<ContextMenu.Item destructive icon="lucide:trash-2" onselect={() => pushLog('image: Remove')}>Xóa ảnh</ContextMenu.Item>
			</ContextMenu.Content>
		</ContextMenu>
	</section>

	<section class="demo" data-test="cm-disabled">
		<h2>Disabled item</h2>
		<p class="demo-hint">Right-click → "Lưu bản sao" bị disabled (aria-disabled, không activate).</p>
		<ContextMenu aria-label="Menu tài liệu">
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (target nhận focus khi menu đóng) -->
			<div class="disabled-box" tabindex="0">
				document.pdf — 2.4 MB
			</div>
			<ContextMenu.Content>
				<ContextMenu.Label>document.pdf</ContextMenu.Label>
				<ContextMenu.Separator />
				<ContextMenu.Item icon="lucide:copy" onselect={() => pushLog('disabled: Copy link')}>Sao chép link</ContextMenu.Item>
				<ContextMenu.Item disabled icon="lucide:save">Lưu bản sao</ContextMenu.Item>
				<ContextMenu.Item icon="lucide:archive" onselect={() => pushLog('disabled: Archive')}>Lưu trữ</ContextMenu.Item>
			</ContextMenu.Content>
		</ContextMenu>
	</section>

	<section class="demo">
		<h2>Log action</h2>
		<div class="log" data-test="cm-log" data-last={lastAction}>
			{#each log as msg, i (i + msg)}
				<div class="log-line">{msg}</div>
			{:else}
				<div class="log-line log-empty">Chưa có action nào — right-click thử!</div>
			{/each}
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
			margin: 0 0 0.5rem;
		}
	}

	.demo-hint {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
		margin: 0 0 0.75rem;
	}

	.table-area {
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: var(--border-radius-md, 0.375rem);
		overflow: hidden;

		@media (prefers-color-scheme: dark) {
			border-color: hsl(240 5.9% 20%);
		}
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.625rem 0.75rem;
		font-size: 0.875rem;
		color: var(--foreground);
		background: var(--background, #fff);
		border-bottom: 1px solid var(--border, hsl(240 5.9% 90%));
		cursor: context-menu;
		user-select: none;

		&:last-child {
			border-bottom: 0;
		}

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: -2px;
		}

		.row-name {
			font-weight: 500;
		}

		.row-email {
			color: var(--muted, var(--foreground));
			font-size: 0.8125rem;
		}

		@media (hover: hover) and (pointer: fine) {
			&:hover {
				background-color: var(--content2, hsl(240 4.8% 96%));
			}
		}

		@media (prefers-color-scheme: dark) {
			border-bottom-color: hsl(240 5.9% 20%);
		}
	}

	.image-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: var(--border-radius-md, 0.375rem);
		background: var(--background, #fff);
		cursor: context-menu;
		user-select: none;
		width: fit-content;

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: 2px;
		}

		.image-ph {
			display: inline-flex;
			width: 2.5rem;
			height: 2.5rem;
			flex-shrink: 0;
			align-items: center;
			justify-content: center;
			border-radius: 0.375rem;
			background: var(--content2, hsl(240 4.8% 96%));
			color: var(--muted, var(--foreground));

			svg {
				width: 1.375rem;
				height: 1.375rem;
			}
		}

		.image-name {
			font-size: 0.875rem;
			color: var(--foreground);
		}

		@media (prefers-color-scheme: dark) {
			border-color: hsl(240 5.9% 20%);
		}
	}

	.disabled-box {
		padding: 0.75rem;
		font-size: 0.875rem;
		color: var(--foreground);
		border: 1px dashed var(--border, hsl(240 5.9% 90%));
		border-radius: var(--border-radius-md, 0.375rem);
		cursor: context-menu;
		user-select: none;
		width: fit-content;

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: 2px;
		}

		@media (prefers-color-scheme: dark) {
			border-color: hsl(240 5.9% 20%);
		}
	}

	.log {
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: var(--border-radius-md, 0.375rem);
		padding: 0.5rem 0.75rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.75rem;
		line-height: 1.6;
		color: var(--muted, var(--foreground));
		background: var(--content2, hsl(240 4.8% 96%));

		.log-empty {
			opacity: 0.7;
		}

		@media (prefers-color-scheme: dark) {
			border-color: hsl(240 5.9% 20%);
		}
	}

	code {
		font-size: 0.8125rem;
		background: var(--content2, hsl(240 4.76% 95.88%));
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}
</style>
