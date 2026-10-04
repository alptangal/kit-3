<!-- src/routes/ui/progress/+page.svelte -->
<script lang="ts">
	import { Progress } from '$components/element';

	const values = [0, 25, 50, 75, 100] as const;
	const colors = ['primary', 'success', 'warning', 'error'] as const;
	const sizes = ['xs', 'sm', 'md', 'lg'] as const;
</script>

<div class="page" data-test="progress-demo">
	<h1 class="page-title">Progress · thanh trạng thái</h1>

	<section class="demo" data-test="pr-value">
		<h2>Value (0–100)</h2>
		<p class="demo-hint">role="progressbar" + aria-valuenow. Bar width = value/max (0% = track rỗng, label "0%").</p>
		<div class="stack">
			{#each values as v}
				<Progress value={v} showValue />
			{/each}
		</div>
	</section>

	<section class="demo" data-test="pr-color">
		<h2>Color (semantic token)</h2>
		<div class="stack">
			{#each colors as c}
				<Progress value={60} color={c} />
			{/each}
		</div>
	</section>

	<section class="demo" data-test="pr-indet">
		<h2>Indeterminate (shimmer)</h2>
		<p class="demo-hint">aria-busy + bar trượt vô hạn. Tôn trọng reduced-motion (đứng yên).</p>
		<div class="stack">
			<Progress indeterminate />
			<Progress indeterminate color="success" />
		</div>
	</section>

	<section class="demo" data-test="pr-showvalue">
		<h2>Show value (text %)</h2>
		<p class="demo-hint">Hiện "NN%" bên phải track (muted, font theo size).</p>
		<div class="stack">
			<Progress value={65} showValue />
			<Progress value={25} showValue color="warning" />
			<Progress value={100} showValue color="success" />
		</div>
	</section>

	<section class="demo" data-test="pr-size">
		<h2>Size (xs/sm/md/lg = 4/6/8/10px)</h2>
		<p class="demo-hint">--progress-height theo size + text % scale theo size.</p>
		<div class="stack">
			{#each sizes as s}
				<Progress value={40} size={s} showValue label={{ en: `Size ${s}`, vi: `Kích thước ${s}` }} />
			{/each}
		</div>
	</section>

	<section class="demo">
		<h2>Label (aria-label tùy chỉnh)</h2>
		<Progress value={80} label={{ en: 'Uploading', vi: 'Đang tải lên' }} showValue />
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
	.stack {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
</style>
