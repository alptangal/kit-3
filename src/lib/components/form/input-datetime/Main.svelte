<script lang="ts">
	// src/lib/components/form/input-datetime/Main.svelte
	// FORM FIELD — mirror mẫu input-otp: configs $state + Symbol context + form
	// registration + validation debounce + _justReset.
	// Render: nhóm ô NHẬP TUẦN TỰ [năm 4 số][tháng 2][ngày 2] · [giờ 2][phút 2],
	// separator là span (KHÔNG input). value = ISO `YYYY-MM-DDTHH:MM` (form
	// serialize đọc được). Cơ chế 3 chiều giống input-otp:
	//   value→segments ($effect guard `v === joined`),
	//   segments→value (syncValue() VÔ ĐIỀU KIỆN trong input handler),
	//   segments→DOM ($effect guard `el.value !== segments[i]` — KHÔNG bind:value
	//   vì Svelte gán trước oninput → wipe).
	import { convertToMiliseconds, styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { getFormContext } from '../form';
	import { setInputDatetimeContext, defaultValidation } from './index';
	import type { InputDatetimeConfigs, InputDatetimeProps } from './_interface';
	import type { ValidationFull } from '../input/_interface';

	let { value = $bindable(), children, ...props }: InputDatetimeProps = $props();
	const formContext = getFormContext();

	// ── Nhóm ô theo thứ tự hiển thị VN: NGÀY trước, GIỜ sau ──
	// [năm(4), tháng(2), ngày(2)] — [giờ(2), phút(2)]  (thuật ISO: YYYY-MM-DDTHH:MM)
	// hideTime → chỉ 3 ô ngày. Separator: '-' giữa nhóm ngày, '·' chuyển nhóm, ':' giờ:phút.
	interface SegmentDef {
		/** Ký tự tương ứng trong ISO: y | m | d | H | M */
		kind: 'y' | 'm' | 'd' | 'H' | 'M';
		/** Số chữ số tối đa (maxlength theo nhóm). */
		max: number;
	}
	const SEGMENTS: SegmentDef[] = [
		{ kind: 'y', max: 4 },
		{ kind: 'm', max: 2 },
		{ kind: 'd', max: 2 },
		{ kind: 'H', max: 2 },
		{ kind: 'M', max: 2 }
	];
	const hideTime = $derived(props.hideTime === true);
	// Segment hiện hành (lọc time nếu hideTime) — mảng STATIC theo render.
	const activeSegs = $derived(hideTime ? SEGMENTS.slice(0, 3) : SEGMENTS);
	const totalSegs = $derived(activeSegs.length);

	// Mốc ban đầu (mốc reset + tính status.changed)
	let _initialValue: string = value ?? '';
	// Programmatic reset → đè validation cho tới khi user tương tác lại
	let _justReset = $state(true);
	// Native name — stable, sinh 1 lần (unique, không collision)
	const stableName = (() => {
		if (props.name) return props.name;
		return `dt-${Math.random().toString(36).slice(2, 10)}`;
	})();

	// Refs của N ô (DOM focus management)
	let boxRefs: (HTMLInputElement | undefined)[] = [];
	// Ô đang focus (roving arrow left/right + focus tracking)
	let activeIndex = $state(0);

	// segments = nội dung từng ô (array literal trong $state → mỗi phần tử reactive)
	let segments = $state<string[]>(Array.from({ length: SEGMENTS.length }, () => ''));

	// Clear button (props.clearable): hiện khi ≥ 1 ô chứa dữ liệu
	const hasValue = $derived((value ?? '').length > 0);

	// Chỉ nhận số (datetime luôn numeric)
	function filterChar(ch: string): string {
		return ch.replace(/\D/g, '');
	}

	// ── Map segments → ISO ──
	// ISO: YYYY-MM-DDTHH:MM — vị trí cố định; ô chưa đủ → không đủ điều kiện ISO
	// → trả chuỗi bộ phận (chỉ phần đã điền đủ số chữ số) giữ đúng cột ISO:
	// năm đủ 4 → 'YYYY', tháng đủ 2 → '-MM', ngày đủ 2 → '-DD', giờ đủ 2 → 'THH',
	// phút đủ 2 → ':MM'. Value rỗng khi CHƯA có ô nào đủ.
	function buildIso(): string {
		const [y, mo, d, h, mi] = segments;
		let iso = '';
		if (y.length === 4) iso = y;
		else return iso;
		if (mo.length === 2) iso += `-${mo}`;
		else return iso;
		if (d.length === 2) iso += `-${d}`;
		else return iso;
		if (hideTime) return iso;
		if (h.length === 2) iso += `T${h}`;
		else return iso;
		if (mi.length === 2) iso += `:${mi}`;
		return iso;
	}

	// ── ISO → segments (phân tán theo cột cố định) ──
	function splitIso(iso: string): string[] {
		const out = Array.from({ length: SEGMENTS.length }, () => '');
		if (!iso) return out;
		const y = iso.slice(0, 4);
		if (/^\d{1,4}$/.test(y)) out[0] = y;
		if (iso.length >= 7) {
			const mo = iso.slice(5, 7);
			if (/^\d{1,2}$/.test(mo)) out[1] = mo;
		}
		if (iso.length >= 10) {
			const d = iso.slice(8, 10);
			if (/^\d{1,2}$/.test(d)) out[2] = d;
		}
		if (iso.length >= 13) {
			const h = iso.slice(11, 13);
			if (/^\d{1,2}$/.test(h)) out[3] = h;
		}
		if (iso.length >= 16) {
			const mi = iso.slice(14, 16);
			if (/^\d{1,2}$/.test(mi)) out[4] = mi;
		}
		return out;
	}

	// Phân tán ISO → segments (chỉ chạy khi value EXTERNAL khác iso hiện tại —
	// user gõ từng ô thì value đã sync bằng syncValue() nên v === joined →
	// KHÔNG reassign (tránh loop effect)).
	$effect(() => {
		const v = value ?? '';
		const joined = buildIso();
		if (v === joined) return;
		const next = splitIso(v);
		for (let i = 0; i < SEGMENTS.length; i++) {
			segments[i] = next[i];
		}
	});

	// Đồng bộ value (ISO) từ segments — nguồn sự thật reverse (user gõ → parent
	// state). Gọi trong mỗi input handler (mirror input/Main "value = ...").
	function syncValue() {
		value = buildIso();
	}

	// segments → DOM input: segments là nguồn sự thật của từng ô. KHÔNG dùng
	// bind:value (bẫy đã biết — Svelte gán trước oninput → wipe). Guard `!==`
	// để KHÔNG clobber ô user vừa gõ (el.value đã đúng → no-op).
	$effect(() => {
		for (let i = 0; i < SEGMENTS.length; i++) {
			const el = boxRefs[i];
			if (el && el.value !== segments[i]) el.value = segments[i];
		}
	});

	// ── configs (mirror input-otp) ──
	let configs: InputDatetimeConfigs = $state({
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
				'input-datetime-root',
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
		get hideTime() {
			return props.hideTime;
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
			const next = splitIso(_initialValue);
			for (let i = 0; i < SEGMENTS.length; i++) segments[i] = next[i];
			configs.validation.messages = undefined;
			configs.validation.isValid = undefined;
			if (configs.timeId) {
				for (const id of configs.timeId.values()) clearTimeout(id);
				configs.timeId.clear();
			}
		}
	});
	setInputDatetimeContext(configs);

	// Sync configs.value (Form serialize đọc 'value' in children → string)
	$effect(() => {
		const v = value ?? '';
		if (configs.value !== v) {
			configs.value = v;
		}
	});

	// ── Validation pipeline (mirror input-otp) ──
	// Theo value: changed && !_justReset → debounce → required(ISO hợp lệ) → isValid
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
				// dateOnly: field hideTime sinh value `YYYY-MM-DD` — validator phải
				// kiểm theo đúng dạng đó (regex đầy đủ T..:.. sẽ từ chối tất cả).
				const validator: ValidationFull = defaultValidation.required(configs.name, hideTime);
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
		const idx = Math.max(0, Math.min(totalSegs - 1, i));
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

	// Input 1 ô: filter → cập nhật segment → sync value → AUTO-ADVANCE khi ĐỦ
	// số chữ số NHÓM (năm=4, khác=2). Không đủ → giữ nguyên ô (tuần tự).
	function handleBoxInput(i: number, e: Event) {
		const el = e.target as HTMLInputElement;
		// Lọc ký tự không hợp lệ (chỉ số) trong oninput
		const filtered = filterChar(el.value ?? '');
		if (filtered !== (el.value ?? '')) {
			el.value = filtered;
		}
		const max = activeSegs[i]?.max ?? 2;
		// Ô giữ tối đa `max` chữ số (auto-advance KHÔNG tràn sang ô khác)
		const val = (el.value ?? '').slice(0, max);
		if (val !== (el.value ?? '')) el.value = val;
		segments[i] = val;
		// syncValue() VÔ ĐIỀU KIỆN — segments là nguồn sự thật; value ISO phải
		// theo segments để (a) form serialize, (b) effect value→segments không
		// coi joined khác value → wipe, (c) config.color/status đồng bộ.
		syncValue();
		if (val.length === max && i < totalSegs - 1) focusBox(i + 1);
	}

	// Keydown scoped trên root (bubbles từ native inputs):
	// Arrow di chuyển, overwrite ô đầy (không IME), Backspace ô rỗng → ô trước +
	// xóa ô trước, Delete xóa ô hiện tại, Ctrl/Cmd+A select-all nội dung ô focus.
	function handleKeydown(e: KeyboardEvent) {
		if (configs.disabled) return;
		const idx = activeIndex;

		// ── Select-all (Ctrl/Cmd+A) ──
		if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
			handleRootSelectAll(e);
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
		// ── Overwrite (ghi đè): ô đang focus ĐÃ đầy + phím số đơn ──
		// native maxlength chặn phím khi ô đầy → intercept: ghi đè tại chỗ +
		// auto-advance. Guard: không Ctrl/Cmd/Alt (chừa copy/paste/selectall),
		// không IME composing, key 1 ký tự số.
		if (
			e.key.length === 1 &&
			!e.ctrlKey &&
			!e.metaKey &&
			!e.altKey &&
			!e.isComposing &&
			(e.key >= '0' && e.key <= '9') &&
			(segments[idx]?.length ?? 0) >= (activeSegs[idx]?.max ?? 2)
		) {
			e.preventDefault();
			segments[idx] = e.key;
			syncValue();
			if (idx < totalSegs - 1) focusBox(idx + 1);
			return;
		}
		// Backspace: ô CÓ nội dung → xóa trọn ô (segment-clear, giữ focus — UX
		// date input chuẩn như Chrome native: mỗi ô là một đơn vị năm/tháng/ngày/
		// giờ/phút, không xóa từng ký tự); ô rỗng → về ô trước + xóa ô trước (quá nhóm).
		if (e.key === 'Backspace') {
			if ((segments[idx] ?? '') !== '') {
				e.preventDefault();
				segments[idx] = '';
				syncValue();
			} else if (idx > 0) {
				e.preventDefault();
				segments[idx - 1] = '';
				syncValue();
				focusBox(idx - 1);
			}
		}
		// Delete xóa ô hiện tại (giữ focus)
		if (e.key === 'Delete' && (segments[idx] ?? '') !== '') {
			e.preventDefault();
			segments[idx] = '';
			syncValue();
		}
	}

	// Paste: dán chuỗi (chấp nhận dạng liên tục `200001150830` hoặc ISO có dấu
	// gạch) → lọc số → tán vào các ô bắt đầu từ ô đang focus.
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
		const cleaned = filterChar(text).slice(0, SEGMENTS.reduce((acc, s) => acc + s.max, 0));
		if (!cleaned) return;
		const start = Math.max(0, Math.min(i, totalSegs - 1));
		let cursor = 0;
		for (let k = start; k < totalSegs && cursor < cleaned.length; k++) {
			const max = activeSegs[k]?.max ?? 2;
			segments[k] = cleaned.slice(cursor, cursor + max);
			cursor += max;
		}
		syncValue();
		// Focus ô tiếp theo còn thiếu (hoặc ô cuối nếu đã đầy)
		let firstIncomplete = totalSegs - 1;
		for (let k = 0; k < totalSegs; k++) {
			if ((segments[k] ?? '').length < (activeSegs[k]?.max ?? 2)) {
				firstIncomplete = k;
				break;
			}
		}
		focusBox(firstIncomplete);
	}

	// Select-all: chọn toàn bộ nội dung ô đang focus (native selection per-input).
	function handleRootSelectAll(e: KeyboardEvent) {
		if (configs.disabled) return;
		const el = document.activeElement;
		if (!(el instanceof HTMLInputElement) || !boxRefs.includes(el)) return;
		if (!el.value) return;
		e.preventDefault();
		el.select();
	}

	// Clear nhanh toàn bộ dữ liệu (props.clearable): xoá toàn bộ segments + sync
	// value + focus ô đầu. _justReset = true → validation không trigger (giống
	// reset programmatic; user tương tác lại → handleFocus bật cờ).
	function handleClearClick() {
		if (configs.disabled) return;
		for (let i = 0; i < SEGMENTS.length; i++) segments[i] = '';
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

<!-- tabindex: root không phải Tab stop (roving ở từng ô); aria-invalid nằm ở
     từng input (role 'group' không hỗ trợ aria-invalid — mirror otp nhưng giữ
     a11y đúng WAI-ARIA); onkeydown scoped root (bubbles từ native inputs). -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class={configs.style}
	style:--duration={`${configs.duration}ms`}
	role="group"
	aria-label={props['aria-label']}
	aria-disabled={configs.disabled ? 'true' : undefined}
	onkeydown={handleKeydown}
>
	{#each activeSegs as seg, i (seg.kind)}
		<input
			bind:this={boxRefs[i]}
			type="text"
			class="dt-box"
			class:filled={segments[i] !== ''}
			maxlength={seg.max}
			data-length={seg.max}
			data-segment={seg.kind}
			inputmode="numeric"
			autocomplete="off"
			autocapitalize="none"
			spellcheck={false}
			disabled={configs.disabled ? true : undefined}
			aria-label={`${props['aria-label'] ?? 'Ngày giờ'}, phần ${i + 1}`}
			aria-invalid={configs.validation.isValid === false ? 'true' : undefined}
			onfocus={handleFocus}
			onblur={handleBlur}
			oninput={(e) => handleBoxInput(i, e)}
			onpaste={(e) => handleBoxPaste(i, e)}
		/>
		{#if i < totalSegs - 1}
			<span class="dt-separator" aria-hidden="true">
				{#if i === 2}
					{hideTime ? '' : '·'}
				{:else if i === 3}
					:
				{:else}
					-
				{/if}
			</span>
		{/if}
	{/each}
	{#if configs.clearable && hasValue && !configs.disabled}
		<button
			type="button"
			class="dt-clear"
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
