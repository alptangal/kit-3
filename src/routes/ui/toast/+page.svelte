<!-- src/routes/ui/toast/+page.svelte -->
<script lang="ts">
	import { ToastWrapper } from '$components/element';
	import { toast } from '$components/element/toast';
	import { iconify } from '$assets/icons/iconify';
	import { browser } from '$app/environment';

	// ── State (probe locate qua data-test) ──
	// lastToast: id của toast mới nhất (mỗi toast-method click cập nhật)
	let lastToast = $state<string | null>(null);
	// actionLog: nội dung onClick của action "Xem lại" ghi vào đây
	let actionLog = $state<string>('chưa có');
	// stackIds: danh sách id của 3 toast "Nhiều cùng lúc" (infinite) để xóa sạch.
	let stackIds = $state<string[]>([]);
	// probeIds: id các toast do probe event tạo (fire/fire-pause) — clear xóa sạch.
	let probeIds = $state<string[]>([]);

	function triggerSuccess() {
		lastToast = toast.success('Đã lưu thành công', 'Dữ liệu đã được ghi vào cơ sở dữ liệu.', {
			indicator: iconify['check-rounded'],
			action: {
				label: 'Xem lại',
				variant: 'ghost',
				onClick: () => {
					actionLog = `Đã mở mục xem lại · ${new Date().toLocaleTimeString('vi-VN')}`;
				}
			}
		});
	}
	function triggerError() {
		lastToast = toast.error('Lưu thất bại', 'Mất kết nối mạng — thử lại sau ít phút.', {
			indicator: iconify['dangerous-outline-rounded']
		});
	}
	function triggerWarning() {
		lastToast = toast.warning('Khoảng dung lượng thấp', 'Tài khoản sắp hết bộ nhớ lưu trữ.', {
			indicator: iconify['warning-outline-rounded']
		});
	}
	function triggerInfo() {
		lastToast = toast.info('Cập nhật hệ thống', 'Dịch vụ sẽ khởi động lại trong 30 giây.', {
			indicator: iconify['info-i-rounded']
		});
	}
	function triggerDefault() {
		lastToast = toast.default('Thông báo chung', 'Tin nhắn không phân loại màu.');
	}
	// Disabled: toast ở state "vô hiệu" (cursor not-allowed qua --cursor khi .disabled).
	// duration infinite để giữ cho probe đọc cursor.
	function triggerDisabled() {
		lastToast = toast.info('Toast disabled', 'State disabled — cursor not-allowed, giữ để probe.', {
			indicator: iconify['info-i-rounded'],
			duration: 'infinite',
			disabled: true
		});
	}
	// Nhiều toast CÙNG LÚC. Fire ở 3 position KHÁC nhau (bottom/top/right) để 3 toast
	// đều thấy rõ, khác màu + icon — minh họa "nhiều toast đồng thời". (Compact-notch
	// stack cùng position — toast mới to nhất che toast cũ, ló mép — đã verify bằng
	// probe T4 + DOM measurement; không dùng cho screenshot vì nền trắng chồng trắng
	// chỉ còn thấy vệt shadow mỏng.) `duration: 'infinite'` để giữ 3 toast cho đến khi
	// bấm "Xóa (last)" (xóa cả 3, vì chúng cùng nằm trong map toasts).
	function triggerStack() {
		stackIds = [
			toast.info('Tin nhắn 1', undefined, {
				position: 'bottom',
				duration: 'infinite',
				indicator: iconify['info-i-rounded']
			})
		];
		setTimeout(() => {
			stackIds.push(
				toast.warning('Tin nhắn 2', undefined, {
					position: 'top',
					duration: 'infinite',
					indicator: iconify['warning-outline-rounded']
				})
			);
		}, 120);
		setTimeout(() => {
			stackIds.push(
				toast.success('Tin nhắn 3', undefined, {
					position: 'right',
					duration: 'infinite',
					indicator: iconify['check-rounded']
				})
			);
			lastToast = stackIds[stackIds.length - 1];
		}, 240);
	}
	// Xóa: nếu đang có stack (nhiều toast infinite) thì xóa hết, không thì xóa lastToast.
	function removeLast() {
		if (stackIds.length) {
			stackIds.forEach((id) => id && toast.remove(id));
			stackIds = [];
		} else if (lastToast) {
			toast.remove(lastToast);
		}
	}

	// ── Probe-only events (toast-hover-probe.mjs) ──
	// fire: tạo N toast infinite cùng position (title "H toast i").
	// fire-pause: 1 toast "H pause toast" duration tùy chỉnh (test pause auto-dismiss).
	// clear: xóa mọi toast do probe tạo (probeIds) + stack — test releaseGroupHover.
	// Lắng nghe qua window CustomEvent vì probe chạy từ console (không import được module).
	if (browser) {
		window.addEventListener('toast-probe:fire', (e) => {
			const detail = (e as CustomEvent).detail as {
				n?: number;
				position?: 'top' | 'bottom' | 'left' | 'right';
			};
			const n = detail?.n ?? 3;
			const position = detail?.position ?? 'bottom';
			for (let i = 1; i <= n; i++) {
				probeIds.push(toast.info(`H toast ${i}`, undefined, { position, duration: 'infinite' }));
			}
		});
		window.addEventListener('toast-probe:fire-pause', (e) => {
			const detail = (e as CustomEvent).detail as { duration?: number };
			probeIds.push(
				toast.info('H pause toast', 'Timer pause khi hover.', {
					position: 'bottom',
					duration: detail?.duration ?? 2500
				})
			);
		});
		window.addEventListener('toast-probe:clear', () => {
			probeIds.forEach((id) => id && toast.remove(id));
			probeIds.length = 0;
			stackIds.forEach((id) => id && toast.remove(id));
			stackIds = [];
		});
	}
