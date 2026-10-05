<!-- src/routes/ui/accordion/+page.svelte -->
<script lang="ts">
	// Demo Accordion (element composite — shadcn accordion):
	// (a) single (3 items, item 1 open default, collapsible) · (b) single
	// non-collapsible (click item đang mở GIỮ NGUYÊN, click item khác switch) ·
	// (c) multiple (3 items, 2 open default) · (d) disabled trigger ·
	// (e) controlled (bind:value + button ngoài đổi array).
	import { Accordion } from '$components/element';

	let ctrlValue = $state(['c1']);
</script>

<div class="page" data-test="accordion-demo">
	<h1 class="page-title">Accordion · composite</h1>
	<p class="page-desc">
		Root giữ <code>value</code> (bindable, loose: single → string · multiple → string[]) +
		<code>defaultValue</code>; context <code>isOpen(id)</code> / <code>toggle(id)</code>;
		Trigger <code>aria-expanded</code> + chevron rotate; Content <code>role="region"</code> +
		fly/fade (prefers-reduced-motion → duration 0).
	</p>

	<section class="demo" data-test="ac-single">
		<h2>(a) Single (collapsible, default) — item 1 open</h2>
		<p class="demo-hint">Click item đang mở → đóng; click item khác → switch (đóng cái cũ).</p>
		<Accordion defaultValue="1">
			<Accordion.Item value="1">
				<Accordion.Header>
					<Accordion.Trigger icon="lucide:help-circle">Giúp gì?</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content>Accordion mở/đóng theo content bên trong.</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="2">
				<Accordion.Header>
					<Accordion.Trigger>Item 2 — nội dung gì?</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content>Ở chế độ single chỉ 1 item mở cùng lúc.</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="3">
				<Accordion.Header>
					<Accordion.Trigger>Item 3 — khi nào dùng?</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content>FAQ, thiết lập, hướng dẫn nhiều bước…</Accordion.Content>
			</Accordion.Item>
		</Accordion>
	</section>

	<section class="demo" data-test="ac-nocollapse">
		<h2>(b) Single (collapsible=false) — luôn có 1 item mở</h2>
		<p class="demo-hint">Click item đang mở → GIỮ NGUYÊN; click item khác → switch.</p>
		<Accordion defaultValue="1" collapsible={false}>
			<Accordion.Item value="1">
				<Accordion.Header>
					<Accordion.Trigger>Item 1 (đang mở)</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content>Click cái này: vẫn mở (không collapsible).</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="2">
				<Accordion.Header>
					<Accordion.Trigger>Item 2</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content>Click cái này: switch sang, item 1 đóng.</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="3">
				<Accordion.Header>
					<Accordion.Trigger>Item 3</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content>Nội dung item 3.</Accordion.Content>
			</Accordion.Item>
		</Accordion>
	</section>

	<section class="demo" data-test="ac-multiple">
		<h2>(c) Multiple — 2 item open default</h2>
		<p class="demo-hint">Mở/đóng độc lập (mảng value).</p>
		<Accordion type="multiple" defaultValue={['1', '2']}>
			<Accordion.Item value="1">
				<Accordion.Header>
					<Accordion.Trigger>Item 1 (open)</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content>Đang mở.</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="2">
				<Accordion.Header>
					<Accordion.Trigger>Item 2 (open)</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content>Cũng đang mở — multiple cho phép.</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="3">
				<Accordion.Header>
					<Accordion.Trigger>Item 3 (closed)</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content>Chưa mở.</Accordion.Content>
			</Accordion.Item>
		</Accordion>
	</section>

	<section class="demo" data-test="ac-disabled">
		<h2>(d) Disabled trigger</h2>
		<p class="demo-hint">aria-disabled + không toggle (pointer-events none).</p>
		<Accordion defaultValue="1">
			<Accordion.Item value="1">
				<Accordion.Header>
					<Accordion.Trigger>Item 1 (bình thường)</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content>Bình thường.</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="2">
				<Accordion.Header>
					<Accordion.Trigger disabled>Item 2 (khóa)</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content>Không bao giờ mở được.</Accordion.Content>
			</Accordion.Item>
		</Accordion>
	</section>

	<section class="demo" data-test="ac-controlled">
		<h2>(e) Controlled (bind:value, multiple)</h2>
		<p class="demo-hint">Button ngoài đổi array → item theo (reactive).</p>
		<Accordion type="multiple" bind:value={ctrlValue}>
			<Accordion.Item value="c1">
				<Accordion.Header>
					<Accordion.Trigger>Alpha (c1)</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content>Panel Alpha.</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="c2">
				<Accordion.Header>
					<Accordion.Trigger>Beta (c2)</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content>Panel Beta.</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="c3">
				<Accordion.Header>
					<Accordion.Trigger>Gamma (c3)</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content>Panel Gamma.</Accordion.Content>
			</Accordion.Item>
		</Accordion>
		<div class="row">
			<button class="demo-btn" data-test="ac-controlled-open-all" onclick={() => (ctrlValue = ['c1', 'c2', 'c3'])}>
				Mở tất cả
			</button>
			<button class="demo-btn" data-test="ac-controlled-close-all" onclick={() => (ctrlValue = [])}>
				Đóng tất cả
			</button>
			<span class="picked" data-test="ac-controlled-value">value = [{ctrlValue.join(', ')}]</span>
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
		margin-bottom: 2.5rem;

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
		line-height: 1.5;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: 0.75rem;
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
		border-radius: 0.375rem;
		cursor: pointer;

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
		}
	}

	.picked {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
	}

	code {
		font-size: 0.8125rem;
		background: var(--content2, hsl(240 4.76% 95.88%));
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}

	@media (prefers-color-scheme: dark) {
		.demo-btn {
			border-color: hsl(240 5.9% 20%);
		}
	}
</style>
