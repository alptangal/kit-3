<script lang="ts">
	// src/lib/components/form/toggle/Main.svelte
	// FORM FIELD — mirror mẫu checkbox/Main.svelte: configs $state + Symbol context
	// (leaf _context.ts) + form registration (childrens) + validation debounce + _justReset.
	//
	// A11y (KHÁC checkbox — dùng native button):
	//   <button type="button" role="switch" aria-checked> — browser tự handle Space/Enter
	//   + focus → KHÔNG cần @attach handleEvents / mousedown-debounce như checkbox.
	//   Label là EM của switch (sibling, không for/id association) → click label →
	//   toggle() manual; click switch → onclick native button. KHÔNG :has().
	//
	// Form serialize: configs.checked (getter → $bindable) + configs.name
	// → Form/Main.svelte đọc `'checked' in children` → payload boolean.
	//
	// Status: `configs.previousValue` = MOC BAN ĐẦU (initial capture, hỗ trợ
	// formContext.data[name]) → `status.changed` = "khác giá trị ban đầu" (stable
	// dirty indicator, mirror checkbox `previousValue` + `status.changed`). Form
	// submit gate + required color (success/error khi đã đổi) đọc `status.changed`.
	import { convertToMiliseconds, styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { getFormContext } from '../form';
	import { setToggleContext, defaultValidation } from './index';
	import type { ToggleConfigs, ToggleProps } from './_interface';
	import type { TranslateContent } from '$interfaces/basic';
	import type { ValidationCompact, ValidationFull } from '../input/_interface';

	let { label, children, checked = $bindable(), ...props }: ToggleProps = $props();
	const formContext = getFormContext();

	// Initial value (hỗ trợ formContext.data[name] — mirror checkbox capture).
	// NOTE: capture lúc init (props.name/formContext.data đã ổn định); form
	// submit gate không đọc `previousValue` nên capture sai cũng không lệch gate.
	let _initialChecked: boolean = Boolean(
		(props.name && formContext?.data && props.name in formContext.data
			? formContext.data[props.name]
			: checked)
	);

	// Rhythm tracking (mirror slider `previousValue` local var)
	let previousChecked = _initialChecked;

	// Track if field was just reset programmatically - suppress validation until user interacts
	let _justReset = $state(true);

	const lang = $derived(client.browser?.language ?? 'en');

	// Label: TranslateContent | string (giữ convention input placeholder/description)
	const labelText = $derived.by(() => {
		if (!label) return undefined;
		if (typeof label === 'string') return label;
		const text =
			(label as TranslateContent)[lang] ?? (label as TranslateContent).en ?? (label as TranslateContent).vi;
		return text ? text : undefined;
	});

	// aria-label: prop trực tiếp, fallback text label (required → thêm marker).
	// Không có label/children + không aria-label → undefined (icon-only/không text
	// thì BẮT buộc truyền `aria-label` — contract §6; demo luôn có một trong hai).
	const ariaLabel = $derived.by(() => {
		const base = props['aria-label'] ?? labelText;
		if (!base) return undefined;
		return props.required ? `${base} (required)` : base;
	});

	function toggle() {
		if (configs.disabled || configs.loading) return;
		checked = !checked;
		props.onchange?.(checked);
	}

	let configs: ToggleConfigs = $state({
		// Mốc ban đầu (initial capture) — baseline so sánh `status.changed` (stable
		// dirty indicator: "khác giá trị ban đầu"), không phải giá trị tick trước.
		// Mirror checkbox `previousValue` getter + `status.changed` baseline.
		previousValue: _initialChecked,
		status: {
			get changed() {
				return Boolean(checked) !== Boolean(configs.previousValue);
			}
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'toggle-root',
				`size-${this.size}`,
				`color-${this.color}`,
				this.disabled ? 'disabled' : undefined,
				configs.loading ? 'loading' : undefined,
				checked ? 'has-value' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get size() {
			return props.size ?? formContext?.size ?? client.browser?.size ?? 'md';
		},
		get color() {
			// mirror checkbox: props.color → (required && changed → success/error) → default
			if (props.color) return props.color;
			if (props.required && configs.status.changed) {
				return configs.validation.isValid === true ? 'success' : 'error';
			}
			return 'default';
		},
		get disabled() {
			return props.disabled ?? formContext?.disabled;
		},
		get loading() {
			// prop-only (loading demo) — form-loading gate xử lý qua Button;
			// field self-block khi đang self-validate (pending).
			if (props.loading) return true;
			return configs.validation.isValid === 'pending';
		},
		get checked() {
			return checked;
		},
		name: props.name,
		required: props.required,
		get duration() {
			return convertToMiliseconds(props.duration) ?? convertToMiliseconds(client.browser?.duration) ?? 300;
		},
		get delay() {
			return convertToMiliseconds(props.delay);
		},
		validation: {
			_isValid: undefined as undefined | boolean | 'pending',
			get isValid() {
				// After programmatic reset, suppress validation until user interacts
				if (_justReset) return true;
				if (configs.required) {
					if (this._isValid === undefined) return 'pending';
					return this._isValid;
				}
				return undefined;
			},
			set isValid(v: boolean | 'pending' | undefined) {
				this._isValid = v;
			},
			messages: new SvelteMap()
		},
		reset() {
			// Khôi phục về checked ban đầu (khi mount) — mirror checkbox.
			// Set _justReset TRƯỚC khi đổi checked để $effect không trigger validation.
			_justReset = true;
			checked = _initialChecked;
			previousChecked = _initialChecked;
			configs.validation.messages = undefined;
			configs.validation.isValid = undefined;
			if (configs.timeId) {
				for (const id of configs.timeId.values()) clearTimeout(id);
				configs.timeId.clear();
			}
		},
		focus() {
			(configs.ref as HTMLButtonElement | undefined)?.focus();
		}
	});
	setToggleContext(configs);

	// ── Validation pipeline (mirror checkbox) ──
	// Theo checked: changed && !_justReset → debounce `configs.delay ?? 300` →
	// defaultValidation.required(name) (isValid = checked truthy) → messages + isValid.
	$effect(() => {
		const current = Boolean(checked);
		const changed = untrack(() => previousChecked) !== current;

		// cập nhật previousChecked ngay, đồng bộ, không lệch nhịp
		untrack(() => {
			previousChecked = current;
		});

		if (changed && !_justReset) {
			if (!configs.timeId) configs.timeId = new Map();
			const name = 'timeout-validation';
			const timeId = configs.timeId.get(name);
			if (timeId) clearTimeout(timeId);
			configs.timeId.set(
				name,
				setTimeout(async () => {
					if (!configs.validation.messages) configs.validation.messages = new SvelteMap();
					configs.validation.isValid = await validationProcessing(
						checked,
						{ required: defaultValidation.required(props.name) },
						configs.validation.messages
					);
				}, configs.delay ?? client.browser?.delay ?? 300)
			);
		} else if (changed && _justReset) {
			// Just reset - clear the flag so future changes will trigger validation
			_justReset = false;
		}
	});

	// Chạy validation required ngay khi mount (KHÔNG debounce) — DIVERGENCE có chủ
	// đích so checkbox: một switch required DEFAULT-OFF là "consent phải BẬT", cần
	// thông báo "bắt buộc" NGAY khi render (không chờ user tương tác).
	// - `runRequiredValidation` chỉ set `configs.validation.messages` + `isValid`
	//   (component-side). HIỂN THỊ (FieldMessages) là trách nhiệm PM: composable
	//   useMessageDisplay phải gọi getToggleContext() — snippet (b), xem BANI BÁO.
	// - _justReset=true ban đầu đã chặn $effect mount; đây là đường riêng, chạy
	//   1 lần. Field KHÔNG-required: no-op (giữ pristine — không hiện message).
	async function runRequiredValidation() {
		if (!configs.required) return;
		_justReset = false;
		if (!configs.validation.messages) configs.validation.messages = new SvelteMap();
		configs.validation.isValid = await validationProcessing(
			checked,
			{ required: defaultValidation.required(props.name) },
			configs.validation.messages
		);
	}

	async function validationProcessing(
		input: string | boolean | undefined,
		validation: {
			required?: ValidationFull | ValidationCompact;
			operator?: 'and' | 'or';
		},
		storageMessages?: Map<
			string | ((output?: string) => boolean | Promise<boolean>),
			{ content?: TranslateContent; kind: 'valid' | 'invalid' }
		>
	) {
		const [objK, objV] = Object.entries(validation);
		if (!objK.length) return;
		const results: Map<'required', boolean> = new SvelteMap();
		if (validation.required) {
			let rs: boolean;
			if (typeof validation.required == 'function') {
				rs = await validation.required();
			} else {
				rs = await validation.required.isValid(input);
			}
			results.set('required', rs);
			if (
				typeof validation.required == 'object' &&
				validation.required.message &&
				storageMessages
			) {
				storageMessages.set('required', {
					content: rs ? validation.required.message.valid : validation.required.message.invalid,
					kind: rs ? 'valid' : 'invalid'
				});
			}
		}
		return validation.operator == 'and'
			? [...results.values()].every((item) => item)
			: [...results.values()].some((item) => item);
	}

	onMount(() => {
		if (formContext) {
			if (!formContext.childrens) formContext.childrens = new SvelteSet();
			formContext.childrens.add(configs);
		}
		// Required toggle: chạy validation ngay khi mount (không debounce) để
		// message "bắt buộc (phải BẬT)" hiện khi render (probe T6: ban đầu invalid).
		// Field không-required: no-op (giữ _justReset pristine — không hiện message).
		void runRequiredValidation();
	});
	onDestroy(() => {
		if (configs.timeId) {
			for (const id of configs.timeId.values()) clearTimeout(id);
			configs.timeId.clear();
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	style:--duration="{configs.duration}ms"
>
	<button
		type="button"
		role="switch"
		aria-checked={checked ? 'true' : 'false'}
		aria-label={ariaLabel}
		disabled={configs.disabled || configs.loading ? true : undefined}
		class="toggle-switch"
		class:has-value={checked}
		data-test="toggle-switch"
		onclick={toggle}
	>
		<span class="toggle-track" aria-hidden="true">
			<span class="toggle-thumb" />
		</span>
	</button>

	{#if children}
		<label class="toggle-label" onclick={toggle}>{@render children?.()}</label>
	{:else if labelText}
		<label class="toggle-label" onclick={toggle}>{labelText}</label>
	{/if}
</svelte:element>

<style lang="scss">
	@use '_styles.scss';
</style>
