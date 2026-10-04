<script lang="ts">
	//$components/form/radiogroup/Main.svelte
	// RadioGroup root — viết lại theo mẫu Checkbox (configs $state + Symbol context
	// + form registration + validation debounce + roving focus scoped).
	import { styleSynced, convertToMiliseconds } from '$modules';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { getFormContext } from '../form';
	import { setRadioContext, defaultValidation } from './index';
	import type { RadioGroupConfigs, RadioGroupProps } from './_interface';

	let { value = $bindable(), children, ...props }: RadioGroupProps = $props();
	const formContext = getFormContext();

	// Giá trị ban đầu (mốc reset + tính status.changed)
	let _initialValue: string | null = value ?? null;
	// Ưng giá trị trước khi đổi (để phát hiện "đã thay đổi" trong validation pipeline)
	let previousValue: string | null = value ?? null;
	// Chương trình reset → đè validation cho tới khi user tương tác lại
	let _justReset = $state(true);

	// Native `name` — stable, sinh 1 lần. props.name nếu có; nếu không thì tự sinh
	// unique (sửa bug collision: nhiều group cùng default 'radio-group' bị native
	// gom chung → chọn 1 group làm mất check của group khác).
	const stableName = (() => {
		if (props.name) return props.name;
		try {
			return crypto.randomUUID().slice(0, 8);
		} catch {
			return `rg-${Math.random().toString(36).slice(2, 10)}`;
		}
	})();

	let configs: RadioGroupConfigs = $state({
		status: {
			get changed() {
				// dirty so với mốc ban đầu (chọn khác giá trị khởi tạo)
				return (value ?? null) !== _initialValue;
			},
			focus: false
		},
		previousValue,
		name: stableName,
		ids: [] as string[],
		items: new SvelteMap<string, { disabled?: boolean }>(),
		get enabledIds() {
			if (configs.disabled) return [] as string[];
			return configs.ids.filter((id) => !configs.items.get(id)?.disabled);
		},
		get activeId() {
			const enabled = configs.enabledIds;
			if (!enabled.length) return undefined;
			if (value && enabled.includes(value)) return value;
			return enabled[0];
		},
		select(id) {
			if (configs.disabled) return;
			if (configs.items.get(id)?.disabled) return;
			_justReset = false;
			value = id;
		},
		reset() {
			// Khôi phục về giá trị ban đầu (khi mount); đặt cờ _justReset TRƯỚC khi
			// đổi value để validation effect không trigger.
			_justReset = true;
			value = _initialValue;
			previousValue = _initialValue;
			configs.validation.messages = undefined;
			configs.validation.isValid = undefined;
			if (configs.timeId) {
				for (const id of configs.timeId.values()) clearTimeout(id);
				configs.timeId.clear();
			}
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'radiogroup-root',
				`size-${this.size}`,
				`color-${this.color}`,
				this.orientation === 'horizontal' ? 'horizontal' : undefined,
				this.disabled ? 'disabled' : undefined,
				value ? 'has-value' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get size() {
			return props.size ?? formContext?.size ?? client.browser?.size ?? 'md';
		},
		get color() {
			if (props.color) return props.color;
			if (configs.required && configs.status.changed) {
				return configs.validation.isValid == true ? 'success' : 'error';
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
		get orientation() {
			return props.orientation ?? 'vertical';
		},
		get value() {
			return value ?? null;
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
		}
	});
	setRadioContext(configs);

	// ── Validation pipeline (mirror checkbox) ──
	// Theo value + previousValue: đổi && !justReset → debounce → required → isValid
	$effect(() => {
		const current = value ?? null;
		const changed = untrack(() => previousValue) !== current;

		// Cập nhật previousValue ngay, đồng bộ (không lệch nhịp)
		untrack(() => {
			previousValue = current;
		});

		if (changed && configs.required) {
			if (_justReset) {
				// Vừa reset — bỏ qua lần này, bật cờ để các lần sau validate
				_justReset = false;
				return;
			}
			if (!configs.timeId) configs.timeId = new Map();
			const name = 'timeout-validation';
			const timeId = configs.timeId.get(name);
			if (timeId) clearTimeout(timeId);
			configs.timeId.set(
				name,
				setTimeout(async () => {
					const validator = defaultValidation.required(configs.name);
					const rs = (await validator.isValid(current)) as boolean;
					if (!configs.validation.messages) configs.validation.messages = new SvelteMap();
					configs.validation.isValid = rs;
					configs.validation.messages.set('required', {
						content: rs ? validator.message?.valid : validator.message?.invalid,
						kind: rs ? 'valid' : 'invalid'
					});
				}, configs.delay ?? client.browser?.delay ?? 300)
			);
		} else if (changed && _justReset) {
			_justReset = false;
		}
	});

	// ── Roving focus (SCOPED — bỏ <svelte:window>, sửa bug R7) ──
	// onkeydown trên root div (bubbles từ native inputs): Arrow/Home/End di focus,
	// Space chọn option hiện tại. e.preventDefault() suppress native radio arrow.
	let rootEl: HTMLDivElement | undefined;

	function focusId(id: string) {
		if (!rootEl) return;
		const input = Array.from(rootEl.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(
			(el) => el.value === id && !el.disabled
		);
		input?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (configs.disabled) return;
		const enabled = configs.enabledIds;
		if (!enabled.length) return;

		// Tính index hiện tại từ DOM activeElement (không cần focusedId store)
		const active = document.activeElement;
		let idx =
			active instanceof HTMLInputElement && active.type === 'radio'
				? enabled.indexOf(active.value)
				: enabled.indexOf(value ?? '');
		if (idx === -1) idx = 0;

		switch (e.key) {
			case 'ArrowDown':
			case 'ArrowRight':
				e.preventDefault();
				focusId(enabled[(idx + 1) % enabled.length]);
				break;
			case 'ArrowUp':
			case 'ArrowLeft':
				e.preventDefault();
				focusId(enabled[(idx - 1 + enabled.length) % enabled.length]);
				break;
			case 'Home':
				e.preventDefault();
				focusId(enabled[0]);
				break;
			case 'End':
				e.preventDefault();
				focusId(enabled[enabled.length - 1]);
				break;
			case ' ':
				e.preventDefault();
				if (idx >= 0) configs.select(enabled[idx]);
				break;
		}
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

<!-- tabindex=-1: ARIA composite (programmatically focusable, KHÔNG Tab stop) —
     roving focus nằm ở radio input, không phải container (WAI-ARIA radio group). -->
<div
	bind:this={rootEl}
	class={configs.style}
	role="radiogroup"
	tabindex={-1}
	aria-label={props['aria-label']}
	aria-disabled={configs.disabled ? 'true' : undefined}
	aria-invalid={configs.validation.isValid === false ? 'true' : undefined}
	onkeydown={handleKeydown}
>
	{@render children?.()}
</div>

<style lang="scss">
	@use '_styles.scss';
</style>
