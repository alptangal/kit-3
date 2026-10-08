<!-- src/routes/ui/switch/+page.svelte -->
<script lang="ts">
	import { iconify } from '$assets/icons/iconify';
	import { Button } from '$components/element';
	import { FieldMessages, Form, Input, TextField, Switch } from '$components/form';

	// ── State (probe locate qua data-test + .switch-root) ──
	let defaultA = $state(false);
	let defaultB = $state(true);

	let iconFixed = $state(true);
	let iconPair = $state(false);

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

	// sw-reset: test configs.reset() THẬT của component — đặt Switch trong <Form>
	// + button type="reset" → native `reset` event → Form handleEvents →
	// configs.reset() → childrens.child.reset() → checked = _initialChecked →
	// binding propagate về page `resetValue`. (configs.reset là method form-field,
	// Svelte 5 bind:this trên component bind root element nên không gọi trực tiếp.)
	let resetValue = $state(false);

	// sw-form: gate submit theo page state (Form không export configs → page tự
	// quản — mirror radiogroup/slider form demo). Switch required (boolean on)
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

<div class="page" data-test="switch-demo">
	<h1 class="page-title">Switch · form field (native button role=switch + icon trên thumb)</h1>

	<!-- 1) Default (bind:checked + label) -->
	<section class="demo" data-test="sw-default">
		<h2>Default (bind:checked + label)</h2>
		<Switch label="Dark mode" bind:checked={defaultA} aria-label="Dark mode" />
		<Switch label={{ en: 'Email notifications', vi: 'Thông báo email' }} bind:checked={defaultB} />
		<p class="demo-hint">
			Đang: <code data-test="sw-default-value">{defaultA ? 'on' : 'off'} / {defaultB ? 'on' : 'off'}</code>
			— click switch hoặc click label đều toggle.
		</p>
	</section>

	<!-- 2) Icon trên thumb (icon cố định / iconOn+iconOff đổi theo state) -->
	<section class="demo" data-test="sw-icon">
		<h2>Icon trên thumb (icon / iconOn + iconOff đổi theo state)</h2>
		<Switch
			label="Icon cố định"
			icon={iconify['info-i-rounded']}
			bind:checked={iconFixed}
			aria-label="Icon cố định"
		/>
		<Switch
			label="Cặp icon đổi state"
			iconOn={iconify['check-rounded']}
			iconOff={iconify['close-rounded']}
			bind:checked={iconPair}
			aria-label="Cặp icon đổi state"
		/>
		<p class="demo-hint">
			Icon nằm trên thumb (iconify, aria-hidden) — icon cố định hiển thị cả on/off;
			cặp iconOn/iconOff đổi khi bật/tắt. Đang:
			<code data-test="sw-icon-pair">{iconPair ? 'on' : 'off'}</code>
		</p>
	</section>

	<!-- 3) Sizes (xs/sm/md/lg/xl) -->
	<section class="demo" data-test="sw-sizes">
		<h2>Sizes (xs / sm / md / lg / xl)</h2>
		<div class="sizes-row">
			<Switch size="xs" label="XS" bind:checked={sizeValues.xs} />
			<Switch size="sm" label="SM" bind:checked={sizeValues.sm} />
			<Switch size="md" label="MD" bind:checked={sizeValues.md} />
			<Switch size="lg" label="LG" bind:checked={sizeValues.lg} />
			<Switch size="xl" label="XL" bind:checked={sizeValues.xl} />
		</div>
		<p class="demo-hint">Mọi đo lường nằm trên token size-* (track ≈ --min-height, width ≈ 1.75×).</p>
	</section>

	<!-- 4) Colors / on-state -->
	<section class="demo" data-test="sw-colors">
		<h2>Colors / on-state (default / primary / success / warning / error)</h2>
		<Switch color="default" label="Default (primary)" bind:checked={colorDefault} />
		<Switch color="primary" label="Primary" bind:checked={colorPrimary} />
		<Switch color="success" label="Success" bind:checked={colorSuccess} />
		<Switch color="warning" label="Warning" bind:checked={colorWarning} />
		<Switch color="error" label="Error" bind:checked={colorError} />
		<p class="demo-hint">On-track lấy màu semantic (var(--color) theo .color-*), off-track = token neutral.</p>
	</section>

	<!-- 5) Disabled + Loading -->
	<section class="demo" data-test="sw-disabled">
		<h2>Disabled</h2>
		<Switch checked={disabledOn} disabled label="Disabled (on)" />
		<Switch checked={disabledOff} disabled label="Disabled (off)" />
		<p class="demo-hint">Disabled: opacity token + not-allowed + không toggle được.</p>
	</section>
	<section class="demo" data-test="sw-loading">
		<h2>Loading</h2>
		<Switch label="Push notifications" bind:checked={loadingValue} loading={isLoading} onchange={handleLoadingToggle} />
		<p class="demo-hint">
			Loading (800ms mock API): opacity 0.7 + block click — sau đó giá trị commit.
			Đang: <code>{loadingValue ? 'on' : 'off'}</code>
		</p>
	</section>

	<!-- 6) Required + FieldMessages (showValid) -->
	<section class="demo" data-test="sw-required">
		<h2>Required + FieldMessages (showValid)</h2>
		<div class="field">
			<Switch
				name="required-optin"
				label="Bật tính năng (required)"
				required
				bind:checked={requiredValue}
			>
				<FieldMessages showValid />
			</Switch>
		</div>
		<p class="demo-hint">
			Chưa bật (chưa đổi) → message invalid; bật lên → sau ~300ms debounce message valid;
			vì là required, track đổi màu error/success khi đã đổi.
		</p>
	</section>

	<!-- 7) In Form (required + Input email + submit gate + payload boolean) -->
	<section class="demo" data-test="sw-form">
		<h2>Trong Form (required + submit gate + payload boolean)</h2>
		<Form onSubmit={handleSubmit}>
			<Switch
				name="consent"
				label="Tôi đồng ý (required)"
				required
				bind:checked={formConsent}
				delay={150}
			>
				<FieldMessages showValid />
			</Switch>

			<TextField name="sw-form-email" required>
				<Input type="email" bind:value={formEmail} placeholder="you@example.com" />
				<FieldMessages />
			</TextField>

			<Button type="submit" color="success" variant="solid" disabled={!formValid}>
				Submit
			</Button>
		</Form>
		{#if formPayload}
			<pre class="payload" data-test="sw-payload">{formPayload}</pre>
		{/if}
		<p class="demo-hint">
			Nút Submit disabled tới khi: switch bật + email đúng định dạng. Payload JSON hiện sau
			submit — <code>consent</code> serialize dạng <b>boolean</b> (Form đọc 'checked' in children).
		</p>
	</section>

	<!-- 8) Reset (configs.reset — form-field, Form gọi qua native `reset` event) -->
	<section class="demo" data-test="sw-reset">
		<h2>Reset (configs.reset)</h2>
		<Form>
			<Switch bind:checked={resetValue} label="Phím tắt minh họa" />
			<button class="demo-btn" type="reset" data-test="sw-reset-btn">
				Reset
			</button>
		</Form>
		<p class="demo-hint">
			Bật switch rồi bấm Reset → Form native reset event → configs.reset() → về giá trị
			ban đầu (off) + bỏ suppression validation.
			Đang: <code data-test="sw-reset-value">{resetValue ? 'on' : 'off'}</code>
		</p>
	</section>

	<!-- 9) Keyboard guide (native button: Space/Enter native) -->
	<section class="demo" data-test="sw-keyboard">
		<h2>Keyboard guide</h2>
		<div class="keyboard-guide">
			<ul>
				<li><kbd>Tab</kbd> — focus switch (native button, 1 stop)</li>
				<li><kbd>Space</kbd> / <kbd>Enter</kbd> — toggle (native button behavior)</li>
				<li>Click — toggle (switch hoặc label đều toggle)</li>
			</ul>
		</div>
		<Switch label="Keyboard demo" aria-label="Keyboard demo" />
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
