<!-- src/routes/ui/input/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { FieldMessages, Form, Input, TextField } from '$components/form';

	let emailValue = $state('');
	let phoneValue = $state('');
	let numberValue = $state('');
	let textValue = $state('');

	// ── type='file' (bind:files — File[] riêng, KHÔNG dùng value string) ──
	let singleFiles = $state<File[]>([]);
	let multipleFiles = $state<File[]>([]);
	let requiredFiles = $state<File[]>([]);
	let previewFiles = $state<File[]>([]);
	let disabledFiles = $state<File[]>([]);

	// if-form: gate submit theo page state (Form không export configs → page tự quản).
	// File input required → phải có ≥1 tệp. Form KHÔNG serialize file (configs không
	// có key `value`) → payload chỉ gồm email, probe FI7 kiểm tra.
	let formFiles = $state<File[]>([]);
	let formEmail = $state('');
	let formSubmitted = $state(false);
	const emailOk = $derived(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formEmail.trim()));
	const formValid = $derived(formFiles.length > 0 && emailOk);
	function handleSubmit() {
		if (!formValid) return;
		formSubmitted = true;
	}
</script>

<div class="page" data-test="input-demo">
	<h1 class="page-title">Input component · per data-type</h1>

	<!-- Email: chặn space, chỉ nhận [a-z0-9@._+-] -->
	<section class="demo">
		<h2>type=email (filter: không nhận space / ký tự lạ)</h2>
		<div data-test="input-email">
			<Input type="email" bind:value={emailValue} placeholder="name@example.com" />
		</div>
		<p class="demo-hint">Gõ <code>a b @ . com</code> → space bị chặn.</p>
	</section>

	<!-- Phone: nhận số + dấu + - ( ) và space -->
	<section class="demo">
		<h2>type=phone (filter: số + dấu + - ( ) · render type="tel")</h2>
		<div data-test="input-phone">
			<Input type="phone" bind:value={phoneValue} placeholder="+84 90 1234 567" />
		</div>
		<p class="demo-hint">Gõ <code>+ ( ) - 0123 </code> → chấp nhận; <code>a@</code> bị chặn.</p>
	</section>

	<!-- Number: giữ hành vi hiện có -->
	<section class="demo">
		<h2>type=number (bất biến)</h2>
		<div data-test="input-number">
			<Input type="number" bind:value={numberValue} placeholder="0" />
		</div>
	</section>

	<!-- Text (mặc định) -->
	<section class="demo">
		<h2>type=text (mặc định)</h2>
		<div data-test="input-text">
			<Input type="text" bind:value={textValue} placeholder="text tự do" />
		</div>
	</section>

	<!-- ──────────────── type='file' ──────────────── -->

	<!-- Single-select: chọn mới thay thế (không append) -->
	<section class="demo" data-test="if-single">
		<h2>type=file · single-select (chọn mới thay thế)</h2>
		<TextField name="if-single">
			<Input type="file" bind:files={singleFiles} accept="image/*,.pdf" />
		</TextField>
		<p class="demo-hint">
			Đã chọn: <code>{singleFiles.length ? singleFiles.map((f) => f.name).join(', ') : 'chưa có'}</code>
			— chọn tệp thứ 2 thay thế tệp cũ.
		</p>
	</section>

	<!-- Multiple + maxFiles: append, cap 3 -->
	<section class="demo" data-test="if-multiple">
		<h2>type=file · multiple (maxFiles=3)</h2>
		<TextField name="if-multiple">
			<Input type="file" bind:files={multipleFiles} multiple maxFiles={3} accept=".png,.txt,.csv" />
		</TextField>
		<p class="demo-hint">
			Đã chọn: <code>{multipleFiles.length}/3</code> — chọn vượt cap sẽ bị cắt ở 3 tệp.
		</p>
	</section>

	<!-- Required + FieldMessages + maxSize (showValid) -->
	<section class="demo" data-test="if-required">
		<h2>type=file · required + maxSize (showValid)</h2>
		<TextField name="if-required" required>
			<Input type="file" bind:files={requiredFiles} required accept="image/*" maxSize={2 * 1024 * 1024} />
			<FieldMessages showValid />
		</TextField>
		<p class="demo-hint">
			Đã chọn: <code>{requiredFiles.length ? requiredFiles.map((f) => f.name).join(', ') : 'chưa có'}</code> —
			required chưa chọn → pending; chọn ảnh → ~300ms debounce lên "valid" (showValid); xóa hết → "error".
		</p>
	</section>

	<!-- Preview: đa định dạng (image / csv / json / txt) -->
	<section class="demo" data-test="if-preview">
		<h2>type=file · preview (ảnh + text-based)</h2>
		<TextField name="if-preview">
			<Input type="file" bind:files={previewFiles} multiple accept="image/*,.csv,.json,.txt,.md" />
		</TextField>
		<p class="demo-hint">
			Ảnh → thumbnail; CSV/JSON/TEXT → nội dung vài dòng đầu; khác → tên + size.
			Đã chọn: <code>{previewFiles.length ? previewFiles.map((f) => f.name).join(', ') : 'chưa có'}</code>
		</p>
	</section>

	<!-- In Form: file required + email + submit gate (payload KHÔNG có file) -->
	<section class="demo" data-test="if-form">
		<h2>Trong Form (file required + submit gate)</h2>
		<Form onSubmit={handleSubmit}>
			<TextField name="if-form-file" required>
				<Input type="file" name="if-form-file" bind:files={formFiles} required accept="image/*,.pdf" />
				<FieldMessages showValid />
			</TextField>
			<TextField name="if-form-email" required>
				<Input type="email" bind:value={formEmail} placeholder="you@example.com" />
				<FieldMessages />
			</TextField>
			<Button type="submit" color="success" variant="solid" disabled={!formValid}>
				{formSubmitted ? 'Đã submit ✓' : 'Submit'}
			</Button>
		</Form>
		<p class="demo-hint">
			Nút Submit disabled tới khi: đã chọn tệp + email đúng định dạng.
			Form KHÔNG serialize file (configs không có key `value`) — page upload qua FormData + bind:files.
		</p>
	</section>

	<!-- Disabled: dropzone không tương tác -->
	<section class="demo" data-test="if-disabled">
		<h2>type=file · disabled</h2>
		<TextField name="if-disabled">
			<Input type="file" bind:files={disabledFiles} disabled />
		</TextField>
		<p class="demo-hint">Dropzone disabled: không click/drag-drop được, không focus.</p>
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
</style>
