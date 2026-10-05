<!-- src/routes/ui/hover-card/+page.svelte -->
<script lang="ts">
	// Demo HoverCard (shadcn hover-card): 2 case — danh sách user (hover avatar +
	// tên → card name/role/email + follow button), hover link code snippet → card
	// hiện code block. Import TRỰC TIẾP component (barrel element/index.ts do PM
	// tích hợp).
	import { HoverCard } from '$components/element/hover-card';

	interface DemoUser {
		id: string;
		name: string;
		role: string;
		email: string;
		abbr: string;
	}

	const users: DemoUser[] = [
		{ id: 'u1', name: 'Alptang Trần', role: 'Front-end Engineer', email: 'alptang@kit.dev', abbr: 'AT' },
		{ id: 'u2', name: 'Linh Phạm', role: 'Design Engineer', email: 'linh@kit.dev', abbr: 'LP' },
		{ id: 'u3', name: 'Minh Nguyễn', role: 'Full-stack Engineer', email: 'minh@kit.dev', abbr: 'MN' }
	];

	let followed = $state<string[]>([]);
	function toggleFollow(id: string) {
		followed = followed.includes(id) ? followed.filter((x) => x !== id) : [...followed, id];
	}
</script>

<div class="page" data-test="hovercard-demo">
	<h1 class="page-title">HoverCard · shadcn</h1>
	<p class="page-desc">
		Root giữ <code>open</code> (bindable) + intent timers (show 300ms / hide 150ms). Trigger = span
		bọc control user. Content <code>role="tooltip"</code> absolute bên dưới (KHÔNG portal, KHÔNG
		focus trap). Đưa chuột vào card để đọc (keep-alive). ESC → ẩn.
	</p>

	<section class="demo" data-test="hc-list">
		<h2>Hover user (danh sách 3 user)</h2>
		<p class="demo-hint">Đưa chuột lên mỗi user → card hiện name + role + email + nút Theo dõi.</p>
		<ul class="user-list">
			{#each users as user (user.id)}
				<li>
					<HoverCard>
						<HoverCard.Trigger>
							<button class="user-btn" data-test="hc-user-{user.id}">
								<span class="avatar" aria-hidden="true">{user.abbr}</span>
								<span class="user-name">{user.name}</span>
							</button>
						</HoverCard.Trigger>
						<HoverCard.Content aria-label="Thông tin {user.name}">
							<div class="hc-card">
								<div class="hc-head">
									<span class="avatar avatar-lg" aria-hidden="true">{user.abbr}</span>
									<div class="hc-meta">
										<strong>{user.name}</strong>
										<span class="hc-role">{user.role}</span>
									</div>
								</div>
								<span class="hc-email">{user.email}</span>
								<button
									class="hc-follow"
									data-test="hc-follow-{user.id}"
									onclick={() => toggleFollow(user.id)}
								>
									{followed.includes(user.id) ? 'Đang theo dõi' : 'Theo dõi'}
								</button>
							</div>
						</HoverCard.Content>
					</HoverCard>
				</li>
			{/each}
		</ul>
		<span class="picked" data-test="hc-followed">Đã theo dõi: {followed.length ? followed.join(', ') : '—'}</span>
	</section>

	<section class="demo" data-test="hc-code">
		<h2>Hover link code snippet</h2>
		<p class="demo-hint">Đưa chuột lên link “Xem ví dụ” → card hiện code block.</p>
		<div class="row">
			<HoverCard>
				<HoverCard.Trigger>
					<a class="code-link" href="#hc-code-example" data-test="hc-code-trigger">Xem ví dụ sử dụng</a>
				</HoverCard.Trigger>
				<HoverCard.Content aria-label="Code example">
					<div class="hc-card">
						<!-- code sample: entity &lt;/&gt; + TRÁNH curly-brace (Svelte compile
						 `{...}` trong text thành expression → runtime error) -->
					<pre class="hc-code"><code>&lt;Popover trigger="hover"&gt;
  &lt;Popover.Trigger&gt;
    &lt;button&gt;Hover&lt;/button&gt;
  &lt;/Popover.Trigger&gt;
  &lt;Popover.Content&gt;Panel&lt;/Popover.Content&gt;
&lt;/Popover&gt;</code></pre>
					</div>
				</HoverCard.Content>
			</HoverCard>
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
		position: relative;

		h2 {
			font-size: 1rem;
			font-weight: 600;
			color: var(--foreground);
			margin: 0 0 0.375rem;
		}
	}

	.demo-hint {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
		margin: 0 0 0.75rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.picked {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
		margin-top: 0.5rem;
	}

	// Horizontal row (layout chuẩn shadcn hover-card): card mở bên dưới user 1
	// KHÔNG che user 2/3 (cùng hàng ngang) — dễ soi screenshot.
	.user-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: row;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.user-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.25rem;
		padding: 0 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--foreground);
		background: transparent;
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: var(--border-radius-md, 0.375rem);
		cursor: pointer;

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: 2px;
		}
	}

	.avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--content2-foreground, #18181b);
		background: var(--content2, hsl(240 4.8% 96%));
		border-radius: 50%;

		&.avatar-lg {
			width: 2.75rem;
			height: 2.75rem;
			font-size: 0.875rem;
		}
	}

	.user-name {
		color: var(--foreground);
	}

	.code-link {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-indigo-600, hsl(243 75% 59%));
		text-decoration: underline;
		text-underline-offset: 2px;

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: 2px;
			border-radius: 0.125rem;
		}
	}

	.hc-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 16rem;
		color: var(--foreground);
	}

	.hc-head {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.hc-meta {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;

		strong {
			font-weight: 600;
			font-size: 0.875rem;
		}
	}

	.hc-role {
		font-size: 0.75rem;
		color: var(--muted, var(--foreground));
	}

	.hc-email {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
	}

	.hc-follow {
		align-self: flex-start;
		min-height: 1.875rem;
		padding: 0 0.625rem;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--foreground);
		background: var(--content2, hsl(240 4.8% 96%));
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: var(--border-radius-sm, 0.25rem);
		cursor: pointer;

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: 2px;
		}
	}

	.hc-code {
		margin: 0;
		padding: 0.625rem;
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--content2-foreground, #18181b);
		background: var(--content2, hsl(240 4.8% 96%));
		border-radius: var(--border-radius-sm, 0.25rem);
		overflow-x: auto;
		white-space: pre;
	}

	@media (prefers-color-scheme: dark) {
		.user-btn,
		.hc-follow {
			border-color: hsl(240 5.9% 20%);
		}
	}
</style>
