<!-- src/routes/ui/input/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { FieldMessages, Form, Input, TextField } from '$components/form';

	let emailValue = $state('');
	let phoneValue = $state('');
	let numberValue = $state('');
	let textValue = $state('');
	// ── type='currency' ──
	let currencyVnd = $state('');
	let currencyUsd = $state('');
	let currencyCustom = $state('');
	let currencyCalc = $state('');
	let currencyForm = $state('');

	// ── type='file' (bind:files — File[] riêng, KHÔNG dùng value string) ──
	let singleFiles = $state<File[]>([]);
	let multipleFiles = $state<File[]>([]);
	let requiredFiles = $state<File[]>([]);
	let previewFiles = $state<File[]>([]);
	let disabledFiles = $state<File[]>([]);
	// Tùy chọn mới: details modal + quick delete + clear all
	let detailsFiles = $state<File[]>([]);
	let quickDeleteFiles = $state<File[]>([]);
	let clearableFiles = $state<File[]>([]);

	// ── type='barcode' (bind:codes — string[] riêng, KHÔNG dùng value string) ──
	let barcodeCodes = $state<string[]>([]);
	let barcodeImportCodes = $state<string[]>([]);
	let barcodeUpdateCodes = $state<string[]>([]);
	let barcodeSelectCodes = $state<string[]>([]);
	let barcodeAllCodes = $state<string[]>([]);
	let barcodeRequiredCodes = $state<string[]>([]);
	let barcodeDisabledCodes = $state<string[]>([]);
	// if-form barcode: gate submit theo page state (mirror if-form file)
	let barcodeFormCodes = $state<string[]>([]);
	let barcodeFormSubmitted = $state(false);
	function handleSubmitBarcode() {
		if (barcodeFormCodes.length === 0) return;
		barcodeFormSubmitted = true;
	}

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
	// Section ic-form: currency required (value = chuỗi raw) — gate riêng KHÔNG
	// dùng formValid (yêu cầu files + email của section if-form).
	let icFormSubmitted = $state(false);
	const icFormValid = $derived(currencyForm.replace(/\D/g, '').length > 0);
	function handleSubmitCurrency() {
		if (!icFormValid) return;
		icFormSubmitted = true;
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

	<!-- ──────────────── type='currency' ──────────────── -->

	<!-- VND (mặc định): symbol ₫ suffix, 0 decimals, nhóm nghìn vi-VN -->
	<section class="demo" data-test="ic-vnd">
		<h2>type=currency · VND (mặc định — ₫ suffix, 0 decimals)</h2>
		<div data-test="input-currency-vnd">
			<Input type="currency" bind:value={currencyVnd} placeholder="0" />
		</div>
		<p class="demo-hint">
			Gõ <code>1234</code> → auto format <code>1.234</code> + symbol <code>₫</code> bên phải.
			Blur → giữ nguyên (decimals=0).
		</p>
	</section>

	<!-- USD: symbol $ prefix, 2 decimals, nhóm nghìn en-US -->
	<section class="demo" data-test="ic-usd">
		<h2>type=currency · USD ($ prefix, 2 decimals)</h2>
		<div data-test="input-currency-usd">
			<Input type="currency" currency="USD" bind:value={currencyUsd} placeholder="0.00" />
		</div>
		<p class="demo-hint">
			Gõ <code>1234</code> → <code>1,234</code> + symbol <code>$</code> bên trái. Blur →
			<code>1,234.00</code> (decimals=2).
		</p>
	</section>

	<!-- Custom: symbol ghi đè + decimals ép + vị trí symbol -->
	<section class="demo" data-test="ic-custom">
		<h2>type=currency · custom (symbol="US$" + decimals=1 + suffix)</h2>
		<div data-test="input-currency-custom">
			<Input
				type="currency"
				currency="USD"
				symbol="US$"
				decimals={1}
				symbolPosition="suffix"
				bind:value={currencyCustom}
				placeholder="0.0"
			/>
		</div>
		<p class="demo-hint">
			Symbol <code>US$</code> ghi đè <code>$</code>, bên phải (suffix). Blur → 1 chữ số thập
			phân (decimals=1).
		</p>
	</section>

	<!-- autoCalculate: nhập biểu thức + - x / ( ) % → '=' hoặc blur tính -->
	<section class="demo" data-test="ic-calc">
		<h2>type=currency · autoCalculate (biểu thức + - x / ( ) %)</h2>
		<div data-test="input-currency-calc">
			<Input type="currency" bind:value={currencyCalc} placeholder="1.000+500" />
		</div>
		<p class="demo-hint">
			Gõ <code>1000+500</code> → nhấn <code>=</code> (hoặc blur) → <code>1.500</code>. Keyboard
			số mobile: <code>x</code> → nhân, <code>:</code> → chia.
		</p>
	</section>

	<!-- In Form: serialize string raw qua configs.value -->
	<section class="demo" data-test="ic-form">
		<h2>Trong Form (currency serialize — payload JSON)</h2>
		<Form onSubmit={handleSubmitCurrency}>
			<TextField name="ic-form-amount" required>
				<Input
					type="currency"
					name="ic-form-amount"
					currency="VND"
					bind:value={currencyForm}
					placeholder="0"
				/>
				<FieldMessages showValid />
			</TextField>
			<Button type="submit" color="success" variant="solid">
				{icFormSubmitted ? 'Đã submit ✓' : 'Submit'}
			</Button>
		</Form>
		<p class="demo-hint">
			Value serialize vào JSON payload dạng chuỗi raw (<code>"ic-form-amount": "150000"</code>).
			Chưa chọn số → required error; gõ số → valid (showValid).
		</p>
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

	<!-- File details: click card → modal chi tiết (ảnh size gốc + meta) -->
	<section class="demo" data-test="if-details">
		<h2>type=file · fileDetails (modal chi tiết)</h2>
		<TextField name="if-details">
			<Input
				type="file"
				bind:files={detailsFiles}
				multiple
				fileDetails
				accept="image/*,.csv,.json,.txt,.md"
			/>
		</TextField>
		<p class="demo-hint">
			Click vào 1 card → modal hiện ảnh size gốc + tên/kích thước (bytes)/loại (mime)/sửa lần cuối.
			<!-- File API KHÔNG có full path → chi tiết chỉ có name (+ webkitRelativePath nếu upload folder). -->
		</p>
	</section>

	<!-- Quick delete: tick card → thanh hành động xóa hàng loạt -->
	<section class="demo" data-test="if-quick-delete">
		<h2>type=file · quickDelete (tick + xóa hàng loạt)</h2>
		<TextField name="if-quick-delete">
			<Input type="file" bind:files={quickDeleteFiles} multiple quickDelete accept="image/*,.txt" />
		</TextField>
		<p class="demo-hint">
			Checkbox select-all (indeterminate khi một phần) + tick từng card (Checkbox component
			reuse) → thanh "Xóa N tệp đã chọn" hiện → xóa hàng loạt. Còn:
			<code>{quickDeleteFiles.length}</code>
		</p>
	</section>

	<!-- Clearable: nút Xóa tất cả ở header previews -->
	<section class="demo" data-test="if-clearable">
		<h2>type=file · clearable (Xóa tất cả)</h2>
		<TextField name="if-clearable">
			<Input type="file" bind:files={clearableFiles} multiple clearable required accept="image/*,.txt" />
		</TextField>
		<p class="demo-hint">
			Nút "Xóa tất cả" hiện khi ≥1 tệp (bên phải header previews) — click → danh sách rỗng,
			validation required về đúng nhịp (không bung).
			Còn: <code>{clearableFiles.length}</code>
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

	<!-- ──────────────── type='barcode' ──────────────── -->

	<!-- Base: input tay (Enter/cộng) + nút scanner camera + beep -->
	<section class="demo" data-test="ib-base">
		<h2>type=barcode · base (nhập tay + scanner camera + beep)</h2>
		<TextField name="ib-base">
			<Input
				type="barcode"
				bind:codes={barcodeCodes}
				cameraOn
				beepOn
				placeholder="Quét hoặc nhập mã (VD: 8938506952141)"
			/>
		</TextField>
		<p class="demo-hint">
			Nhập mã → <code>Enter</code> hoặc nút <code>+</code> → thêm vào danh sách. Nút scanner
			→ mở camera (native BarcodeDetector hoặc polyfill zbar-wasm). Beep 1 nốt khi quét
			được 1 mã, 2 nốt khi nhiều mã. Mã TRÙNG → toast + card hiện có rung/tỏa sáng,
			không thêm bản sao.
			Đã quét: <code>{barcodeCodes.length}</code>
		</p>
	</section>

	<!-- Import photo: chọn ảnh từ thư viện → detect barcode/QR trên ảnh tĩnh -->
	<section class="demo" data-test="ib-import">
		<h2>type=barcode · importOn (nhập ảnh → detect mã)</h2>
		<TextField name="ib-import">
			<Input
				type="barcode"
				bind:codes={barcodeImportCodes}
				importOn
				beepOn
				placeholder="Chọn ảnh chứa mã vạch/QR…"
			/>
		</TextField>
		<p class="demo-hint">
			Nút ảnh (indigo) → chọn 1 ảnh từ thư viện → detect trên ảnh tĩnh (không cần camera).
			1 mã → thêm thẳng; nhiều mã → overlay chọn vùng như scan; 0 mã → toast cảnh báo.
			Đã thêm: <code>{barcodeImportCodes.length}</code>
		</p>
	</section>

	<!-- Update/delete từng item -->
	<section class="demo" data-test="ib-update">
		<h2>type=barcode · updateOn + deleteOn (sửa/xóa từng mã)</h2>
		<TextField name="ib-update">
			<Input
				type="barcode"
				bind:codes={barcodeUpdateCodes}
				updateOn
				deleteOn
				placeholder="Nhập mã…"
			/>
		</TextField>
		<p class="demo-hint">
			Nút bút chì → input inline sửa mã (<code>Enter</code> commit, <code>Esc</code> hủy).
			Nút × → xóa khỏi danh sách.
		</p>
	</section>

	<!-- Select delete: tick card → xóa hàng loạt -->
	<section class="demo" data-test="ib-select-delete">
		<h2>type=barcode · selectDeleteOn (tick + xóa hàng loạt)</h2>
		<TextField name="ib-select-delete">
			<Input
				type="barcode"
				bind:codes={barcodeSelectCodes}
				selectDeleteOn
				selectAllButtonOn
				placeholder="Nhập mã…"
			/>
		</TextField>
		<p class="demo-hint">
			Tick ô tròn bên trái nhiều card → nút "Xóa N mã đã chọn" hiện → xóa hàng loạt.
			Nút "Chọn tất cả" (prop `selectAllButtonOn`) hiện khi ≥2 mã (header list) — bấm
			chọn hết, bấm lần nữa bỏ chọn hết; chọn một phần → đếm "Đã chọn X/Y".
			Còn: <code>{barcodeSelectCodes.length}</code>
		</p>
	</section>

	<!-- Select all: nút Xóa tất cả ở header list -->
	<section class="demo" data-test="ib-select-all">
		<h2>type=barcode · selectAllOn (Xóa tất cả)</h2>
		<TextField name="ib-select-all">
			<Input
				type="barcode"
				bind:codes={barcodeAllCodes}
				selectAllOn
				selectDeleteOn
				placeholder="Nhập mã…"
			/>
		</TextField>
		<p class="demo-hint">
			Nút "Xóa N mã đã chọn" (header, khi chọn ≥2) / "Xóa tất cả" (khi không tick card nào).
			Section này KHÔNG bật `selectAllButtonOn` → không có nút "Chọn tất cả" (xem
			section selectDeleteOn ở trên).
			Còn: <code>{barcodeAllCodes.length}</code>
		</p>
	</section>

	<!-- Required + FieldMessages (validate theo quy tắc chung) -->
	<section class="demo" data-test="ib-required">
		<h2>type=barcode · required (showValid)</h2>
		<TextField name="ib-required" required>
			<Input
				type="barcode"
				bind:codes={barcodeRequiredCodes}
				selectAllOn
				required
				placeholder="Nhập mã…"
			/>
			<FieldMessages showValid />
		</TextField>
		<p class="demo-hint">
			Required chưa có mã → error; thêm mã → ~300ms debounce lên "valid" (showValid);
			xóa hết → "error" lại.
		</p>
	</section>

	<!-- In Form: barcode required + submit gate (payload KHÔNG có barcode) -->
	<section class="demo" data-test="ib-form">
		<h2>Trong Form (barcode required + submit gate)</h2>
		<Form onSubmit={handleSubmitBarcode}>
			<TextField name="ib-form-code" required>
				<Input
					type="barcode"
					name="ib-form-code"
					bind:codes={barcodeFormCodes}
					required
					selectAllOn
					placeholder="Nhập mã…"
				/>
				<FieldMessages showValid />
			</TextField>
			<Button type="submit" color="success" variant="solid" disabled={barcodeFormCodes.length === 0}>
				{barcodeFormSubmitted ? 'Đã submit ✓' : 'Submit'}
			</Button>
		</Form>
		<p class="demo-hint">
			Nút Submit disabled tới khi có ≥1 mã. Form KHÔNG serialize barcode (configs không có
			key `value`) — page đọc qua bind:codes.
		</p>
	</section>

	<!-- Disabled: không tương tác -->
	<section class="demo" data-test="ib-disabled">
		<h2>type=barcode · disabled</h2>
		<TextField name="ib-disabled">
			<Input type="barcode" bind:codes={barcodeDisabledCodes} cameraOn disabled />
		</TextField>
		<p class="demo-hint">Barcode disabled: không nhập/scanner/xóa được.</p>
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
