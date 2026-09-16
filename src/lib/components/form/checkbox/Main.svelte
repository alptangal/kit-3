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
	// Ghi nhớ giá trị checked ban đầu để reset về đúng mốc đầu tiên (hỗ trợ cả formContext.data)
	let _initialChecked: boolean | undefined =
		formContext?.data && props.name && props.name in formContext.data
			? Boolean(formContext.data[props.name])
			: checked;
	let configs: CheckboxConfigs = $state({
		previousValue: _initialChecked,
		status: {
			get changed() {
				return Boolean(checked) !== Boolean(_initialChecked);
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
			return (
				convertToMiliseconds(props.duration) ??
				convertToMiliseconds(client.browser?.duration) ??
				300
			);
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
									checked = !checked;
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
			checked = _initialChecked;
			configs.previousValue = _initialChecked;
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
		if (changed) {
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
	{@attach handleEvents(configs.event)}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	.checkbox-root {
		@apply flex flex-row-reverse justify-end items-center;
		&.disabled {
			position: relative;
			--cursor: not-allowed;
			--opacity: var(--disabled-opacity);
			&::before {
				content: '';
				position: absolute;
				top: 0px;
				left: 0px;
				width: 100%;
				height: 100%;
				z-index: 1;
			}
		}
		&.has-value {
		}
		--cursor: pointer;
		--opacity: 1;
		cursor: var(--cursor);
		opacity: var(--opacity);
		gap: var(--gap);
	}
</style>
