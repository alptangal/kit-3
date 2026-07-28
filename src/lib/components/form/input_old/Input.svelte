<script lang="ts">
	import { iconify } from '$assets/icons/iconify';
	import type { BasicComponent, EventListener, MetaChildren } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';
	import { client, profile } from '$store/basic.svelte';
	import Icon from '$components/element/icon/Main.svelte';

	import { Button, Loading, Tooltip } from '$components/element/index';
	import type { InputProps } from './_interface.ts';
	import { fade } from 'svelte/transition';
	import { copyToClipboard, pasteFromClipboard, watchClipboard } from '$modules';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { every, keys, mapValues, omit } from 'es-toolkit/compat';
	import type { NumbericKey } from '$components/keyboard/numberic/_interface';
	import { getTextfieldCtx } from '../textField/index.ts';
	import { getFormContext } from '../form/index.ts';
	import { v7 as uuidV7 } from 'uuid';
	import type { Component } from 'vitest-browser-svelte';
	import type { SvelteComponent } from 'svelte';
	// import Numberic from '$components/keyboard/numberic/Numberic.svelte';
	// import { every, some } from 'es-toolkit/compat';

	let { value = $bindable(), disabled = $bindable(), ...props }: InputProps = $props();

	const defaults = {
		root: {
			style: 'border-none flex'
		},
		input: {
			style: 'flex-1'
		}
	};
	const numberKeysAllowedRegEx = /[0-9.+\-*/()]/;
	const notAllowKeysForPassword = [
		'Alt',
		'Backspace',
		'Ctrl',
		'Capslock',
		'Enter',
		'Shift',
		'Control',
		'Tab',
		'ArrowLeft',
		'ArrowRight',
		'ArrowUp',
		'ArrowDown'
	];
	let configs = $state({
		status: {
			focusFirstTime: false,
			focus: false,
			timeId: {
				timeout: undefined as undefined | NodeJS.Timeout,
				animationId: undefined as undefined | number,
				calculate: undefined as undefined | NodeJS.Timeout,
				validation: undefined as undefined | NodeJS.Timeout | number
			},
			showClearBtn: false,
			get type() {
				return props.type ?? 'text';
			},
			get loadingAnimationStyle(): `style-${number}` | undefined {
				if (!this.loading) return undefined;
				return typeof props.loadingAnimation == 'string'
					? props.loadingAnimation
					: typeof props.loadingAnimation == 'object'
						? props.loadingAnimation.style
						: 'style-1';
			},
			get loadingAnimationDuration(): number | undefined {
				if (!this.loading) return undefined;
				if (typeof props.loadingAnimation == 'string') return profile.delay;
				if (typeof props.loadingAnimation == 'object') {
					if (props.loadingAnimation.duration) {
						return typeof props.loadingAnimation.duration == 'number'
							? props.loadingAnimation.duration
							: typeof props.loadingAnimation.duration == 'string' &&
								  props.loadingAnimation.duration.includes('ms')
								? parseFloat(props.loadingAnimation.duration)
								: parseFloat(props.loadingAnimation.duration) * 1000;
					}
				}
				return profile.delay;
			},
			loadingStartAt: undefined as undefined | number,
			showPassword: undefined as undefined | boolean,
			get changed() {
				if (
					(configs.initValue && configs.initValue != value) ||
					configs.input.status.previousValue != value
				)
					return true;
				return false;
			},
			_loading: undefined as undefined | boolean,
			get loading() {
				return this._loading ?? props.loading;
			},
			set loading(val) {
				this._loading = val;
			},
			resolver: {
				calculate: undefined as undefined | (() => void),
				validate: undefined as undefined | (() => void)
			}
		},
		get delay() {
			const browserDelay = client.browser?.delay;
			if (!browserDelay) return 300;
			return typeof browserDelay == 'number'
				? browserDelay
				: browserDelay.includes('ms')
					? parseFloat(browserDelay)
					: parseFloat(browserDelay) * 10;
		},
		initValue: undefined as undefined | number | string,
		get name() {
			return props.name ?? textFieldCtx?.name ?? `input_${uuidV7()}`;
		},
		_passwordMask: undefined as undefined | string,
		get passwordMask() {
			if (this._passwordMask?.length)
				return this._passwordMask
					.split('')
					.map((_, idx) =>
						this._passwordMask && configs.status.focus
							? idx < this._passwordMask.split('').length - 1
								? '⬤'
								: _
							: '⬤'
					)
					.join('');
			return '';
		},
		set passwordMask(val) {
			this._passwordMask = val;
		},
		ref: undefined as undefined | HTMLElement,
		get style() {
			const propsClass =
				typeof props.class == 'string'
					? [props.class]
					: typeof props.class == 'object'
						? props.class
						: [];
			return [
				'input-root justify-between',
				...(props.overwriteDefaultStyles ? propsClass : [...propsClass, defaults.root.style])
			];
		},
		childrens: undefined as undefined | Map<HTMLElement, MetaChildren>,
		event: {
			load: {
				handler(e, data) {
					if (data?.node instanceof HTMLElement) {
						const mutationObs = new MutationObserver(() => {
							if (data.node instanceof HTMLElement) {
								const childrens = data.node.children;
								if (childrens.length) {
									const totalW = [...childrens].reduce((st, node) => st + node.offsetWidth, 0);
									//data.node.style.minWidth = `${totalW}px`;
								}
							}
							if (data.node instanceof HTMLElement) {
								const styleComputed = window.getComputedStyle(data.node);
								data.node.style.setProperty('--background-current', styleComputed.backgroundColor);
							}
						});
						mutationObs.observe(data.node, { attributes: true });
						if (
							profile.browser.type &&
							profile.browser.type.includes('mobile') &&
							props.type == 'number' &&
							props.focusAtStart
						) {
							profile.visualKeyboard.fallbackFocusOn = () => {
								if (configs.ref?.contains(profile.visualKeyboard.focusOn)) actionFocus();
							};
							if (!configs.status.focusFirstTime) {
								configs.status.focusFirstTime = true;
								untrack(() => {
									if (data.node instanceof HTMLElement) {
										profile.visualKeyboard.focusOn = data.node;
										profile.visualKeyboard.onKeyup = visualKbOnKeyup;
									}
								});
							}
						}
						return () => {
							mutationObs.disconnect();
							if (configs.status.timeId.animationId)
								cancelAnimationFrame(configs.status.timeId.animationId);
						};
					}
				}
			},
			mousedown: {
				handler(e: MouseEvent) {
					if (configs.status.focus) {
						e.preventDefault();
					}
				}
			},
			get click() {
				if (!profile.browser.type?.includes('mobile'))
					return {
						handler() {
							if (!configs.status.focus) {
								actionFocus();
							}
						}
					};
				return {
					handler(e: MouseEvent) {
						e.preventDefault();
						if (
							props.type &&
							['phone', 'number'].includes(props.type) &&
							profile.visualKeyboard.height
						) {
							configs.status.focus = true;
						} else if (props.type && ['password'].includes(props.type)) {
							if (textFieldCtx?.onBlur) textFieldCtx?.onBlur(configs.status.focus);
						}
						actionFocus();
					}
				};
			},
			get touchstart() {
				if (!profile.browser.type?.includes('mobile'))
					return {
						handler() {
							if (!configs.status.focus) {
								actionFocus();
							}
						}
					};
				return {
					handler(e: MouseEvent) {
						e.preventDefault();
						if (
							props.type &&
							['phone', 'number'].includes(props.type) &&
							profile.visualKeyboard.height
						) {
							configs.status.focus = true;
						} else if (props.type && ['password'].includes(props.type)) {
							if (textFieldCtx?.onBlur) textFieldCtx.onBlur(configs.status.focus);
						}
						actionFocus();
					}
				};
			}
		} as EventListener,
		eventValidate: undefined as undefined | EventListener,
		input: {
			status: {
				openParen: undefined as undefined | number,
				previousValue: undefined as undefined | number | string,
				currentSelected: null as null | number
			},
			ref: undefined as undefined | HTMLElement,
			get style() {
				return ['input-input min-w-0  bg-transparent', defaults.input.style];
			},
			event: {
				load: {
					handler(e, data) {
						if (data?.node instanceof HTMLElement) {
							if (!configs.childrens) configs.childrens = new Map();
							configs.childrens.set(data.node, {
								get width() {
									return (data.node as HTMLElement).offsetWidth;
								},
								get height() {
									return (data.node as HTMLElement).offsetHeight;
								}
							});
							//data.node.focus();
							if (profile.browser.type?.includes('mobile')) profile.visualKeyboard.isShow = false;
						}
					}
				},
				touchstart: {
					handler(e) {}
				},
				focus: {
					handler(e) {
						configs.status.focus = true;
						if (textFieldCtx?.onBlur) textFieldCtx.onBlur(configs.status.focus);
						const scrollY = window.scrollY;
						const myTimeout = setTimeout(() => {
							window.scrollTo(0, scrollY);
						});
						if (props.onFocus) {
							props.onFocus(value);
						}
						return () => {
							clearTimeout(myTimeout);
						};
					}
				},
				change: {
					handler() {
						if (textFieldCtx?.updateValue) {
							textFieldCtx.updateValue(value);
						}
						if (props.onChange) {
							props.onChange(value);
						}
					}
				},
				keyup: {
					handler() {
						if (configs.status.type == 'number' && value != undefined) {
							configs.input.status.openParen = value.toString().split('(').length;
						}
						if (props.onKeyup) {
							props.onKeyup(value);
						}
					}
				},
				get keydown() {
					return {
						handler(e: KeyboardEvent) {
							if (e.key == 'Enter' && textFieldCtx?.onEnter) {
								textFieldCtx.onEnter();
							}
							if (configs.status.type == 'text') {
								if (configs.input.ref) configs.input.ref.scrollLeft = configs.input.ref.clientWidth;
								if (e.key == 'Enter' && configs.status.focus) {
									actionBlur();
								}
							}
							if (configs.status.type == 'password') {
								if (e.key.toLowerCase() == 'backspace' && value) {
									const inputElement = e.target as HTMLInputElement;
									const currentSelection = inputElement.selectionStart;
									if (currentSelection) {
										configs.input.status.previousValue = value;
										value =
											value.toString().slice(0, currentSelection - 1) +
											value.toString().slice(currentSelection, value.toString().length);
										requestAnimationFrame(() => {
											inputElement.selectionStart = currentSelection - 1;
											inputElement.selectionEnd = currentSelection - 1;
										});
										configs.passwordMask = value;
									}

									e.preventDefault();
								}
								if (notAllowKeysForPassword.includes(e.key)) {
									if (e.key == 'Enter' && configs.status.focus) {
										actionBlur();
									}
									return;
								}
								if (!value) value = '';
								if (!configs.passwordMask) configs.passwordMask = '';
								configs.input.status.previousValue = value;
								value += e.key;
								configs.passwordMask += e.key;
								e.preventDefault();
								if (configs.input.ref) configs.input.ref.scrollLeft = configs.input.ref.clientWidth;
							}
							if (configs.status.type == 'number') {
								const inputElement = e.target as HTMLInputElement;
								const allowedKeys = ['Backspace'];
								if (allowedKeys.includes(e.key)) return;
								if (e.ctrlKey && e.key == 'v') return;
								if (
									['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(e.key.toLowerCase())
								)
									return;
								if (!numberKeysAllowedRegEx.test(e.key)) e.preventDefault();
								if (
									/[+\-*/]/.test(e.key) &&
									value != undefined &&
									/[+\-*/]/.test(value?.toString().slice(-1))
								)
									e.preventDefault();
								if (
									/[()]/.test(e.key) &&
									value &&
									/[()]/.test(value?.toString().slice(-1)) &&
									value &&
									configs.input.status.openParen &&
									value.toString().split(')').length >= configs.input.status.openParen
								)
									e.preventDefault();
								if (
									value &&
									value.toString().length &&
									!/[+\-*/]/.test(value.toString().slice(-1)) &&
									/[(]/.test(e.key)
								)
									e.preventDefault();
								if (
									value &&
									value.toString().length &&
									/[+\-*/]/.test(value.toString().slice(-1)) &&
									/[)]/.test(e.key)
								)
									e.preventDefault();
								if (configs.input.ref) configs.input.ref.scrollLeft = configs.input.ref.clientWidth;
							}
							if (props.onKeydown) {
								props.onKeydown(value);
							}
						}
					};
				},
				get blur() {
					if (configs.status.type != 'number' || profile.browser.type?.includes('desktop'))
						return {
							async handler(e) {
								if (profile.browser.type?.includes('mobile') && profile.visualKeyboard.isShow)
									profile.visualKeyboard.isShow = false;
								configs.status.focus = false;
								if (props.type == 'number') await calculatorString();
								if (textFieldCtx?.onBlur) {
									textFieldCtx.onBlur(configs.status.focus);
								}
								if (textFieldCtx?.updateValue && configs.status.changed)
									textFieldCtx.updateValue(value);
								if (props.onBlur) {
									props.onBlur(value);
								}
							}
						};
					return {
						async handler(e) {
							await calculatorString();
							if (props.onBlur) {
								props.onBlur(value);
							}
						}
					};
				}
			} as EventListener
		},
		clearBtn: {
			component: undefined as undefined | SvelteComponent,
			get ref() {
				return this.component?.configs?.ref;
			},
			event: {
				load: {
					handler(_, data) {
						if (data?.node instanceof HTMLElement) {
							if (!configs.childrens) configs.childrens = new Map();
							configs.childrens.set(data.node, {
								get width() {
									return (data.node as HTMLElement).offsetWidth;
								},
								get height() {
									return (data.node as HTMLElement).offsetHeight;
								}
							});
						}
					}
				},
				get click() {
					return this.touchstart;
				},
				touchstart: {
					handler() {
						value = undefined;
						if (props.onClear) props.onClear(value);
						if (textFieldCtx?.updateValue) textFieldCtx.updateValue(value);
						if (props.type == 'password') {
							configs.passwordMask = '';
						}
						if (
							(props.type == 'text' || profile.browser.type?.includes('desktop')) &&
							!configs.status.focus
						) {
							actionFocus();
						}
					}
				}
			} as EventListener
		},
		copyBtn: {
			component: undefined as undefined | SvelteComponent,
			get ref() {
				return this.component?.configs?.ref;
			},
			status: {
				copied: false
			},
			event: {
				load: {
					handler(_, data) {
						if (data?.node instanceof HTMLElement) {
							if (!configs.childrens) configs.childrens = new Map();
							configs.childrens.set(data.node, {
								get width() {
									return (data.node as HTMLElement).offsetWidth;
								},
								get height() {
									return (data.node as HTMLElement).offsetHeight;
								}
							});
						}
					}
				},
				get click() {
					if (client.browser?.isMobile) return undefined;
					return this.touchstart;
				},
				touchstart: {
					async handler(e) {
						// actionBlur();
						if (
							(typeof value == 'string' && value.length) ||
							(typeof value == 'number' && value != null)
						) {
							let holdFocus: boolean;
							if (configs.input.ref) {
								configs.input.status.currentSelected = (
									configs.input.ref as HTMLInputElement
								).selectionStart;
							}
							configs.copyBtn.status.copied = await copyToClipboard(
								typeof value == 'number' ? value.toString() : value
							);
							if (client.browser?.isMobile && configs.status.focus) {
								if (profile.visualNodes.input.ref) {
									profile.visualNodes.input.ref.focus();
									holdFocus = true;
								}
							}
							disabled = true;
							if (configs.copyBtn.status.copied) {
								profile.clipboard.value = typeof value == 'number' ? value.toString() : value;
								setTimeout(() => {
									configs.copyBtn.status.copied = false;
									disabled = undefined;
									if (
										(configs.status.focus && !client.browser?.isMobile) ||
										(client.browser?.isMobile && holdFocus)
									) {
										requestAnimationFrame(() => {
											if (configs.input.ref) configs.input.ref.focus();
											if (configs.input.ref && props.type == 'text') {
												if (configs.input.status.currentSelected) {
													(configs.input.ref as HTMLInputElement).setSelectionRange(
														configs.input.status.currentSelected,
														configs.input.status.currentSelected
													);
												} else {
													(configs.input.ref as HTMLInputElement).setSelectionRange(
														typeof value == 'string'
															? value.length
															: (value?.toString().length ?? 0),
														typeof value == 'string'
															? value.length
															: (value?.toString().length ?? 0)
													);
												}
											} else {
												setTimeout(() => {
													try {
														actionFocus();
													} catch (e) {
														console.log(e);
													}
												}, configs.delay);
											}
										});
									}
								}, configs.delay);
							}
						}
					},
					options: {
						get delay() {
							return configs.delay ?? 300;
						},
						stopPropagation: true,
						preventDefault: true
					}
				}
			} as EventListener
		},
		pasteBtn: {
			component: undefined as undefined | BasicComponent,
			get ref() {
				return this.component?.configs?.ref;
			},
			status: {
				hasData: false
			},
			event: {
				load: {
					handler(_, data) {
						if (data?.node instanceof HTMLElement) {
							if (!configs.childrens) configs.childrens = new Map();
							configs.childrens.set(data.node, {
								get width() {
									return (data.node as HTMLElement).offsetWidth;
								},
								get height() {
									return (data.node as HTMLElement).offsetHeight;
								}
							});
						}
					}
				},
				get click() {
					return this.touchstart;
				},
				touchstart: {
					async handler() {
						let data;
						try {
							data = await navigator.clipboard.readText();
						} catch (e) {
							data = await pasteFromClipboard();
						}
						if (data) {
							value = data;
							if (props.type == 'password') configs.passwordMask = value;
							if (configs.input.ref && props.type == 'text') {
								if (configs.input.status.currentSelected) {
									if (props.type == 'text' && configs.status.focus) {
										actionFocus();
									}
									(configs.input.ref as HTMLInputElement).setSelectionRange(
										configs.input.status.currentSelected,
										configs.input.status.currentSelected
									);
								} else {
									(configs.input.ref as HTMLInputElement).setSelectionRange(
										value.length,
										value.length
									);
								}
							}
						}
					},
					options: {
						get delay() {
							return profile.delay ?? 300;
						},
						preventDefault: true,
						stopPropagation: true
					}
				}
			} as EventListener
		},
		showPasswordBtn: {
			component: undefined as undefined | BasicComponent,
			get ref() {
				return this.component?.configs?.ref;
			},
			event: {
				load: {
					handler(_, data) {
						if (data?.node instanceof HTMLElement) {
							if (!configs.childrens) configs.childrens = new Map();
							configs.childrens.set(data.node, {
								get width() {
									return (data.node as HTMLElement).offsetWidth;
								},
								get height() {
									return (data.node as HTMLElement).offsetHeight;
								}
							});
						}
					}
				},
				get click() {
					return this.touchstart;
				},
				touchstart: {
					handler() {
						configs.status.showPassword = !configs.status.showPassword;
						if (!configs.status.focus) {
							actionFocus();
						}
						setTimeout(() => {}, 1000);
					}
				}
			} as EventListener
		},
		svg: {
			ref: undefined as undefined | SVGElement,
			rect: {
				ref: undefined as undefined | SVGRectElement
			}
		},
		virualInput: {
			ref: undefined as undefined | HTMLElement
		},
		numbericKb: {
			component: null as
				| null
				| typeof import('$components/keyboard/numberic/Numberic.svelte').configs,
			get ref(): HTMLElement | null {
				if (this.component?.configs.ref) return this.component.configs.ref;
				return null;
			}
		},
		trailingIcon: {
			component: undefined as undefined | BasicComponent,
			get ref() {
				return this.component?.configs?.ref;
			},
			event: {
				load: {
					handler(_, data) {
						if (data?.node instanceof HTMLElement) {
							if (!configs.childrens) configs.childrens = new Map();
							configs.childrens.set(data.node, {
								get width() {
									return (data.node as HTMLElement).offsetWidth;
								},
								get height() {
									return (data.node as HTMLElement).offsetHeight;
								}
							});
						}
					}
				}
			} as EventListener
		},
		leadingIcon: {
			component: undefined as undefined | BasicComponent,
			get ref() {
				return this.component?.configs?.ref;
			},
			event: {
				load: {
					handler(_, data) {
						if (data?.node instanceof HTMLElement) {
							if (!configs.childrens) configs.childrens = new Map();
							configs.childrens.set(data.node, {
								get width() {
									return (data.node as HTMLElement).offsetWidth;
								},
								get height() {
									return (data.node as HTMLElement).offsetHeight;
								}
							});
						}
					}
				}
			} as EventListener
		},
		loading: {
			component: undefined as undefined | BasicComponent,
			get ref() {
				return this.component?.configs?.ref;
			},
			event: {
				load: {
					handler(_, data) {
						if (data?.node instanceof HTMLElement) {
							if (!configs.childrens) configs.childrens = new Map();
							configs.childrens.set(data.node, {
								get width() {
									return (data.node as HTMLElement).offsetWidth;
								},
								get height() {
									return (data.node as HTMLElement).offsetHeight;
								}
							});
						}
					}
				}
			} as EventListener
		}
	});

	function processLoadingAnimation() {
		if (!configs.status.loadingStartAt) return;
		const currentTime = performance.now();
		const duration = configs.status.loadingAnimationDuration ?? 300;
		const currentPercent = ((currentTime - configs.status.loadingStartAt) * 100) / duration;
		const currentDeg = (currentPercent * 360) / 100;
		if (Math.min(100, currentPercent) == 100 && configs.status.timeId.animationId) {
			if (configs.ref) {
				configs.ref.style.setProperty('--process-deg', `360deg`);
			}
			configs.status.loadingStartAt = performance.now();
		} else {
			if (configs.ref) {
				configs.ref.style.setProperty('--process-deg', `${currentDeg}deg`);
			}
		}
		configs.status.timeId.animationId = requestAnimationFrame(processLoadingAnimation);
	}
	function autoFocus(e: MouseEvent) {
		if (
			((e.target as HTMLElement).classList.contains('copy-btn') ||
				(e.target as HTMLElement).classList.contains('paste-btn')) &&
			configs.virualInput.ref
		) {
			if ((e.target as HTMLElement).classList.contains('copy-btn')) {
			} else if ((e.target as HTMLElement).classList.contains('paste-btn')) {
				actionFocus();
			}
		}
		if (textFieldCtx && textFieldCtx.ref?.contains(e.target as HTMLElement) && !disabled) {
		}
	}
	function visualKbOnKeyup(key: NumbericKey) {
		if (
			(value == null || value == undefined) &&
			key != 'Done' &&
			key != 'NextField' &&
			key != 'PrevField'
		)
			value = '';
		switch (key) {
			case 'AC':
				value = undefined;
				break;
			case '(':
				value += '(';

				break;
			case ')':
				if (!value?.toString().length) return;
				value += ')';

				break;
			case 'Del':
				if (!value?.toString().length) {
					value = undefined;
					return;
				}
				value = value?.toString().slice(0, -1);
				value = value.length ? value : undefined;
				break;
			case ':':
				if (!value) return;
				if (
					(value.toString().length && ['+', '-', 'x', ':'].includes(value.toString().slice(-1))) ||
					!value.toString().length
				) {
					return;
				}
				value += ':';

				break;
			case '*':
				if (!value) return;
				if (
					(value.toString().length && ['+', '-', 'x', ':'].includes(value.toString().slice(-1))) ||
					!value.toString().length
				) {
					return;
				}
				value += 'x';
				break;
			case '-':
				if (
					value &&
					value.toString().length &&
					['+', '-', 'x', ':'].includes(value.toString().slice(-1))
				) {
					return;
				}
				value += '-';
				break;
			case '+':
				if (value && ['+', '-', 'x', ':'].includes(value.toString().slice(-1))) {
					return;
				}
				value += '+';
				break;
			case '.':
				if (
					(value?.toString().length && value.toString().slice(-1) == '.') ||
					(value &&
						every(
							['+', '-', 'x', ':'].map((it) =>
								every(value?.toString().split(it), (str) => str.includes('.'))
							)
						))
				)
					return;
				value += '.';
				break;
			case '%':
				if (
					(value?.toString().length && value.toString().slice(-1) == '%') ||
					(value &&
						every(
							['+', '-', 'x', ':'].map((it) =>
								every(value?.toString().split(it), (str) => str.includes('%'))
							)
						))
				)
					return;
				value += '%';
				break;
			case 1:
				if (value?.toString().length == 1 && value.toString().slice(0, 1) == '0') return;
				value += '1';
				break;
			case 2:
				if (value?.toString().length == 1 && value.toString().slice(0, 1) == '0') return;
				value += '2';
				break;
			case 3:
				if (value?.toString().length == 1 && value.toString().slice(0, 1) == '0') return;
				value += '3';
				break;
			case 4:
				if (value?.toString().length == 1 && value.toString().slice(0, 1) == '0') return;
				value += '4';
				break;
			case 5:
				if (value?.toString().length == 1 && value.toString().slice(0, 1) == '0') return;
				value += '5';
				break;
			case 6:
				if (value?.toString().length == 1 && value.toString().slice(0, 1) == '0') return;
				value += '6';
				break;
			case 7:
				if (value?.toString().length == 1 && value.toString().slice(0, 1) == '0') return;
				value += '7';
				break;
			case 8:
				if (value?.toString().length == 1 && value.toString().slice(0, 1) == '0') return;
				value += '8';
				break;
			case 9:
				if (value?.toString().length == 1 && value.toString().slice(0, 1) == '0') return;
				value += '9';
				break;
			case 0:
				if (value?.toString().length && value.toString().slice(0, 1) == '0') return;
				value += '0';
				break;
			case '=':
				try {
					if (profile.browser.type?.includes('mobile') && profile.visualKeyboard.isShow)
						profile.visualKeyboard.isShow = true;
					value = Function(
						`'use strict'; return (${value?.toString().replace('x', '*').replace(':', '/').replace('%', '/100')})`
					)();
					configs.input.status.previousValue = value;
				} catch {
					if (configs.input.status.previousValue) value = configs.input.status.previousValue;
				}
				break;
			case 'NextField':
				break;
			case 'PrevField':
				break;
			case 'Done':
				profile.visualKeyboard.focusOn = null;
				configs.status.focus = false;
				if (textFieldCtx?.onBlur) textFieldCtx.onBlur(configs.status.focus);
		}
		configs.input.ref?.scrollTo({ left: configs.input.ref.scrollWidth, behavior: 'smooth' });
	}
	async function calculatorString() {
		configs.status.loading = true;
		let calculated: number;
		if (configs.status.focus) return;
		if (configs.status.timeId.calculate) {
			clearTimeout(configs.status.timeId.calculate);
		}
		if (configs.status.resolver.calculate) configs.status.resolver.calculate();
		return new Promise<void>((resolve) => {
			configs.status.resolver.calculate = resolve;
			configs.status.timeId.calculate = setTimeout(() => {
				try {
					if (profile.browser.type?.includes('mobile') && profile.visualKeyboard.isShow)
						profile.visualKeyboard.isShow = true;

					calculated = Function(
						`'use strict'; return (${value?.toString().replaceAll('x', '*').replaceAll(':', '/')})`
					)();

					configs.status.focus = false;
					if (textFieldCtx?.onBlur) textFieldCtx.onBlur(configs.status.focus);
					if (calculated != null) {
						if (value != calculated) configs.input.status.previousValue = value;
						value = calculated;
					}
					configs.status.loading = false;
					resolve();
				} catch (e) {
					if (configs.input.status.previousValue) value = configs.input.status.previousValue;
					configs.status.loading = false;
					resolve();
				}
			}, 300);
		});
	}
	function actionFocus() {
		try {
			if (disabled || !browser) return;
			if (profile.browser.type?.includes('mobile') && props.type == 'number' && configs.ref) {
				if (profile.visualNodes.input.ref && !profile.visualKeyboard.hasHeightValue) {
					profile.visualNodes.input.ref.focus();
					profile.visualNodes.input.ref.scrollIntoView({ behavior: 'smooth', block: 'center' });

					requestAnimationFrame(() => {
						if (visualViewport && profile.screen.height) {
							setTimeout(() => {
								if (profile.screen.height && visualViewport) {
									profile.visualKeyboard.height = profile.screen.height - visualViewport.height;
								}
								if (profile.visualNodes.input.ref) profile.visualNodes.input.ref.blur();
								configs.status.focus = true;
								if (textFieldCtx?.onBlur) textFieldCtx.onBlur(configs.status.focus);
								if (configs.ref) {
									profile.visualKeyboard.focusOn = configs.ref;
									profile.visualKeyboard.onKeyup = visualKbOnKeyup;
								}
							}, 50);
						}
					});
				} else {
					configs.status.focus = true;
					if (textFieldCtx?.onBlur) textFieldCtx.onBlur(configs.status.focus);
					if (configs.ref) {
						profile.visualKeyboard.focusOn = configs.ref;
						profile.visualKeyboard.onKeyup = visualKbOnKeyup;
					}
				}
			}
			if (configs.input.ref) {
				configs.input.ref.focus();
			}
		} catch (e) {
			console.log(e);
		}
	}
	function actionBlur() {
		if (configs.input.ref) {
			configs.input.ref.dispatchEvent(new Event('blur'));
			configs.input.ref.blur();
		}
		if (props.onEnter) {
			props.onEnter();
		}
	}
	function reset() {
		configs.status.focus = false;
		value = undefined;
		if (props.type == 'password') configs.passwordMask = '';
	}

	const textFieldCtx = getTextfieldCtx();
	const formCtx = getFormContext();
	if (textFieldCtx && textFieldCtx.onFocus) {
		textFieldCtx.onFocus('input', actionFocus);
	}

	$effect(() => {
		if (configs.status.loading) {
			configs.status.loadingStartAt = performance.now();
			configs.status.timeId.animationId = requestAnimationFrame(processLoadingAnimation);
		} else {
			if (configs.status.timeId.animationId) {
				cancelAnimationFrame(configs.status.timeId.animationId);
			}
			if (configs.ref) {
				configs.ref.style.removeProperty('--process-deg');
			}
		}
	});

	$effect(() => {
		if (client.browser?.isMobile && !profile.visualNodes.input.ref && props.type != 'number') {
			const visualInput = document.createElement('input');
			visualInput.classList.add(
				'h-12',
				'w-12',
				'bottom-0',
				'left-0',
				'opacity-1',
				'bg-white',
				'-z-50',
				'text-white',
				'absolute'
			);
			visualInput.type = 'password';
			document.body.appendChild(visualInput);
			profile.visualNodes.input.ref = visualInput;
		}
	});

	onMount(async () => {
		window.addEventListener('click', autoFocus);

		watchClipboard((e) => {
			configs.pasteBtn.status.hasData = e;
		});
		profile.clipboard.value = await pasteFromClipboard();
		if (props.showPassword && props.type == 'password')
			configs.status.showPassword = props.showPassword;

		if (textFieldCtx?.validate) {
			configs.eventValidate = mapValues(
				textFieldCtx.validate,
				(item, eventName: keyof EventListener) => ({
					async handler() {
						if (item) {
							if (
								props.type == 'number' &&
								eventName == 'change' &&
								configs.status.timeId.calculate
							)
								clearTimeout(configs.status.timeId.calculate);
							if (configs.status.resolver.validate) configs.status.resolver.validate();
							await calculatorString();
							configs.status.loading = true;
							if (
								configs.status.timeId.validation &&
								typeof configs.status.timeId.validation == 'number'
							)
								clearTimeout(configs.status.timeId.validation);
							await new Promise<void>((resolve) => {
								configs.status.resolver.validate = resolve;
								configs.status.timeId.validation = setTimeout(async () => {
									const isValid = await item.isValid(value);
									textFieldCtx.isInvalid = !isValid;
									if (textFieldCtx.insertErrorMessage) {
										textFieldCtx.insertErrorMessage({
											eventName: eventName,
											message: item.message
												? isValid
													? item.message.valid
													: item.message.invalid
												: undefined
										});
									}
									configs.status.loading = false;
									resolve();
								}, 300);
							});
						}
					}
				})
			);
		}
		if (textFieldCtx?.insertMetaNode) {
			textFieldCtx.insertMetaNode({
				name: configs.name,
				ref: configs.ref,
				reset: reset,
				get loading() {
					return configs.status.loading;
				},
				focus: actionFocus
			});
		}
		configs.initValue = value;
	});
	onDestroy(() => {
		if (browser) {
			window.removeEventListener('click', autoFocus);
			if (profile.visualNodes.input.ref) {
				profile.visualNodes.input.ref.remove();
				profile.visualNodes.input.ref = undefined;
			}
		}
	});

	export { configs };
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	data-variant={props.variant ?? 'primary'}
	data-size={props.size ?? textFieldCtx?.size ?? formCtx?.size ?? 'md'}
	data-disabled={disabled}
	data-loading={configs.status.loading}
	data-loading-animation-style={configs.status.loadingAnimationStyle}
	data-is-invalid={textFieldCtx?.isInvalid}
	data-focus={configs.status.focus}
	data-hover={textFieldCtx?.status?.hover}
	data-has-leading={props.leadingIcon &&
	((typeof props.loadingAnimation == 'string' && props.loadingAnimation == 'style-1') ||
		(typeof props.loadingAnimation == 'object' && props.loadingAnimation.style == 'style-1') ||
		!props.loadingAnimation)
		? true
		: undefined}
	data-has-trailing={(props.trailingIcon &&
		((typeof props.loadingAnimation == 'string' && props.loadingAnimation == 'style-1') ||
			(typeof props.loadingAnimation == 'object' && props.loadingAnimation.style == 'style-1') ||
			!props.loadingAnimation)) ||
	value
		? true
		: undefined}
	style:--loading-animation-duration={configs.status.loadingAnimationDuration}
	{@attach handleEvents([
		...(disabled
			? [{ events: [] }]
			: [
					{ events: [configs.event] },
					{
						events: [
							{
								touchstart: {
									async handler(e) {
										if (!textFieldCtx?.ref?.contains(e.target) && configs.status.focus) {
											//actionBlur();
											//console.log('blur');
										}
										if (
											configs.ref &&
											!configs.ref.contains(e.target) &&
											profile.visualKeyboard.ref &&
											!profile.visualKeyboard.ref.contains(e.target) &&
											configs.ref.contains(profile.visualKeyboard.focusOn) &&
											textFieldCtx?.ref &&
											!textFieldCtx.ref.contains(e.target) &&
											props.type == 'number'
										) {
											if (configs.input.ref) {
												//configs.input.ref.dispatchEvent(new Event('blur'));
											}
											configs.status.focus = false;
											if (textFieldCtx.onBlur) textFieldCtx.onBlur(configs.status.focus);
											profile.visualKeyboard.focusOn = null;
											configs.input.ref?.dispatchEvent(new CustomEvent('blur'));
											if (configs.input.status.previousValue != value) {
												configs.input.ref?.dispatchEvent(new CustomEvent('change'));
											}
											if (
												configs.input.status.previousValue != value &&
												!keys(textFieldCtx.validate).includes('change')
											)
												await calculatorString();
										}
									}
								}
							}
						],
						target: window
					}
				])
	])}
>
	{#if props.leadingIcon && !configs.status.loading}
		<Icon
			bind:this={configs.leadingIcon.component}
			icon={props.leadingIcon}
			class="input-leading-icon"
			onLoad={(metaChildren) => {
				if (!configs.childrens) configs.childrens = new Map();
				if (!metaChildren.ref) return;
				configs.childrens.set(metaChildren.ref, omit(metaChildren, ['ref']));
			}}
			onDestroy={(metaChildren) => {
				if (!configs.childrens || !metaChildren.ref) return;
				configs.childrens.delete(metaChildren.ref);
			}}
		/>
	{/if}
	{#if configs.status.loading && configs.status.loadingAnimationStyle == 'style-1' && (props.leadingIcon || (!props.leadingIcon && !props.trailingIcon))}
		<Loading.Rotate
			class="mx-[var(--padding)]"
			color="primary"
			onLoad={(metaChildren) => {
				if (!configs.childrens) configs.childrens = new Map();
				if (!metaChildren.ref) return;
				configs.childrens.set(metaChildren.ref, omit(metaChildren, ['ref']));
			}}
			onDestroy={(metaChildren) => {
				if (!configs.childrens || !metaChildren.ref) return;
				configs.childrens.delete(metaChildren.ref);
			}}
		/>
	{/if}
	{#if !disabled}
		{#if (props.type && ['text'].includes(props.type)) || (props.type && props.type == 'number' && profile.browser.type?.includes('desktop'))}
			<input
				class={[...configs.input.style]}
				bind:this={configs.input.ref}
				type="text"
				bind:value
				placeholder={props.placeholder}
				{@attach handleEvents([
					{
						events: [
							configs.event,
							configs.input.event,
							...(configs.eventValidate ? [configs.eventValidate] : [])
						]
					},
					props.events ? props.events : undefined
				])}
			/>
		{:else if props.type && ['password'].includes(props.type)}
			<input
				class={[...configs.input.style]}
				bind:this={configs.input.ref}
				type="text"
				value={configs.status.showPassword ? value : configs.passwordMask}
				placeholder={props.placeholder}
				{@attach handleEvents([
					{
						events: [
							configs.event,
							configs.input.event,
							...(configs.eventValidate ? [configs.eventValidate] : [])
						]
					},
					props.events ? props.events : undefined
				])}
			/>
		{:else}
			<div class={[...configs.input.style, 'flex-1 flex overflow-hidden']}>
				<div
					class="w-fit overflow-hidden pr-2 {value == null ||
					value == undefined ||
					!value?.toString().length
						? 'text-gray-400'
						: ''}"
					bind:this={configs.input.ref}
					{@attach handleEvents([
						{
							events: [
								configs.event,
								configs.input.event,
								...(configs.eventValidate ? [configs.eventValidate] : [])
							]
						},
						props.events ? props.events : undefined
					])}
				>
					{configs.status.focus
						? value
						: value !== null && value !== undefined && value.toString().length
							? value
							: props.placeholder}
				</div>
				{#if configs.status.focus && profile.visualKeyboard.focusOn && configs.ref.contains(profile.visualKeyboard.focusOn)}
					<div class="input-visual-cursor"></div>
				{/if}
			</div>
		{/if}
		{#if props.clearButtonEnabled && value != undefined}
			<Button
				bind:this={configs.clearBtn.component}
				class="aspect-square z-[9999] relative"
				color="danger"
				size={props.size ?? textFieldCtx?.size ?? formCtx?.size ?? 'md'}
				icon={iconify['close-rounded']}
				variant="light"
				events={{ events: [configs.clearBtn.event] }}
				width={configs.ref?.clientHeight ??
					0 - parseFloat(configs.ref?.style.getPropertyValue('--border-width') ?? 0)}
				onDestroy={(metaChildren) => {
					if (!configs.childrens || !metaChildren.ref) return;
					configs.childrens.delete(metaChildren.ref);
				}}
			/>
		{/if}
	{:else}
		<span class="flex-1 pl-[var(--padding-input-left)]">{value ? value : props.placeholder}</span>
	{/if}

	{#if value != undefined && props.copyButtonEnabled}
		<Button
			bind:this={configs.copyBtn.component}
			class="aspect-square copy-btn z-10 relative"
			color="success"
			size={props.size ?? textFieldCtx?.size ?? formCtx?.size ?? 'md'}
			icon={configs.copyBtn.status.copied
				? iconify['check-rounded']
				: iconify['content-copy-outline-rounded']}
			variant="light"
			events={{ events: [configs.copyBtn.event] }}
			width={configs.ref?.clientHeight ??
				0 - parseFloat(configs.ref?.style.getPropertyValue('--border-width') ?? 0)}
		/>
	{/if}
	{#if ((typeof value == 'number' && value == null) || (typeof value == 'string' && !value.length) || !value) && profile.clipboard.status.hasData}
		<Button
			class="aspect-square paste-btn z-10 relative"
			color="success"
			size={props.size ?? textFieldCtx?.size ?? formCtx?.size ?? 'md'}
			icon={iconify['content-paste-rounded']}
			variant="light"
			events={{ events: [configs.pasteBtn.event] }}
			width={configs.ref?.clientHeight ??
				0 - parseFloat(configs.ref?.style.getPropertyValue('--border-width') ?? 0)}
		/>
	{/if}
	{#if props.type && props.type == 'password' && props.showPasswordButtonEnabled}
		<Tooltip.Provider>
			{#if profile.browser.type?.includes('desktop')}
				<Tooltip.Root class="">
					<Tooltip.Content class="capitalize border-solid border border-gray-500 bg-gray-400 px-2"
						>{configs.status.showPassword ? 'Show' : 'Hidden'} password</Tooltip.Content
					>
					<Tooltip.Arrow></Tooltip.Arrow>
				</Tooltip.Root>
			{/if}
			<Tooltip.Trigger>
				<Button
					class="aspect-square paste-btn z-10 relative"
					color="primary"
					size={props.size ?? textFieldCtx?.size ?? formCtx?.size ?? 'md'}
					icon={configs.status.showPassword
						? iconify['password-2-off-rounded']
						: iconify['password-2-rounded']}
					variant="light"
					events={{ events: [configs.showPasswordBtn.event] }}
					alt={profile.browser.type?.includes('mobile')
						? `${configs.status.showPassword ? 'Show' : 'Hidden'} Password`
						: undefined}
					width={configs.ref?.clientHeight ??
						0 - parseFloat(configs.ref?.style.getPropertyValue('--border-width') ?? 0)}
				/>
			</Tooltip.Trigger>
		</Tooltip.Provider>
	{/if}
	{#if props.trailingIcon && !configs.status.loading}
		<Icon
			bind:this={configs.trailingIcon.component}
			icon={props.trailingIcon}
			class="input-leading-icon"
			onLoad={(metaChildren) => {
				if (!configs.childrens) configs.childrens = new Map();
				if (!metaChildren.ref) return;
				configs.childrens.set(metaChildren.ref, omit(metaChildren, ['ref']));
			}}
			onDestroy={(metaChildren) => {
				if (!configs.childrens || !metaChildren.ref) return;
				configs.childrens.delete(metaChildren.ref);
			}}
		/>
	{/if}
	{#if configs.status.loading && configs.status.loadingAnimationStyle == 'style-1' && props.trailingIcon}
		<Loading.Rotate
			class="mx-[var(--padding)]"
			color="primary"
			onLoad={(metaChildren) => {
				if (!configs.childrens) configs.childrens = new Map();
				if (!metaChildren.ref) return;
				configs.childrens.set(metaChildren.ref, omit(metaChildren, ['ref']));
			}}
			onDestroy={(metaChildren) => {
				if (!configs.childrens || !metaChildren.ref) return;
				configs.childrens.delete(metaChildren.ref);
			}}
		/>
	{/if}
</svelte:element>

<style lang="scss">
	@media (prefers-color-scheme: light) {
		.input-root {
			&[data-variant='primary'] {
				&[data-size='xs'] {
					--box-shadow: 0 1px 2px 0 var(--shadow-color);
				}
				&[data-size='sm'] {
					--box-shadow: 0 1px 3px 0 var(--shadow-color), 0 1px 2px -1px var(--shadow-color);
				}
				&[data-size='md'] {
					--box-shadow: 0 4px 6px -1px var(--shadow-color), 0 2px 4px -2px var(--shadow-color);
				}
				&[data-size='lg'] {
					--box-shadow: 0 10px 15px -3px var(--shadow-color), 0 4px 6px -4px var(--shadow-color);
				}
				&[data-size='xl'] {
					--box-shadow: 0 20px 25px -5px var(--shadow-color), 0 8px 10px -6px var(--shadow-color);
				}
				&[data-size='2xl'],
				&[data-size='3xl'],
				&[data-size='4xl'],
				&[data-size='5xl'],
				&[data-size='6xl'],
				&[data-size='7xl'],
				&[data-size='8xl'],
				&[data-size='9xl'],
				&[data-size='full-width'] {
					--box-shadow: 0 25px 50px -12px var(--shadow-color);
				}
				--shadow-color: hsl(var(--default));
			}
			&[data-variant='secondary'] {
				&[data-size='xs'] {
					--box-shadow: 0 1px 2px 0 var(--shadow-color);
				}
				&[data-size='sm'] {
					--box-shadow: 0 1px 3px 0 var(--shadow-color), 0 1px 2px -1px var(--shadow-color);
				}
				&[data-size='md'] {
					--box-shadow: 0 4px 6px -1px var(--shadow-color), 0 2px 4px -2px var(--shadow-color);
				}
				&[data-size='lg'] {
					--box-shadow: 0 10px 15px -3px var(--shadow-color), 0 4px 6px -4px var(--shadow-color);
				}
				&[data-size='xl'] {
					--box-shadow: 0 20px 25px -5px var(--shadow-color), 0 8px 10px -6px var(--shadow-color);
				}
				&[data-size='2xl'],
				&[data-size='3xl'],
				&[data-size='4xl'],
				&[data-size='5xl'],
				&[data-size='6xl'],
				&[data-size='7xl'],
				&[data-size='8xl'],
				&[data-size='9xl'],
				&[data-size='full-width'] {
					--box-shadow: 0 25px 50px -12px var(--shadow-color);
				}
				--shadow-color: hsl(var(--default));
			}
			box-shadow: var(--box-shadow);
		}
	}

	.input-root {
		--color: hsl(var(--foreground-400));
		&[data-disabled='true'] {
			--cursor: not-allowed;
			--opacity: var(--disabled-opacity);
			position: relative;
			&::before {
				content: '';
				width: 100%;
				height: 100%;
				border-radius: var(--border-radius);
				position: absolute;
				z-index: 9999;
			}
		}
		&[data-variant='primary'] {
			--background-color: hsl(var(--field-background-primary));
			--shadow-color: hsl(var(--default-200));
		}
		&[data-variant='secondary'] {
			--background-color: hsl(var(--field-background-secondary));
			--shadow-color: hsl(var(--default-300));
		}
		&[data-size='xs'] {
			--font-size: var(--font-size-xs);
			--line-height: var(--line-height-xs);
			--border-radius: var(--border-radius-xs);
			--padding: var(--padding-xs);
			--min-width: var(--min-width-xs);
			--min-height: 28px;
			--border-width: var(--border-width-xs);
			--box-shadow: 0 1px 2px 0 var(--shadow-color);
		}
		&[data-size='sm'] {
			--font-size: var(--font-size-sm);
			--line-height: var(--line-height-sm);
			--border-radius: var(--border-radius-sm);
			--padding: var(--padding-sm);
			--min-width: var(--min-width-sm);
			--min-height: 40px;
			--border-width: var(--border-width-sm);
			--box-shadow: 0 1px 3px 0 var(--shadow-color), 0 1px 2px -1px var(--shadow-color);
		}
		&[data-size='md'] {
			--font-size: var(--font-size-md);
			--line-height: var(--line-height-md);
			--border-radius: var(--border-radius-md);
			--padding: var(--padding-md);
			--min-width: var(--min-width-md);
			--min-height: 48px;
			--border-width: var(--border-width-md);
			--box-shadow: 0 4px 6px -1px var(--shadow-color), 0 2px 4px -2px var(--shadow-color);
		}
		&[data-size='lg'] {
			--font-size: var(--font-size-lg);
			--line-height: var(--line-height-lg);
			--border-radius: var(--border-radius-lg);
			--padding: var(--padding-lg);
			--min-width: var(--min-width-lg);
			--min-height: 58px;
			--border-width: var(--border-width-lg);
			--box-shadow: 0 10px 15px -3px var(--shadow-color), 0 4px 6px -4px var(--shadow-color);
		}
		&[data-size='xl'] {
			--font-size: var(--font-size-xl);
			--line-height: var(--line-height-xl);
			--border-radius: var(--border-radius-xl);
			--padding: var(--padding-xl);
			--min-width: var(--min-width-xl);
			--min-height: 68px;
			--border-width: var(--border-width-xl);
			--box-shadow: 0 20px 25px -5px var(--shadow-color), 0 8px 10px -6px var(--shadow-color);
		}
		&[data-size='2xl'] {
			--font-size: var(--font-size-2xl);
			--line-height: var(--line-height-2xl);
			--border-radius: var(--border-radius-2xl);
			--padding: var(--padding-2xl);
			--min-width: var(--min-width-2xl);
			--min-height: 80px;
			--border-width: var(--border-width-2xl);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
		}
		&[data-size='3xl'] {
			--font-size: var(--font-size-3xl);
			--line-height: var(--line-height-3xl);
			--border-radius: var(--border-radius-3xl);
			--padding: var(--padding-3xl);
			--min-width: var(--min-width-3xl);
			--min-height: 94px;
			--border-width: var(--border-width-3xl);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
		}
		&[data-size='4xl'] {
			--font-size: var(--font-size-4xl);
			--line-height: var(--line-height-4xl);
			--border-radius: var(--border-radius-4xl);
			--padding: var(--padding-4xl);
			--min-width: var(--min-width-4xl);
			--min-height: 108px;
			--border-width: var(--border-width-4xl);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
		}
		&[data-size='5xl'] {
			--font-size: var(--font-size-5xl);
			--line-height: var(--line-height-5xl);
			--border-radius: var(--border-radius-5xl);
			--padding: var(--padding-5xl);
			--min-width: var(--min-width-5xl);
			--min-height: 128px;
			--border-width: var(--border-width-5xl);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
		}
		&[data-size='6xl'] {
			--font-size: var(--font-size-6xl);
			--line-height: var(--line-height-6xl);
			--border-radius: var(--border-radius-6xl);
			--padding: var(--padding-6xl);
			--min-width: var(--min-width-6xl);
			--min-height: 148px;
			--border-width: var(--border-width-6xl);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
		}
		&[data-size='7xl'] {
			--font-size: var(--font-size-7xl);
			--line-height: var(--line-height-7xl);
			--border-radius: var(--border-radius-7xl);
			--padding: var(--padding-7xl);
			--min-width: var(--min-width-7xl);
			--border-width: var(--border-width-7xl);
			--min-height: 168px;
		}
		&[data-size='8xl'] {
			--font-size: var(--font-size-8xl);
			--line-height: var(--line-height-8xl);
			--border-radius: var(--border-radius-8xl);
			--padding: var(--padding-8xl);
			--min-width: var(--min-width-9xl);
			--min-height: 200px;
			--border-width: var(--border-width-8xl);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
		}
		&[data-size='9xl'] {
			--font-size: var(--font-size-9xl);
			--line-height: var(--line-height-9xl);
			--border-radius: var(--border-radius-9xl);
			--padding: var(--padding-9xl);
			--min-width: var(--min-width-9xl);
			--min-height: 240px;
			--border-width: var(--border-width-9xl);
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
		}
		&[data-size='full-width'] {
			--font-size: var(--font-size-9xl);
			--line-height: var(--line-height-9xl);
			--border-radius: var(--border-radius-9xl);
			--padding: var(--padding-9xl);
			--min-width: 100%;
			--min-height: 240px;
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
		}
		&:not([data-loading='true'][data-loading-animation-style='style-1']) > * {
			/* padding-inline: var(--padding);
			padding-block: calc(var(--padding) / 2); */
		}
		--padding-input-left: var(--padding);
		&[data-has-leading] {
			--padding-input-left: 0px;
		}
		--padding-input-right: var(--padding);
		&[data-has-trailing] {
			--padding-input-right: 0px;
		}
		> input {
			@apply flex-1;
			max-width: 100%;
			border-radius: var(--border-radius);
			padding-left: var(--padding-input-left);
			padding-right: var(--padding-input-right);
			transition: all 0.3s ease-in-out;
			&:focus {
				outline: none;
			}
			&::placeholder {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
		}
		&[data-disabled='true'] {
			/* padding-inline: var(--padding);
			padding-block: calc(var(--padding) / 2); */
			opacity: var(--disabled-opacity);
			cursor: not-allowed;
		}
		.input-loading-icon {
			padding-inline: var(--padding);
		}
		&[data-loading='true'][data-loading-animation-style='style-1'] .input-loading-icon {
			animation: loading-style-1 calc(var(--loading-animation-duration) * 1ms) linear infinite;
			color: hsl(var(--primary));
		}

		@keyframes loading-style-1 {
			from {
				transform: rotate(0deg);
			}
			to {
				transform: rotate(360deg);
			}
		}
		&[data-loading='true'][data-loading-animation-style='style-2'] {
			position: relative;
			&::before {
				box-shadow: var(--box-shadow);
				content: '';
				position: absolute;
				bottom: 0px;
				left: 50%;
				width: 0%;
				height: var(--border-width);
				background: hsl(var(--primary));
				transform: translateX(-50%);
				animation: loading-style-2 calc(var(--loading-animation-duration) * 1ms) linear infinite;
			}
		}
		@keyframes loading-style-2 {
			from {
				width: 0%;
			}
			to {
				width: 100%;
			}
		}
		&[data-loading='true'][data-loading-animation-style='style-3'] {
			position: relative;
			&::before {
				content: '';
				position: absolute;
				top: 50%;
				left: 50%;
				width: calc(100% + var(--border-width));
				height: calc(100% + var(--border-width));
				z-index: -1;
				transform: translate(-50%, -50%);
				background: conic-gradient(
					hsl(var(--primary)) var(--process-deg),
					transparent var(--process-deg)
				);
				border-radius: var(--border-radius);
			}
			&::after {
				content: '';
				position: absolute;
				top: 0px;
				left: 0px;
				width: 100%;
				height: 100%;
				z-index: 0;
				background-color: var(--background-current);
			}
			:global(*) {
				position: relative;
				z-index: 1;
			}
		}
		&[data-focus='true'],
		&[data-hover='true'] {
			--color: hsl(var(--foreground));
			--border-color: hsl(var(--primary));
		}
		&[data-focus='false'],
		&[data-hover='false'] {
			--border-color: transparent;
		}
		&[data-is-invalid='true'] {
			--color: hsl(var(--danger-300));
			border-color: hsl(var(--color));
			&[data-focus='true'],
			&[data-hover='true'] {
				--color: hsl(var(--danger));
				border-color: hsl(var(--danger));
			}
		}
		&[data-is-invalid='false'] {
			--color: hsl(var(--success-300));
			border-color: hsl(var(--color));
			&[data-focus='true'],
			&[data-hover='true'] {
				--color: hsl(var(--success));
				border-color: hsl(var(--success));
			}
		}

		transition: all linear 0.3s;
		display: flex;
		align-items: center;
		border-radius: var(--border-radius);
		min-height: calc(var(--min-height) + var(--border-width) * 2);
		min-width: var(--min-width);
		font-size: var(--font-size);
		line-height: var(--line-height);
		max-width: 100%;
		background-color: var(--background-color);
		cursor: var(--cursor);
		opacity: var(--opacity);
		color: var(--color);
		border-style: solid;
		border-color: var(--border-color);
		border-width: var(--border-width);
		:global(.input-leading-icon) {
			padding-inline: var(--padding);
		}
	}
	.visual-cursor-animation {
		border-right: 1px solid white;
		animation: cursor-blink 0.1s linear infinite;
	}
	@keyframes cursor-blink {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	[data-loading='true'][data-loading-animation-style='style-4'] {
		position: relative;
		overflow: hidden;
		&::before {
			content: '';
			position: absolute;
			top: 0px;
			left: 0px;
			width: 100%;
			height: 100%;
			z-index: 1;
			background-image: -webkit-linear-gradient(
				left,
				transparent 0%,
				hsl(var(--background-invert)),
				transparent 100%
			);
			animation: shimper calc(var(--loading-animation-duration) * 1ms) linear infinite;
			opacity: 0.2;
		}
	}
	@keyframes shimper {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(100%);
		}
	}

	.input-visual-cursor {
		@apply flex-1 border-l border-solid border-black input-visual-cursor min-w-1 min-h-[var(--font-size)];
		animation: visual-cursor 1s ease-in-out infinite;
	}
	@keyframes visual-cursor {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	:global(html[data-theme='dark']) .input-visual-cursor {
		@apply border-white;
	}
	:root[data-theme='light'] {
		.input-root {
			&[data-is-invalid='true'] {
				--color: hsl(var(--danger-400));
				border-color: hsl(var(--color));
				&[data-focus='true'],
				&[data-hover='true'] {
					--color: hsl(var(--danger));
					border-color: hsl(var(--danger));
				}
			}
			&[data-is-invalid='false'] {
				--color: hsl(var(--success-400));
				border-color: hsl(var(--color));
				&[data-focus='true'],
				&[data-hover='true'] {
					--color: hsl(var(--success));
					border-color: hsl(var(--success));
				}
			}
		}
	}
</style>
