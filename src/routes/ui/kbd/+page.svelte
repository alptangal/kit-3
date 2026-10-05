<script lang="ts">
	// src/routes/ui/kbd/+page.svelte
	// Demo Kbd — phím đơn, combo (Kbd.Combo), variant, size, inline trong câu.
	import { Kbd } from '$components/element';
</script>

<div class="page" data-test="kbd-demo">
	<h1 class="page-title">Kbd · phím tắt / phím bấm</h1>

	<section class="demo" data-test="kb-single">
		<h2>Phím đơn</h2>
		<p class="demo-hint">mỗi key là một &lt;kbd&gt; — symbol, chữ, F-key</p>
		<div class="row">
			<Kbd>⌘</Kbd>
			<Kbd>K</Kbd>
			<Kbd>F1</Kbd>
		</div>
	</section>

	<section class="demo" data-test="kb-combo">
		<h2>Combo (Kbd.Combo)</h2>
		<p class="demo-hint">nhiều key + separator "&" — aria-label tổng hợp (nếu truyền)</p>
		<div class="row">
			<Kbd.Combo aria-label="Command Shift K" data-test="kb-combo-mac">
				<Kbd single>⌘</Kbd>
				<Kbd single>⇧</Kbd>
				<Kbd single>K</Kbd>
			</Kbd.Combo>
			<Kbd.Combo aria-label="Control P" data-test="kb-combo-p">
				<Kbd single>Ctrl</Kbd>
				<Kbd single>P</Kbd>
			</Kbd.Combo>
		</div>
	</section>

	<section class="demo" data-test="kb-variant">
		<h2>Variant (default / outline)</h2>
		<p class="demo-hint">default = physical-key (nền xám + viền dưới dày + inset shadow)</p>
		<div class="row">
			<Kbd>⌘K</Kbd>
			<Kbd variant="outline">⌘K</Kbd>
			<Kbd variant="outline">Esc</Kbd>
		</div>
	</section>

	<section class="demo" data-test="kb-size">
		<h2>Size (xs / sm / md)</h2>
		<p class="demo-hint">đặt theo token size-* (font/padding/radius)</p>
		<div class="row">
			<Kbd size="xs">⌘K</Kbd>
			<Kbd size="sm">⌘K</Kbd>
			<Kbd size="md">⌘K</Kbd>
		</div>
	</section>

	<section class="demo" data-test="kb-inline">
		<h2>Inline trong câu</h2>
		<p class="demo-hint">kbd nằm inline trong đoạn văn</p>
		<p class="inline-demo">
			Bấm <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> để tìm kiếm. Nhấn <Kbd variant="outline">Esc</Kbd> để thoát
			khỏi cửa sổ tìm kiếm.
		</p>
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
		font-size: 1.375rem;
		font-weight: 700;
	}

	.demo {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		h2 {
			font-size: 1rem;
			font-weight: 600;
		}
	}

	.demo-hint {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
	}

	.row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 0.5rem 0;
	}

	.inline-demo {
		font-size: 0.9375rem;
		line-height: 1.75;
	}
</style>
