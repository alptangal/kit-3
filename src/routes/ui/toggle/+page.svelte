<!-- src/routes/ui/toggle/+page.svelte -->
<script lang="ts">
	import { iconify } from '$assets/icons/iconify';
	import { Toggle } from '$components/element';

	// ── State (probe locate qua data-test + .toggle-root) ──
	let defaultA = $state(false);
	let defaultB = $state(true);

	let outlineA = $state(false);
	let outlineB = $state(true);

	let disabledPressed = $state(true);
	let disabledOff = $state(false);

	let smPressed = $state(false);
	let defaultPressed = $state(true);
	let lgPressed = $state(false);

	let iconPressed = $state(false);
	let iconOnlyPressed = $state(true);
	let colorSuccess = $state(false);
	let colorError = $state(false);
</script>

<div class="page" data-test="toggle-demo">
	<h1 class="page-title">Toggle · base (nút nhấn 2 trạng thái aria-pressed)</h1>

	<!-- 1) Default (bind:pressed + label) -->
	<section class="demo" data-test="tg-default">
		<h2>Default (bind:pressed + label)</h2>
		<Toggle label="Bold" bind:pressed={defaultA} aria-label="Bold" />
		<Toggle label={{ en: 'Italic', vi: 'Nghiêng' }} bind:pressed={defaultB} />
		<p class="demo-hint">
			Đang: <code data-test="tg-default-value">{defaultA ? 'pressed' : 'unpressed'} / {defaultB ? 'pressed' : 'unpressed'}</code>
			— click nút để toggle (Space/Enter cũng toggle).
		</p>
	</section>

	<!-- 2) Outline variant -->
	<section class="demo" data-test="tg-outline">
		<h2>Outline (viền + nền trong suốt)</h2>
		<Toggle variant="outline" label="Underline" bind:pressed={outlineA} aria-label="Underline" />
		<Toggle variant="outline" label="Strikethrough" bind:pressed={outlineB} aria-label="Strikethrough" />
		<p class="demo-hint">
			Đang: <code data-test="tg-outline-value">{outlineA ? 'pressed' : 'unpressed'} / {outlineB ? 'pressed' : 'unpressed'}</code>
		</p>
	</section>

	<!-- 3) Sizes (sm / default / lg) -->
	<section class="demo" data-test="tg-sizes">
		<h2>Sizes (sm / default / lg)</h2>
		<div class="sizes-row">
			<Toggle size="sm" label="SM" bind:pressed={smPressed} />
			<Toggle size="default" label="Default" bind:pressed={defaultPressed} />
			<Toggle size="lg" label="LG" bind:pressed={lgPressed} />
		</div>
		<p class="demo-hint">Kích thước map về token min-height hệ thống (sm ≈ xs, default ≈ md, lg ≈ lg).</p>
	</section>

	<!-- 4) Icon (cạnh text + icon-only) -->
	<section class="demo" data-test="tg-icon">
		<h2>Icon (cạnh text + icon-only)</h2>
		<Toggle icon={iconify['search-rounded']} label="Tìm kiếm" bind:pressed={iconPressed} aria-label="Tìm kiếm" />
		<Toggle icon={iconify['info-i-rounded']} bind:pressed={iconOnlyPressed} aria-label="Thông tin" />
		<p class="demo-hint">
			Icon iconify cạnh text (aria-hidden) — không label/children → icon-only (aria-label bắt buộc).
			Đang: <code data-test="tg-icon-value">{iconPressed ? 'pressed' : 'unpressed'} / {iconOnlyPressed ? 'pressed' : 'unpressed'}</code>
		</p>
	</section>

	<!-- 5) Colors / pressed-state -->
	<section class="demo" data-test="tg-colors">
		<h2>Colors / pressed-state (default / success / error)</h2>
		<Toggle color="default" label="Default" bind:pressed={defaultA} />
		<Toggle color="success" label="Success" bind:pressed={colorSuccess} />
		<Toggle color="error" label="Error" bind:pressed={colorError} />
		<p class="demo-hint">Pressed: nền nhạt + màu semantic (var(--color)) theo .color-*, off-state = màu neutral.</p>
	</section>

	<!-- 6) Disabled -->
	<section class="demo" data-test="tg-disabled">
		<h2>Disabled</h2>
		<Toggle pressed disabled label="Disabled (pressed)" aria-label="Disabled pressed" />
		<Toggle disabled label="Disabled (off)" aria-label="Disabled off" />
		<p class="demo-hint">Disabled: opacity token + not-allowed + không toggle được.</p>
	</section>

	<!-- 7) Keyboard guide (native button: Space/Enter native) -->
	<section class="demo" data-test="tg-keyboard">
		<h2>Keyboard guide</h2>
		<div class="keyboard-guide">
			<ul>
				<li><kbd>Tab</kbd> — focus nút (native button, 1 stop)</li>
				<li><kbd>Space</kbd> / <kbd>Enter</kbd> — toggle pressed (native button behavior)</li>
				<li>Click — toggle pressed</li>
			</ul>
		</div>
		<Toggle label="Keyboard demo" aria-label="Keyboard demo" />
		<p class="demo-hint">Toggle là <code>&lt;button type="button" aria-pressed&gt;</code> — không cần keydown handler riêng.</p>
	</section>
</div>

<style lang="scss">
	.page {
		max-width: 720px;
		margin: 0 auto;
		padding: 2rem 1.5rem 6rem;
		color: var(--foreground);
	}
	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 1.5rem;
	}
	.demo {
		margin-bottom: 2.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		h2 {
			font-size: 1rem;
			font-weight: 600;
			margin-bottom: 0.25rem;
			opacity: 0.8;
		}
	}
	.demo-hint {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		opacity: 0.7;
	}
	.sizes-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
	}
	.keyboard-guide {
		margin: 0.5rem 0;
		padding: 0.75rem 1rem;
		border: 1px dashed var(--border, rgba(125, 125, 125, 0.4));
		border-radius: 0.5rem;
		ul {
			margin: 0;
			padding-left: 1rem;
			display: flex;
			flex-direction: column;
			gap: 0.3rem;
		}
		li {
			font-size: 0.85rem;
		}
	}
	kbd {
		display: inline-block;
		min-width: 2rem;
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--border, rgba(125, 125, 125, 0.4));
		border-radius: 0.25rem;
		font-family: monospace;
		font-size: 0.8rem;
		text-align: center;
	}
</style>
