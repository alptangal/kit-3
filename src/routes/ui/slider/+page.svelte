<!-- src/routes/ui/slider/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { FieldMessages, Form, Slider } from '$components/form';

	// ── State (probe locate qua data-test) ──
	let basicValue = $state(30);
	let ticksValue = $state(40);
	let sizesSm = $state(25);
	let sizesMd = $state(50);
	let sizesLg = $state(75);

	// sl-clamp: page state OUT OF RANGE (500) — Slider phải clamp về max=100
	let clampValue = $state(30);

	// sl-minmax: validation minValue + maxValue
	let minMaxValue = $state(80);

	// sl-form: gate submit theo page state (đồng bộ với Form gate)
	let formScore = $state(0);
	let formEmail = $state('');
	let formPayload = $state<string | null>(null);
	const emailOk = $derived(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formEmail.trim()));
	// Slider required (minValue=10) + email → gate
	const sliderOk = $derived(formScore >= 10);
	const formValid = $derived(sliderOk && emailOk);
	function handleSubmit() {
		if (!formValid) return;
		formPayload = JSON.stringify({
			score: formScore,
			email: formEmail
		});
	}
</script>

<div class="page" data-test="slider-demo">
	<h1 class="page-title">Slider · native range input + form field</h1>

	<!-- 1) Default min/max/step + showValue + clamp control -->
	<section class="demo" data-test="sl-basic">
		<h2>Default (min 0 / max 100 / step 1) + showValue</h2>
		<Slider bind:value={basicValue} min={0} max={100} step={1} showValue aria-label="Basic slider" />
		<p class="demo-hint">
			Giá trị: <code data-test="sl-basic-value">{basicValue}</code>
		</p>
	</section>

	<!-- 2) With ticks -->
	<section class="demo" data-test="sl-ticks">
		<h2>With ticks (tickCount 5) + showValue</h2>
		<Slider bind:value={ticksValue} min={0} max={100} step={5} showTicks tickCount={5} showValue aria-label="Ticks slider" />
		<p class="demo-hint">11 markers dọc track, step 5 snap theo tick.</p>
	</section>

	<!-- 3) Sizes -->
	<section class="demo" data-test="sl-sizes">
		<h2>Sizes (sm / md / lg)</h2>
		<Slider size="sm" bind:value={sizesSm} aria-label="Size sm slider" />
		<Slider size="md" bind:value={sizesMd} aria-label="Size md slider" />
		<Slider size="lg" bind:value={sizesLg} aria-label="Size lg slider" />
	</section>

	<!-- 4) Disabled -->
	<section class="demo" data-test="sl-disabled">
		<h2>Disabled</h2>
		<Slider value={60} disabled showValue aria-label="Disabled slider" />
		<p class="demo-hint">Disabled: opacity + not-allowed + fill muted.</p>
	</section>

	<!-- 5) Clamp value out of range (page state 500 → Slider clamp về 100) -->
	<section class="demo" data-test="sl-clamp">
		<h2>Clamp (value ngoài range)</h2>
		<Slider bind:value={clampValue} min={0} max={100} showValue aria-label="Clamp slider" />
		<button class="demo-btn" data-test="sl-clamp-set" onclick={() => (clampValue = 500)}>
			Set 500 (out of range)
		</button>
		<p class="demo-hint">
			Giá trị: <code data-test="sl-clamp-value">{clampValue}</code> — set 500 → clamp về 100.
		</p>
	</section>

	<!-- 6) minValue + maxValue validation -->
	<section class="demo" data-test="sl-minmax">
		<h2>Validation (minValue 20 / maxValue 50)</h2>
		<Slider
			name="threshold"
			bind:value={minMaxValue}
			min={0}
			max={100}
			step={5}
			minValue={20}
			maxValue={50}
			showValue
			delay={150}
			aria-label="Min max validation slider"
		>
			<FieldMessages />
		</Slider>
		<p class="demo-hint">
			Kéo ra 2 đầu (Home/End) → error "ít nhất bằng 20" / "tối đa 50";
			giá trị hợp lệ ∈ [20, 50] → success.
		</p>
	</section>

	<!-- 7) In Form: slider required (minValue 10) + email + submit gate + payload -->
	<section class="demo" data-test="sl-form">
		<h2>Trong Form (required + submit gate + payload)</h2>
		<Form onSubmit={handleSubmit}>
			<Slider
				name="score"
				required
				minValue={10}
				bind:value={formScore}
				showValue
				delay={150}
				aria-label="Điểm (required, ≥ 10)"
			>
				<FieldMessages />
			</Slider>

			<input
				class="demo-email"
				type="email"
				name="ta-form-email"
				placeholder="you@example.com"
				bind:value={formEmail}
			/>

			<Button type="submit" color="success" variant="solid" disabled={!formValid}>
				Submit
			</Button>
		</Form>
		{#if formPayload}
			<pre class="payload" data-test="sl-payload">{formPayload}</pre>
		{/if}
		<p class="demo-hint">
			Nút Submit disabled tới khi: slider ≥ 10 + email đúng định dạng. Payload JSON
			hiện sau submit (ghi chú: score serialize dạng number).
		</p>
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
	.demo-btn {
		align-self: flex-start;
		padding: 0.4rem 0.8rem;
		font-size: 0.8rem;
		border: 1px solid var(--border, rgba(125, 125, 125, 0.4));
		border-radius: 0.5rem;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	.demo-email {
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		border: 1px solid var(--border, rgba(125, 125, 125, 0.4));
		border-radius: 0.5rem;
		background: transparent;
		color: inherit;
	}
	.payload {
		margin: 0.75rem 0 0;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--border, rgba(125, 125, 125, 0.4));
		border-radius: 0.5rem;
		font-size: 0.8rem;
		overflow-x: auto;
	}
</style>
