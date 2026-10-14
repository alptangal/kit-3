<script lang="ts">
	// src/lib/components/form/textarea/Main.svelte
	// FORM FIELD — mirror mẫu checkbox/radiogroup: configs $state + Symbol context
	// + form registration + validation debounce + _justReset.
	// Render: native <textarea> (giữ keyboard/IME/autocomplete chuẩn — §7 a11y).
	import { convertToMiliseconds, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { getFormContext } from '../form';
	import { setTextareaContext, defaultValidation } from './index';
	import type { TextareaConfigs, TextareaProps } from './_interface';
	import type { ValidationFull } from '../input/_interface';
	import type { TranslateContent } from '$interfaces/basic';

	let { value = $bindable(), children, ...props }: TextareaProps = $props();
	const formContext = getFormContext();

	// Mốc ban đầu (mốc reset + tính status.changed)
	let _initialValue: string = value ?? '';
	// Programmatic reset → đè validation cho tới khi user tương tác lại
	let _justReset = $state(true);
	// Native name — stable, sinh 1 lần (unique, không collision)
	const stableName = (() => {
		if (props.name) return props.name;
		return `textarea-${Math.random().toString(36).slice(2, 10)}`;
	})();

	// Native textarea ref
	let textareaRef: HTMLTextAreaElement | undefined;

	// Placeholder resolution (TranslateContent → string theo language)
	const placeholderText = $derived.by(() => {
		if (!props.placeholder) return undefined;
		if (typeof props.placeholder === 'string') return props.placeholder;
		const lang = client.browser?.language ?? 'en';
		return props.placeholder[lang] ?? props.placeholder.en ?? props.placeholder.vi ?? undefined;
	});

	let configs: TextareaConfigs = $state({
		value: '',
		name: stableName,
		get loading() {
			// Form loading indicator: true khi validation đang 'pending'
			return configs.validation.isValid === 'pending';
		},
		status: {
			focus: false,
			get changed() {
				return (value ?? '') !== _initialValue;
			}
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'textarea-root',
				`size-${this.size}`,
				`color-${this.color}`,
				this.disabled ? 'disabled' : undefined,
				props.readOnly ? 'is-readonly' : undefined,
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
			// Có validator (required/minLength/maxLength): đổi màu chỉ khi ĐÃ trigger
			// (messages đã populate — mirror input `process.size > 0`), tránh màu
			// pending trên pristine field. Empty + required sau khi từng nhập → vẫn
			// báo error (khác `status.changed` vốn so với initial).
			if (props.required || props.minLength != null || props.maxLength != null) {
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
		get minLength() {
			return props.minLength;
		},
		get maxLength() {
			return props.maxLength;
		},
		get rows() {
			return props.rows ?? 3;
		},
		get autoResize() {
			return props.autoResize ?? false;
		},
		get readOnly() {
			return props.readOnly;
		},
		get event(): TextareaConfigs['event'] {
			if (this.disabled) return undefined;
			return props.events ?? [];
		},
		validation: {
			_isValid: undefined as undefined | boolean | 'pending',
			get isValid() {
				// Programmatic reset → chưa validate → hợp lệ (trả true)
				if (_justReset) return true;
				if (configs.required || configs.minLength != null || configs.maxLength != null) {
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
	setTextareaContext(configs);

	// Sync configs.value (Form serialize đọc 'value' in children → string)
	$effect(() => {
		const v = value ?? '';
		if (configs.value !== v) {
			configs.value = v;
		}
	});

	// ── Validation pipeline (mirror checkbox/radiogroup) ──
	// Theo value: changed && !_justReset → debounce → run validators → isValid + messages
	let previousValue: string = value ?? '';

	$effect(() => {
		const current = value ?? '';
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
			const hasValidator = configs.required || configs.minLength != null || configs.maxLength != null;
			if (!hasValidator) return;

			if (!configs.timeId) configs.timeId = new Map();
			const name = 'timeout-validation';
			const timeId = configs.timeId.get(name);
			if (timeId) clearTimeout(timeId);
			configs.timeId.set(
				name,
				setTimeout(async () => {
					// Build validators
					const validators: ValidationFull[] = [];
					if (configs.required) validators.push(defaultValidation.required(configs.name));
					if (configs.minLength != null) validators.push(defaultValidation.minLength(configs.minLength, configs.name));
					if (configs.maxLength != null) validators.push(defaultValidation.maxLength(configs.maxLength, configs.name));

					// Run all validators (AND) — mỗi validator 1 key riêng để
					// FieldMessages có thể hiện nhiều message (required + min + max).
					let allValid = true;
					if (!configs.validation.messages) configs.validation.messages = new SvelteMap();
					const messages = configs.validation.messages as SvelteMap<string, { content?: TranslateContent; kind: 'valid' | 'invalid' }>;
					for (let i = 0; i < validators.length; i++) {
						const v = validators[i];
						const rs = (await v.isValid(current)) as boolean;
						if (!rs) allValid = false;
						const key = i === 0 ? 'required' : i === 1 ? 'minLength' : 'maxLength';
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

	// ── Auto-resize ──
	// height auto theo nội dung (min-height theo rows do CSS; max-height 20rem clamp).
	// `value` là reactive (bindable) → effect re-run khi nội dung đổi.
	$effect(() => {
		// Reactive dep: đọc (value ?? '').length để effect re-run khi nội dung đổi
		// (tránh expression-statement `value;`).
		const v = value ?? '';
		v.length;
		if (!configs.autoResize || !textareaRef) return;
		textareaRef.style.height = 'auto';
		// Rỗng → giữ height auto (min-height CSS theo rows). KHÔNG đo scrollHeight
		// khi empty: Chromium đo placeholder vào scrollHeight (lớn bất thường) →
		// height "giãn ảo" khi chưa có nội dung.
		if (!v) return;
		const maxH = 20 * parseFloat(getComputedStyle(document.documentElement).fontSize);
		const h = Math.min(textareaRef.scrollHeight, maxH);
		textareaRef.style.height = `${h}px`;
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

<div class={configs.style} style:--duration={`${configs.duration}ms`} {@attach handleEvents(configs.event)}>
	<textarea
		bind:this={textareaRef}
		bind:value
		rows={configs.rows}
		placeholder={placeholderText}
		maxlength={configs.maxLength}
		disabled={configs.disabled ? true : undefined}
		readonly={configs.readOnly ? true : undefined}
		aria-invalid={configs.validation.isValid === false ? 'true' : undefined}
		aria-label={props['aria-label']}
		id={props.id}
		onfocus={handleFocus}
		onblur={handleBlur}
	></textarea>
	{@render children?.()}
</div>

<style lang="scss">
	@use '_styles.scss';
</style>
