<!-- src/routes/ui/separator/+page.svelte -->
<script lang="ts">
	import { Separator } from '$components/element';
</script>

<div class="page" data-test="separator-demo">
	<h1 class="page-title">Separator · vạch ngăn cách</h1>

	<section class="demo">
		<h2>Horizontal (mặc định)</h2>
		<p class="demo-hint">Chia block dọc, role="separator" aria-orientation="horizontal".</p>
		<div class="stack">
			<p>Block trên</p>
			<Separator />
			<p>Block dưới</p>
		</div>
	</section>

	<section class="demo">
		<h2>Vertical</h2>
		<p class="demo-hint">Chia hàng ngang (aria-orientation="vertical").</p>
		<div class="row">
			<span>Trái</span>
			<Separator orientation="vertical" />
			<span>Giữa</span>
			<Separator orientation="vertical" decorative />
			<span>Phải</span>
		</div>
	</section>

	<section class="demo">
		<h2>Disabled (opacity token)</h2>
		<div class="stack">
			<Separator disabled />
		</div>
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
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--foreground);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 2.5rem;
		font-size: 0.875rem;
		color: var(--foreground);
	}

	@media (prefers-color-scheme: dark) {
		.demo-hint {
			color: hsl(240 5.03% 64.9%);
		}
	}
</style>
