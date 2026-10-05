<!-- src/routes/ui/popover/+page.svelte -->
<script lang="ts">
	// Demo Popover (shadcn popover): 4 case — click + form, hover intent,
	// position start/end/center, controlled (bind:open + outside button).
	// Import TRỰC TIẾP component (barrel element/index.ts do PM tích hợp).
	import { Popover } from '$components/element/popover';

	let nickname = $state('alptang');
	let saved = $state(false);

	let controlledOpen = $state(false);
</script>

<div class="page" data-test="popover-demo">
	<h1 class="page-title">Popover · shadcn</h1>
	<p class="page-desc">
		Root giữ <code>open</code> (bindable) + Symbol context; content <code>role="dialog"</code> render
		absolute bên dưới trigger (KHÔNG portal). Escape / outside-click tự đóng + focus trả trigger.
		Trigger = span bọc control user (button/link).
	</p>

	<section class="demo" data-test="pv-click">
		<h2>Click + form nhỏ (trigger mặc định)</h2>
		<p class="demo-hint">
			Click nút “Thiết lập” → panel mở, focus tự về input tên. Click “Lưu” → đóng + focus trả trigger.
			Click ngoài / Escape cũng đóng.
		</p>
		<Popover>
			<Popover.Trigger>
				<button class="demo-btn">Thiết lập</button>
			</Popover.Trigger>
			<Popover.Content aria-label="Thiết lập">
				<div class="pv-form" style:width="20rem">
					<h3 class="pv-form-title">Chỉnh sửa hồ sơ</h3>
					<label class="pv-field" for="pv-input-nick">
						Nickname
						<input id="pv-input-nick" class="pv-input" type="text" bind:value={nickname} />
					</label>
					<label class="pv-field" for="pv-input-bio">
						Mô tả ngắn
						<input id="pv-input-bio" class="pv-input" type="text" placeholder="Ví dụ: Front-end dev" />
					</label>
					<button
						class="demo-btn demo-btn-primary"
						data-test="pv-save"
						onclick={() => (saved = true)}
					>
						Lưu
					</button>
				</div>
			</Popover.Content>
		</Popover>
		{#if saved}
			<span class="picked" data-test="pv-saved">Đã lưu nickname: {nickname}</span>
		{/if}
	</section>

	<section class="demo" data-test="pv-hover">
		<h2>Hover intent (delay show 200ms / hide 150ms)</h2>
		<p class="demo-hint">
			Đưa chuột vào nút → panel hiện sau 200ms; đưa chuột ra → ẩn sau 150ms. Đưa chuột
			<b>vào panel</b> để đọc (không tự tắt ngay khi rời trigger).
		</p>
		<Popover trigger="hover">
			<Popover.Trigger>
				<button class="demo-btn">Bấm giữ chuột đây (hover)</button>
			</Popover.Trigger>
			<Popover.Content aria-label="Thông tin phiên bản">
				<div class="pv-hover-body">
					<strong>Version</strong>
					<span class="pv-mono">kit-3 · 0.4.2</span>
					<p class="demo-hint">Bản ổn định — build 2026-10-04.</p>
				</div>
			</Popover.Content>
		</Popover>
	</section>

	<section class="demo" data-test="pv-position">
		<h2>Position (start / end / center)</h2>
		<p class="demo-hint">Căn panel theo cạnh trigger: start (trái), end (phải), center (giữa).</p>
		<div class="row">
			<Popover position="start">
				<Popover.Trigger>
					<button class="demo-btn">Start</button>
				</Popover.Trigger>
				<Popover.Content aria-label="Position start">
					<span>Panel căn <b>trái</b> (start)</span>
				</Popover.Content>
			</Popover>

			<Popover position="end">
				<Popover.Trigger>
					<button class="demo-btn">End</button>
				</Popover.Trigger>
				<Popover.Content aria-label="Position end">
					<span>Panel căn <b>phải</b> (end)</span>
				</Popover.Content>
			</Popover>

			<Popover position="center">
				<Popover.Trigger>
					<button class="demo-btn">Center</button>
				</Popover.Trigger>
				<Popover.Content aria-label="Position center">
					<span>Panel căn <b>giữa</b> (center)</span>
				</Popover.Content>
			</Popover>
		</div>
	</section>

	<section class="demo" data-test="pv-disabled">
		<h2>Disabled (trigger bị vô hiệu)</h2>
		<p class="demo-hint">
			Trigger disabled → click không mở (guard JS) + cursor not-allowed (CSS `.disabled`).
		</p>
		<div class="row">
			<Popover>
				<Popover.Trigger disabled>
					<button class="demo-btn" data-test="pv-disabled-trigger-btn">
						Thiết lập (bị khóa)
					</button>
				</Popover.Trigger>
				<Popover.Content aria-label="Disabled content">
					<span>Không thể mở khi trigger disabled.</span>
				</Popover.Content>
			</Popover>
		</div>
	</section>

	<section class="demo" data-test="pv-controlled">
		<h2>Controlled (bind:open)</h2>
		<p class="demo-hint">Nút ngoài mở/đóng bằng state — panel không tự quản lý open.</p>
		<div class="row">
			<Popover bind:open={controlledOpen}>
				<Popover.Trigger>
					<button class="demo-btn" data-test="pv-controlled-trigger">
						Trigger ({controlledOpen ? 'mở' : 'đóng'})
					</button>
				</Popover.Trigger>
				<Popover.Content aria-label="Controlled content">
					<div class="pv-hover-body">
						<strong>Panel controlled</strong>
						<p class="demo-hint">Open = {String(controlledOpen)} (state của page)</p>
						<button class="demo-btn" data-test="pv-controlled-close" onclick={() => (controlledOpen = false)}>
							Đóng
						</button>
					</div>
				</Popover.Content>
			</Popover>

			<button
				class="demo-btn"
				data-test="pv-controlled-toggle"
				onclick={() => (controlledOpen = !controlledOpen)}
			>
				{controlledOpen ? 'Đóng bằng state' : 'Mở bằng state'}
			</button>
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
		position: relative; // tránh panel absolute bị overflow clip của section

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
		margin-left: 0.75rem;
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
		border-radius: var(--border-radius-md, 0.375rem);
		cursor: pointer;

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: 2px;
		}

		&.demo-btn-primary {
			background: var(--color-indigo-600, hsl(243 75% 59%));
			border-color: var(--color-indigo-600, hsl(243 75% 59%));
			color: #fff;
		}
	}

	.pv-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.pv-form-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}

	.pv-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
	}

	.pv-input {
		min-height: 2.25rem;
		padding: 0 0.625rem;
		font-size: 0.875rem;
		color: var(--foreground);
		background: var(--background, #fff);
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: var(--border-radius-sm, 0.25rem);

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: 1px;
		}
	}

	.pv-hover-body {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.875rem;
		color: var(--foreground);

		strong {
			font-weight: 600;
		}
	}

	.pv-mono {
		font-family: monospace;
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
	}

	@media (prefers-color-scheme: dark) {
		.demo-btn,
		.pv-input {
			border-color: hsl(240 5.9% 20%);
		}
	}
</style>