</script>

<div class="page" data-test="toast-demo">
	<!-- Mount chính (primary) — render toasts thật; wrapper global ở layout nhường chỗ -->
	<ToastWrapper data-test="toast-wrapper" />

	<h1 class="page-title">Toast · thông báo thời gian thực</h1>
	<p class="demo-desc">
		Toast bằng <code>toast.success/error/warning/info/default(title, description, options)</code>.
		Auto-dismiss ~3s (trừ khi hover), nút đóng (hover), action button tùy chọn.
	</p>

	<section class="demo" data-test="toast-triggers">
		<h2>Triggers (mỗi màu 1 nút)</h2>
		<div class="row">
			<button class="demo-btn" data-test="toast-btn-success" onclick={triggerSuccess}>Success</button>
			<button class="demo-btn" data-test="toast-btn-error" onclick={triggerError}>Error</button>
			<button class="demo-btn" data-test="toast-btn-warning" onclick={triggerWarning}>Warning</button>
			<button class="demo-btn" data-test="toast-btn-info" onclick={triggerInfo}>Info</button>
			<button class="demo-btn" data-test="toast-btn-default" onclick={triggerDefault}>Default</button>
			<button class="demo-btn" data-test="toast-btn-disabled" onclick={triggerDisabled}>Disabled</button>
			<button class="demo-btn" data-test="toast-btn-stack" onclick={triggerStack}>Nhiều cùng lúc</button>
			<button class="demo-btn" data-test="toast-btn-remove" onclick={removeLast}>Xóa (last)</button>
		</div>
		<p class="demo-hint">
			Last toast id: <code data-test="toast-last-id">{lastToast ?? '—'}</code> ·
			Action log: <code data-test="toast-action-log">{actionLog}</code>
		</p>
	</section>

	<section class="demo" data-test="toast-action">
		<h2>Action button (variant ghost) — "Xem lại"</h2>
		<p class="demo-hint">
			Success có <code>action</code>: nút "Xem lại" (ghost) click → ghi vào
			<code>data-test="toast-action-log"</code> (hiển thị phía trên).
		</p>
	</section>

	<section class="demo" data-test="toast-remove">
		<h2>toast.remove(id)</h2>
		<p class="demo-hint">Nút "Xóa (last)" gọi <code>toast.remove(lastToast)</code> → toast biến mất.</p>
	</section>
</div>

<style lang="scss">
	.page {
		max-width: 42rem;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--foreground);
		margin: 0;
	}
	.demo-desc {
		font-size: 0.9rem;
		color: var(--muted, var(--foreground));
		margin: 0;
	}
	.demo {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.demo h2 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}
	.demo-hint {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
		margin: 0;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.demo-btn {
		padding: 0.4rem 0.8rem;
		font-size: 0.8rem;
		border: 1px solid var(--border, rgba(125, 125, 125, 0.4));
		border-radius: 0.5rem;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	.demo-btn:hover {
		background: rgba(125, 125, 125, 0.08);
	}
</style>
