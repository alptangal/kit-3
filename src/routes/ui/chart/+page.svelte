<!-- src/routes/ui/chart/+page.svelte -->
<script lang="ts">
	import { Chart } from '$components/element';

	// (1) Bar đơn — doanh thu 6 tháng
	const revenue = [
		{ label: 'T1', value: 420 },
		{ label: 'T2', value: 610 },
		{ label: 'T3', value: 380 },
		{ label: 'T4', value: 720 },
		{ label: 'T5', value: 560 },
		{ label: 'T6', value: 890 }
	];

	// (2) Line đơn — visitor (showArea + showPoints)
	const visitors = [
		{ label: 'T1', value: 1200 },
		{ label: 'T2', value: 1800 },
		{ label: 'T3', value: 1500 },
		{ label: 'T4', value: 2600 },
		{ label: 'T5', value: 2100 },
		{ label: 'T6', value: 3200 },
		{ label: 'T7', value: 2900 },
		{ label: 'T8', value: 3800 }
	];

	// (3) Multiple series line
	const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].map((label) => ({ label, value: 0 }));
	const multiSeries = [
		{ name: 'Doanh thu', data: [400, 520, 480, 610, 590, 720] },
		{ name: 'Chi phí', color: 'secondary' as const, data: [280, 340, 320, 410, 400, 480] },
		{ name: 'Lợi nhuận', color: 'success' as const, data: [120, 180, 160, 200, 190, 240] }
	];

	// (4) valueFormatter (M/k) + showGrid toggle
	const bigValues = [
		{ label: 'Q1', value: 900000 },
		{ label: 'Q2', value: 1500000 },
		{ label: 'Q3', value: 2500000 },
		{ label: 'Q4', value: 1200 }
	];
</script>

<div class="page" data-test="chart-demo">
	<h1 class="page-title">Chart · biểu đồ SVG tự viết</h1>

	<section class="demo" data-test="chart-bar">
		<h2>Bar đơn (doanh thu 6 tháng)</h2>
		<p class="demo-hint">type="bar". Mỗi point = một bar rounded-top, align baseline. Hover bar → tooltip native (title).</p>
		<Chart type="bar" data={revenue} title="Doanh thu theo tháng" aria-label="Biểu đồ doanh thu theo tháng" />
	</section>

	<section class="demo" data-test="chart-line">
		<h2>Line đơn (visitor, showArea + showPoints)</h2>
		<p class="demo-hint">type="line" + showArea (nền 10%) + showPoints (marker r=4, ring nền).</p>
		<Chart
			type="line"
			data={visitors}
			showArea
			showPoints
			title="Lượng visitor"
			aria-label="Biểu đồ lượng visitor theo tháng"
		/>
	</section>

	<section class="demo" data-test="chart-multi">
		<h2>Multiple series line (3 series + legend)</h2>
		<p class="demo-hint">series[] (stretch). Legend hiện tên + swatch (kênh nhận dạng, không chỉ màu). Series 2 = secondary, 3 = success.</p>
		<Chart
			type="line"
			data={months}
			series={multiSeries}
			showPoints
			title="Doanh thu / Chi phí / Lợi nhuận"
			aria-label="Biểu đồ doanh thu chi phí lợi nhuận theo tháng"
		/>
	</section>

	<section class="demo" data-test="chart-formatter">
		<h2>valueFormatter (M/k) + showGrid</h2>
		<p class="demo-hint">Formatter mặc định: ≥1e6 → "M", ≥1e3 → "k" (Q3 = 2.5M, Q1 = 900k). Trục tự nice-scale.</p>
		<Chart type="bar" data={bigValues} title="Doanh thu quý (formatter M/k)" />
		<p class="demo-hint">showGrid={false} — chỉ còn axis baseline, không gridlines.</p>
		<Chart type="bar" data={bigValues} showGrid={false} />
	</section>

	<section class="demo" data-test="chart-empty">
		<h2>Empty data (placeholder)</h2>
		<p class="demo-hint">data=[] → "Không có dữ liệu" (muted, centered). Không render bar/line/axis.</p>
		<Chart type="bar" data={[]} />
		<Chart type="line" data={[]} />
	</section>

	<section class="demo" data-test="chart-sizes">
		<h2>Sizes / heights khác nhau</h2>
		<p class="demo-hint">viewBox theo width/height prop; CSS co giãn width:100%. Low-height (sparkline-like) + default.</p>
		<Chart type="line" data={visitors} height={160} showPoints />
		<Chart type="bar" data={revenue} width={480} height={220} />
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
</style>
