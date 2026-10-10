<!-- src/routes/ui/datetime/+page.svelte -->
<!-- Demo InputDatetime: nhập tuần tự auto-advance + invalid (31/02) + paste + bind parent. -->
<script lang="ts">
	import { FieldMessages, InputDatetime, Label, TextField } from '$components/form';
	import { Button } from '$components/element';
	import type { InputDatetimeFormat } from '$components/form/input-datetime/_interface';

	// ── State (probe locate qua data-test + .input-datetime-root) ──
	let dateValue = $state('');
	let dateOnlyValue = $state('');
	let sizeValue = $state('');
	let sizeSmValue = $state('');
	let disabledValue = $state('');
	let requiredValue = $state('');
	let pastedValue = $state('');

	// ── Format đa ngôn ngữ (props.format — display order + separator) ──
	const FORMAT_TABS: { id: InputDatetimeFormat; label: string; hint: string }[] = [
		{ id: 'ymd', label: 'yyyy-mm-dd', hint: 'ISO · Nhật/Trung' },
		{ id: 'dmy', label: 'dd/mm/yyyy', hint: 'VN · châu Âu' },
		{ id: 'mdy', label: 'mm/dd/yyyy', hint: 'Mỹ' }
	];
	let formatTab = $state<InputDatetimeFormat>('dmy');
	let formatValue = $state('');
	let formatHideTime = $state(false);

	// ── Picker + giới hạn năm (props.datePicker + minYear/maxYear) ──
	let pickerValue = $state('');
	let pickerHideTime = $state(true);

	// ── Snap cross-field (2/2000 → 29 · 2/2001 → 28) ──
	let clampValue = $state('');

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
		formatValue = '';
		pickerValue = '';
		clampValue = '';
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

	<!-- Format đa ngôn ngữ (ymd / dmy / mdy) -->
	<section class="demo" data-test="dt-format">
		<h2>Format đa ngôn ngữ (ymd / dmy / mdy)</h2>
		<div class="format-tabs" role="tablist" aria-label="Format nhóm ngày">
			{#each FORMAT_TABS as tab (tab.id)}
				<button
					type="button"
					class="format-tab"
					class:active={formatTab === tab.id}
					data-test="dt-format-tab-{tab.id}"
					aria-pressed={formatTab === tab.id}
					onclick={() => (formatTab = tab.id)}
				>
					{tab.label}
					<span class="format-hint">{tab.hint}</span>
				</button>
			{/each}
		</div>
		<label class="check-row">
			<input type="checkbox" bind:checked={formatHideTime} data-test="dt-format-hidetime" />
			hideTime (chỉ nhóm ngày)
		</label>
		<TextField name="dt-format" required>
			<Label>Ngày theo format</Label>
			<InputDatetime
				bind:value={formatValue}
				required
				clearable
				format={formatTab}
				hideTime={formatHideTime}
				aria-label="Ngày theo format demo"
			/>
			<FieldMessages showValid />
		</TextField>
		<p class="demo-hint">
			Value ISO (không đổi theo format): <code data-test="dt-format-echo">{formatValue || 'chưa có'}</code>
		</p>
	</section>

	<!-- Picker + min/maxYear (nút lịch → panel DatePicker) -->
	<section class="demo" data-test="dt-picker">
		<h2>DatePicker button + min/maxYear (1900–2030)</h2>
		<label class="check-row">
			<input type="checkbox" bind:checked={pickerHideTime} data-test="dt-picker-hidetime" />
			hideTime (picker chỉ chọn ngày)
		</label>
		<TextField name="dt-picker" required>
			<Label>Ngày qua lịch</Label>
			<InputDatetime
				bind:value={pickerValue}
				required
				clearable
				datePicker
				minYear={1900}
				maxYear={2030}
				hideTime={pickerHideTime}
				aria-label="Ngày qua lịch demo"
			/>
			<FieldMessages showValid />
		</TextField>
		<p class="demo-hint">
			Nút lịch bên phải các ô → panel DatePicker (min/max chặn 1900–2030). Value:
			<code data-test="dt-picker-echo">{pickerValue || 'chưa có'}</code>
		</p>
	</section>

	<!-- Snap cross-field (validate khi gõ + auto-sync giữa các ô) -->
	<section class="demo" data-test="dt-clamp">
		<h2>Snap khi gõ + cross-field (tháng 2/2000 → 29 · 2/2001 → 28)</h2>
		<TextField name="dt-clamp" required>
			<Label>Ngày sinh (auto-clamp)</Label>
			<InputDatetime
				bind:value={clampValue}
				required
				clearable
				hideTime
				format="dmy"
				minYear={1900}
				maxYear={2030}
				aria-label="Ngày auto-clamp demo"
			/>
			<FieldMessages showValid />
		</TextField>
		<p class="demo-hint">
			Gõ <code>dd/mm/2000</code> ngày 31 → snap 29 (năm nhuận); <code>2001</code> → 28. Tháng
			<code>00</code> → 01, <code>13</code> → 12. Năm <code>1899</code> → 1900, <code>9999</code>
			→ 2030. Value: <code data-test="dt-clamp-echo">{clampValue || 'chưa có'}</code>
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
	.format-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.format-tab {
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem;
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--border, rgba(125, 125, 125, 0.4));
		border-radius: 999px;
		background: transparent;
		color: var(--foreground);
		font-family: monospace;
		font-size: 0.8rem;
		cursor: pointer;
		&.active {
			border-color: var(--primary, #6366f1);
			color: var(--primary, #6366f1);
			font-weight: 600;
		}
		.format-hint {
			font-family: inherit;
			font-size: 0.7rem;
			opacity: 0.65;
		}
	}
	.check-row {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.75rem;
		font-size: 0.85rem;
		cursor: pointer;
		input {
			cursor: pointer;
		}
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
