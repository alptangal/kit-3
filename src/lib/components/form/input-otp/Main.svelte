<script lang="ts">
	// src/lib/components/form/input-otp/Main.svelte
	// FORM FIELD — mirror mẫu textarea/radiogroup: configs $state + Symbol context
	// + form registration + validation debounce + _justReset.
	// Render: N ô (length prop), mỗi ô = 1 native <input maxlength=1> (giữ
	// keyboard/autocomplete chuẩn). value = string compact của các ô → form
	// serialize an toàn ('value' in children → string).
	import { convertToMiliseconds, styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { getFormContext } from '../form';
	import { setInputOtpContext, defaultValidation } from './index';
	import type { InputOtpConfigs, InputOtpProps, OtpType } from './_interface';
	import type { ValidationFull } from '../input/_interface';

	let { value = $bindable(), children, ...props }: InputOtpProps = $props();
	const formContext = getFormContext();

	// Số ô — clamp an toàn (1..24), default 6
	const length = Math.min(24, Math.max(1, props.length ?? 6));
	const otpType: OtpType = props.type ?? 'numeric';

	// Mốc ban đầu (mốc reset + tính status.changed)
	let _initialValue: string = value ?? '';
	// Programmatic reset → đè validation cho tới khi user tương tác lại
	let _justReset = $state(true);
	// Native name — stable, sinh 1 lần (unique, không collision)
	const stableName = (() => {
		if (props.name) return props.name;
		return `otp-${Math.random().toString(36).slice(2, 10)}`;
	})();

	// Refs của N ô (DOM focus management)
	let boxRefs: HTMLInputElement[] = [];
	// Ô đang focus (roving arrow left/right + focus tracking)
	let activeIndex = $state(0);

	// boxes = nội dung từng ô (array literal trong $state → mỗi phần tử reactive)
	let boxes = $state(Array.from({ length }, () => ''));

	// Clear button (props.clearable): hiện khi ≥ 1 ô chứa dữ liệu — value compact
	// khác rỗng (giống pattern Input clear button: ẩn khi toàn bộ rỗng)
	const hasValue = $derived((value ?? '').length > 0);

	// Lọc ký tự: numeric → chỉ 0-9; text → bỏ whitespace
	function filterChar(ch: string): string {
		if (otpType === 'numeric') return ch.replace(/\D/g, '');
		return ch.replace(/\s/g, '');
	}

	// Phân tán compact value → boxes (chỉ chạy khi value EXTERNAL khác boxes —
	// user gõ từng ô thì value đã sync bằng syncValue() nên v === joined →
	// KHÔNG reassign (tránh loop effect)).
	$effect(() => {
		const v = value ?? '';
		const joined = boxes.join('');
		if (v === joined) return;
		boxes = v.slice(0, length).split('');
		while (boxes.length < length) boxes.push('');
	});

	// Đồng bộ value (compact string) từ boxes — nguồn sự thật reverse (user gõ →
	// parent state). Gọi trong mỗi input handler (mirror input/Main "value = ...").
	function syncValue() {
		value = boxes.join('');
	}

	// boxes → DOM input: boxes là nguồn sự thật của từng ô. KHÔNG dùng
	// bind:value={boxes[i]} — bind_value target listener (Svelte) tự gán
	// boxes[i] từ native value TRƯỚC khi oninput handler chạy; lúc đó compact
	// `value` chưa sync (còn '' nếu mới gõ ô đầu) → effect value→boxes coi
	// joined khác value → WIPE boxes → Svelte viết '' ngược vào input. Thay
	// vào đó: boxes là single source of truth, hiệu ứng này đẩy boxes vào DOM.
	// Guard `!==` để KHÔNG clobber ô user vừa gõ (el.value đã đúng → no-op).
	$effect(() => {
		for (let i = 0; i < length; i++) {
			const el = boxRefs[i];
			if (el && el.value !== boxes[i]) el.value = boxes[i];
		}
	});

	// ── configs (mirror textarea) ──
	let configs: InputOtpConfigs = $state({
		value: '',
		name: stableName,
		get loading() {
			// Form loading indicator: true khi validation đang 'pending'
			return configs.required && configs.validation.isValid === 'pending';
		},
		status: {
			focus: false,
			get changed() {
				return (value ?? '') !== _initialValue;
			}
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'input-otp-root',
				`size-${this.size}`,
				`color-${this.color}`,
				this.disabled ? 'disabled' : undefined,
				hasValue ? 'has-value' : undefined,
				this.status.focus ? 'focus' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get size() {
			return props.size ?? formContext?.size ?? client.browser?.size ?? 'md';
		},
		get color() {
			// Ưu tiên props.color nếu được set explicitly
			if (props.color) return props.color;
			// Khi đang pending (debounce chạy) → trung tính
			if (configs.loading) return 'default';
			// Có validator (required): đổi màu chỉ khi ĐÃ trigger (messages populate
			// — mirror textarea), tránh màu pending trên pristine field.
			if (props.required) {
				const messages = configs.validation.messages;
				if (messages && messages.size > 0) {
					return configs.validation.isValid ? 'success' : 'error';
				}
				return 'default';
			}
			return 'default';
		},
		get disabled() {
			return props.disabled ?? formContext?.disabled;
		},
		get duration() {
			return convertToMiliseconds(props.duration) ?? convertToMiliseconds(client.browser?.duration) ?? 300;
		},
		get delay() {
			return convertToMiliseconds(props.delay);
		},
		get required() {
			return props.required;
		},
		get clearable() {
			return props.clearable;
		},
		get length() {
			return length;
		},
		get type() {
			return otpType;
		},
		validation: {
			_isValid: undefined as undefined | boolean | 'pending',
			get isValid() {
				// Programmatic reset → chưa validate → hợp lệ (trả true)
				if (_justReset) return true;
				if (configs.required) {
					if (this._isValid === undefined) return 'pending';
					return this._isValid;
				}
				return undefined;
			},
			set isValid(v) {
				this._isValid = v;
			},
			messages: new SvelteMap()
		},
		reset() {
			// Đặt _justReset TRƯỚC khi đổi value để validation effect không trigger
			_justReset = true;
			value = _initialValue;
			configs.validation.messages = undefined;
			configs.validation.isValid = undefined;
			if (configs.timeId) {
				for (const id of configs.timeId.values()) clearTimeout(id);
				configs.timeId.clear();
			}
		}
	});
	setInputOtpContext(configs);

	// Sync configs.value (Form serialize đọc 'value' in children → string)
	$effect(() => {
		const v = value ?? '';
		if (configs.value !== v) {
			configs.value = v;
		}
	});

	// ── Validation pipeline (mirror radiogroup/textarea) ──
	// Theo value: changed && !_justReset → debounce → required(đủ length) → isValid
	let previousValue: string = value ?? '';

	$effect(() => {
		const current = value ?? '';
		const changed = untrack(() => previousValue) !== current;
		untrack(() => {
			previousValue = current;
		});

		if (!changed) return;
		if (_justReset) {
			// Vừa reset — bỏ qua, bật cờ cho các lần sau
			_justReset = false;
			return;
		}
		// Không có validator nào → skip (không validate, giữ neutral)
		if (!configs.required) return;

		if (!configs.timeId) configs.timeId = new Map();
		const name = 'timeout-validation';
		const timeId = configs.timeId.get(name);
		if (timeId) clearTimeout(timeId);
		configs.timeId.set(
			name,
			setTimeout(async () => {
				const validator: ValidationFull = defaultValidation.required(configs.name, configs.length);
				const rs = (await validator.isValid(current)) as boolean;
				if (!configs.validation.messages) configs.validation.messages = new SvelteMap();
				configs.validation.isValid = rs;
				configs.validation.messages.set('required', {
					content: rs ? validator.message?.valid : validator.message?.invalid,
					kind: rs ? 'valid' : 'invalid'
				});
			}, configs.delay ?? client.browser?.delay ?? 300)
		);
	});

	// ── UX: focus management ──
	function focusBox(i: number) {
		const idx = Math.max(0, Math.min(length - 1, i));
		boxRefs[idx]?.focus();
	}

	function handleFocus(e: FocusEvent) {
		const target = e.target as HTMLInputElement;
		const idx = boxRefs.indexOf(target);
		if (idx !== -1) activeIndex = idx;
		configs.status.focus = true;
		// User tương tác → bật validation lại (nếu đang _justReset)
		_justReset = false;
	}

	function handleBlur() {
		configs.status.focus = false;
	}

	// Input 1 ký tự: filter → cập nhật boxes → sync value → auto-advance.
	// (Svelte inline handler cho oninput truyền `Event`, KHÔNG `InputEvent` —
	// chỉ dùng e.target nên typ broad an toàn.)
	function handleBoxInput(i: number, e: Event) {
		const el = e.target as HTMLInputElement;
		// Lọc ký tự không hợp lệ (numeric → chỉ số) trong oninput
		const filtered = filterChar(el.value ?? '');
		if (filtered !== (el.value ?? '')) {
			el.value = filtered;
		}
		const ch = (el.value ?? '').slice(-1);
		boxes[i] = ch;
		// syncValue() VÔ ĐIỀU KIỆN — boxes là nguồn sự thật; value compact
		// phải theo boxes để (a) form serialize, (b) effect value→boxes không
		// coi joined khác value → wipe boxes, (c) config.color/status đồng bộ.
		syncValue();
		if (ch && i < length - 1) focusBox(i + 1);
	}

	// Keydown scoped trên root (bubbles từ native inputs):
	// Arrow di chuyển, Overwrite trên ô có giá trị, Backspace trên ô rỗng →
	// về ô trước + xóa ô trước, Ctrl/Cmd+A → select-all nội dung ô focus
	function handleKeydown(e: KeyboardEvent) {
		if (configs.disabled) return;
		const idx = activeIndex;

		// ── Select-all (Ctrl/Cmd+A) — chừa khỏi guard overwrite/paste ──
		if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
			handleRootSelectAll(e);
			return;
		}
		// ── Copy (Ctrl/Cmd+C) — intercept + preventDefault: native `copy` event
		// chỉ fire khi có selection (auto-advance làm selection thường rỗng) →
		// intercept keydown đảm bảo copy luôn hoạt động. Copy qua context-menu
		// (mouse) không qua keydown → vẫn bắt bằng `copy` event (oncopy giữ).
		if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
			handleRootCopy(e);
			return;
		}
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			focusBox(idx + 1);
			return;
		}
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			focusBox(idx - 1);
			return;
		}
		// ── Overwrite (ghi đè): ô đang focus ĐÃ có giá trị + phím ký tự đơn ──
		// native maxlength=1 CHẶN phím khi ô đầy (không fire input) → intercept
		// keydown: ghi đè giá trị tại chỗ + auto-advance (hành vi gõ thông
		// thường). Guard: không Ctrl/Cmd/Alt (chừa copy/paste/selectall), không
		// IME composing, key 1 ký tự. Phím không qua filter (vd numeric + chữ)
		// → preventDefault + bỏ qua (native cũng chặn — hành vi cũ).
		if (
			e.key.length === 1 &&
			!e.ctrlKey &&
			!e.metaKey &&
			!e.altKey &&
			!e.isComposing &&
			boxes[idx] !== ''
		) {
			e.preventDefault();
			const ch = filterChar(e.key);
			if (ch) {
				boxes[idx] = ch;
				syncValue();
				if (idx < length - 1) focusBox(idx + 1);
			}
			return;
		}
		if (e.key === 'Backspace' && boxes[idx] === '') {
			// Ô đang focus rỗng → không cho native; xóa ô trước + focus ô trước
			e.preventDefault();
			if (idx > 0) {
				boxes[idx - 1] = '';
				syncValue();
				focusBox(idx - 1);
			}
		}
	}

	// Paste: dán chuỗi dài → phân tán vào các ô (bắt đầu ô đang focus, hoặc
	// đầu nếu focus ngoài bounds — probe paste vào ô đầu)
	function handleBoxPaste(i: number, e: ClipboardEvent) {
		e.preventDefault();
		let text = e.clipboardData?.getData('text') ?? '';
		if (!text) {
			// Headless/synthetic clipboard rỗng → fallback clipboard demo (localStorage)
			const raw = localStorage.getItem('clipboard');
			if (raw) {
				try {
					const entries = Object.entries(JSON.parse(raw));
					const last = entries[entries.length - 1]?.[1];
					if (typeof last === 'string') text = last;
				} catch {
					text = '';
				}
			}
		}
		const cleaned = filterChar(text).slice(0, length);
		if (!cleaned) return;
		const start = Math.max(0, Math.min(i, length - 1));
		for (let k = 0; k < cleaned.length; k++) {
			const target = Math.min(start + k, length - 1);
			boxes[target] = cleaned[k];
		}
		syncValue();
		// Focus ô tiếp theo còn trống (hoặc ô cuối nếu đã đầy)
		const firstEmpty = cleaned.length < length ? start + cleaned.length : length - 1;
		focusBox(firstEmpty);
	}

	// Copy: toàn bộ boxes → clipboard. Ctrl/Cmd+C intercept trong keydown (luôn
	// chạy — không phụ thuộc selection) + copy qua context-menu mouse bắt bằng
	// `copy` event (oncopy trên root giữ). Headless/synthetic clipboard không
	// ghi được qua navigator.clipboard (permission) → fallback ghi localStorage
	// 'clipboard' (nguồn 'clipboard' demo — mirror pattern Input actionButtons.copy).
	// e có thể là KeyboardEvent (keydown intercept) HOẶC ClipboardEvent (oncopy)
	// → chỉ preventDefault khi có (synthetic dispatch luôn cancelable).
	async function handleRootCopy(e?: ClipboardEvent | KeyboardEvent) {
		if (configs.disabled) return;
		const current = boxes.join('');
		if (!current) return;
		e?.preventDefault();
		let wrote = false;
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(current);
				wrote = true;
			}
		} catch {
			// Headless/permission denied → fallback localStorage bên dưới
		}
		if (!wrote) {
			const date = new Date();
			localStorage.setItem('clipboard', JSON.stringify({ [`${date.getTime()}`]: current }));
			if (!client.browser) client.browser = {};
			if (!client.browser.clipboard) client.browser.clipboard = new SvelteMap();
			client.browser.clipboard.set(date.getTime(), current);
		}
	}

	// Select-all: Ctrl/Cmd+A khi focus trong component → chọn toàn bộ nội dung
	// ô đang focus (chọn hết value hiện tại; native selection per-input — ô
	// maxlength=1 chỉ có 1 ký tự → select-all = chọn ký tự ô đang focus).
	function handleRootSelectAll(e: KeyboardEvent) {
		if (configs.disabled) return;
		const el = document.activeElement;
		if (!(el instanceof HTMLInputElement) || !boxRefs.includes(el)) return;
		if (!el.value) return;
		e.preventDefault();
		el.select();
	}

	// Clear nhanh toàn bộ dữ liệu (props.clearable): xoá toàn bộ boxes + sync
	// value + focus ô đầu. _justReset = true → validation không trigger (giống
	// reset programmatic; user tương tác lại → handleFocus bật cờ).
	function handleClearClick() {
		if (configs.disabled) return;
		boxes = Array.from({ length }, () => '');
		_justReset = true;
		syncValue();
		focusBox(0);
	}

	onMount(() => {
		if (formContext) {
			if (!formContext.childrens) formContext.childrens = new SvelteSet();
			formContext.childrens.add(configs);
		}
	});
	onDestroy(() => {
		if (configs.timeId) {
			for (const id of configs.timeId.values()) clearTimeout(id);
			configs.timeId.clear();
		}
	});
