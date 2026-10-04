<script lang="ts">
	import { convertToMiliseconds, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { defaultValidation, releaseIndicator, setCheckboxContext } from '.';
	import { getFormContext } from '../form';
	import type { CheckboxConfigs, CheckboxProps } from './_interface';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { TranslateContent } from '$interfaces/basic';
	import type { ValidationCompact, ValidationFull } from '../input/_interface';

	let { children, checked = $bindable(), ...props }: CheckboxProps = $props();
	const formContext = getFormContext();

	function toggle() {
		if (configs.disabled) return;
		checked = !checked;
	}
	// Ghi nhớ giá trị checked ban đầu để reset về đúng mốc đầu tiên (hỗ trợ cả formContext.data)
	// Capture initial value immediately on mount to avoid lazy capture issues
	let _initialChecked: boolean | undefined = checked;
	// Track if field was just reset programmatically - suppress validation until user interacts
	let _justReset = $state(true);

let configs: CheckboxConfigs = $state({
		get previousValue() {
			if (_initialChecked === undefined) {
				const name = props.name;
				const data = formContext?.data;
				if (data && name && name in data) {
					_initialChecked = Boolean(data[name]);
				} else {
					_initialChecked = checked;
				}
			}
			return _initialChecked;
		},
		status: {
			get changed() {
				return Boolean(checked) !== Boolean(configs.previousValue);
			}
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'checkbox-root',
				`size-${this.size}`,
				`color-${this.color}`,
				this.disabled ? 'disabled' : undefined,
				checked ? 'has-value' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get size() {
			return props.size ?? formContext?.size ?? client.browser?.size ?? 'md';
		},
		get color() {
			if (props.color) return props.color;
			if (this.required && configs.status.changed) {
				return configs.validation.isValid == true ? 'success' : 'error';
			}
			return 'default';
		},
		get disabled() {
			return props.disabled ?? formContext?.disabled;
		},
		get checked() {
			return checked;
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
		get event(): CheckboxConfigs['event'] {
			if (this.disabled) return undefined;
			const defaultEvents: CheckboxConfigs['event'] = [
				{
					events: {
						mousedown: {
							handler(e, data) {
								if (data?.node instanceof HTMLElement) {
									toggle();
								}
							},
							options: {
								get delay() {
									return configs.delay;
								}
							}
						}
					}
				}
			];
			const propEvents = props.events ?? [];
			return [...defaultEvents, ...propEvents];
		},
		children: {},
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
			set isValid(v) {
				this._isValid = v;
			},
			messages: new SvelteMap()
		},
		reset() {
			// Khôi phục về checked ban đầu (khi mount), không phải luôn xóa thành undefined
			const initialValue = _initialChecked ?? (() => {
				const name = props.name;
				const data = formContext?.data;
				if (data && name && name in data) {
					return Boolean(data[name]);
				}
				return checked;
			})();
			// Set _justReset BEFORE changing checked to prevent $effect from triggering validation
			_justReset = true;
			checked = initialValue;
			_initialChecked = initialValue;
			configs.validation.messages = undefined;
			configs.validation.isValid = undefined;
			if (configs.timeId) {
				for (const id of configs.timeId.values()) clearTimeout(id);
				configs.timeId.clear();
			}
		}
	});
	setCheckboxContext(configs);

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

	let unmountIndicator: (() => void) | undefined = undefined;

	$effect(() => {
		if (!configs.children.indicator && configs.ref) {
			unmountIndicator = releaseIndicator(configs);
		}
		return () => {
			unmountIndicator?.();
			unmountIndicator = undefined;
		};
	});

	$effect(() => {
		const current = checked;
		const changed = untrack(() => configs.previousValue) !== current;

		// cập nhật previousValue ngay, đồng bộ, không lệch nhịp
		untrack(() => {
			configs.previousValue = current;
		});
		if (changed && !_justReset) {
			if (!configs.timeId) configs.timeId = new Map();
			const name = 'timeout-valition';
			const timeId = configs.timeId.get(name);
			if (timeId) clearTimeout(timeId);
			configs.timeId.set(
				name,
				setTimeout(
					async () => {
						if (!configs.validation.messages) configs.validation.messages = new SvelteMap();
						configs.validation.isValid = await validationProcessing(
							checked,
							{ required: defaultValidation.required() },
							configs.validation.messages
						);
					},
					configs.delay ?? client.browser?.delay ?? 300
				)
			);
		} else if (changed && _justReset) {
			// Just reset - clear the flag so future changes will trigger validation
			_justReset = false;
		}
	});

	onMount(() => {
		if (formContext) {
			if (!formContext.childrens) formContext.childrens = new SvelteSet();
			formContext.childrens.add(configs);
		}
	});
	onDestroy(() => {
		unmountIndicator?.();
		[...(configs.timeId?.values() ?? [])].forEach((time) => {
			clearTimeout(time);
			cancelAnimationFrame(time as number);
		});
		configs.timeId?.clear();
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	role="checkbox"
	aria-checked={checked ? 'true' : 'false'}
	tabindex={0}
	aria-label={props['aria-label']}
	{@attach handleEvents(configs.event)}
	onkeydown={(e: KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggle();
		}
	}}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	@use '_styles.scss';
</style>