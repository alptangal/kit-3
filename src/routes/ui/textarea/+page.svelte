<!-- src/routes/ui/textarea/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { FieldMessages, Form, Input, TextField } from '$components/form';
	import { Textarea } from '$components/form';

	// ── State (probe locate qua data-test) ──
	let basicValue = $state('');
	let requiredValue = $state('');
	let showValid = $state(false);
	let autoValue = $state('');
	let maxCount = $state('');
	let sizesValue = $state('');

	// ta-form: gate submit theo page state (đồng bộ với Form gate).
	let formComment = $state('');
	let formEmail = $state('');
	let formSubmitted = $state(false);
	let formPayload = $state<string | null>(null);
	const emailOk = $derived(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formEmail.trim()));
	const formValid = $derived(formComment.trim().length > 0 && emailOk);
	function handleSubmit() {
		if (!formValid) return;
		formPayload = JSON.stringify({
			comment: formComment,
			email: formEmail
		});
		formSubmitted = true;
	}
</script>

<div class="page" data-test="textarea-demo">
	<h1 class="page-title">Textarea · native textarea + form field</h1>

	<!-- Basic + placeholder -->
	<section class="demo" data-test="ta-basic">
		<h2>Basic + placeholder</h2>
		<Textarea
			bind:value={basicValue}
			placeholder={{ en: 'Write something...', vi: 'Viết gì đó...' }}
			aria-label="Basic textarea"
		/>
		<p class="demo-hint">
			Giá trị: <code>{basicValue || '(trống)'}</code>
		</p>
	</section>

	<!-- Required + FieldMessages (showValid toggle) -->
	<section class="demo" data-test="ta-required">
		<h2>Required + FieldMessages (showValid)</h2>
		<Textarea name="ta-required" required bind:value={requiredValue} aria-label="Required textarea">
			<FieldMessages showValid={showValid} />
		</Textarea>
		<label class="toggle">
			<input type="checkbox" data-test="ta-showvalid" bind:checked={showValid} />
			Hiển thị message valid (showValid)
		</label>
		<p class="demo-hint">
			Nhập → blur → xoá sạch (rỗng) → sau ~300ms debounce hiện error "bắt buộc";
			nhập hợp lệ → success (khi showValid bật).
		</p>
	</section>

	<!-- Auto-resize -->
	<section class="demo" data-test="ta-auto">
		<h2>Auto-resize (max-height 20rem)</h2>
		<Textarea
			bind:value={autoValue}
			autoResize
			rows={3}
			placeholder="Nhập nhiều dòng để thấy height giãn..."
			aria-label="Auto-resize textarea"
		/>
		<p class="demo-hint">Height giãn theo nội dung (min-height theo rows=3, clamp 20rem).</p>
	</section>

	<!-- MaxLength + counter -->
	<section class="demo" data-test="ta-maxlength">
		<h2>MaxLength (100) + counter</h2>
		<Textarea bind:value={maxCount} maxLength={100} aria-label="Max length textarea" />
		<p class="demo-hint">
			Đã nhập: <code data-test="ta-counter">{maxCount.length}/100</code>
		</p>
	</section>

	<!-- Disabled + readOnly -->
	<section class="demo" data-test="ta-disabled">
		<h2>Disabled + readOnly</h2>
		<Textarea value="Đoạn bị khoá — disabled" disabled aria-label="Disabled textarea" />
		<Textarea
			value="Đoạn chỉ đọc — readonly (vẫn focusable)"
			readOnly
			aria-label="Read-only textarea"
		/>
		<p class="demo-hint">Disabled: opacity + not-allowed; readOnly: cursor default, vẫn focus.</p>
	</section>

	<!-- Sizes -->
	<section class="demo" data-test="ta-sizes">
		<h2>Sizes (sm / md / lg)</h2>
		<Textarea size="sm" value="size-sm" aria-label="Size sm" />
		<Textarea size="md" value="size-md" aria-label="Size md" />
		<Textarea size="lg" value="size-lg" aria-label="Size lg" />
	</section>

	<!-- In Form: Textarea required + Input email + submit gate + payload -->
	<section class="demo" data-test="ta-form">
		<h2>Trong Form (required + submit gate + payload)</h2>
		<Form onSubmit={handleSubmit}>
			<Textarea name="ta-form-comment" required bind:value={formComment} aria-label="Comment">
				<FieldMessages />
			</Textarea>

			<TextField name="ta-form-email" required>
				<Input type="email" bind:value={formEmail} placeholder="you@example.com" />
				<FieldMessages />
			</TextField>

			<Button type="submit" color="success" variant="solid" disabled={!formValid}>
				{formSubmitted ? 'Đã submit ✓' : 'Submit'}
			</Button>
		</Form>
		{#if formPayload}
			<pre class="payload" data-test="ta-payload">{formPayload}</pre>
		{/if}
		<p class="demo-hint">
			Nút Submit disabled tới khi: comment có chữ + email đúng định dạng. Payload JSON
			hiện sau submit.
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
	.payload {
		margin: 0.75rem 0 0;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--border, rgba(125, 125, 125, 0.4));
		border-radius: 0.5rem;
		font-size: 0.8rem;
		overflow-x: auto;
	}
</style>
