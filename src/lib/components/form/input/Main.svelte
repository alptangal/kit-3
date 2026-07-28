<script lang="ts">
	import { iconify } from '$assets/icons/iconify';
	import { Button, Icon } from '$components/element';
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { untrack, type SvelteComponent } from 'svelte';
	import type { InputConfigs, InputProps } from './_interface';
	import type { ButtonConfigs } from '$components/element/button/_interface';
	import { keys_allowed } from '.';
	import type { EventListener } from '$components/interface';
	import type { TranslateContent } from '$interfaces/basic';
	import { SvelteMap } from 'svelte/reactivity';
	import { curry } from 'es-toolkit/compat';

	let { value = $bindable(), disabled = $bindable(), ...props }: InputProps = $props();
	let configs: InputConfigs = $state({
		status: {},
		get type() {
			return props.type ?? 'text';
		},
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		get rounded() {
			return props.rounded ?? this.size;
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'input-root',
				`size-${this.size}`,
				configs.status.focus ? 'focus' : undefined,
				`variant-${this.variant}`,
				disabled ? 'disabled' : undefined,
				`rounded-${this.rounded}`,
				props.loading ? 'loading' : undefined,
				`color-${this.color}`
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get delay() {
			return client.browser?.delay ?? 300;
		},
		get duration() {
			return client.browser?.delay ?? 300;
		},
		get variant() {
			return props.variant ?? 'secondary';
		},
		get maxLength() {
			if (props.maxLength)
				return typeof props.maxLength == 'number' ? props.maxLength : parseFloat(props.maxLength);
			return undefined;
		},
		get color() {
			if (props.validation) {
				if (configs.validation.isValid != 'pending') {
					return configs.validation.isValid ? 'success' : 'error';
				}
			}
			return props.color ?? 'default';
		},

		validation: {
			get isValid() {
				if (!props.validation) return true;
				if (configs.validation.process) {
					const operator = props.validation?.operator ?? 'and';
					const results = [...configs.validation.process.values()];
					if (results.some((rs) => rs == 'pending')) return 'pending';
					return operator == 'and' ? results.every((rs) => rs) : results.some((rs) => rs);
				}
				return 'pending';
			}
		},
		get event() {
			if (disabled) return [];
			return [
				props.validation
					? {
							events: Object.fromEntries(
								Object.entries(props.validation)
									.filter(([eventName, _]) => !['keyup', 'keydown'].includes(eventName))
									.map(([eventName, data]) => {
										return [
											eventName,
											async () => {
												const evName = eventName as keyof EventListener | 'operator';
												if (evName == 'operator') {
													if (typeof data == 'string') {
													}
												} else {
													if (!configs.validation.process)
														configs.validation.process = new SvelteMap();
													if (typeof data == 'object' && Array.isArray(data)) {
														configs.validation.process.set(evName, 'pending');
														const operator = props.validation?.operator ?? 'and';
														await processingValidation(evName, data, operator);
													} else if (typeof data == 'object') {
														const operator = data.operator ?? props.validation?.operator ?? 'and';
														configs.validation.process.set(evName, 'pending');
														await processingValidation(evName, data.handles, operator);
													}
												}
											}
										];
									})
							)
						}
					: undefined,
				{
					events: {
						async load() {
							if (client.browser?.isMobile && !client.browser.visualInput) {
								const visualInput = document.createElement('input');
								visualInput.classList.add(
									'visual-input',
									'h-1',
									'w-1',
									'opacity-0',
									'fixed',
									'bottom-0',
									'left-0',
									'-z-50'
								);
								document.body.appendChild(visualInput);
								client.browser.visualInput = visualInput;
							}
							let clipboardRaw: string | undefined | null;
							try {
								clipboardRaw = await navigator.clipboard.readText();
							} catch (e) {
								clipboardRaw = localStorage.getItem('clipboard');
							}
							if (!clipboardRaw) return;
							if (!client.browser) client.browser = {};
							if (!client.browser.clipboard) client.browser.clipboard = new Map();
							try {
								const [time, content] = (
									Object.entries(JSON.parse(clipboardRaw)) as [string, string][]
								)[0];
								client.browser.clipboard.set(parseFloat(time), content);
							} catch (e) {
								console.log(e);
							}
						},
						mousedown(e: MouseEvent) {
							if (value && configs.maskValue.ref) {
								const index = calculatorCursor(e, value, configs.maskValue.ref);
								requestAnimationFrame(() => {
									const ref = configs.input[configs.type].ref;
									if (ref instanceof HTMLInputElement) {
										configs.status.currentCursor = index ?? value?.length ?? 1;
										ref.setSelectionRange(
											configs.status.currentCursor,
											configs.status.currentCursor
										);
									}
								});
							}
							if (configs.status.focus) {
								const target = e.target as HTMLElement;
								const ref = configs.input[configs.type].ref;
								if (!ref?.contains(target)) e.preventDefault();
								const name = 'animation-bounce';
								if (!configs.timeId) configs.timeId = new Map();
								const timeId = configs.timeId.get(name);
								if (timeId) clearTimeout(timeId);
								configs.timeId.set(
									name,
									setTimeout(() => {
										configs.ref?.classList.add('animation-bounce');
										setTimeout(() => {
											configs.ref?.classList.remove('animation-bounce');
										}, configs.duration);
									}, configs.delay)
								);
							} else {
								configs.status.focus = true;
								if (client.browser?.isMobile && client.browser.visualInput) {
									client.browser.visualInput.focus();
								}
							}
						},
						keydown() {
							// configs.lastValue = value;
						}
					}
				},
				...(props.events ?? [])
			] as InputProps['events'];
		},
		placeholder: {
			get value() {
				return (
					props.placeholder ?? {
						vi: `Nhập giá trị ${configs.type}`,
						en: `Enter your ${configs.type}`
					}
				);
			},
			event: [
				{
					events: {
						load() {
							return () => {
								requestAnimationFrame(() => {
									const ref = configs.input[configs.type].ref;
									if (ref) {
										ref.focus();
										configs.ref?.classList.add('animation-bounce');
										setTimeout(() => {
											configs.ref?.classList.remove('animation-bounce');
										}, configs.duration);
									}
								});
							};
						},
						mousedown() {}
					}
				}
			]
		},
		input: {
			text: {
				get event() {
					return [
						props.validation
							? {
									events: Object.fromEntries(
										Object.entries(props.validation)
											.filter(([eventName, _]) => ['keyup', 'keydown'].includes(eventName))
											.map(([eventName, data]) => {
												return [
													eventName,
													async () => {
														const evName = eventName as keyof EventListener | 'operator';
														if (evName == 'operator') {
															if (typeof data == 'string') {
															}
														} else {
															if (!configs.validation.process)
																configs.validation.process = new SvelteMap();
															if (typeof data == 'object' && Array.isArray(data)) {
																configs.validation.process.set(evName, 'pending');
																const operator = props.validation?.operator ?? 'and';
																await processingValidation(evName, data, operator);
															} else if (typeof data == 'object') {
																const operator =
																	data.operator ?? props.validation?.operator ?? 'and';
																configs.validation.process.set(evName, 'pending');
																await processingValidation(evName, data.handles, operator);
															}
														}
													}
												];
											})
									)
								}
							: { events: {} },
						{
							events: {
								load(e, data) {
									if (data?.node instanceof HTMLInputElement) {
										if (!configs.timeId) configs.timeId = new Map();
										const name = 'timeout-get-size-input';
										const timeId = configs.timeId.get(name);
										if (timeId) clearTimeout(timeId);
										configs.timeId.set(
											name,
											setTimeout(() => {
												if (data.node instanceof HTMLInputElement) {
													const rect = data.node.getBoundingClientRect();
													if (data.node.offsetWidth) configs.maskValue.width = rect.width;
													if (data.node.offsetHeight) configs.maskValue.height = rect.height;
												}
											}, configs.duration)
										);
									}
								},
								blur() {
									configs.status.focus = false;
								},
								keydown(e) {
									const event = e as KeyboardEvent;
									if (
										event &&
										configs.maxLength &&
										configs.type == 'text' &&
										value?.length == configs.maxLength &&
										!keys_allowed.includes(event.key.toLowerCase())
									) {
										event.preventDefault();
									}
								}
							}
						}
					];
				},
				get style() {
					const defaultStyles: (string | undefined)[] = ['input-editor'];
					return styleSynced({ defaultStyles });
				}
			},
			password: {
				get style() {
					return configs.input.text.style;
				},
				_value: undefined as undefined | string,
				get value() {
					if (!this._value) return this._value;
					if (configs.actionButtons.showPassword.status.showing) return this._value;
					return (
						this._value
							.slice(0, -1)
							.split('')
							.map((character) => '*')
							.join('') + this._value.slice(-1)
					);
				},
				set value(v: string | undefined) {
					this._value = v;
				},
				event: [
					{
						events: {
							mousedown(e) {
								let index: number | undefined;
								if (configs.input.password.showPassword) {
									if (!value || !configs.input.password.ref) {
										index = 1;
									} else {
										index = calculatorCursor(e as MouseEvent, value, configs.input.password.ref);
									}
								} else {
									if (!configs.input.password.value || !configs.input.password.ref) {
										index = 1;
									} else {
										index = calculatorCursor(
											e as MouseEvent,
											configs.input.password.value,
											configs.input.password.ref
										);
									}
								}
								configs.status.currentCursor = index ?? value?.length ?? 1;
							},
							keydown(e) {
								const event = e as KeyboardEvent;
								if (configs.input.password.showPassword) event.preventDefault();
								const key = event.key;
								if (!value) {
									value = key;
								} else {
									if (
										!['delete', 'backspace', 'control', 'alt', 'shift'].includes(key.toLowerCase())
									) {
										const currentCursor = configs.status.currentCursor ?? 1;
										value =
											value.slice(0, currentCursor) +
											key +
											value.slice(currentCursor, value.length);
									}
								}
								if (
									!configs.status.currentCursor ||
									configs.status.currentCursor == value.length - 1
								) {
									configs.status.currentCursor = value.length;
								} else {
									configs.status.currentCursor += 1;
								}
							},
							keyup() {
								if (!value) return;
								configs.input.password.value = Array(value.length).fill('*').join('');
								const inputRef = configs.input.password.ref as HTMLInputElement;

								if (inputRef && configs.status.currentCursor) {
									inputRef.setSelectionRange(
										configs.status.currentCursor,
										configs.status.currentCursor
									);
								}
							},
							blur() {
								configs.status.focus = false;
							}
						}
					}
				]
			},
			email: {},
			phone: {},
			number: {},
			currency: {}
		},
		maskValue: {
			get style() {
				const defaultStyles: (string | undefined)[] = [
					'input-mask',
					...(configs.input.text?.style ?? [])
				];
				return styleSynced({ defaultStyles });
			},
			event: [
				{
					events: {
						load(e, data) {
							if (data?.node instanceof HTMLElement) {
								data.node.style.width = `${configs.maskValue.width}px`;
								data.node.style.height = `${configs.maskValue.height}px`;
								data.node.scrollTo({ left: data.node.scrollWidth, behavior: 'smooth' });
							}
							return () => {
								requestAnimationFrame(() => {
									const ref = configs.input[configs.type].ref;
									if (ref) {
										ref.focus();
										configs.ref?.classList.add('animation-bounce');
										setTimeout(() => {
											configs.ref?.classList.remove('animation-bounce');
										}, configs.duration);
									}
								});
							};
						}
					}
				}
			]
		},
		actionButtons: {
			clear: {
				get display() {
					return props.actionButtons?.clear?.display ?? true;
				},
				event: [
					{
						events: {
							mousedown: {
								handler() {
									if (configs.type == 'password') {
										configs.input.password.value = '';
									}
									value = '';
									onFocus();
								},
								options: {}
							}
						}
					}
				],
				get ref(): HTMLElement | undefined {
					const component = configs.actionButtons.clear.component as SvelteComponent & {
						configs: ButtonConfigs;
					};
					if (component && component.configs) return component.configs.ref as HTMLElement;
					return undefined;
				}
			},
			copy: {
				get display() {
					return props.actionButtons?.copy?.display ?? false;
				},
				status: {},
				event: [
					{
						events: {
							async mousedown() {
								if (!value) return;
								const date = new Date();
								localStorage.setItem('clipboard', JSON.stringify({ [`${date.getTime()}`]: value }));
								if (!client.browser) client.browser = {};
								if (!client.browser?.clipboard) client.browser.clipboard = new Map();
								client.browser.clipboard.set(date.getTime(), value);
								configs.actionButtons.copy.status.copied = true;
								if (!configs.timeId) configs.timeId = new Map();
								const name = 'timeout-copy';
								const timeId = configs.timeId.get(name);
								if (timeId) clearTimeout(timeId);
								configs.timeId.set(
									name,
									setTimeout(() => {
										configs.actionButtons.copy.status.copied = false;
									}, configs.duration)
								);
								return () => {
									if (configs.timeId) {
										const timeId = configs.timeId.get(name);
										if (timeId) clearTimeout(timeId);
									}
								};
							}
						}
					}
				]
			},
			paste: {
				get display() {
					return props.actionButtons?.paste?.display ?? false;
				},
				status: {},
				event: [
					{
						events: {
							async load() {},
							async mousedown() {
								if (!client.browser?.clipboard) return;
								const lastTime = [...client.browser.clipboard.keys()].sort(
									(timeA, timeB) => timeB - timeA
								)[0];
								if (!lastTime) return;
								const clipboard = client.browser.clipboard.get(lastTime);
								if (!clipboard) return;
								value = clipboard.slice(0, configs.maxLength ? configs.maxLength : -1);
								configs.actionButtons.paste.status.pasted = true;
								if (!configs.timeId) configs.timeId = new Map();
								const name = 'timeout-paste';
								const timeId = configs.timeId.get(name);
								if (timeId) clearTimeout(timeId);
								configs.timeId.set(
									name,
									setTimeout(() => {
										configs.actionButtons.paste.status.pasted = false;
									}, configs.duration)
								);
								return () => {
									if (configs.timeId) {
										const timeId = configs.timeId.get(name);
										if (timeId) clearTimeout(timeId);
									}
								};
							}
						}
					}
				]
			},
			showPassword: {
				get display() {
					return props.actionButtons?.showPassword?.display ?? true;
				},
				status: {
					_showing: undefined as undefined | boolean,
					get showing() {
						if (this._showing == undefined) return props.showPassword;
						return this._showing;
					},
					set showing(v) {
						this._showing = v;
					}
				},
				event: [
					{
						events: {
							mousedown() {
								configs.input.password.showPassword = !configs.input.password.showPassword;
							}
						}
					}
				]
			}
		},
		leading: {
			get style() {
				const defaultStyles: (string | undefined)[] = ['input-leading input-snippet'];
				return styleSynced({ defaultStyles });
			}
		},
		trailing: {
			get style() {
				const defaultStyles: (string | undefined)[] = ['input-trailing input-snippet'];
				return styleSynced({ defaultStyles });
			}
		}
	});

	function onFocus() {
		if (!configs.status.focus) configs.status.focus = true;
		requestAnimationFrame(() => {
			configs.input.text?.ref?.focus();
		});
	}
	async function processingValidation(
		eventName: keyof EventListener,
		handles: (
			| ((output?: string) => boolean | Promise<boolean>)
			| {
					isValid: (output?: string) => boolean | Promise<boolean>;
					message?: {
						valid?: TranslateContent;
						invalid?: TranslateContent;
					};
			  }
		)[],
		operator: 'and' | 'or'
	) {
		if (!props.validation) return;
		if (!configs.validation.messages) configs.validation.messages = new Map();
		if (!configs.timeId) configs.timeId = new Map();
		const name = `timeout-validation-${eventName}`;
		const timeId = configs.timeId.get(name);
		if (timeId) clearTimeout(timeId);
		configs.timeId.set(
			name,
			setTimeout(async () => {
				if (configs.ref) {
					configs.ref.classList.add('validation-loading');
				}
				if (!configs.validation.process) configs.validation.process = new SvelteMap();
				const promises = await Promise.all(
					handles.map(async (validateHandler) => {
						if (!configs.validation.messages) configs.validation.messages = new Map();
						let result;
						let isValid;
						if (typeof validateHandler == 'function') {
							isValid = validateHandler;
							result = await isValid(untrack(() => value));
						} else {
							isValid = validateHandler.isValid;
							result = await isValid(untrack(() => value));

							const content = result
								? validateHandler.message?.valid
								: validateHandler.message?.invalid;
							const kind = result ? 'valid' : 'invalid';
							configs.validation.messages.set(isValid, { content, kind });
						}
						return result;
					})
				);
				configs.validation.process.set(
					eventName,
					operator == 'and'
						? promises.every((isValid) => isValid)
						: promises.some((isValid) => isValid)
				);
				if (configs.ref && configs.validation.isValid != 'pending') {
					configs.ref.classList.remove('validation-loading');
				}
			}, configs.delay)
		);
	}
	function calculatorCursor(event: MouseEvent, value: string, inputElement: HTMLElement) {
		let index: number | undefined = undefined;
		const mirroEl = document.createElement('span');
		mirroEl.classList.add('input-mirror');
		if (!configs.maskValue.positionCharacters) configs.maskValue.positionCharacters = new Map();
		document.body.append(mirroEl);
		for (let i = 0; i <= value.length; i++) {
			mirroEl.textContent = value.slice(0, i);
			if (
				mirroEl.offsetWidth >=
				event.clientX - (inputElement.getBoundingClientRect().left ?? 0) + inputElement.scrollLeft
			) {
				index = i;
				break;
			}
		}
		mirroEl.remove();
		return index;
	}

	$effect(() => {
		if (configs.ref) {
			const previousValue = value;
			if (configs.status.focus) {
				configs.ref.dispatchEvent(new Event('focus'));
			} else {
				configs.ref.dispatchEvent(new Event('blur'));
			}
			if (value) {
				configs.ref.dispatchEvent(new Event('input'));
				configs.ref.dispatchEvent(new Event('keypress'));
			}
			if (value != configs.lastValue && !configs.status.focus) {
				configs.ref.dispatchEvent(new Event('change'));
			}
			return () => {
				if (!configs.status.focus) configs.lastValue = previousValue;
			};
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	style:--duration={`${configs.duration}ms`}
	{@attach handleEvents(configs.event)}
>
	{#if props.leading}
		{@render props.leading({
			defaultStyles: configs.leading.style,
			get size() {
				return configs.size;
			}
		})}
	{/if}
	{#if !configs.status.focus && !value}
		<div
			class="input-placeholder"
			bind:this={configs.placeholder.ref}
			{@attach handleEvents(configs.placeholder.event)}
		>
			{configs.placeholder.value[client.browser?.language ?? 'en']}
		</div>
	{:else if !configs.status.focus && value}
		<div
			bind:this={configs.maskValue.ref}
			class={configs.maskValue.style}
			{@attach handleEvents(configs.maskValue.event)}
		>
			{#if configs.type == 'text'}
				{value}
			{:else if configs.type == 'password'}
				{configs.input.password.showPassword ? value : configs.input.password.value}
			{/if}
		</div>
	{:else if configs.type == 'text'}
		<input
			type="text"
			bind:value
			bind:this={configs.input.text.ref}
			class={configs.input.text.style}
			{@attach handleEvents(configs.input.text.event)}
		/>
	{:else if configs.type == 'password'}
		<input
			type="text"
			value={configs.input.password.showPassword ? value : configs.input.password.value}
			bind:this={configs.input.password.ref}
			class={configs.input.password.style}
			{@attach handleEvents(configs.input.password.event)}
		/>
	{/if}
	{#if configs.maxLength && configs.type == 'text'}
		<div class="input-max-length">{value?.length ?? 0}/{configs.maxLength}</div>
	{/if}

	<div class="input-group-actions">
		{#if !value && client.browser?.clipboard?.size && configs.actionButtons.paste.display}
			<Button
				icon={configs.actionButtons.copy.status.copied
					? iconify['check-rounded']
					: iconify['content-paste-rounded']}
				class="input-paste p-0!"
				size={configs.size}
				aspect-square
				color="success"
				events={configs.actionButtons.paste.event}
				disabled={configs.actionButtons.paste.status.pasted}
			/>
		{:else if value}
			{#if configs.actionButtons.clear.display}
				<Button
					bind:this={configs.actionButtons.clear.component}
					icon={iconify['close-rounded']}
					size={configs.size}
					aspect-square
					events={configs.actionButtons.clear.event}
					class="input-clear p-0!"
					color="error"
					variant="ghost"
				/>
			{/if}
			{#if configs.actionButtons.copy.display}
				<Button
					icon={configs.actionButtons.copy.status.copied
						? iconify['check-rounded']
						: iconify['content-copy-outline-rounded']}
					class="input-copy p-0!"
					size={configs.size}
					aspect-square
					color="success"
					events={configs.actionButtons.copy.event}
					disabled={configs.actionButtons.copy.status.copied ||
						value ==
							client.browser?.clipboard?.get(
								[...(client.browser?.clipboard?.keys() ?? [])].sort(
									(timeA, timeB) => timeB - timeA
								)[0]
							)}
				/>
			{/if}
		{/if}
		{#if configs.type == 'password'}
			<Button
				icon={configs.input.password.showPassword
					? iconify['password-2-off-rounded']
					: iconify['password-2-rounded']}
				class="p-0!"
				events={configs.actionButtons.showPassword.event}
			/>
		{/if}
	</div>

	{#if props.trailing}
		{@render props.trailing({
			defaultStyles: configs.trailing.style,
			get size() {
				return configs.size;
			}
		})}
	{/if}
</svelte:element>

<style lang="scss">
	@use '$styles/sizes.scss';
	.input-root {
		--cursor: text;
		--border-color: transparent;
		--color: var(--default);
		&.size-xs {
			--min-width: calc(var(--container-xs) * 2/3);
			--min-height: var(--min-width-button-xs);
		}
		&.size-sm {
			--min-width: calc(var(--container-sm) * 2/3);
			--min-height: var(--font-size);
		}
		&.size-md {
			--min-width: calc(var(--container-md) * 2/3);
			--min-height: var(--min-width-button-xs);
		}
		&.size-lg {
			--min-width: calc(var(--container-lg) * 2/3);
			--min-height: var(--font-size);
		}
		&.size-xl {
			--min-width: calc(var(--container-xl) * 2/3);
			--min-height: var(--font-size);
		}
		&.size-2xl {
			--min-width: calc(var(--container-2xl) * 2/3);
			--min-height: var(--font-size);
		}
		&.size-3xl {
			--min-width: calc(var(--container-3xl) * 2/3);
			--min-height: var(--font-size);
		}
		&.size-4xl {
			--min-width: calc(var(--container-4xl) * 2/3);
			--min-height: var(--font-size);
		}
		&.size-5xl {
			--min-width: calc(var(--container-5xl) * 2/3);
			--min-height: var(--font-size);
		}
		&.size-6xl {
			--min-width: calc(var(--container-6xl) * 2/3);
			--min-height: var(--font-size);
		}
		&.size-7xl {
			--min-width: calc(var(--container-7xl) * 2/3);
			--min-height: var(--font-size);
		}
		&.size-8xl {
			--min-width: calc(var(--container-8xl) * 2/3);
			--min-height: var(--font-size);
		}
		&.size-9xl {
			--min-width: calc(var(--container-9xl) * 2/3);
			--min-height: var(--font-size);
		}
		&.focus {
			&.animation-bounce {
				animation: border-animation var(--duration) 2 ease-in-out;
			}
		}
		&.variant-secondary {
			@media (prefers-color-scheme: dark) {
				--background: var(--color-gray-700);
			}
			@media (prefers-color-scheme: light) {
				--background: var(--color-gray-200);
			}
			&.focus,
			&:hover:not(.disabled) {
				@media (prefers-color-scheme: dark) {
					--background: var(--color-gray-600);
				}
				@media (prefers-color-scheme: light) {
					--background: var(--color-gray-300);
				}
			}
			&.focus {
				--border-color: var(--color-sky-500);
			}
			&.color-success {
				--color: var(--success);
				--background: var(--success-100);
				--border-color: var(--success);
				&.focus,
				&:hover:not(.disabled) {
					@media (prefers-color-scheme: dark) {
						--background: var(--success-600);
					}
					@media (prefers-color-scheme: light) {
						--background: var(--success-300);
					}
				}
				&.focus {
					--border-color: var(--success-500);
				}
			}
			&.color-error {
				--color: var(--error);
				--background: var(--error-100);
				--border-color: var(--error);
				&.focus,
				&:hover:not(.disabled) {
					@media (prefers-color-scheme: dark) {
						--background: var(--error-600);
					}
					@media (prefers-color-scheme: light) {
						--background: var(--error-300);
					}
				}
				&.focus {
					--border-color: var(--error-500);
				}
			}
		}
		&.variant-primary {
			@media (prefers-color-scheme: dark) {
				--background: var(--color-gray-900);
			}
			@media (prefers-color-scheme: light) {
				--background: var(--color-gray-100);
			}

			&.focus,
			&:hover:not(.disabled) {
				@media (prefers-color-scheme: dark) {
					--background: var(--color-gray-800);
				}
				@media (prefers-color-scheme: light) {
					--background: var(--color-gray-200);
				}
			}
			&.focus {
				--border-color: var(--color-sky-500);
			}
			&.color-success {
				--color: var(--success);
				--background: var(--success-100);
				--border-color: var(--success);
				&.focus,
				&:hover:not(.disabled) {
					@media (prefers-color-scheme: dark) {
						--background: var(--success-800);
					}
					@media (prefers-color-scheme: light) {
						--background: var(--success-200);
					}
				}
				&.focus {
					--border-color: var(--success-500);
				}
			}
			&.color-error {
				--color: var(--error);
				--background: var(--error-100);
				--border-color: var(--error);
				&.focus,
				&:hover:not(.disabled) {
					@media (prefers-color-scheme: dark) {
						--background: var(--error-800);
					}
					@media (prefers-color-scheme: light) {
						--background: var(--error-200);
					}
				}
				&.focus {
					--border-color: var(--error-500);
				}
			}
		}

		&.disabled {
			--cursor: not-allowed;
			--position: relative;
			&::before {
				content: '';
				position: absolute;
				top: 0px;
				left: 0px;
				width: 100%;
				height: 100%;
				z-index: 99;
				border-radius: var(--border-radius);
			}
		}
		@media (prefers-color-scheme: dark) {
			--placeholder-color: var(--color-gray-400);
		}
		@media (prefers-color-scheme: light) {
			--placeholder-color: var(--color-gray-400);
		}
		--height: calc(var(--line-height) * 1rem);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--gap-sm);
		cursor: var(--cursor);
		border: var(--border-width) solid var(--border-color);
		border-radius: var(--border-radius);
		// padding-inline: calc(var(--padding) / 2);
		// padding-block: calc(var(--padding) / 6);
		line-height: var(--line-height);
		min-width: var(--min-width);
		max-width: 100%;
		font-size: var(--font-size);
		background: var(--background);
		position: var(--position);
		color: var(--color);
		.input-placeholder {
			color: var(--placeholder-color);
			flex: 1;
			min-width: 0px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.input-editor {
			@apply flex-1;
			background: transparent;
			color: var(--color);
			min-width: 0;
			&:focus {
				border: none;
				outline: none;
			}
		}
		.input-mask {
			overflow: hidden;
			flex: 1;
			align-items: center;
			display: flex;
		}
		.input-group-actions {
			@apply flex items-center gap-[calc(var(--gap)/4)] w-fit;
			height: 100%;
		}
		.input-max-length {
			width: fit-content;
			display: flex;
			align-items: center;
			color: var(--placeholder-color);
		}
		:global(.input-snippet) {
			height: fit-content;
			width: fit-content;
		}
		&.validation-loading {
			position: relative;
			&::before {
				content: '';
				position: absolute;
				bottom: 0px;
				left: 50%;
				transform: translateX(-50%);
				width: 0px;
				height: calc(var(--border-width));
				border-radius: var(--border-radius);
				z-index: 9999;
				animation: validation-loading infinite var(--duration) ease-in-out;
				background: var(--color-sky-800);
				opacity: 0.5;
			}
		}
	}
	@keyframes border-animation {
		from {
			transform: scale(0.99);
		}
		to {
			transform: scale(1);
		}
	}
	@keyframes validation-loading {
		from {
			width: 0px;
		}
		to {
			width: 100%;
		}
	}
</style>
