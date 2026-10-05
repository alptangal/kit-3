<!-- src/routes/ui/toggle/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { FieldMessages, Form, Input, TextField, Toggle } from '$components/form';

	// ── State (probe locate qua data-test + .toggle-root) ──
	let defaultA = $state(false);
	let defaultB = $state(true);

	let sizeValues = $state({ xs: false, sm: false, md: true, lg: false, xl: false });

	let colorDefault = $state(true);
	let colorPrimary = $state(true);
	let colorSuccess = $state(true);
	let colorWarning = $state(true);
	let colorError = $state(true);

	let disabledOn = $state(true);
	let disabledOff = $state(false);
	let loadingValue = $state(false);
	let isLoading = $state(false);

	async function handleLoadingToggle(checked: boolean) {
		if (isLoading) return;
		isLoading = true;
		await new Promise((resolve) => setTimeout(resolve, 800));
		loadingValue = checked;
		isLoading = false;
	}

	let requiredValue = $state(false);

	// tg-reset: test configs.reset() THẬT của component — đặt Toggle trong <Form>
	// + button type="reset" → native `reset` event → Form handleEvents →
	// configs.reset() → childrens.child.reset() → checked = _initialChecked →
	// binding propagate về page `resetValue`. (configs.reset là method form-field,
	// Svelte 5 bind:this trên component bind root element nên không gọi trực tiếp.)
	let resetValue = $state(false);

	// tg-form: gate submit theo page state (Form không export configs → page tự
	// quản — mirror radiogroup/slider form demo). Toggle required (boolean on)
	// + email → submit.
	let formConsent = $state(false);
	let formEmail = $state('');
	let formPayload = $state<string | null>(null);
	const emailOk = $derived(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formEmail.trim()));
	const formValid = $derived(!!formConsent && emailOk);
	function handleSubmit() {
		if (!formValid) return;
		formPayload = JSON.stringify({
			consent: formConsent,
			email: formEmail
		});
	}
</script>

