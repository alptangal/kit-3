<!-- src/routes/ui/datetime/+page.svelte -->
<!-- Demo InputDatetime: nhập tuần tự auto-advance + invalid (31/02) + paste + bind parent. -->
<script lang="ts">
	import { FieldMessages, InputDatetime, Label, TextField } from '$components/form';
	import { Button } from '$components/element';

	// ── State (probe locate qua data-test + .input-datetime-root) ──
	let dateValue = $state('');
	let dateOnlyValue = $state('');
	let sizeValue = $state('');
	let sizeSmValue = $state('');
	let disabledValue = $state('');
	let requiredValue = $state('');
	let pastedValue = $state('');

	// bind parent: value cha đọc được trực tiếp (ISO string)
	const parentEcho = $derived(dateValue || 'chưa có giá trị');

	function handleReset() {
		dateValue = '';
		dateOnlyValue = '';
		sizeValue = '';
		sizeSmValue = '';
		disabledValue = '';
		requiredValue = '';
		pastedValue = '';
	}
</script>

<div class="page" data-test="datetime-demo">
	<h1 class="page-title">InputDatetime · nhóm ô tuần tự (năm · tháng · ngày · giờ · phút)</h1>

	<!-- Basic: nhập đủ + bind parent -->
	<section class="demo" data-test="dt-basic">
		<h2>Basic (bind parent, value ISO)</h2>
		<TextField name="dt-basic" required>
			<Label>Ngày sinh</Label>
			<InputDatetime
				bind:value={dateValue}
				required
				clearable
				aria-label="Ngày sinh demo"
			/>
			<FieldMessages showValid />
		</TextField>
		<p class="demo-hint">
			Value cha: <code data-test="dt-value-echo">{parentEcho}</code>
		</p>
	</section>

	<!-- Date only (hideTime) -->
	<section class="demo" data-test="dt-dateonly">
		<h2>Date only (hideTime — 3 ô năm/tháng/ngày)</h2>
		<TextField name="dt-dateonly" required>
			<Label>Ngày</Label>
			<InputDatetime
				bind:value={dateOnlyValue}
				required
				hideTime
				aria-label="Ngày demo"
			/>
			<FieldMessages showValid />
		</TextField>
		<p class="demo-hint">
			Value: <code>{dateOnlyValue || 'chưa có'}</code>
		</p>
	</section>

	<!-- Sizes -->
	<section class="demo" data-test="dt-sizes">
		<h2>Sizes (size-md / size-sm)</h2>
		<InputDatetime bind:value={sizeValue} size="md" aria-label="Size MD" />
		<InputDatetime bind:value={sizeSmValue} size="sm" aria-label="Size SM" />
	</section>

	<!-- Required + invalid ngày (31/02) -->
	<section class="demo" data-test="dt-required">
		<h2>Required + ngày invalid (31/02 → báo lỗi)</h2>
		<TextField name="dt-required" required>
			<Label>Ngày giờ (required)</Label>
			<InputDatetime
				bind:value={requiredValue}
				required
				aria-label="Ngày giờ required demo"
			/>
			<FieldMessages showValid />
		</TextField>
		<p class="demo-hint">
			Value: <code>{requiredValue || 'chưa có'}</code> — nhập tháng 02 + ngày 31 → sau ~300ms
			debounce message "invalid" (không đủ ngày); nhập hợp lệ → "valid".
		</p>
	</section>

	<!-- Paste tán ô -->
	<section class="demo" data-test="dt-paste">
		<h2>Paste tán ô (chuỗi liên tục / ISO)</h2>
		<TextField name="dt-paste">
			<Label>Dán ngày giờ</Label>
			<InputDatetime
				bind:value={pastedValue}
				aria-label="Paste demo"
			/>
			<FieldMessages />
		</TextField>
		<p class="demo-hint">
			Paste <code>200001150830</code> hoặc <code>2000-01-15T08:30</code> vào ô đầu → tán vào các
			ô. Value: <code>{pastedValue || 'chưa có'}</code>
		</p>
	</section>

	<!-- Disabled -->
	<section class="demo" data-test="dt-disabled">
		<h2>Disabled</h2>
		<InputDatetime bind:value={disabledValue} disabled aria-label="Disabled demo" />
	</section>

	<!-- Keyboard guide -->
	<section class="demo" data-test="dt-keyboard">
		<h2>Keyboard guide</h2>
		<div class="keyboard-guide">
			<ul>
				<li><kbd>Tab</kbd> — vào ô đầu (mỗi ô là 1 stop, native input)</li>
				<li><kbd>ArrowLeft</kbd> / <kbd>ArrowRight</kbd> — di ô trước / kế</li>
				<li>Điền đủ chữ số nhóm (năm=4, khác=2) → tự nhảy ô kế</li>
				<li><kbd>Backspace</kbd> ô rỗng → về ô trước + xóa ô trước (qua nhóm)</li>
				<li><kbd>Delete</kbd> — xóa ô hiện tại</li>
				<li><kbd>Ctrl+A</kbd> / <kbd>Ctrl+C</kbd> — select-all / copy ô focus</li>
			</ul>
		</div>
	</section>

	<div class="demo-actions">
		<Button type="button" color="error" variant="ghost" size="sm" onclick={handleReset}>
			Reset tất cả
		</Button>
	</div>
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
	.demo-actions {
		margin-top: 1.5rem;
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
	code {
		font-family: monospace;
		font-size: 0.85rem;
	}
</style>
