<script lang="ts">
	// src/lib/components/form/input-datetime/Main.svelte
	// FORM FIELD — mirror mẫu input-otp: configs $state + Symbol context + form
	// registration + validation debounce + _justReset.
	// Render: nhóm ô NHẬP TUẦN TỰ theo format hiển thị (ymd `yyyy-mm-dd` mặc
	// định, dmy `dd/mm/yyyy`, mdy `mm/dd/yyyy` — segments[] nội bộ LUÔN theo cột
	// ISO, ô hiển thị map ngược qua isoIndex) · [giờ 2][phút 2], separator là
	// span (KHÔNG input). Snap khi gõ (normalizeSegments): tháng/ngày/giờ/phút
	// vượt → snap; năm vượt [minYear, maxYear] → snap; cross-field ngày re-clamp
	// theo tháng+năm. props.datePicker → DatePicker.Root bọc field + nút lịch
	// (PickerToggle) + bridge pickerDate 2 chiều. value = ISO `YYYY-MM-DDTHH:MM`
	// (form serialize đọc được). Cơ chế 3 chiều giống input-otp:
	//   value→segments ($effect guard `v === joined`),
	//   segments→value (syncValue() VÔ ĐIỀU KIỆN trong input handler),
	//   segments→DOM ($effect guard `el.value !== segments[i]` — KHÔNG bind:value
	//   vì Svelte gán trước oninput → wipe).
	import { convertToMiliseconds, styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	// DatePicker sub-file DIRECT (không qua barrel element — tránh vòng import
	// form↔element; mirror datatable/Head import form/checkbox/Main.svelte).
	import DatePickerRoot from '$components/element/date-picker/Root.svelte';
	import DatePickerContent from '$components/element/date-picker/Content.svelte';
	import { daysInMonth, sameDay } from '$components/element/date-picker/_dates';
	import { getFormContext } from '../form';
	import { setInputDatetimeContext, defaultValidation } from './index';
	import PickerToggle from './PickerToggle.svelte';
	import type {
		InputDatetimeConfigs,
		InputDatetimeFormat,
		InputDatetimeProps
	} from './_interface';
	import type { ValidationFull } from '../input/_interface';

	let { value = $bindable(), children, ...props }: InputDatetimeProps = $props();
	const formContext = getFormContext();

	// ── Cột ISO nội bộ (index storage): 0=y, 1=m, 2=d, 3=H, 4=M ──
	// Ô hiển thị theo format (display order) — map ngược qua isoIndex, KHÔNG
	// đổi storage → buildIso/splitIso/value ISO không phụ thuộc format.
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
	// format hiển thị nhóm ngày (props.format — default 'ymd' backward-compat)
	const format = $derived((props.format ?? 'ymd') as InputDatetimeFormat);
	// Thứ tự hiển thị: nhóm ngày theo format, giờ/phút luôn cuối.
	//   ymd → [y, m, d]   dmy → [d, m, y]   mdy → [m, d, y]
	const DATE_ORDER: Record<InputDatetimeFormat, ('y' | 'm' | 'd')[]> = {
		ymd: ['y', 'm', 'd'],
		dmy: ['d', 'm', 'y'],
		mdy: ['m', 'd', 'y']
	};
	// Display segment: mang isoIndex (vị trí storage trong SEGMENTS) — mọi
	// handler đọc/ghi segments[seg.isoIndex], focus/advance theo display i.
	interface DisplaySeg extends SegmentDef {
		isoIndex: number;
	}
	const activeSegs = $derived.by<DisplaySeg[]>(() => {
		const order: ('y' | 'm' | 'd' | 'H' | 'M')[] = [...DATE_ORDER[format]];
		if (!hideTime) order.push('H', 'M');
		return order.map((kind) => {
			const isoIndex = SEGMENTS.findIndex((s) => s.kind === kind);
			return { ...SEGMENTS[isoIndex], isoIndex };
		});
	});
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

	// ── Snap khi gõ (validate cơ bản NGAY trong ô — yêu cầu user #3) ──
	// CHỈ áp cho segment ĐÃ ĐỦ số chữ số (đang gõ dở '0' chuẩn bị '05' không
	// bị snap); '00' → '01'; vượt max hợp lệ → snap max (tháng 13 → 12, giờ
	// 25 → 23…); năm đủ 4 → snap [minYear, maxYear]; CROSS-FIELD: năm+tháng đủ
	// → re-clamp ngày theo daysInMonth (2/2000 → 29, 2/2001 → 28 — yêu cầu #5).
	function normalizeSegments(): boolean {
		let changed = false;
		// segment đã gõ đủ max chữ số mới snap (tránh snap giữa chừng user gõ)
		const full = (i: number) => (segments[i] ?? '').length === SEGMENTS[i].max;
		// Tháng (iso 1): '00' → '01', >12 → '12'
		if (full(1)) {
			const mo = Number(segments[1]);
			if (mo === 0) {
				segments[1] = '01';
				changed = true;
			} else if (mo > 12) {
				segments[1] = '12';
				changed = true;
			}
		}
		// Giờ (iso 3): >23 → '23' ('00' hợp lệ)
		if (!hideTime && full(3)) {
			const h = Number(segments[3]);
			if (h > 23) {
				segments[3] = '23';
				changed = true;
			}
		}
		// Phút (iso 4): >59 → '59' ('00' hợp lệ)
		if (!hideTime && full(4)) {
			const mi = Number(segments[4]);
			if (mi > 59) {
				segments[4] = '59';
				changed = true;
			}
		}
		// Ngày (iso 2): '00' → '01'; vượt daysInMonth(year, month) khi năm+tháng
		// đủ → snap NGÀY CUỐI THÁNG (2/2000=29, 4/2001=30, 2/2003=28). Năm/tháng
		// chưa đủ → chỉ chặn >31 (validate cơ bản).
		if (full(2)) {
			const d = Number(segments[2]);
			const y = segments[0].length === 4 ? Number(segments[0]) : null;
			const m = segments[1].length === 2 ? Number(segments[1]) : null;
			const maxDay = y !== null && m !== null ? daysInMonth(y, m - 1) : 31;
			if (d === 0) {
				segments[2] = '01';
				changed = true;
			} else if (d > maxDay) {
				segments[2] = String(maxDay).padStart(2, '0');
				changed = true;
			}
		}
		// Năm (iso 0): đủ 4 → snap [minYear, maxYear] (tùy chọn — yêu cầu #3)
		if (full(0)) {
			const y = Number(segments[0]);
			if (configs.minYear !== undefined && y < configs.minYear) {
				segments[0] = String(configs.minYear);
				changed = true;
			} else if (configs.maxYear !== undefined && y > configs.maxYear) {
				segments[0] = String(configs.maxYear);
				changed = true;
			}
		}
		// Năm vừa snap (2020→1990) có thể làm ngày đã clamp (29) vượt tháng đích
		// → re-clamp ngày theo (năm mới, tháng cũ).
		if (changed && full(0) && full(1) && full(2)) {
			const d = Number(segments[2]);
			const maxDay = daysInMonth(Number(segments[0]), Number(segments[1]) - 1);
			if (d > maxDay) {
				segments[2] = String(maxDay).padStart(2, '0');
			}
		}
		return changed;
	}

	// segments → DOM input: segments là nguồn sự thật của từng ô. KHÔNG dùng
	// bind:value (bẫy đã biết — Svelte gán trước oninput → wipe). Guard `!==`
	// để KHÔNG clobber ô user vừa gõ (el.value đã đúng → no-op). boxRefs theo
	// DISPLAY position → đọc cột storage qua isoIndex.
	$effect(() => {
		for (let i = 0; i < totalSegs; i++) {
			const el = boxRefs[i];
			const seg = activeSegs[i];
			if (el && seg && el.value !== segments[seg.isoIndex]) {
				el.value = segments[seg.isoIndex];
			}
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
		get format() {
			return format;
		},
		get datePicker() {
			return props.datePicker === true;
		},
		get minYear() {
			return props.minYear;
		},
		get maxYear() {
			return props.maxYear;
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

	// Input 1 ô: filter → cập nhật segment (theo isoIndex — display i chỉ là
	// vị trí focus) → normalize snap → sync value → AUTO-ADVANCE khi ĐỦ số chữ
	// số NHÓM (năm=4, khác=2). Không đủ → giữ nguyên ô (tuần tự).
	function handleBoxInput(i: number, e: Event) {
		const el = e.target as HTMLInputElement;
		// Lọc ký tự không hợp lệ (chỉ số) trong oninput
		const filtered = filterChar(el.value ?? '');
		if (filtered !== (el.value ?? '')) {
			el.value = filtered;
		}
		const seg = activeSegs[i];
		const max = seg?.max ?? 2;
		// Ô giữ tối đa `max` chữ số (auto-advance KHÔNG tràn sang ô khác)
		const val = (el.value ?? '').slice(0, max);
		if (val !== (el.value ?? '')) el.value = val;
		segments[seg.isoIndex] = val;
		// Snap khi gõ (tháng 13 → 12, 2/2000 ngày 30 → 29…) — chạy TRƯỚC sync để
		// value ISO luôn mang giá trị đã chuẩn hóa. DOM ô bị snap tự sửa qua
		// effect segments→DOM (guard !==).
		normalizeSegments();
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
			(segments[activeSegs[idx]?.isoIndex ?? 0]?.length ?? 0) >= (activeSegs[idx]?.max ?? 2)
		) {
			e.preventDefault();
			segments[activeSegs[idx].isoIndex] = e.key;
			normalizeSegments();
			syncValue();
			if (idx < totalSegs - 1) focusBox(idx + 1);
			return;
		}
		// Backspace: ô CÓ nội dung → xóa trọn ô (segment-clear, giữ focus — UX
		// date input chuẩn như Chrome native: mỗi ô là một đơn vị năm/tháng/ngày/
		// giờ/phút, không xóa từng ký tự); ô rỗng → về ô trước + xóa ô trước (quá nhóm).
		if (e.key === 'Backspace') {
			if ((segments[activeSegs[idx]?.isoIndex ?? 0] ?? '') !== '') {
				e.preventDefault();
				segments[activeSegs[idx].isoIndex] = '';
				syncValue();
			} else if (idx > 0) {
				e.preventDefault();
				segments[activeSegs[idx - 1].isoIndex] = '';
				syncValue();
				focusBox(idx - 1);
			}
		}
		// Delete xóa ô hiện tại (giữ focus)
		if (e.key === 'Delete' && (segments[activeSegs[idx]?.isoIndex ?? 0] ?? '') !== '') {
			e.preventDefault();
			segments[activeSegs[idx].isoIndex] = '';
			syncValue();
		}
	}

	// Paste: dán chuỗi (chấp nhận dạng liên tục `200001150830` hoặc có dấu
	// gạch) → lọc số → tán vào các ô bắt đầu từ ô đang focus THEO THỨ TỰ HIỂN
	// THỊ (format ymd mặc định = ISO cũ; dmy/mdy user nhìn ô nào trước thì chuỗi
	// số rơi vào ô đó) → normalize snap.
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
			const seg = activeSegs[k];
			const max = seg?.max ?? 2;
			segments[seg.isoIndex] = cleaned.slice(cursor, cursor + max);
			cursor += max;
		}
		normalizeSegments();
		syncValue();
		// Focus ô tiếp theo còn thiếu (hoặc ô cuối nếu đã đầy)
		let firstIncomplete = totalSegs - 1;
		for (let k = 0; k < totalSegs; k++) {
			if ((segments[activeSegs[k].isoIndex] ?? '').length < (activeSegs[k]?.max ?? 2)) {
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

	// ── DatePicker bridge (props.datePicker — yêu cầu user #2) ──
	// DatePicker.Root bọc toàn field (chỉ khi bật) → PickerToggle + panel
	// Content trong field đọc context qua _context.ts. pickerDate là Date|null
	// của panel; bridge 2 chiều với value ISO. MỖI effect đọc phía còn lại qua
	// untrack (bẫy vòng: nếu A theo dõi pickerDate thì panel vừa select xong bị
	// A revert về ISO cũ — A chạy trước B):
	//   A: value ISO đủ ngày → pickerDate (thiếu → null) — chỉ chạy khi value đổi;
	//   B: pickerDate đổi (select từ panel) → set segments y/m/d (giữ giờ) + sync.
	const pickerDateInit = (() => {
		const v = value ?? '';
		if (v.length >= 10) {
			return new Date(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10)));
		}
		return null;
	})();
	let pickerDate = $state<Date | null>(pickerDateInit);
	let pickerOpen = $state(false);
	// min/max panel từ minYear/maxYear (chặn select ngoài khoảng — year-only)
	const pickerMin = $derived(
		configs.minYear !== undefined ? new Date(configs.minYear, 0, 1) : undefined
	);
	const pickerMax = $derived(
		configs.maxYear !== undefined ? new Date(configs.maxYear, 11, 31) : undefined
	);

	// A: value ISO → pickerDate
	$effect(() => {
		if (!configs.datePicker) return;
		const v = value ?? '';
		if (v.length >= 10) {
			const d = new Date(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10)));
			const cur = untrack(() => pickerDate);
			if (!cur || !sameDay(cur, d)) pickerDate = d;
		} else if (untrack(() => pickerDate) !== null) {
			pickerDate = null;
		}
	});

	// B: pickerDate → segments (user chọn ngày từ panel lịch)
	$effect(() => {
		if (!configs.datePicker || !pickerDate) return;
		const v = untrack(() => value ?? '');
		if (v.length >= 10) {
			const d = new Date(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10)));
			if (sameDay(d, pickerDate)) return;
		}
		segments[0] = String(pickerDate.getFullYear()).padStart(4, '0');
		segments[1] = String(pickerDate.getMonth() + 1).padStart(2, '0');
		segments[2] = String(pickerDate.getDate()).padStart(2, '0');
		normalizeSegments();
		syncValue();
	});

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
{#snippet field()}
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
				class:filled={segments[seg.isoIndex] !== ''}
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
				<!-- Separator PAIR-BASED theo display order (không còn index cứng):
				     cặp trong nhóm ngày → theo format ('-' ymd, '/' dmy/mdy);
				     cặp cuối nhóm ngày → giờ: '·' (nếu !hideTime); giờ → phút ':' -->
				<span class="dt-separator" aria-hidden="true">
					{#if i < 2}
						{format === 'ymd' ? '-' : '/'}
					{:else if i === 2}
						{hideTime ? '' : '·'}
					{:else}
						:
					{/if}
				</span>
			{/if}
		{/each}
		{#if configs.datePicker && !configs.disabled}
			<PickerToggle />
		{/if}
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
{/snippet}

{#if configs.datePicker}
	<!-- DatePicker.Root bọc field: panel absolute theo root relative; PickerToggle
	     + Content đọc context qua _context.ts. size passthrough để panel cell theo
	     field size. min/max chặn select ngoài [minYear, maxYear]. -->
	<DatePickerRoot
		bind:value={pickerDate}
		bind:open={pickerOpen}
		min={pickerMin}
		max={pickerMax}
		size={configs.size}
		disabled={configs.disabled ? true : undefined}
		aria-label={props['aria-label'] ?? 'Chọn ngày'}
	>
		{@render field()}
		<DatePickerContent />
	</DatePickerRoot>
{:else}
	{@render field()}
{/if}

<style lang="scss">
	@use '_styles.scss';
</style>
