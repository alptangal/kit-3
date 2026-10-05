<script lang="ts">
	// src/lib/components/form/slider/Main.svelte
	// FORM FIELD — mirror mẫu textarea/radiogroup: configs $state + Symbol context
	// (leaf _context.ts) + form registration + validation debounce + _justReset.
	// Render: native <input type="range"> (source of truth + screen-reader/keyboard
	// chuẩn WAI-ARIA: role=slider implicit, aria-valuenow/min/max, Arrow/Home/End)
	// + visual layer (track/fill/thumb/ticks) phủ CÙNG BOX, pointer-events:none
	// → input vẫn nhận toàn bộ event (KHÔNG :has() — es2020 + safari15).
	import { convertToMiliseconds, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { getFormContext } from '../form';
	import { setSliderContext, defaultValidation } from './index';
	import type { SliderConfigs, SliderProps } from './_interface';
	import type { TranslateContent } from '$interfaces/basic';
	import type { ValidationFull } from '../input/_interface';

	let { value = $bindable(), children, ...props }: SliderProps = $props();
	const formContext = getFormContext();

	// ── Bounds resolution (min/max/step — guards: min<max, step>0, finite) ──
	const _min = Number.isFinite(props.min) ? (props.min as number) : 0;
	const _max = Number.isFinite(props.max) ? (props.max as number) : 100;
	const min = Math.min(_min, _max);
	const max = Math.max(_min, _max);
	const rawStep = props.step;
	const step =
		Number.isFinite(rawStep) && (rawStep as number) > 0 ? (rawStep as number) : 1;

	// ── Clamp + snap theo step (bẫy value ngoài range / không đúng step) ──
	// Snap "xuôi chiều" giá trị hiện tại (không lệch nửa step).
	function snap(v: number): number {
		const steps = Math.round((v - min) / step);
		let n = min + steps * step;
		// Thu gọn sai số float (step thập phân: 0.1, 0.5...)
		const dp = decimalPlacesOf(step);
		if (dp > 0) n = Math.round(n * 10 ** dp) / 10 ** dp;
		return Math.min(max, Math.max(min, n));
	}
	function decimalPlacesOf(n: number): number {
		const s = String(n);
		const i = s.indexOf('.');
		return i === -1 ? 0 : s.length - i - 1;
	}
	// Giá trị khởi tạo LUÔN hợp lệ (clamp + snap ngay từ init — giá trị ngoài
	// range truyền từ page sẽ bị kẹp về biên gần nhất).
	let _initialValue: number = snap(value ?? min);

	// Programmatic reset → đè validation cho tới khi user tương tác lại
	let _justReset = $state(true);

	// Native name — stable, sinh 1 lần (unique, không collision khi nhiều slider
	// cùng form — mirror textarea).
	const stableName = (() => {
		if (props.name) return props.name;
		return `slider-${Math.random().toString(36).slice(2, 10)}`;
	})();

	// Số tick (điểm chia đều từ min → max)
	const tickCount =
		Number.isFinite(props.tickCount) && (props.tickCount as number) > 0
			? Math.floor(props.tickCount as number)
			: 10;
	// Vị trí tick % (0 → 100) — trong bounding box input (nhìn thẳng vào track,
	// đúng "điểm tick" của nhiều slider UI: tick nằm giữa track, không lệch thumb)
	const tickOffsets: number[] = Array.from(
		{ length: tickCount + 1 },
		(_, i) => Math.round(((i / tickCount) * 10000) / 100)
	);
	// Độ dài chữ số thập phân để format showValue (đồng bộ step)
	const displayDecimals = decimalPlacesOf(step);

	// Giá trị hiển thị (showValue + aria-align native value)
	const displayValue = $derived(
		Number(value ?? min).toFixed(displayDecimals)
	);
	// Fill % (0→100) — truyền CSS var `--slider-fill` inline (không cần $effect sync,
	// template style reactive tự cập nhật khi value đổi)
	const fillPercent = $derived(((Number(value ?? min) - min) / (max - min || 1)) * 100);

	let configs: SliderConfigs = $state({
		value: _initialValue,
		name: stableName,
		ref: undefined,
		focus() {
			configs.ref?.focus();
		},
		get loading() {
			// Form loading indicator: true khi validation đang 'pending'
			return configs.validation.isValid === 'pending';
		},
		status: {
			focus: false,
			get changed() {
				return Number(value ?? min) !== _initialValue;
			}
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'slider-root',
				`size-${this.size}`,
				`color-${this.color}`,
				this.disabled ? 'disabled' : undefined,
				this.status.focus ? 'focus' : undefined,
				props.showValue ? 'show-value' : undefined
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
			// Có validator (required/minValue/maxValue): đổi màu chỉ khi ĐÃ trigger
			// (messages đã populate — mirror textarea), tránh màu pending trên
			// pristine field.
			const hasValidator =
				!!props.required || props.minValue != null || props.maxValue != null;
			if (hasValidator) {
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
		get minValue() {
			return props.minValue;
		},
		get maxValue() {
			return props.maxValue;
		},
		get event(): SliderConfigs['event'] {
			if (this.disabled) return undefined;
			return props.events ?? [];
		},
		validation: {
			_isValid: undefined as undefined | boolean | 'pending',
			get isValid() {
				// Programmatic reset → chưa validate → hợp lệ (trả true)
				if (_justReset) return true;
				const hasValidator =
					!!configs.required || configs.minValue != null || configs.maxValue != null;
				if (!hasValidator) return undefined;
				if (this._isValid === undefined) return 'pending';
				return this._isValid;
			},
			set isValid(v: boolean | 'pending' | undefined) {
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
	setSliderContext(configs);

	// ── Sync configs.value (Form serialize đọc `'value' in children` → number) ──
	// CONTRACT §7.5: form chỉ serialize string|boolean an toàn — slider value là
	// number: ghi thẳng number vào payload JSON; page muốn string thì cast.
	$effect(() => {
		const v = snap(Number(value ?? min));
		if (configs.value !== v) configs.value = v;
	});

	// ── Clamp value (giá trị ngoài range đổi từ phía page → snap về [min,max]) ──
	$effect(() => {
		const raw = value;
		const n = Number(raw);
		if (!Number.isFinite(n) || n < min || n > max) {
			value = snap(n || min);
		}
	});

	// ── Validation pipeline (mirror textarea/radiogroup) ──
	// Theo value: changed && !_justReset → debounce → run validators → isValid + messages
	let previousValue: number = _initialValue;

	$effect(() => {
		const current = Number(value ?? min);
		const changed = untrack(() => previousValue) !== current;
		untrack(() => {
			previousValue = current;
		});

		if (changed) {
			if (_justReset) {
				// Vừa reset — bỏ qua, bật cờ cho các lần sau
				_justReset = false;
				return;
			}
			// Không có validator nào → skip (không validate, giữ neutral)
			const hasValidator =
				!!configs.required || configs.minValue != null || configs.maxValue != null;
			if (!hasValidator) return;

			if (!configs.timeId) configs.timeId = new Map();
			const name = 'timeout-validation';
			const timeId = configs.timeId.get(name);
			if (timeId) clearTimeout(timeId);
			configs.timeId.set(
				name,
				setTimeout(async () => {
					// Build validators (mỗi validator 1 key riêng để FieldMessages
					// có thể hiện nhiều message: required + minValue + maxValue).
					const validators: { key: string; v: ValidationFull }[] = [];
					if (configs.required)
						validators.push({ key: 'required', v: defaultValidation.required(configs.name) });
					if (configs.minValue != null)
						validators.push({
							key: 'minValue',
							v: defaultValidation.minValue(configs.minValue, configs.name)
						});
					if (configs.maxValue != null)
						validators.push({
							key: 'maxValue',
							v: defaultValidation.maxValue(configs.maxValue, configs.name)
						});

					let allValid = true;
					if (!configs.validation.messages) configs.validation.messages = new SvelteMap();
					const messages = configs.validation.messages as SvelteMap<
						string,
						{ content?: TranslateContent; kind: 'valid' | 'invalid' }
					>;
					for (const { key, v } of validators) {
						// ValidationFull.input là union string|boolean|File[] (form-wide);
						// slider truyền String(number) — validator coerce lại Number().
						const rs = (await v.isValid(String(current))) as boolean;
						if (!rs) allValid = false;
						messages.set(key, {
							content: rs ? v.message?.valid : v.message?.invalid,
							kind: rs ? 'valid' : 'invalid'
						});
					}
					configs.validation.isValid = allValid;
				}, configs.delay ?? client.browser?.delay ?? 300)
			);
		}
	});

	// ── Focus tracking ──
	function handleFocus() {
		configs.status.focus = true;
		// User tương tác → bật validation lại (nếu đang _justReset)
		_justReset = false;
	}
	function handleBlur() {
		configs.status.focus = false;
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
	style:--slider-fill="{fillPercent}%"
	style:--duration="{configs.duration}ms"
	{@attach handleEvents(configs.event)}
>
	<!-- Native range input — source of truth + a11y chuẩn WAI-ARIA slider
	     (role=slider implicit, aria-valuenow/min/max do browser sinh tự động,
	     keyboard Arrow ±step / Home / End native). Box = visual track (height
	     padding box = --slider-track-height) để visual layer phủ cùng box. -->
	<input
		bind:value
		bind:this={configs.ref}
		type="range"
		min={min}
		max={max}
		step={step}
		name={configs.name}
		id={props.id}
		disabled={configs.disabled ? true : undefined}
		aria-label={props['aria-label']}
		aria-invalid={configs.validation.isValid === false ? 'true' : undefined}
		onfocus={handleFocus}
		onblur={handleBlur}
	>

	<!-- Visual layer (track + fill + thumb + ticks) — pointer-events:none,
	     KHÔNG che input (input vẫn nhận drag/keyboard) -->
	<div class="slider-visual" aria-hidden="true">
		<div class="slider-track">
			<div class="slider-fill" />
		</div>
		{#if props.showTicks}
			<div class="slider-ticks">
				{#each tickOffsets as pos, i}
					<span class="slider-tick" style:--tick-pos="{pos}%"></span>
				{/each}
			</div>
		{/if}
		<div class="slider-thumb" />
	</div>

	{#if props.showValue}
		<!-- Duplicate decorative (native value đã báo screen-reader) → aria-hidden -->
		<span class="slider-value" aria-hidden="true">{displayValue}</span>
	{/if}

	{@render children?.()}
</div>

<style lang="scss">
	@use '_styles.scss';
</style>