<div class="page" data-test="toggle-demo">
	<h1 class="page-title">Toggle · switch (native button role=switch + form field)</h1>

	<!-- 1) Default (bind:checked + label) -->
	<section class="demo" data-test="tg-default">
		<h2>Default (bind:checked + label)</h2>
		<Toggle label="Dark mode" bind:checked={defaultA} aria-label="Dark mode" />
		<Toggle label={{ en: 'Email notifications', vi: 'Thông báo email' }} bind:checked={defaultB} />
		<p class="demo-hint">
			Đang: <code data-test="tg-default-value">{defaultA ? 'on' : 'off'} / {defaultB ? 'on' : 'off'}</code>
			— click switch hoặc click label đều toggle.
		</p>
	</section>

	<!-- 2) Sizes (xs/sm/md/lg/xl) -->
	<section class="demo" data-test="tg-sizes">
		<h2>Sizes (xs / sm / md / lg / xl)</h2>
		<div class="sizes-row">
			<Toggle size="xs" label="XS" bind:checked={sizeValues.xs} />
			<Toggle size="sm" label="SM" bind:checked={sizeValues.sm} />
			<Toggle size="md" label="MD" bind:checked={sizeValues.md} />
			<Toggle size="lg" label="LG" bind:checked={sizeValues.lg} />
			<Toggle size="xl" label="XL" bind:checked={sizeValues.xl} />
		</div>
		<p class="demo-hint">Mọi đo lường nằm trên token size-* (track ≈ --min-height, width ≈ 1.75×).</p>
	</section>

	<!-- 3) Colors / on-state -->
	<section class="demo" data-test="tg-colors">
		<h2>Colors / on-state (default / primary / success / warning / error)</h2>
		<Toggle color="default" label="Default (primary)" bind:checked={colorDefault} />
		<Toggle color="primary" label="Primary" bind:checked={colorPrimary} />
		<Toggle color="success" label="Success" bind:checked={colorSuccess} />
		<Toggle color="warning" label="Warning" bind:checked={colorWarning} />
		<Toggle color="error" label="Error" bind:checked={colorError} />
		<p class="demo-hint">On-track lấy màu semantic (var(--color) theo .color-*), off-track = token neutral.</p>
	</section>

	<!-- 4) Disabled + Loading -->
	<section class="demo" data-test="tg-disabled">
		<h2>Disabled</h2>
		<Toggle checked={disabledOn} disabled label="Disabled (on)" />
		<Toggle checked={disabledOff} disabled label="Disabled (off)" />
		<p class="demo-hint">Disabled: opacity token + not-allowed + không toggle được.</p>
	</section>
	<section class="demo" data-test="tg-loading">
		<h2>Loading</h2>
		<Toggle label="Push notifications" bind:checked={loadingValue} loading={isLoading} onchange={handleLoadingToggle} />
		<p class="demo-hint">
			Loading (800ms mock API): opacity 0.7 + block click — sau đó giá trị commit.
			Đang: <code>{loadingValue ? 'on' : 'off'}</code>
		</p>
	</section>

	<!-- 5) Required + FieldMessages (showValid) -->
	<section class="demo" data-test="tg-required">
		<h2>Required + FieldMessages (showValid)</h2>
		<div class="field">
			<Toggle
				name="required-optin"
				label="Bật tính năng (required)"
				required
				bind:checked={requiredValue}
			>
				<FieldMessages showValid />
			</Toggle>
		</div>
		<p class="demo-hint">
			Chưa bật (chưa đổi) → message invalid; bật lên → sau ~300ms debounce message valid;
			vì là required, track đổi màu error/success khi đã đổi.
		</p>
	</section>

	<!-- 6) In Form (required + Input email + submit gate + payload boolean) -->
	<section class="demo" data-test="tg-form">
		<h2>Trong Form (required + submit gate + payload boolean)</h2>
		<Form onSubmit={handleSubmit}>
			<Toggle
				name="consent"
				label="Tôi đồng ý (required)"
				required
				bind:checked={formConsent}
				delay={150}
			>
				<FieldMessages showValid />
			</Toggle>

			<TextField name="tg-form-email" required>
				<Input type="email" bind:value={formEmail} placeholder="you@example.com" />
				<FieldMessages />
			</TextField>

			<Button type="submit" color="success" variant="solid" disabled={!formValid}>
				Submit
			</Button>
		</Form>
		{#if formPayload}
			<pre class="payload" data-test="tg-payload">{formPayload}</pre>
		{/if}
		<p class="demo-hint">
			Nút Submit disabled tới khi: toggle bật + email đúng định dạng. Payload JSON hiện sau
			submit — <code>consent</code> serialize dạng <b>boolean</b> (Form đọc 'checked' in children).
		</p>
	</section>

	<!-- 7) Reset (configs.reset — form-field, Form gọi qua native `reset` event) -->
	<section class="demo" data-test="tg-reset">
		<h2>Reset (configs.reset)</h2>
		<Form>
			<Toggle bind:checked={resetValue} label="Phím tắt minh họa" />
			<button class="demo-btn" type="reset" data-test="tg-reset-btn">
				Reset
			</button>
		</Form>
		<p class="demo-hint">
			Bật toggle rồi bấm Reset → Form native reset event → configs.reset() → về giá trị
			ban đầu (off) + bỏ suppression validation.
			Đang: <code data-test="tg-reset-value">{resetValue ? 'on' : 'off'}</code>
		</p>
	</section>

	<!-- 8) Keyboard guide (native button: Space/Enter native) -->
	<section class="demo" data-test="tg-keyboard">
		<h2>Keyboard guide</h2>
		<div class="keyboard-guide">
			<ul>
				<li><kbd>Tab</kbd> — focus switch (native button, 1 stop)</li>
				<li><kbd>Space</kbd> / <kbd>Enter</kbd> — toggle (native button behavior)</li>
				<li>Click — toggle (switch hoặc label đều toggle)</li>
			</ul>
		</div>
		<Toggle label="Keyboard demo" aria-label="Keyboard demo" />
		<p class="demo-hint">Switch là <code>&lt;button role="switch"&gt;</code> — không cần keydown handler riêng.</p>
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
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
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
	.payload {
		margin: 0.75rem 0 0;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--border, rgba(125, 125, 125, 0.4));
		border-radius: 0.5rem;
		font-size: 0.8rem;
		overflow-x: auto;
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
