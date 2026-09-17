<script lang="ts">
	//$components/form/input/Main.svelte
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
	import {
		text_keys_allowed,
		number_keys_allowed,
		defaultValidation,
		createDefaultInputEvents
	} from '.';
	import type { BasicConfigs, EventListener } from '$components/interface';
	import { SvelteMap } from 'svelte/reactivity';
	import { ensureKeyboardHost } from '$modules/keyboardHost.svelte';
	import { browser } from '$app/environment';
	import { getFormContext } from '../form';
	import { getTextFieldContext } from '../textField';
	import type { FullAutoFill } from 'svelte/elements';

	let { value = $bindable(), disabled = $bindable(), ...props }: InputProps = $props();
	// Ghi nhớ giá trị ban đầu khi component được tạo ra, dùng để reset về đúng mốc ban đầu
	let _initialValue: string | undefined = value;
	const typeDerived = $derived(props.type ?? 'text');
	const sizeDerived = $derived(props.size ?? textFieldContext?.size ?? formContext?.size ?? client.browser?.size ?? 'md');
	const roundedDerived = $derived(props.rounded ?? sizeDerived);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'input-root',
			`size-${sizeDerived}`,
			configs.status.focus ? 'focus' : undefined,
			`variant-${variantDerived}`,
			disabledDerived ? 'disabled' : undefined,
			`rounded-${roundedDerived}`,
			props.loading ? 'loading' : undefined,
			`color-${colorDerived}`,
			configs.status.hover || textFieldContext?.status.hover ? 'hover' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	const delayDerived = $derived(client.browser?.delay ?? 300);
	const durationDerived = $derived(client.browser?.delay ?? 300);
	const variantDerived = $derived(props.variant ?? 'secondary');

	const placeholderDerived = $derived.by(() => {
		if (!props.placeholder) return undefined;
		if (typeof props.placeholder === 'string') return props.placeholder;
		const currentLang = client.browser?.language ?? 'en';
		const text = props.placeholder[currentLang] ?? props.placeholder.en ?? props.placeholder.vi;
		return text ? text : undefined;
	});

	const maxLengthDerived = $derived.by(() => {
		if (props.maxLength)
			return typeof props.maxLength == 'number' ? props.maxLength : parseFloat(props.maxLength);
		return undefined;
	});

	const maxNumberDerived = $derived.by(() => {
		return typeof props.maxNumber == 'number'
			? props.maxNumber
			: props.maxNumber
				? parseFloat(props.maxNumber)
				: undefined;
	});

	const minNumberDerived = $derived.by(() => {
		return typeof props.minNumber == 'number'
			? props.minNumber
			: props.minNumber
				? parseFloat(props.minNumber)
				: undefined;
	});

	const colorDerived = $derived.by(() => {
		// Ưu tiên props.color nếu được set explicitly
		if (props.color) return props.color;

		if (props.validation || requiredDerived || typeDerived == 'email') {
			if (configs?.validation?.isValid != 'pending') {
				return configs?.validation?.isValid ? 'success' : 'error';
			}
		}
		return 'default';
	});

	const requiredDerived = $derived(props.required ?? textFieldContext?.required);

	let _disabled: undefined | boolean = $state(undefined);
	const disabledDerived = $derived.by(() => {
		if (disabled) return disabled;
		return _disabled ?? formContext?.disabled;
	});

	const nameDerived = $derived(props.name ?? textFieldContext?.name);

	const clearDisplayDerived = $derived(props.actionButtons?.clear?.display ?? true);
	const copyDisplayDerived = $derived(props.actionButtons?.copy?.display ?? false);
	const pasteDisplayDerived = $derived(props.actionButtons?.paste?.display ?? false);
	const showPasswordDisplayDerived = $derived(props.actionButtons?.showPassword?.display ?? true);

	const highlightDerived = $derived(props.highlight);
	const caseSensitiveDerived = $derived(props.caseSensitive ?? false);

	/** Tính danh sách các đoạn { text, isMatch } để render highlight overlay */
	const highlightSegmentsDerived = $derived.by(() => {
		if (!highlightDerived || !value) return undefined;
		const flag = caseSensitiveDerived ? '' : 'i';
		let regex: RegExp;
		try {
			regex = new RegExp(highlightDerived.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), `g${flag}`);
		} catch {
			return undefined;
		}
		const segments: { text: string; isMatch: boolean }[] = [];
		let lastIndex = 0;
		for (const match of value.matchAll(regex)) {
			if (match.index > lastIndex) {
				segments.push({ text: value.slice(lastIndex, match.index), isMatch: false });
			}
			segments.push({ text: match[0], isMatch: true });
			lastIndex = match.index + match[0].length;
		}
		if (lastIndex < value.length) {
			segments.push({ text: value.slice(lastIndex), isMatch: false });
		}
		return segments;
	});

	// ── Email Auto-complete Suggestions ──
	let emailSuggestionsDismissed = $state(false);
	let emailHighlightedIndex = $state(0);

	const defaultPopularEmailDomains = [
		'gmail.com',
		'outlook.com',
		'icloud.com',
		'atomicmail.com',
		'proton.me',
		'protonmail.com',
		'yahoo.com',
		'hotmail.com'
	];

	const emailSuggestEnabled = $derived(props.emailSuggest ?? (typeDerived === 'email'));
	const emailDomainsDerived = $derived(props.emailDomains ?? defaultPopularEmailDomains);

	const emailPartsDerived = $derived.by(() => {
		if (!emailSuggestEnabled || typeof value !== 'string') {
			return null;
		}
		const firstAt = value.indexOf('@');
		const lastAt = value.lastIndexOf('@');
		// Trigger khi có đúng 1 ký tự '@'
		if (firstAt === -1 || firstAt !== lastAt) {
			return null;
		}
		const prefix = value.slice(0, firstAt);
		const query = value.slice(firstAt + 1).toLowerCase();
		return { prefix, query };
	});

	const matchingEmailDomains = $derived.by(() => {
		if (!emailPartsDerived) return [];
		const { query } = emailPartsDerived;
		return emailDomainsDerived.filter((domain) => {
			const lower = domain.toLowerCase();
			// Thu gọn danh sách gợi ý theo độ chi tiết người dùng nhập sau @
			// Nếu đã hoàn thành nhập đúng toàn bộ domain thì ẩn gợi ý
			return lower.startsWith(query) && lower !== query;
		});
	});

	// Reset index khi danh sách domain gợi ý thay đổi
	$effect(() => {
		if (emailHighlightedIndex >= matchingEmailDomains.length) {
			emailHighlightedIndex = 0;
		}
	});

	// Mở lại gợi ý khi người dùng thay đổi giá trị (gõ, xoá, backspace)
	let _prevValueForSuggest: string | undefined = undefined;
	$effect(() => {
		if (value !== _prevValueForSuggest) {
			_prevValueForSuggest = value;
			emailSuggestionsDismissed = false;
		}
	});

	// Quản lý trạng thái focus: input đang focus HOẶC chuột đang trên popup
	let isInteractingWithSuggestions = $state(false);
	const isFocused = $derived(!!(configs?.status?.focus || configs?.input?.status?.focus));

	const emailSuggestionsOpen = $derived(
		emailSuggestEnabled &&
		!emailSuggestionsDismissed &&
		(isFocused || isInteractingWithSuggestions) &&
		emailPartsDerived !== null &&
		matchingEmailDomains.length > 0
	);

	function selectEmailDomain(domain: string) {
		if (!emailPartsDerived) return;
		value = `${emailPartsDerived.prefix}@${domain}`;
		_prevValueForSuggest = value;
		emailSuggestionsDismissed = true;
		isInteractingWithSuggestions = false;
		const type =
			configs.type === 'password' || configs.type === 'email' || configs.type === 'phone'
				? configs.type
				: 'text';
		const inputRef = configs.input[type]?.ref as HTMLInputElement | undefined;
		if (inputRef) {
			requestAnimationFrame(() => {
				inputRef.focus();
				try {
					if (['text', 'search', 'url', 'tel', 'password'].includes(inputRef.type)) {
						inputRef.setSelectionRange(value.length, value.length);
					}
				} catch (e) {
					// Input type email/number không hỗ trợ setSelectionRange theo chuẩn WHATWG
				}
			});
		}
	}

	function handleEmailKeydown(e: KeyboardEvent) {
		if (!emailSuggestEnabled) return;
		if (emailSuggestionsOpen && matchingEmailDomains.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				e.stopPropagation();
				emailHighlightedIndex = (emailHighlightedIndex + 1) % matchingEmailDomains.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				e.stopPropagation();
				emailHighlightedIndex =
					(emailHighlightedIndex - 1 + matchingEmailDomains.length) % matchingEmailDomains.length;
				return;
			}
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				e.stopPropagation();
				const chosen = matchingEmailDomains[emailHighlightedIndex] ?? matchingEmailDomains[0];
				if (chosen) {
					selectEmailDomain(chosen);
				}
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				emailSuggestionsDismissed = true;
				return;
			}
		}
	}

	let configs: InputConfigs = $state({
		status: {},
		get type() { return typeDerived; },
		get size() { return sizeDerived; },
		get rounded() { return roundedDerived; },
		get style() { return styleDerived; },
		get delay() { return delayDerived; },
		get duration() { return durationDerived; },
		get variant() { return variantDerived; },
		get maxLength() { return maxLengthDerived; },
		get maxNumber() { return maxNumberDerived; },
		get minNumber() { return minNumberDerived; },
		get color() { return colorDerived; },
		get required() { return requiredDerived; },
		get _disabled() { return _disabled; },
		set _disabled(v) { _disabled = v; },
		get disabled() { return disabledDerived; },
		set disabled(v) { _disabled = v; },
		get name() { return nameDerived; },
		get highlight() { return highlightDerived; },
		get caseSensitive() { return caseSensitiveDerived; },
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
			if (this.disabled) return [];

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
								if (textFieldContext) textFieldContext.status.touched = true;
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
											if (evName === 'blur' && textFieldContext) {
												textFieldContext.status.touched = true;
											}

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
				if (!props.placeholder) return { vi: '', en: '' };
				if (typeof props.placeholder === 'string')
					return { vi: props.placeholder, en: props.placeholder };
				return props.placeholder;
			},
			get event() {
				if (configs.disabled) return [];
				return [
					{
						events: {
							mousedown() {
								configs.focus();
							}
						}
					}
				];
			}
		},
		input: {
			status: {},
			text: {
				get event() {
					if (configs.disabled) return [];
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
														if (evName !== 'operator') {
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
						},
						...(createDefaultInputEvents(
							untrack(() => value),
							configs,
							textFieldContext,
							formContext
						) ?? [])
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
				get event() {
					if (configs.disabled) return [];
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
						...(createDefaultInputEvents(
							untrack(() => value),
							configs,
							textFieldContext,
							formContext
						) ?? [])
					] as InputConfigs['input']['password']['event'];
				}
			},
			email: {
				get style() {
					return configs.input.text.style;
				},
				get event() {
					if (configs.disabled) return [];
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
					if (configs.disabled) return [];
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
						...(createDefaultInputEvents(
							untrack(() => value),
							configs,
							textFieldContext,
							formContext
						) ?? []),
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
			get event() {
				if (configs.disabled) return [];
				return [
					{
						events: {
							async load(e, data) {
								if (data?.node instanceof HTMLElement) {
									data.node.style.width = `${configs.maskValue.width}px`;
									data.node.style.height = `${configs.maskValue.height}px`;
									data.node.scrollTo({ left: data.node.scrollWidth, behavior: 'smooth' });

									if (value && configs.type == 'number') {
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
				];
			}
		},
		actionButtons: {
			clear: {
				get display() { return clearDisplayDerived; },
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
				get display() { return copyDisplayDerived; },
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
				get display() { return pasteDisplayDerived; },
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
				get display() { return showPasswordDisplayDerived; },
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
				if (!client.browser.visualInput) client.createInputVisual();
				if (client.browser.visualInput) {
					client.browser.visualInput.focus();
				}
			}
			configs.status.focus = true;
			requestAnimationFrame(() => {
				const type = configs.type === 'password' || configs.type === 'email' || configs.type === 'phone' ? configs.type : 'text';
				const ref = configs.input[type]?.ref as HTMLInputElement | undefined;
				if (ref && typeof ref.focus === 'function' && document.activeElement !== ref) {
					ref.focus();
				}
			});
		},
		reset() {
			// Khôi phục về đúng giá trị ban đầu (khi mount), không xóa trắng
			value = _initialValue;
			if (configs.type == 'password') configs.input.password.value = _initialValue;
			configs.validation.process = undefined;
			configs.validation.messages = undefined;
			if (configs.timeId) {
				for (const id of configs.timeId.values()) clearTimeout(id);
				configs.timeId.clear();
			}
			configs.loading = false;
			configs.status.focus = false;
			configs.input.status.focus = false;
			if (configs.ref) {
				configs.ref.classList.remove('validation-loading');
			}
		}
	});
	const formContext = getFormContext();
	const textFieldContext = getTextFieldContext();

	function onFocus() {
		// if (!configs.status.focus) configs.status.focus = true;
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
				clipboardRaw = localStorage.getItem('clipboard');
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
					
					const target = e.target as HTMLElement;
					const type = configs.type as 'text' | 'email' | 'password' | 'number' | 'phone';
					const ref = configs.input[type]?.ref as HTMLElement | undefined;
					
					if (target !== ref) {
						e.preventDefault();
					}

					if (e.detail == 1) {
						if (
							configs.type === 'number' &&
							client.browser?.isMobile &&
							!client.browser?.visualKeyboard
						) {
							if (!client.browser?.visualInput) client.createInputVisual();
							await client.getVisualKeyboardMeta();
							requestAnimationFrame(() => showVisualNumberKb());
						} else {
							if (configs.status.focus) {
								if (target !== ref) {
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
								}
							} else {
								configs.focus();
								if (configs.type === 'number' && client.browser?.isMobile) {
									requestAnimationFrame(() => showVisualNumberKb());
								}
							}
						}
					} else {
						configs.status.selectAll = true;
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
		if ((!focus || value?.length) && configs.status.selectAll) {
			// configs.status.selectAll = false;
		}
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
			textFieldContext.status.focus = configs.status.focus ?? configs.input.status.focus;
			textFieldContext.loading = configs.loading;
		}
	});
	$effect(() => {
		if (
			configs.input.status.focus &&
			(textFieldContext?.status.selectAll || configs.status.selectAll) &&
			value?.length
		) {
			try {
				const el = configs.input[configs.type]?.ref as HTMLInputElement | undefined;
				if (el && ['text', 'search', 'url', 'tel', 'password'].includes(el.type)) {
					el.setSelectionRange(0, value.length);
				} else if (el) {
					el.select();
				}
			} catch (e) {
				// Ignore for unsupported types like email/number
			}
			if (textFieldContext?.status.selectAll) textFieldContext.status.selectAll = false;
			if (configs.status.selectAll) configs.status.selectAll = false;
		}
	});

	$effect(() => {
		if (configs.type == 'number' && !configs.status.focus && value) {
			if (!configs.timeId) configs.timeId = new Map();
			const name = 'timeout-calculate';
			const timeId = configs.timeId.get(name);
			if (timeId) clearTimeout(timeId);
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
	});

	onMount(() => {
		if (textFieldContext) {
			if (!textFieldContext.children) textFieldContext.children = {};
			textFieldContext.children.input = configs;
		}
	});
	onDestroy(() => {
		value = undefined;
		if (configs.type == 'password') configs.input.password.value = undefined;
		[...(configs.timeId?.values() ?? [])].forEach((time) => {
			clearTimeout(time);
		});
		configs.timeId?.clear();
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
	{#if configs.type == 'number'}
		<div class={configs.input.number.style}>
			<input
				type="text"
				bind:value
				bind:this={configs.input.number.ref}
				class="bg-transparent outline-none border-none w-full"
				placeholder={placeholderDerived}
				readonly={client.browser?.isMobile}
				inputmode={client.browser?.isMobile ? 'none' : undefined}
				{@attach handleEvents(configs.input.number.event)}
			/>
			{#if client.browser?.isMobile}
				<div class="input-visual-cursor"></div>
			{/if}
		</div>
	{:else}
		<div class="input-highlight-wrapper">
			{#if highlightSegmentsDerived && configs.type !== 'password'}
				<div
					class="input-highlight-layer"
					aria-hidden="true"
					{@attach (node) => {
						// Sync scroll position from input to highlight layer
						const inputKey = configs.type === 'email' || configs.type === 'phone' ? configs.type : 'text';
						const inputRef = configs.input[inputKey]?.ref as HTMLInputElement | undefined;
						if (!inputRef) return;
						const onScroll = () => { node.scrollLeft = inputRef.scrollLeft; };
						inputRef.addEventListener('scroll', onScroll);
						return () => inputRef.removeEventListener('scroll', onScroll);
					}}
				>
					{#each highlightSegmentsDerived as seg}
						{#if seg.isMatch}
							<mark class="input-highlight-mark">{seg.text}</mark>
						{:else}
							<span>{seg.text}</span>
						{/if}
					{/each}
					<!-- whitespace char to preserve height when empty -->
					&#x200B;
				</div>
			{/if}
			<input
				type={configs.type == 'password' ? (configs.input.password.showPassword ? 'text' : 'password') : (configs.type == 'email' || configs.type == 'phone' ? configs.type : 'text')}
				bind:value
				bind:this={configs.input[configs.type == 'password' || configs.type == 'email' || configs.type == 'phone' ? configs.type : 'text'].ref}
				class={[
					...( configs.input[configs.type == 'password' || configs.type == 'email' || configs.type == 'phone' ? configs.type : 'text'].style ?? []),
					highlightSegmentsDerived && configs.type !== 'password' ? 'input-transparent-text' : '',
					'bg-transparent outline-none border-none w-full'
				]}
				placeholder={placeholderDerived}
				autocomplete={props.autocomplete ?? 'off' as FullAutoFill}
				inputmode={props.inputmode}
				name={nameDerived}
				onkeydown={handleEmailKeydown}
				{@attach handleEvents(configs.input[configs.type == 'password' || configs.type == 'email' || configs.type == 'phone' ? configs.type : 'text'].event)}
			/>
		</div>
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

	{#if emailSuggestionsOpen && matchingEmailDomains.length > 0}
		<div
			class="email-suggestions-popup"
			role="listbox"
			aria-label="Email domain suggestions"
			onpointerenter={() => {
				isInteractingWithSuggestions = true;
			}}
			onpointerleave={() => {
				isInteractingWithSuggestions = false;
				if (!configs?.status?.focus && !configs?.input?.status?.focus) {
					suggestionsFocusHeld = false;
				}
			}}
			onpointerdown={(e) => {
				e.stopPropagation();
			}}
			onmousedown={(e) => {
				e.stopPropagation();
			}}
			onclick={(e) => {
				e.stopPropagation();
			}}
		>
			<div class="email-suggestions-header">
				<span>Gợi ý domain</span>
			</div>
			<div class="email-suggestions-list">
				{#each matchingEmailDomains as domain, idx (domain)}
					<button
						type="button"
						role="option"
						aria-selected={emailHighlightedIndex === idx}
						class="email-suggestion-item {emailHighlightedIndex === idx ? 'active' : ''}"
						onpointerdown={(e) => {
							e.preventDefault();
							e.stopPropagation();
							selectEmailDomain(domain);
						}}
						onmousedown={(e) => {
							e.preventDefault();
							e.stopPropagation();
							selectEmailDomain(domain);
						}}
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							selectEmailDomain(domain);
						}}
						ontouchstart={(e) => {
							e.preventDefault();
							e.stopPropagation();
							selectEmailDomain(domain);
						}}
						onmouseenter={() => {
							emailHighlightedIndex = idx;
						}}
					>
						<span class="email-suggestion-icon">@</span>
						<span class="email-suggestion-text">
							<span class="email-suggestion-prefix">{emailPartsDerived?.prefix ?? ''}@</span>
							<span class="email-suggestion-match">{emailPartsDerived?.query ?? ''}</span>
							<span class="email-suggestion-rest">{domain.slice(emailPartsDerived?.query.length ?? 0)}</span>
						</span>
						{#if emailHighlightedIndex === idx}
							<span class="email-suggestion-hint">Tab ↵</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</svelte:element>

<style lang="scss">
	@use './styles.scss';
</style>
