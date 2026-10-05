<!-- src/routes/ui/alert-dialog/+page.svelte -->
<script lang="ts">
	// Demo AlertDialog (shadcn AlertDialog) — dialog DẠNG XÁC NHẬN.
	// 3 case: (a) danger trigger, (b) controlled (bind:open), (c) info variant.
	import { AlertDialog, Icon } from '$components/element';
	import { iconify } from '$assets/icons/iconify';

	// (a) — action click ghi log "deleted: X".
	const product = $state('MacBook Air M3');
	let adLog = $state('');

	// (b) — controlled bằng code (bind:open).
	let controlledOpen = $state(false);
</script>

<div class="page" data-test="alertdialog-demo">
	<h1 class="page-title">AlertDialog · shadcn</h1>
	<p class="page-desc">
		Dialog xác nhận: <code>role="alertdialog"</code> + focus trap 2 nút (Action ↔ Cancel),
		Escape đóng, click nền <strong>không</strong> đóng. Root giữ <code>open</code> (bindable).
	</p>

	<!-- (a) DANGER trigger -->
	<section class="demo">
		<h2>Xác nhận xóa (danger)</h2>
		<div class="row">
			<AlertDialog data-test="ad-danger">
				<AlertDialog.Trigger>
					<button class="demo-btn danger">Xóa sản phẩm</button>
				</AlertDialog.Trigger>
				<AlertDialog.Content>
					<AlertDialog.Header variant="danger">
						{#snippet leading()}
							<Icon icon={iconify['warning-outline-rounded']} class="ad-icon" />
						{/snippet}
						<AlertDialog.Title>Xóa sản phẩm?</AlertDialog.Title>
						<AlertDialog.Description>
							Thao tác này không thể hoàn tác. {product} sẽ bị xóa khỏi hệ thống vĩnh viễn.
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Hủy</AlertDialog.Cancel>
						<AlertDialog.Action onselect={() => (adLog = `deleted: ${product}`)}>Xóa</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog>

			<pre class="log" data-test="ad-log">{adLog || 'chưa thao tác'}</pre>
		</div>
	</section>

	<!-- (b) CONTROLLED (bind:open) -->
	<section class="demo">
		<h2>Controlled (bind:open)</h2>
		<div class="row" data-test="ad-controlled">
			<AlertDialog bind:open={controlledOpen} title="Xác nhận (controlled)" description="Mở bằng state, không cần Trigger.">
				<AlertDialog.Content>
					<AlertDialog.Header variant="danger">
						<AlertDialog.Title>Xác nhận (controlled)</AlertDialog.Title>
						<AlertDialog.Description>
							Dialog này mở bằng <code>bind:open</code>. Bấm "Mở/Đóng" để điều khiển.
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel data-test="ad-controlled-cancel">Đóng</AlertDialog.Cancel>
						<AlertDialog.Action onselect={() => (adLog = 'controlled: confirmed')}>Xác nhận</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog>

			<button class="demo-btn" data-test="ad-controlled-open" onclick={() => (controlledOpen = true)}>
				Mở dialog (mở)
			</button>
			<button class="demo-btn" data-test="ad-controlled-close" onclick={() => (controlledOpen = false)}>
				Đóng (đóng)
			</button>
			<span class="state" data-test="ad-controlled-state">state: {controlledOpen ? 'mở' : 'đóng'}</span>
		</div>
	</section>

	<!-- (c) INFO variant -->
	<section class="demo">
		<h2>Thông tin (info)</h2>
		<div class="row" data-test="ad-info">
			<AlertDialog>
				<AlertDialog.Trigger>
					<button class="demo-btn">Thông báo cập nhật</button>
				</AlertDialog.Trigger>
				<AlertDialog.Content>
					<AlertDialog.Header variant="info">
						{#snippet leading()}
							<Icon icon={iconify['info-i-rounded']} class="ad-icon" />
						{/snippet}
						<AlertDialog.Title>Ứng dụng đã cập nhật</AlertDialog.Title>
						<AlertDialog.Description>
							Phiên bản mới đã sẵn sàng. Bấm "Nhận" để áp dụng thay đổi.
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Để sau</AlertDialog.Cancel>
						<AlertDialog.Action color="primary" onselect={() => (adLog = 'info: applied')}>Nhận</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog>
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

	.log {
		font-family: monospace;
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
		background: var(--content2, hsl(240 4.76% 95.88%));
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
		margin: 0;
		min-width: 10rem;
	}

	.state {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
	}

	.demo-btn {
		display: inline-flex;
		align-items: center;
		min-height: 2.25rem;
		padding: 0 0.875rem;
		font-size: 0.875rem;
		font-weight: 500;
		font-family: inherit;
		color: var(--foreground);
		background: var(--content2, hsl(240 4.8% 96%));
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: 0.375rem;
		cursor: pointer;
		transition: background-color 150ms cubic-bezier(0.65, 0, 0.35, 1);

		&.danger {
			background: var(--danger, hsl(0 72% 51%));
			color: hsl(0 0% 100%);
			border-color: transparent;
		}

		@media (hover: hover) and (pointer: fine) {
			&:hover:not(.danger) {
				opacity: 0.9;
			}
		}

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, hsl(241 100% 68.6%));
			outline-offset: 2px;
		}
	}

	code {
		font-size: 0.8125rem;
		background: var(--content2, hsl(240 4.76% 95.88%));
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}

	@media (prefers-color-scheme: dark) {
		.log,
		.demo-btn,
		.state,
		code {
			border-color: hsl(240 5.9% 20%);
		}
	}
</style>
