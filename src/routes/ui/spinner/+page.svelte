<!-- src/routes/ui/spinner/+page.svelte -->
<script lang="ts">
	import { Spinner, Button } from '$components/element';

	const patterns = ['circle', 'dots', 'bars', 'square'] as const;
	const sizes = ['xs', 'sm', 'md', 'lg'] as const;
	const colors = ['primary', 'success', 'warning', 'error'] as const;
</script>

<div class="page" data-test="spinner-demo">
	<h1 class="page-title">Spinner · state display (thuần CSS)</h1>

	<section class="demo" data-test="sp-pattern">
		<h2>Pattern</h2>
		<p class="demo-hint">4 pattern: circle (ring), dots (3 chấm pulse), bars (3 thanh), square (vuông).</p>
		<div class="row">
			{#each patterns as p}
				<Spinner pattern={p} />
			{/each}
		</div>
	</section>

	<section class="demo" data-test="sp-size">
		<h2>Size (xs/sm/md/lg = 14/18/24/32px)</h2>
		<p class="demo-hint">Token riêng --spinner-size (không dùng size-* chung của hệ).</p>
		<div class="row">
			{#each sizes as s}
				<div class="cell">
					<Spinner pattern="circle" size={s} />
					<code>{s}</code>
				</div>
			{/each}
		</div>
	</section>

	<section class="demo" data-test="sp-color">
		<h2>Color (semantic token)</h2>
		<p class="demo-hint">Mặc định 'primary' — success/warning/error chạy qua token --color.</p>
		<div class="row">
			{#each colors as c}
				<div class="cell">
					<Spinner pattern="dots" color={c} />
					<code>{c}</code>
				</div>
			{/each}
		</div>
	</section>

	<section class="demo" data-test="sp-button">
		<h2>Trong Button (decorative — aria-hidden)</h2>
		<p class="demo-hint">Không có label → aria-hidden="true" (trùng với text button, SR đọc text).</p>
		<div class="row">
			<Button disabled>
				<Spinner pattern="circle" size="xs" color="primary" />
				Đang lưu…
			</Button>
		</div>
	</section>

	<section class="demo" data-test="sp-label">
		<h2>Có label (role="status" + sr-only)</h2>
		<p class="demo-hint">SR đọc label; màn hình chỉ hiện đồ họa (text sr-only ẩn).</p>
		<div class="row">
			<Spinner
				pattern="bars"
				size="lg"
				label={{ en: 'Saving your document…', vi: 'Đang lưu tài liệu…' }}
			/>
			<Spinner pattern="square" color="success" label={{ en: 'Done soon…', vi: 'Sắp xong…' }} />
		</div>
	</section>

	<section class="demo">
		<h2>Matrix pattern × size</h2>
		<div class="matrix">
			<div class="matrix-head"></div>
			{#each sizes as s}
				<div class="matrix-cell"><code>{s}</code></div>
			{/each}
			{#each patterns as p}
				<div class="matrix-cell label-cell">{p}</div>
				{#each sizes as s}
					<div class="matrix-cell">
						<Spinner pattern={p} size={s} />
					</div>
				{/each}
			{/each}
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
	.row {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
	}
	.cell code,
	.matrix-cell code,
	.label-cell {
		font-size: 0.6875rem;
		color: var(--muted, var(--foreground));
	}
	.matrix {
		display: grid;
		grid-template-columns: auto repeat(4, minmax(3rem, 1fr));
		gap: 0.5rem 1rem;
		align-items: center;
		justify-items: center;
	}
	.matrix-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 2.5rem;
	}
	.matrix-head {
		visibility: hidden;
	}
</style>
