<script lang="ts">
	import { iconify } from '$assets/icons/iconify';
	import { Button, Icon } from '$components/element';
	import { measureTextWidth, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { onDestroy, untrack, type SvelteComponent } from 'svelte';
	import type { InputConfigs, InputProps, NumberKeyAllowed } from './_interface';
	import type { ButtonConfigs } from '$components/element/button/_interface';
	import { keys_allowed } from '.';
	import type { BasicConfigs, EventListener } from '$components/interface';
	import type { TranslateContent } from '$interfaces/basic';
	import { SvelteMap } from 'svelte/reactivity';
	import { curry } from 'es-toolkit/compat';
	import { Keyboard } from '$components/keyboard';
	import { ensureKeyboardHost } from '$modules/keyboardHost.svelte';
	import { numberKeyboardState } from '$modules/numberKeyboardState.svelte';
	import { browser } from '$app/environment';

	let visualNumberKbCleaner: (() => void) | undefined = $state(undefined);
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
								client.createInputVisual();
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
						mousedown: {
							async handler(e: MouseEvent) {
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
								if (
									configs.type == 'number' &&
									client.browser?.isMobile &&
									!client.browser?.visualKeyboard
								) {
									e.preventDefault();
									if (!client.browser?.visualInput) client.createInputVisual();
									await client.getVisualKeyboardMeta();
									configs.status.focus = true;
									requestAnimationFrame(() => {
										showVisualNumberKb();
									});
								} else {
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
										if (configs.type == 'number') {
											requestAnimationFrame(() => {
												showVisualNumberKb();
											});
										}
									}
								}
							},
							options: {
								stopPropagation: true
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
									if (ref && !(configs.type === 'number' && client.browser?.isMobile)) {
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
							load(e, data) {
								const node = data?.node;
								if (node instanceof HTMLElement) {
									const { width, height }: { width: number; height: number } =
										node.getBoundingClientRect();
									configs.maskValue.width = width;
									configs.maskValue.height = height;
								}
							},
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
								if (
									['delete', 'backspace', 'control', 'alt', 'shift'].includes(key.toLowerCase())
								) {
									return;
								}
								if (!value) {
									value = key;
									configs.status.currentCursor = 1;
								} else {
									const currentCursor = configs.status.currentCursor ?? value.length;

									value =
										value.slice(0, currentCursor) + key + value.slice(currentCursor, value.length);
									configs.status.currentCursor = currentCursor + 1;
								}
							},
							keyup() {
								if (!value) return;
								configs.input.password.value = Array(value.length).fill('*').join('');
								const inputRef = configs.input.password.ref as HTMLInputElement;
								if (!configs.timeId) configs.timeId = new Map();
								const name = 'animation-keyup';
								const timeId = configs.timeId.get(name) as number;
								if (timeId) cancelAnimationFrame(timeId);
								configs.timeId.set(
									name,
									requestAnimationFrame(() => {
										if (inputRef && configs.status.currentCursor != undefined) {
											inputRef.setSelectionRange(
												configs.status.currentCursor,
												configs.status.currentCursor
											);
										}
									})
								);
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
			number: {
				get style() {
					return [...(configs.input.text.style ?? []), 'input-editor-number'];
				},
				get event() {
					if (!browser) return undefined;
					const events = [
						{
							events: {
								async load(_, data) {
									if (data?.node instanceof HTMLInputElement) {
										if (!value) {
											data.node.style.width = `0px`;
										} else {
											const w = measureTextWidth(value, data.node);
											const baseSize = getComputedStyle(document.body).fontSize;
											data.node.style.width = `${(w + 1) / parseFloat(baseSize)}rem`;
										}
										return async () => {
											if (visualNumberKbCleaner && configs.status.focus == false) {
												visualNumberKbCleaner();
												visualNumberKbCleaner = undefined;
											}
										};
									}
								},
								async keydown(e, data) {
									e;
									const event = e as CustomEvent<string>;
									if (client.browser?.isMobile) {
										event.preventDefault();
										const key = event.detail as NumberKeyAllowed;
										const currentIndex = configs.status.currentCursor;
										if (key == 'ac') {
											value = '';
											configs.status.currentCursor = 0;
										} else if (key == 'del') {
											if (value && configs.status.currentCursor) {
												if (currentIndex == value.length) {
													value = value.slice(0, -1);
													configs.status.currentCursor = value.length ?? 1;
												} else if (currentIndex !== undefined) {
													value =
														value.slice(0, currentIndex - 1) +
														value.slice(currentIndex, value.length);
													configs.status.currentCursor = Math.max(
														0,
														configs.status.currentCursor - 1
													);
												}
											}
										} else if (key == '=' && value) {
											const rs = await calculatorString(value);
											if (rs != value) {
												value = rs;
											}
											return;
										} else {
											if (!value) value = '';
											if (currentIndex === undefined) {
												value += key;
												configs.status.currentCursor = 1;
											} else {
												if (currentIndex == value.length) {
													value += key;
												} else {
													value =
														value.slice(0, currentIndex) +
														key +
														value.slice(currentIndex, value.length);
												}
												if (!configs.status.currentCursor) configs.status.currentCursor = 0;
												configs.status.currentCursor += 1;
											}
										}
										if (configs.status.currentCursor != undefined) {
											requestAnimationFrame(() => {
												const inputRef = configs.input.number.ref as HTMLInputElement;
												if (configs.status.currentCursor != undefined)
													if (inputRef)
														inputRef.setSelectionRange(
															configs.status.currentCursor,
															configs.status.currentCursor
														);
											});
										}
										if (configs.input.number.ref && value) {
											const w = measureTextWidth(value, configs.input.number.ref);
											configs.input.number.ref.style.width = `${w + 4}px`;
										}

										return;
									}
								},
								blur(e) {
									configs.status.focus = false;
								},
								mousedown(e) {
									const ev = e as MouseEvent;
									ev.preventDefault();
									let index: number | undefined;
									if (!value || !configs.input.number.ref) {
										index = 1;
									} else {
										index = calculatorCursor(e as MouseEvent, value, configs.input.number.ref);
									}
									configs.status.currentCursor = index ?? value?.length ?? 1;
								}
							}
						},
						{
							events: {
								mousedown: {
									handler(e) {
										const ev = e as MouseEvent;
										if (
											configs.status.focus &&
											!configs.ref?.contains(ev.target as HTMLElement) &&
											!client.browser?.visualKeyboard?.ref?.contains(ev.target as HTMLElement)
										) {
											configs.status.focus = false;
											if (visualNumberKbCleaner) visualNumberKbCleaner();
										}
									},
									options: {
										capture: true
									}
								}
							},
							target: window
						}
					] as BasicConfigs['event'];
					return events;
				}
			},
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
						async load(e, data) {
							if (data?.node instanceof HTMLElement) {
								data.node.style.width = `${configs.maskValue.width}px`;
								data.node.style.height = `${configs.maskValue.height}px`;
								data.node.scrollTo({ left: data.node.scrollWidth, behavior: 'smooth' });

								if (value) {
									const rs = await calculatorString(value);
									if (rs != value) {
										value = rs;
									}
								}
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
								if (configs.type == 'password') configs.input.password.value = value;
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
	function showVisualNumberKb() {
		const target = {
			get value() {
				return value;
			},
			set value(v: string | undefined) {
				value = v; // gán thẳng vào biến $bindable(), Svelte tự lo phần reactivity
			},
			ref: configs.input.number.ref as HTMLInputElement,
			maxLength: configs.maxLength
		};
		visualNumberKbCleaner = ensureKeyboardHost(target);
	}
	async function calculatorString(input: string): Promise<string> {
		let calculated: number;
		if (!configs.timeId) configs.timeId = new Map();
		const name = 'timeout-calculator';
		const timeId = configs.timeId.get(name);
		if (timeId) clearTimeout(timeId);
		if (configs.input.number.resolveCalculator && configs.previousValue)
			configs.input.number.resolveCalculator(configs.previousValue);
		return new Promise<string>((resolve) => {
			if (!configs.timeId) {
				configs.timeId = new Map();
			}
			configs.input.number.resolveCalculator = resolve;
			configs.timeId.set(
				name,
				setTimeout(() => {
					try {
						calculated = Function(
							`'use strict'; return (${input?.toString().replaceAll('x', '*').replaceAll(':', '/')})`
						)();

						if (calculated != null) {
							configs.previousValue = calculated.toString();
							resolve(calculated.toString());
						}
					} catch (e) {
						if (configs.previousValue) resolve(configs.previousValue);
					}
				}, 300)
			);
		});
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
			{#if ['text', 'number'].includes(configs.type)}
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
	{:else if configs.type == 'number'}
		<div class={configs.input.number.style}>
			<input
				type="text"
				bind:value
				bind:this={configs.input.number.ref}
				class="bg-transparent outline-none border-none"
				readonly={client.browser?.isMobile}
				inputmode={client.browser?.isMobile ? 'none' : undefined}
				{@attach handleEvents(configs.input.number.event)}
			/>

			<div class="input-visual-cursor"></div>
		</div>
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
				size={configs.size}
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
	@use './styles.scss';
</style>
