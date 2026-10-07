<!-- src/routes/ui/input-otp/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { FieldMessages, Form, InputOtp } from '$components/form';

	// ── State (probe locate qua data-test) ──
	// Mỗi instance một bind:value RIÊNG (chống shared state giữa các case).
	let basicValue = $state('');
	let requiredValue = $state('');
	let showValid = $state(false);
	let disabledValue = $state('123456');

	// Form case: gate submit theo page state (đồng bộ với Form gate).
	let formOtp = $state('');
	let formSubmitted = $state(false);
	let formPayload = $state<string | null>(null);
	const formValid = $derived(formOtp.length === 6);
	function handleSubmit() {
		if (!formValid) return;
		formPayload = JSON.stringify({ otp: formOtp });
		formSubmitted = true;
	}

	// I8: controlled — parent set bind:value "777777" → 6 ô hiện 7.
	function setSeventySeven() {
		basicValue = '777777';
	}

	// Clearable case: state riêng (chống shared giữa các case)
	let clearableValue = $state('');
</script>

<div class="page" data-test="input-otp-demo">
	<h1 class="page-title">Input OTP · N ô nhập 1 ký tự (form field)</h1>

	<!-- 1. Basic 6 số -->
	<section class="demo" data-test="otp-basic">
		<h2>Basic 6 số (auto-advance + backspace + paste)</h2>
		<InputOtp bind:value={basicValue} aria-label="Mã OTP cơ bản" />
		<button class="mini-btn" data-test="otp-set777" onclick={setSeventySeven}>
			Set "777777"
		</button>
		<p class="demo-hint">
			Giá trị: <code data-test="otp-basic-value">{basicValue || '(trống)'}</code>
		</p>
	</section>

	<!-- 2. Required + FieldMessages (showValid toggle) -->
	<section class="demo" data-test="otp-required">
		<h2>Required + FieldMessages (showValid)</h2>
		<InputOtp name="otp-required" required bind:value={requiredValue} aria-label="Mã OTP bắt buộc">
			<FieldMessages showValid={showValid} />
		</InputOtp>
		<label class="toggle">
			<input type="checkbox" data-test="otp-showvalid" bind:checked={showValid} />
			Hiển thị message valid (showValid)
		</label>
		<p class="demo-hint">
			Nhập chưa đủ 6 → sau ~300ms debounce hiện error "bắt buộc" + ô viền đỏ; đủ 6
			→ success (ô viền xanh + message hợp lệ khi showValid bật).
		</p>
	</section>

	<!-- 3. Disabled -->
	<section class="demo" data-test="otp-disabled">
		<h2>Disabled</h2>
		<InputOtp bind:value={disabledValue} disabled aria-label="Mã OTP khoá" />
		<p class="demo-hint">Disabled: opacity 0.5 + not-allowed + không focusable (native disabled).</p>
	</section>

	<!-- 3b. Clearable (clear button khi ≥ 1 ô có dữ liệu) -->
	<section class="demo" data-test="otp-clearable">
		<h2>Clearable (nút xóa nhanh toàn bộ)</h2>
		<InputOtp clearable bind:value={clearableValue} aria-label="Mã OTP xóa nhanh" />
		<p class="demo-hint">
			Gõ ít nhất 1 số → nút xóa hiện bên phải các ô; click xóa toàn bộ + focus ô đầu.
			Toàn bộ rỗng → nút ẩn. Giá trị: <code data-test="otp-clearable-value">{clearableValue || '(trống)'}</code>
		</p>
	</section>

	<!-- 4. In Form — submit gate -->
	<section class="demo" data-test="otp-form">
		<h2>Trong Form (submit gate theo đủ 6 số)</h2>
		<Form onSubmit={handleSubmit}>
			<InputOtp name="otp-form" required bind:value={formOtp} aria-label="Mã OTP trong form">
				<FieldMessages />
			</InputOtp>
			<Button type="submit" color="success" variant="solid" disabled={!formValid}>
				{formSubmitted ? 'Đã submit ✓' : 'Submit'}
			</Button>
		</Form>
		{#if formPayload}
			<pre class="payload" data-test="otp-form-payload">{formPayload}</pre>
		{/if}
		<p class="demo-hint">Nút Submit disabled tới khi đủ 6 số.</p>
	</section>

	<!-- 5. Keyboard / numeric / paste guide -->
	<section class="demo" data-test="otp-guide">
		<h2>Keyboard · numeric · paste guide</h2>
		<ul class="guide">
			<li>
				<code>←</code> / <code>→</code> di chuyển giữa các ô (arrow key, preventDefault).
			</li>
			<li>
				<code>Backspace</code> trên ô rỗng → xóa ô trước + focus về ô đó.
			</li>
			<li>
				Gõ số → auto-advance sang ô kế tiếp. Chỉ nhận số (numeric filter bỏ
				non-digit).
			</li>
			<li>
				Gõ số vào ô <strong>đã có giá trị</strong> → ghi đè tại chỗ + auto-advance
				(như hành vi gõ thông thường).
			</li>
			<li>
				Paste chuỗi "123456" vào ô 0 → phân tán đầy 6 ô.
			</li>
			<li>
				<code>Ctrl/Cmd+C</code> khi focus trong component → copy value hiện tại vào
				clipboard; <code>Ctrl/Cmd+A</code> → select-all nội dung ô đang focus.
			</li>
			<li>
				Paste khi có ô đã có giá trị → ghi đè từ ô focus; paste chuỗi ngắn hơn số ô
				→ chỉ fill các ô tương ứng; ký tự không hợp lệ bị lọc bỏ.
			</li>
			<li>
				Prop <code>clearable</code> → nút xóa nhanh toàn bộ bên phải các ô (hiện khi
				≥ 1 ô chứa dữ liệu, ẩn khi toàn bộ rỗng).
			</li>
			<li>
				Native <code>autocomplete="one-time-code"</code> + <code>inputmode="numeric"</code>
				→ mobile keyboard số, autofill OTP chuẩn.
			</li>
		</ul>
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
		h2 {
			font-size: 1rem;
			font-weight: 600;
			margin-bottom: 0.75rem;
			opacity: 0.8;
		}
	}
	.demo-hint {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		opacity: 0.7;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		opacity: 0.8;
	}
	.mini-btn {
		margin-left: 0.75rem;
		padding: 0.25rem 0.6rem;
		font-size: 0.75rem;
		border: 1px solid var(--border, rgba(125, 125, 125, 0.4));
		border-radius: 0.4rem;
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
	.guide {
		margin: 0;
		padding-left: 1.2rem;
		font-size: 0.8rem;
		opacity: 0.85;
		li {
			margin-bottom: 0.35rem;
		}
	}
</style>
