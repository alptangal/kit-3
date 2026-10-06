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

	// (5) Live data — mirror $state + setInterval (client only). Cửa sổ trượt max=10.
	const liveData = $state<{ label: string; value: number }[]>([
		{ label: '0s', value: 120 },
		{ label: '1s', value: 340 },
		{ label: '2s', value: 220 }
	]);
	let liveTick = $state(3);
	let liveTimer: ReturnType<typeof setInterval> | undefined;

	$effect(() => {
		if (typeof window === 'undefined') return;
		liveTimer = setInterval(() => {
			const v = 100 + Math.round(Math.random() * 500);
			liveData.push({ label: `${liveTick}s`, value: v });
			if (liveData.length > 10) liveData.shift();
			liveTick += 1;
		}, 1000);
		return () => clearInterval(liveTimer);
	});

	// (6) Live với source poll — chart tự poll theo interval prop.
	let sourceTick = 0;
	const pollSource = () => {
		sourceTick += 1;
		return { label: `n${sourceTick}`, value: 200 + Math.round(Math.random() * 400) };
	};
</script>

<div class="page" data-test="chart-demo">
	<h1 class="page-title">Chart · biểu đồ SVG tự viết</h1>

	<section class="demo" data-test="chart-bar">
		<h2>Bar đơn (doanh thu 6 tháng)</h2>
		<p class="demo-hint">type="bar". Mỗi point = một bar rounded-top, align baseline. Hover bar → tooltip đa thông tin (label + value + % + delta).</p>
		<Chart type="bar" data={revenue} tooltip title="Doanh thu theo tháng" aria-label="Biểu đồ doanh thu theo tháng" />
	</section>

	<section class="demo" data-test="chart-line">
		<h2>Line đơn (visitor, showArea + showPoints)</h2>
		<p class="demo-hint">type="line" + showArea (nền 10%) + showPoints (marker r=4, ring nền). Hover → tooltip + delta so điểm kề (mặc định line).</p>
		<Chart
			type="line"
			data={visitors}
			showArea
			showPoints
			tooltip
			title="Lượng visitor"
			aria-label="Biểu đồ lượng visitor theo tháng"
		/>
	</section>

	<section class="demo" data-test="chart-multi">
		<h2>Multiple series line (3 series + legend)</h2>
		<p class="demo-hint">series[] (stretch). Legend hiện tên + swatch (kênh nhận dạng, không chỉ màu). Tooltip hover: value từng series + % so tổng tại điểm.</p>
		<Chart
			type="line"
			data={months}
			series={multiSeries}
			showPoints
			tooltip
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

	<section class="demo" data-test="chart-live">
		<h2>Live data (cửa sổ trượt max=10, interval 1s)</h2>
		<p class="demo-hint">Demo tự đẩy bằng $state + setInterval. Chart re-render mượt (transition geometry, không nhảy layout); badge LIVE + dot pulse. Vượt 10 điểm → bỏ điểm cũ nhất.</p>
		<Chart type="line" data={liveData} live showPoints showArea title="Live traffic (max 10)" aria-label="Biểu đồ live traffic" />
	</section>

	<section class="demo" data-test="chart-live-source">
		<h2>Live data với source poll (interval 800ms, max=8)</h2>
		<p class="demo-hint">live={ '{' } source, interval, max { '}' } — chart tự poll nguồn, append điểm mới + cửa sổ trượt bỏ điểm cũ nhất khi vượt max.</p>
		<Chart type="bar" data={[]} live={{ source: pollSource, interval: 800, max: 8 }} title="Live polled (max 8)" aria-label="Biểu đồ live polled" />
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