</script>

<div
	class={configs.style}
	style:--duration={`${configs.duration}ms`}
	role="group"
	aria-label={props['aria-label']}
	aria-disabled={configs.disabled ? 'true' : undefined}
	aria-invalid={configs.validation.isValid === false ? 'true' : undefined}
	onkeydown={handleKeydown}
	oncopy={handleRootCopy}
>
	{#each boxes as box, i}
		<input
			bind:this={boxRefs[i]}
			type="text"
			class="otp-box"
			class:filled={box !== ''}
			maxlength={1}
			inputmode={otpType === 'numeric' ? 'numeric' : 'text'}
			autocomplete={otpType === 'numeric' ? 'one-time-code' : 'off'}
			autocapitalize="none"
			spellcheck={false}
			disabled={configs.disabled ? true : undefined}
			aria-label={`${props['aria-label'] ?? 'Mã xác nhận'}, ô ${i + 1}`}
			aria-invalid={configs.validation.isValid === false ? 'true' : undefined}
			onfocus={handleFocus}
			onblur={handleBlur}
			oninput={(e) => handleBoxInput(i, e)}
			onpaste={(e) => handleBoxPaste(i, e)}
		/>
	{/each}
	{#if configs.clearable && hasValue && !configs.disabled}
		<button
			type="button"
			class="otp-clear"
			aria-label="Xóa toàn bộ"
			onclick={handleClearClick}
		>
			<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path
					d="M6 6l12 12M18 6L6 18"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	{/if}
	{@render children?.()}
</div>

<style lang="scss">
	@use '_styles.scss';
</style>
