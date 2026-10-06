<!-- src/routes/ui/date-picker/+page.svelte -->
<script lang="ts">
	// Demo DatePicker (shadcn date picker, PURE JS — KHÔNG date library):
	// 6 case — (1) single date mặc định, (2) sizes xs/md/lg, (3) min/max,
	// (4) controlled bind:value, (5) disabled, (6) range mode.
	import { DatePicker } from '$components/element';

	// ngày mặc định: 15 tháng hiện tại (SSR an toàn — tính theo Date local).
	const now = new Date();
	const defaultDate = new Date(now.getFullYear(), now.getMonth(), 15);

	// min/max case: min = hôm nay, max = hôm nay + 60 ngày (PURE JS).
	const today = new Date();
	const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 60);

	// controlled: state page (bind:value) — bắt đầu null.
	let controlledValue = $state<Date | null>(null);

	// range: state page (bind:value) — bắt đầu rỗng (chưa chọn).
	let rangeValue = $state<{ from?: Date; to?: Date }>({});

	// dd/mm/yyyy thuần JS (không format helper export — demo tự viết cho nhẹ).
	function fmt(d: Date | null): string {
		if (!d) return '';
		const dd = String(d.getDate()).padStart(2, '0');
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		return `${dd}/${mm}/${d.getFullYear()}`;
	}

	// range → "dd/mm/yyyy → dd/mm/yyyy" (demo tự viết cho nhẹ).
	function fmtRange(r: { from?: Date; to?: Date } | null): string {
		if (!r?.from && !r?.to) return 'chưa chọn';
		if (!r.to) return `${fmt(r.from ?? null)} → …`;
		return `${fmt(r.from ?? null)} → ${fmt(r.to)}`;
	}
</script>

<div class="page" data-test="date-picker-demo">
	<h1 class="page-title">DatePicker · shadcn</h1>
	<p class="page-desc">
		Composite Root + Trigger + Content (panel lịch role=grid 7×6, tuần bắt đầu thứ Hai).
		Root giữ <code>value</code> (bindable — single hoặc range <code>{'{from, to}'}</code>) +
		<code>open</code> + tháng hiển thị + roving focus. Phím: ←/→ ±1 ngày, ↑/↓ ±7 ngày,
		Home/End đầu/cuối tuần, Enter/Space chọn, Escape / click ngoài / Tab đóng + focus trả
		trigger. PURE JS — không date library.
	</p>

	<section class="demo" data-test="dp-single">
		<h2>1. Single date (mặc định)</h2>
		<p class="demo-hint">
			Click trigger → panel mở, hôm nay có ring tròn, ngày đã chọn nền primary. Chọn ngày
			→ đóng + focus trả trigger. Button “Hôm nay” quick-jump về tháng hiện tại.
		</p>
		<DatePicker value={defaultDate} aria-label="Ngày sinh">
			<DatePicker.Trigger />
			<DatePicker.Content />
		</DatePicker>
		<span class="picked">Value: {fmt(defaultDate)}</span>
	</section>

	<section class="demo" data-test="dp-sizes">
		<h2>2. Sizes (xs / md / lg)</h2>
		<p class="demo-hint">
			Trigger đồng bộ Button↔Input (DESIGN_SYSTEM §2.1); panel theo size (ô ngày to lên).
		</p>
		<div class="row">
			<DatePicker size="xs" value={defaultDate} aria-label="Size xs">
				<DatePicker.Trigger />
				<DatePicker.Content />
			</DatePicker>
			<DatePicker size="md" value={defaultDate} aria-label="Size md">
				<DatePicker.Trigger />
				<DatePicker.Content />
			</DatePicker>
			<DatePicker size="lg" value={defaultDate} aria-label="Size lg">
				<DatePicker.Trigger />
				<DatePicker.Content />
			</DatePicker>
		</div>
	</section>

	<section class="demo" data-test="dp-range">
		<h2>3. Min / max (hôm nay → +60 ngày)</h2>
		<p class="demo-hint">
			Ngày ngoài [min, max] = faded + not-allowed + aria-disabled (không chọn được).
			Min = {fmt(minDate)}, Max = {fmt(maxDate)}.
		</p>
		<DatePicker min={minDate} max={maxDate} aria-label="Ngày trong khoảng">
			<DatePicker.Trigger />
			<DatePicker.Content />
		</DatePicker>
	</section>

	<section class="demo" data-test="dp-controlled">
		<h2>4. Controlled (bind:value)</h2>
		<p class="demo-hint">value là state của page — chọn ngày trong panel cập nhật text dưới đây.</p>
		<DatePicker bind:value={controlledValue} aria-label="Controlled">
			<DatePicker.Trigger />
			<DatePicker.Content />
		</DatePicker>
		<span class="picked" data-test="dp-controlled-value">Value: {fmt(controlledValue) || 'chưa chọn'}</span>
	</section>

	<section class="demo" data-test="dp-disabled">
		<h2>5. Disabled</h2>
		<p class="demo-hint">Root disabled → trigger không click, panel không mở, opacity giảm.</p>
		<DatePicker value={defaultDate} disabled aria-label="Disabled">
			<DatePicker.Trigger />
			<DatePicker.Content />
		</DatePicker>
	</section>

	<section class="demo" data-test="dp-range-mode">
		<h2>6. Range (chọn khoảng từ → đến)</h2>
		<p class="demo-hint">
			<code>range</code> — click ngày 1 → from (ring báo đang chờ), hover giữa → preview
			highlight, click ngày 2 → to (to &lt; from tự swap, panel đóng). Click ngày 3 → bắt đầu
			lại from. Trigger hiện "dd/mm/yyyy → dd/mm/yyyy".
		</p>
		<DatePicker range bind:value={rangeValue} aria-label="Chọn khoảng ngày">
			<DatePicker.Trigger />
			<DatePicker.Content />
		</DatePicker>
		<span class="picked" data-test="dp-range-value">Value: {fmtRange(rangeValue)}</span>
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

		code {
			font-family: monospace;
			font-size: 0.9em;
		}
	}

	.demo {
		margin-bottom: 2rem;
		position: relative; // panel absolute được render trong root (relative)

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

	@media (prefers-color-scheme: dark) {
		.page {
			background: hsl(0 0% 0%);
		}
	}
</style>
