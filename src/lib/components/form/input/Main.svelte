<script lang="ts">
	import { iconify } from '$assets/icons/iconify';
	import { Button, Icon } from '$components/element';
	import { measureTextWidth, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount, untrack, type SvelteComponent } from 'svelte';
	import type {
		InputConfigs,
		InputProps,
		NumberKeyAllowed,
		ValidationCompact,
		ValidationFull
	} from './_interface';
	import type { ButtonConfigs } from '$components/element/button/_interface';
	import { text_keys_allowed, number_keys_allowed, defaultValidation } from '.';
	import type { BasicConfigs, EventListener } from '$components/interface';
	import { SvelteMap } from 'svelte/reactivity';
	import { ensureKeyboardHost } from '$modules/keyboardHost.svelte';
	import { browser } from '$app/environment';
	import { getFormContext } from '../form';
	import { getTextFieldContext } from '../textField';

	let visualNumberKbCleaner: (() => void) | undefined = $state(undefined);
	let { value = $bindable(), disabled = $bindable(), ...props }: InputProps = $props();
	let configs: InputConfigs = $state({
		status: {},
		get type() {
			return props.type ?? 'text';
		},
		get size() {
			return (
				props.size ?? textFieldContext?.size ?? formContext?.size ?? client.browser?.size ?? 'md'
			);
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
				`color-${this.color}`,
				configs.status.hover || textFieldContext?.status.hover ? 'hover' : undefined
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
		get maxNumber() {
			return typeof props.maxNumber == 'number'
				? props.maxNumber
				: props.maxNumber
					? parseFloat(props.maxNumber)
					: undefined;
		},
		get minNumber() {
			return typeof props.minNumber == 'number'
				? props.minNumber
				: props.minNumber
					? parseFloat(props.minNumber)
					: undefined;
		},
		get color() {
			if (props.validation || configs.required || configs.type == 'email') {
				if (configs.validation.isValid != 'pending') {
					return configs.validation.isValid ? 'success' : 'error';
				}
			}
			return props.color ?? 'default';
		},
		get required() {
			return props.required ?? textFieldContext?.required;
		},
		get name() {
			return props.name ?? textFieldContext?.name;
		},
		validation: {
			get isValid() {
				if (!props.validation && !configs.required && configs.type !== 'email') return undefined;
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

			const defaultValidators = getDefaultValidators();
			const hasCustomValidation = !!props.validation;
			const hasDefaultValidation = defaultValidators.length > 0;
			if (!hasCustomValidation && !hasDefaultValidation) {
				return [{ events: buildCoreEvents() }, ...(props.events ?? [])] as InputProps['events'];
			}
			if (!hasCustomValidation) {
				return [
					{
						events: {
							async blur() {
								if (!configs.validation.process) configs.validation.process = new SvelteMap();
								const operator = 'and' as const;
								configs.validation.process.set('blur', 'pending');
								await processingValidation('blur', defaultValidators, operator);
							}
						}
					},
					{ events: buildCoreEvents() },
					...(props.events ?? [])
				] as InputProps['events'];
			}
			const globalOperator = props.validation?.operator ?? 'and';
			const validationEntries = props.validation
				? Object.entries(props.validation).filter(
						([key]) => key !== 'operator' && !['keyup', 'keydown'].includes(key)
					)
				: [];
			const hasBlurEntry = validationEntries.some(([key]) => key === 'blur');
			if (defaultValidators.length > 0 && !hasBlurEntry) {
				validationEntries.push(['blur', []]); // mảng rỗng — sẽ được merge defaultValidators bên dưới
			}
			const validationEvents =
				validationEntries.length > 0
					? {
							events: Object.fromEntries(
								validationEntries.map(([eventName, data]) => {
									return [
										eventName,
										async () => {
											const evName = eventName as keyof EventListener;

											if (!configs.validation.process) {
												configs.validation.process = new SvelteMap();
											}

											let dataArr: (ValidationCompact | ValidationFull)[];
											let operator: 'and' | 'or' = globalOperator;

											if (Array.isArray(data)) {
												dataArr = data;
											} else if (typeof data === 'object' && data != null) {
												operator = data.operator ?? globalOperator;
												dataArr = data.handles;
											} else {
												dataArr = [];
											}

											const finalHandles =
												evName === 'blur' && defaultValidators.length > 0
													? [...dataArr, ...defaultValidators]
													: dataArr;

											if (finalHandles.length === 0) return;

											configs.validation.process.set(evName, 'pending');
											await processingValidation(evName, finalHandles, operator);
										}
									];
								})
							)
						}
					: null;

			return [
				validationEvents,
				{ events: buildCoreEvents() },
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
										!text_keys_allowed.includes(event.key.toLowerCase())
									) {
										event.preventDefault();
									}
								}
							}
						}
					] as InputConfigs['input']['text']['event'];
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
					if (configs.input.password.showPassword) return this._value;
					if (configs.status.currentCursor != value?.length || !configs.status.focus)
						return Array(this._value.length).fill('*').join('');
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
								async keyup(e) {
									const event = e as KeyboardEvent;
									let key = event.key;
									const fnKeys = [
										'delete',
										'backspace',
										'control',
										'alt',
										'shift',
										'arrowup',
										'arrowdown',
										'arrowleft',
										'arrowright'
									];
									if (!fnKeys.includes(key.toLowerCase())) {
										if (event.ctrlKey === true && key == 'v') {
											let clipboardText;
											try {
												clipboardText = await navigator.clipboard.readText();
											} catch (e) {
												clipboardText = localStorage.getItem('clipboard');
												if (clipboardText) {
													clipboardText = JSON.parse(clipboardText) as { [k: string]: string };
													const lastTime = Object.keys(clipboardText).sort(
														(a, b) => parseFloat(b) - parseFloat(a)
													)[0];
													clipboardText = clipboardText[lastTime];
												}
											}
											if (clipboardText) key = clipboardText;
										}
										if (!value) {
											value = key;
										} else {
											const currentCursor = configs.status.currentCursor ?? value.length;
											value =
												value.slice(0, currentCursor) +
												key +
												value.slice(currentCursor, value.length);
											if (!configs.status.currentCursor) configs.status.currentCursor = 1;
											configs.status.currentCursor += 1;
										}
									} else if (
										fnKeys.includes(key.toLowerCase()) &&
										event.altKey === false &&
										event.ctrlKey === false &&
										event.shiftKey == false
									) {
										if (configs.status.currentCursor === undefined)
											configs.status.currentCursor = 1;
										if (
											key.toLowerCase() == 'backspace' &&
											value &&
											configs.status.currentCursor &&
											configs.status.currentCursor > 0
										) {
											const currentCursor = configs.status.currentCursor ?? value.length;
											value =
												value.slice(0, currentCursor - 1) +
												value.slice(currentCursor, value.length);
											configs.status.currentCursor -= 1;
										}
										if ('arrowleft' == key.toLowerCase()) {
											configs.status.currentCursor = Math.max(0, configs.status.currentCursor - 1);
										}
										if ('arrowdown' == key.toLowerCase()) {
											configs.status.currentCursor = 0;
										}
										if (key.toLowerCase() == 'arrowright' && value) {
											configs.status.currentCursor = Math.min(
												configs.status.currentCursor + 1,
												value.length
											);
										}
										if ('arrowup' == key.toLowerCase() && value) {
											configs.status.currentCursor = value.length;
										}
									}
								},
								blur() {
									configs.status.focus = false;
								}
							}
						}
					] as InputConfigs['input']['password']['event'];
				}
			},
			email: {
				get style() {
					return configs.input.text.style;
				},
				get event() {
					return configs.input.text.event;
				}
			},
			phone: {},
			number: {
				get style() {
					return [...(configs.input.text.style ?? []), 'input-editor-number'];
				},
				get event() {
					if (!browser) return undefined;
					const events = [
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
								async load(_, data) {
									if (data?.node instanceof HTMLInputElement && client.browser?.isMobile) {
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
									let event = e as KeyboardEvent;

									if (
										!client.browser?.isMobile &&
										!number_keys_allowed.includes(event.key.toLowerCase())
									) {
										event.preventDefault();
										return;
									}
									if (client.browser?.isMobile) {
										const event = e as CustomEvent<string>;
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
											if (!configs.timeId) configs.timeId = new Map();
											const name = 'timeout-calculate';
											const timeId = configs.timeId.get(name);
											if (timeId) {
												clearTimeout(timeId);
											}
											configs.timeId.set(
												name,
												setTimeout(() => {
													if (value) {
														const rs = calculatorString(value);
														if (rs && rs.toString() !== value) {
															value = rs.toString();
														}
													}
												}, configs.delay)
											);

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
									if (!configs.timeId) configs.timeId = new Map();
									const name = 'timeout-calculate';
									const timeId = configs.timeId.get(name);
									if (timeId) {
										clearTimeout(timeId);
									}
									configs.timeId.set(
										name,
										setTimeout(() => {
											if (value) {
												const rs = calculatorString(value);
												if (rs && rs.toString() !== value) {
													value = rs.toString();
												}
											}
										}, configs.delay)
									);
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
									configs.status.currentCursor = 0;
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
								if (configs.input.password.showPassword) {
									configs.input.password.value = value;
								}
								requestAnimationFrame(() => {
									if (configs.input.password.ref) {
										(configs.input.password.ref as HTMLInputElement).setSelectionRange(
											configs.status.currentCursor ?? 1,
											configs.status.currentCursor ?? 1
										);
									}
								});
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
		},
		focus() {
			if (client.browser?.isMobile) {
				if (client.browser.visualInput) client.browser.visualInput.focus();
			}
			configs.status.focus = true;
			requestAnimationFrame(() => {
				switch (configs.type) {
					case 'text':
						if (configs.input.text.ref) configs.input.text.ref.focus();
						break;
					case 'password':
						if (configs.input.password.ref) configs.input.password.ref.focus();
						break;
					case 'number':
						if (configs.input.number.ref) configs.input.number.ref.focus();
						break;
				}
			});
		},
		reset() {
			value = undefined;
			if (configs.type == 'password') configs.input.password.value = undefined;
			configs.validation.process = undefined;
			configs.validation.messages = undefined;
		}
	});
	const formContext = getFormContext();
	const textFieldContext = getTextFieldContext();

	function onFocus() {
		if (!configs.status.focus) configs.status.focus = true;
		requestAnimationFrame(() => {
			configs.input.text?.ref?.focus();
		});
	}
	let resolver: () => void;
	async function processingValidation(
		eventName: keyof EventListener,
		handles: (ValidationCompact | ValidationFull)[],
		operator: 'and' | 'or'
	) {
		if (!props.validation && !configs.required && configs.type !== 'email') return;
		if (!configs.validation.messages) configs.validation.messages = new SvelteMap();
		if (!configs.timeId) configs.timeId = new Map();
		const name = `timeout-validation-${eventName}`;
		const timeId = configs.timeId.get(name);
		if (timeId) clearTimeout(timeId);
		if (resolver) {
			resolver();
		}
		configs.loading = true;

		return new Promise<void>((resolve) => {
			resolver = resolve;
			if (!configs.timeId) configs.timeId = new Map();
			configs.timeId.set(
				name,
				setTimeout(async () => {
					if (configs.ref) {
						configs.ref.classList.add('validation-loading');
					}
					if (!configs.validation.process) configs.validation.process = new SvelteMap();
					const promises = await Promise.all(
						handles.map(async (validateHandler) => {
							if (!configs.validation.messages) configs.validation.messages = new SvelteMap();
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
					configs.loading = false;
					resolve();
				}, configs.delay)
			);
		});
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
	function calculatorString(input: string): number | undefined {
		let calculated: number;
		try {
			calculated = Function(
				`'use strict'; return (${input?.toString().replaceAll('x', '*').replaceAll(':', '/')})`
			)();
			configs.previousValue = calculated.toString();
			return calculated;
		} catch (e) {
			return configs.previousValue ? parseFloat(configs.previousValue) : undefined;
		}
	}
	function buildCoreEvents() {
		return {
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
					configs.status.mousePos = { clientX: e.clientX, clientY: e.clientY };
					if (value && configs.maskValue.ref) {
						e.preventDefault();
						const index = calculatorCursor(e, value, configs.maskValue.ref);
						requestAnimationFrame(() => {
							const ref = configs.input[configs.type].ref;
							if (ref instanceof HTMLInputElement) {
								configs.status.currentCursor = index ?? value?.length ?? 1;
								ref.setSelectionRange(configs.status.currentCursor, configs.status.currentCursor);
							}
						});
					}
					if (
						configs.type === 'number' &&
						client.browser?.isMobile &&
						!client.browser?.visualKeyboard
					) {
						e.preventDefault();
						if (!client.browser?.visualInput) client.createInputVisual();
						await client.getVisualKeyboardMeta();
						configs.status.focus = true;
						requestAnimationFrame(() => showVisualNumberKb());
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
									setTimeout(
										() => configs.ref?.classList.remove('animation-bounce'),
										configs.duration
									);
								}, configs.delay)
							);
						} else {
							configs.focus();
							if (configs.type === 'number' && client.browser?.isMobile) {
								requestAnimationFrame(() => showVisualNumberKb());
							}
						}
					}
				},
				options: { stopPropagation: true }
			},
			keydown() {}
		};
	}
	function getDefaultValidators(): (ValidationCompact | ValidationFull)[] {
		const validators: (ValidationCompact | ValidationFull)[] = [];
		if (configs.required) {
			validators.push(defaultValidation.required(configs.name));
		}
		if (configs.type === 'number') {
			if (configs.minNumber != null && defaultValidation.minNumber) {
				validators.push(defaultValidation.minNumber(configs.minNumber, configs.name));
			}
			if (configs.maxNumber != null && defaultValidation.maxNumber) {
				validators.push(defaultValidation.maxNumber(configs.maxNumber, configs.name));
			}
		} else if (configs.type === 'email' && defaultValidation.isEmail) {
			validators.push(defaultValidation.isEmail(configs.name));
		}
		return validators;
	}
	let prevFocus: boolean | undefined;
	$effect(() => {
		if (!configs.ref) return;
		const focus = configs.status.focus;
		if (focus !== undefined && focus !== prevFocus) {
			configs.ref.dispatchEvent(new Event(focus ? 'focus' : 'blur'));
		}
		prevFocus = focus;
	});
	$effect(() => {
		if (!configs.ref || configs.status.reseting) return;
		const previousValue = value;
		if (value) {
			configs.ref.dispatchEvent(new Event('input'));
			configs.ref.dispatchEvent(new Event('keypress'));
		}
		if (value != configs.previousValue && !configs.status.focus) {
			configs.ref.dispatchEvent(new Event('change'));
		}
		return () => {
			if (!configs.status.focus) configs.previousValue = previousValue;
		};
	});
	$effect(() => {
		if (textFieldContext) {
			if (textFieldContext.setValue && textFieldContext.value != value)
				textFieldContext.setValue(value);
			if (textFieldContext.validation?.setValid)
				textFieldContext.validation.setValid(configs.validation.isValid);
			textFieldContext.status.focus = configs.status.focus;
			textFieldContext.loading = configs.loading;
		}
	});

	onMount(() => {
		if (textFieldContext) {
			if (!textFieldContext.children) textFieldContext.children = {};
			textFieldContext.children.input = configs;
		}
	});

	export { configs };
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
			{#if ['text', 'number', 'email'].includes(configs.type)}
				{value}
			{:else if configs.type == 'password'}
				{configs.input.password.showPassword ? value : configs.input.password.value}
			{/if}
		</div>
	{:else if configs.type == 'email'}
		<input
			type="text"
			bind:value
			bind:this={configs.input.email.ref}
			class={configs.input.email.style}
			{@attach handleEvents(configs.input.email.event)}
		/>
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
			{#if client.browser?.isMobile}
				<div class="input-visual-cursor"></div>
			{/if}
		</div>
	{:else if configs.type == 'password'}
		<input
			type="text"
			bind:value={configs.input.password.value}
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
