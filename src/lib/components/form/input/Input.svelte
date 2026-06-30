<script lang="ts">
	import { iconify } from '$assets/icons/iconify';
	import type { EventListener } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';
	import { profile } from '$store/basic.svelte';
	import Icon from '@iconify/svelte';
	import { Button, Tooltip } from '$components/element/index';
	import type { InputProps } from './_interface.ts';
	import { fade } from 'svelte/transition';
	import { copyToClipboard, pasteFromClipboard, watchClipboard } from '$modules';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { every } from 'es-toolkit/compat';
	import type { NumbericKey } from '$components/keyboard/numberic/_interface';
	import { getTextfieldCtx } from '../textField/index.ts';
	import { getFormContext } from '../form/index.ts';
	// import Numberic from '$components/keyboard/numberic/Numberic.svelte';
	// import { every, some } from 'es-toolkit/compat';

	let {
		value = $bindable(),
		loading = $bindable(),
		disabled = $bindable(),
		...props
	}: InputProps = $props();

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
				animationId: undefined as undefined | number
			},
			showClearBtn: false,
			get type() {
				return props.type ?? 'text';
			},
			get loadingAnimationStyle(): `style-${number}` | undefined {
				if (!loading) return undefined;
				return typeof props.loadingAnimation == 'string'
					? props.loadingAnimation
					: typeof props.loadingAnimation == 'object'
						? props.loadingAnimation.style
						: 'style-1';
			},
			get loadingAnimationDuration(): number | undefined {
				if (!loading) return undefined;
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
			showPassword: undefined as undefined | boolean
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
		event: {
			load: {
				handler(e, data) {
					if (data?.node instanceof HTMLElement) {
						const mutationObs = new MutationObserver(() => {
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
								if (configs.ref?.contains(profile.visualKeyboard.focusOn))
									configs.status.focus = true;
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

							// profile.visualKeyboard.focusOn = data.node;
							// profile.visualKeyboard.onKeyup = visualKbOnKeyup;
						}
						// function processFocus() {
						// 	if (
						// 		profile.browser.type &&
						// 		profile.browser.type.includes('mobile') &&
						// 		props.type == 'number' &&
						// 		!configs.status.focus
						// 	) {
						// 		configs.status.focus = true;
						// 		if (configs.status.timeId.animationId) {
						// 			cancelAnimationFrame(configs.status.timeId.animationId);
						// 			if (configs.ref) {
						// 				const refRect = configs.ref.getBoundingClientRect();
						// 				if (window.innerHeight - refRect.bottom < profile.visualKeyboard.height) {
						// 					document.body.setAttribute(
						// 						'height-bu',
						// 						document.body.style.getPropertyValue('height')
						// 					);
						// 					document.body.style.height = `${document.body.offsetHeight + (profile.visualKeyboard.height - (window.innerHeight - refRect.bottom))}px`;
						// 					window.scrollTo({ top: document.body.offsetHeight, behavior: 'smooth' });
						// 				}
						// 			}
						// 		}

						// 		configs.status.focusFirstTime = true;
						// 	}
						// }
						//if (props.focusAtStart && !configs.status.focusFirstTime) processFocus();
						return () => {
							mutationObs.disconnect();
							if (configs.status.timeId.animationId)
								cancelAnimationFrame(configs.status.timeId.animationId);
						};
					}
				}
			},
			get touchstart() {
				if (!profile.browser.type?.includes('mobile'))
					return {
						handler() {
							actionFocus();
							// configs.status.focus = true;
							// requestAnimationFrame(() => {
							// 	configs.input.ref?.focus();
							// });
						}
					};
				return {
					handler(e: MouseEvent) {
						if (
							props.type &&
							['phone', 'number'].includes(props.type) &&
							profile.visualKeyboard.height
						) {
							e.preventDefault();
							actionFocus();
							// configs.status.focus = true;
							// if (configs.ref) {
							// 	profile.visualKeyboard.focusOn = configs.ref;
							// 	profile.visualKeyboard.onKeyup = visualKbOnKeyup;
							// 	requestAnimationFrame(() => {
							// 		if (props.type == 'text') configs.input.ref?.focus();
							// 	});
							// }
						} else if (props.type && ['password'].includes(props.type)) {
							actionFocus();
						}
					}
				};
			}
		} as EventListener,
		input: {
			status: {
				openParen: undefined as undefined | number,
				previousValue: undefined as undefined | number | string,
				currentSelected: null as null | number
			},
			ref: undefined as undefined | HTMLElement,
			get style() {
				return ['input-input min-w-0 px-2  bg-transparent', defaults.input.style];
			},
			event: {
				load: {
					handler(e, data) {
						if (data?.node instanceof HTMLElement) {
							//data.node.focus();
							if (profile.browser.type?.includes('mobile')) profile.visualKeyboard.isShow = false;
						}
					}
				},
				focus: {
					handler() {
						configs.status.focus = true;
						if (textFieldCtx.onBlur) textFieldCtx.onBlur(configs.status.focus);
					}
				},
				// focus: {
				// 	handler() {
				// 		if (profile.browser.type?.includes('mobile')) {
				// 			profile.visualKeyboard.isShow = true;
				// 			function watchKb() {
				// 				if (profile.visualKeyboard.height && configs.status.timeId.animationId) {
				// 					cancelAnimationFrame(configs.status.timeId.animationId);
				// 					configs.input.ref?.blur();
				// 					configs.status.focus = true;
				// 				} else {
				// 					configs.status.timeId.animationId = requestAnimationFrame(watchKb);
				// 				}
				// 			}
				// 			configs.status.timeId.animationId = requestAnimationFrame(watchKb);
				// 			// setTimeout(() => {
				// 			// 	if (props.type == 'number' && configs.input.ref && profile.visualKeyboard.height) {
				// 			// 	}
				// 			// 	configs.input.ref.blur();
				// 			// 	configs.status.focus = true;
				// 			// }, 700);
				// 		}
				// 	}
				// },
				keyup: {
					handler() {
						if (configs.status.type == 'number' && value != undefined) {
							configs.input.status.openParen = value.toString().split('(').length;
						}
					}
				},
				get keydown() {
					if (configs.status.type == 'text')
						return {
							handler(e) {
								if (configs.input.ref) configs.input.ref.scrollLeft = configs.input.ref.clientWidth;
							}
						};
					if (configs.status.type == 'password')
						return {
							handler(e: KeyboardEvent) {
								if (e.key.toLowerCase() == 'backspace' && value) {
									const inputElement = e.target as HTMLInputElement;
									const currentSelection = inputElement.selectionStart;
									if (currentSelection) {
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
								if (notAllowKeysForPassword.includes(e.key)) return;
								if (!value) value = '';
								if (!configs.passwordMask) configs.passwordMask = '';
								value += e.key;
								configs.passwordMask += e.key;
								e.preventDefault();
								if (configs.input.ref) configs.input.ref.scrollLeft = configs.input.ref.clientWidth;
							}
						};
					if (configs.status.type == 'number')
						return {
							handler(e: KeyboardEvent) {
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
						};
					return undefined;
				},
				get blur() {
					if (configs.status.type != 'number' || profile.browser.type?.includes('desktop'))
						return {
							handler() {
								if (profile.browser.type?.includes('mobile') && profile.visualKeyboard.isShow)
									profile.visualKeyboard.isShow = false;
								configs.status.focus = false;
								if (props.type == 'number') calculatorString();
								if (textFieldCtx.onBlur) {
									textFieldCtx.onBlur(configs.status.focus);
								}
							}
						};
					return {
						handler() {
							requestAnimationFrame(() => {
								try {
									if (
										!configs.status.focus ||
										(configs.ref && configs.ref.contains(profile.visualKeyboard.focusOn))
									)
										return;
									if (profile.browser.type?.includes('mobile') && profile.visualKeyboard.isShow)
										profile.visualKeyboard.isShow = true;
									value = Function(
										`'use strict'; return (${value?.toString().replace('x', '*').replace(':', '/')})`
									)();
									configs.input.status.previousValue = value;
								} catch {
									if (configs.input.status.previousValue)
										value = configs.input.status.previousValue;
								}
							});
						}
					};
				}
			} as EventListener
		},
		clearBtn: {
			event: {
				touchstart: {
					handler() {
						value = undefined;
						if (props.type == 'password') {
							configs.passwordMask = '';
						}
						if (props.type == 'text' || profile.browser.type?.includes('desktop')) {
							actionFocus();
							// setTimeout(() => {
							// 	configs.input.ref?.focus();
							// 	configs.status.focus = true;
							// });
						}
					}
				}
			} as EventListener
		},
		copyBtn: {
			status: {
				copied: false
			},
			event: {
				touchstart: {
					async handler() {
						if (
							(typeof value == 'string' && value.length) ||
							(typeof value == 'number' && value != null)
						) {
							if (configs.input.ref) {
								configs.input.status.currentSelected = (
									configs.input.ref as HTMLInputElement
								).selectionStart;
							}
							configs.copyBtn.status.copied = await copyToClipboard(
								typeof value == 'number' ? value.toString() : value
							);
							disabled = true;
							if (configs.copyBtn.status.copied) {
								profile.clipboard.value = typeof value == 'number' ? value.toString() : value;
								requestAnimationFrame(() => {
									setTimeout(() => {
										configs.copyBtn.status.copied = false;
										disabled = undefined;
										requestAnimationFrame(() => {
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
												actionFocus();
											}
										});
									}, profile.delay);
								});
							}
						}
					},
					options: {
						get delay() {
							return profile.delay ?? 300;
						}
					}
				}
			} as EventListener
		},
		pasteBtn: {
			status: {
				hasData: false
			},
			event: {
				touchstart: {
					async handler() {
						actionFocus();
						// if (props.type == 'text' || profile.browser.type?.includes('desktop')) {
						// 	configs.status.focus = true;
						// 	configs.input.ref?.focus();
						// }
						const data = await navigator.clipboard.readText();
						if (data) {
							value = data;
							if (props.type == 'password') configs.passwordMask = value;
							if (configs.input.ref && props.type == 'text') {
								if (configs.input.status.currentSelected) {
									if (props.type == 'text') {
										actionFocus();
										// configs.status.focus = true;
										// configs.input.ref?.focus();
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
						}
					}
				}
			} as EventListener
		},
		showPasswordBtn: {
			event: {
				touchstart: {
					handler() {
						configs.status.focus = true;
						configs.status.showPassword = !configs.status.showPassword;
						setTimeout(() => {
							if (configs.input.ref) configs.input.ref.focus();
						}, 1000);
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
				//configs.virualInput.ref.focus();
			} else if ((e.target as HTMLElement).classList.contains('paste-btn')) {
				actionFocus();
				// if (props.type == 'text') {
				// 	configs.status.focus = true;
				// 	configs.input.ref?.focus();
				// }
			}
			// configs.virualInput.ref.focus();
			// if ((e.target as HTMLElement).classList.contains('paste-btn')) {
			// 	configs.input.ref?.focus();
			// }
		}
		if (textFieldCtx && textFieldCtx.ref?.contains(e.target as HTMLElement) && !disabled) {
			//actionFocus();
			// configs.status.focus = true;
			// configs.input.ref?.focus();
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
				if (textFieldCtx.onblur) textFieldCtx.onblur(configs.status.focus);
		}

		//configs.input.ref?.focus();
		configs.input.ref?.scrollTo({ left: configs.input.ref.scrollWidth, behavior: 'smooth' });
	}
	function calculatorString() {
		requestAnimationFrame(() => {
			try {
				if (profile.browser.type?.includes('mobile') && profile.visualKeyboard.isShow)
					profile.visualKeyboard.isShow = true;
				value = Function(
					`'use strict'; return (${value?.toString().replace('x', '*').replace(':', '/')})`
				)();
				configs.input.status.previousValue = value;
				configs.status.focus = false;
				if (textFieldCtx.onBlur) textFieldCtx.onBlur(configs.status.focus);
			} catch {
				if (configs.input.status.previousValue) value = configs.input.status.previousValue;
			}
		});
	}
	function actionFocus() {
		if (disabled || !browser) return;
		configs.status.focus = true;
		// if (configs.status.timeId.animationId) cancelAnimationFrame(configs.status.timeId.animationId);
		// configs.status.timeId.animationId = requestAnimationFrame(() => {
		if (profile.browser.type?.includes('mobile') && props.type == 'number' && configs.ref) {
			profile.visualKeyboard.focusOn = configs.ref;
			profile.visualKeyboard.onKeyup = visualKbOnKeyup;
		}
		if (configs.input.ref) {
			configs.input.ref.focus();
		}
		// });
	}
	function actionBlur() {
		if (configs.input.ref) {
			configs.input.ref.dispatchEvent(new Event('blur'));
			configs.input.ref.blur();
		}
	}

	const textFieldCtx = getTextfieldCtx();
	const formCtx = getFormContext();
	if (textFieldCtx.onFocus) {
		textFieldCtx.onFocus('input', actionFocus);
	}

	$effect(() => {
		if (loading) {
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
		// if (textFieldCtx.status?.focus && !disabled) {
		// 	configs.status.focus = true;
		// 	if (profile.browser.type?.includes('desktop') && configs.input.ref) {
		// 		requestAnimationFrame(() => {
		// 			configs.input.ref?.focus();
		// 		});
		// 	}
		// }
		// if (configs.status.focus && configs.ref && !props.focusAtStart) {
		// 	const refRect = configs.ref.getBoundingClientRect();
		// 	if (window.innerHeight - refRect.bottom < profile.visualKeyboard.height) {
		// 		document.body.setAttribute('height-bu', document.body.style.getPropertyValue('height'));
		// 		document.body.style.height = `${document.body.offsetHeight + (profile.visualKeyboard.height - (window.innerHeight - refRect.bottom))}px`;
		// 		window.scrollTo({
		// 			top: profile.visualKeyboard.height - (window.innerHeight - refRect.bottom),
		// 			behavior: 'smooth'
		// 		});
		// 	}
		// } else if (!configs.status.focus) {
		// 	document.body.style.height = `${document.body.getAttribute('height-bu')}px`;
		// 	document.body.removeAttribute('height-bu');
		// }
	});
	onMount(async () => {
		window.addEventListener('click', autoFocus);

		watchClipboard((e) => {
			configs.pasteBtn.status.hasData = e;
		});
		profile.clipboard.value = await pasteFromClipboard();
		if (props.showPassword && props.type == 'password')
			configs.status.showPassword = props.showPassword;
	});
	onDestroy(() => {
		if (browser) {
			window.removeEventListener('click', autoFocus);
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	data-variant={props.variant ?? 'primary'}
	data-size={props.size ?? textFieldCtx.size ?? formCtx.size ?? 'md'}
	data-disabled={disabled}
	data-loading={loading && !configs.status.focus}
	data-loading-animation-style={configs.status.loadingAnimationStyle}
	data-is-invalid={textFieldCtx.isInvalid}
	data-focus={configs.status.focus}
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
									handler(e) {
										if (!textFieldCtx.ref?.contains(e.target)) {
											actionBlur();
										}
										if (
											configs.ref &&
											!configs.ref.contains(e.target) &&
											profile.visualKeyboard.ref &&
											!profile.visualKeyboard.ref.contains(e.target) &&
											configs.ref.contains(profile.visualKeyboard.focusOn) &&
											textFieldCtx.ref &&
											!textFieldCtx.ref.contains(e.target) &&
											props.type == 'number'
										) {
											if (configs.input.ref) {
												//configs.input.ref.dispatchEvent(new Event('blur'));
											}
											calculatorString();
											profile.visualKeyboard.focusOn = null;
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
	{#if loading && configs.status.loadingAnimationStyle == 'style-1'}
		<div transition:fade={profile.transition.templates.fade} class="input-loading-icon">
			<Icon icon={iconify.loading} />
		</div>
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
					{ events: [configs.event, configs.input.event] },
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
					{ events: [configs.event, configs.input.event] },
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
				class="aspect-square z-[9999] relative"
				color="danger"
				size={props.size ?? textFieldCtx.size ?? formCtx.size ?? 'md'}
				icon={iconify['close-rounded']}
				variant="light"
				events={{ events: [configs.clearBtn.event] }}
			/>
		{/if}
	{:else}
		<span>{value ? value : props.placeholder}</span>
	{/if}
	{#if value != undefined}
		<Button
			class="aspect-square copy-btn z-10 relative"
			color="success"
			size={props.size ?? textFieldCtx.size ?? formCtx.size ?? 'md'}
			icon={configs.copyBtn.status.copied
				? iconify['check-rounded']
				: iconify['content-copy-outline-rounded']}
			variant="light"
			events={{ events: [configs.copyBtn.event] }}
		/>
	{/if}
	{#if ((typeof value == 'number' && value == null) || (typeof value == 'string' && !value.length) || !value) && profile.clipboard.status.hasData}
		<Button
			class="aspect-square paste-btn z-10 relative"
			color="success"
			size={props.size ?? textFieldCtx.size ?? formCtx.size ?? 'md'}
			icon={iconify['content-paste-rounded']}
			variant="light"
			events={{ events: [configs.pasteBtn.event] }}
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
					size={props.size ?? textFieldCtx.size ?? formCtx.size ?? 'md'}
					icon={configs.status.showPassword
						? iconify['password-2-off-rounded']
						: iconify['password-2-rounded']}
					variant="light"
					events={{ events: [configs.showPasswordBtn.event] }}
					alt={profile.browser.type?.includes('mobile')
						? `${configs.status.showPassword ? 'Show' : 'Hidden'} Password`
						: undefined}
				/>
			</Tooltip.Trigger>
		</Tooltip.Provider>
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
				box-shadow: var(--box-shadow);
			}
		}
	}

	.input-root {
		--color: hsl(var(--foreground));
		&[data-disabled] {
			--cursor: not-allowed;
			--opacity: var(--disabled-opacity);
			position: relative;
			padding-inline: var(--padding);
			padding-block: calc(var(--padding) / 2);
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
			--background-color: hsl(var(--field-background));
			--shadow-color: hsl(var(--primary));
		}
		&[data-variant='secondary'] {
			--background-color: hsl(var(--default));
			--shadow-color: hsl(var(--secondary));
		}
		&[data-size='xs'] {
			--font-size: var(--font-size-xs);
			--line-height: var(--line-height-xs);
			--border-radius: var(--border-radius-xs);
			--padding: var(--padding-xs);
			--min-width: var(--min-width-xs);
			--min-height: 28px;
			--border-width: 1px;
			--box-shadow: 0 1px 2px 0 var(--shadow-color);
		}
		&[data-size='sm'] {
			--font-size: var(--font-size-sm);
			--line-height: var(--line-height-sm);
			--border-radius: var(--border-radius-sm);
			--padding: var(--padding-sm);
			--min-width: var(--min-width-sm);
			--min-height: 40px;
			--border-width: 2px;
			--box-shadow: 0 1px 3px 0 var(--shadow-color), 0 1px 2px -1px var(--shadow-color);
		}
		&[data-size='md'] {
			--font-size: var(--font-size-md);
			--line-height: var(--line-height-md);
			--border-radius: var(--border-radius-md);
			--padding: var(--padding-md);
			--min-width: var(--min-width-md);
			--min-height: 48px;
			--border-width: 3px;
			--box-shadow: 0 4px 6px -1px var(--shadow-color), 0 2px 4px -2px var(--shadow-color);
		}
		&[data-size='lg'] {
			--font-size: var(--font-size-lg);
			--line-height: var(--line-height-lg);
			--border-radius: var(--border-radius-lg);
			--padding: var(--padding-lg);
			--min-width: var(--min-width-lg);
			--min-height: 58px;
			--box-shadow: 0 10px 15px -3px var(--shadow-color), 0 4px 6px -4px var(--shadow-color);
		}
		&[data-size='xl'] {
			--font-size: var(--font-size-xl);
			--line-height: var(--line-height-xl);
			--border-radius: var(--border-radius-xl);
			--padding: var(--padding-xl);
			--min-width: var(--min-width-xl);
			--min-height: 68px;
			--box-shadow: 0 20px 25px -5px var(--shadow-color), 0 8px 10px -6px var(--shadow-color);
		}
		&[data-size='2xl'] {
			--font-size: var(--font-size-2xl);
			--line-height: var(--line-height-2xl);
			--border-radius: var(--border-radius-2xl);
			--padding: var(--padding-2xl);
			--min-width: var(--min-width-2xl);
			--min-height: 80px;
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
		}
		&[data-size='3xl'] {
			--font-size: var(--font-size-3xl);
			--line-height: var(--line-height-3xl);
			--border-radius: var(--border-radius-3xl);
			--padding: var(--padding-3xl);
			--min-width: var(--min-width-3xl);
			--min-height: 94px;
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
		}
		&[data-size='4xl'] {
			--font-size: var(--font-size-4xl);
			--line-height: var(--line-height-4xl);
			--border-radius: var(--border-radius-4xl);
			--padding: var(--padding-4xl);
			--min-width: var(--min-width-4xl);
			--min-height: 108px;
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
		}
		&[data-size='5xl'] {
			--font-size: var(--font-size-5xl);
			--line-height: var(--line-height-5xl);
			--border-radius: var(--border-radius-5xl);
			--padding: var(--padding-5xl);
			--min-width: var(--min-width-5xl);
			--min-height: 128px;
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
		}
		&[data-size='6xl'] {
			--font-size: var(--font-size-6xl);
			--line-height: var(--line-height-6xl);
			--border-radius: var(--border-radius-6xl);
			--padding: var(--padding-6xl);
			--min-width: var(--min-width-6xl);
			--min-height: 148px;
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
		}
		&[data-size='7xl'] {
			--font-size: var(--font-size-7xl);
			--line-height: var(--line-height-7xl);
			--border-radius: var(--border-radius-7xl);
			--padding: var(--padding-7xl);
			--min-width: var(--min-width-7xl);
			--min-height: 168px;
		}
		&[data-size='8xl'] {
			--font-size: var(--font-size-8xl);
			--line-height: var(--line-height-8xl);
			--border-radius: var(--border-radius-8xl);
			--padding: var(--padding-8xl);
			--min-width: var(--min-width-9xl);
			--min-height: 200px;
			--box-shadow: 0 25px 50px -12px var(--shadow-color);
		}
		&[data-size='9xl'] {
			--font-size: var(--font-size-9xl);
			--line-height: var(--line-height-9xl);
			--border-radius: var(--border-radius-9xl);
			--padding: var(--padding-9xl);
			--min-width: var(--min-width-9xl);
			--min-height: 240px;
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
		&:not([data-loading='true'][data-loading-animation-style='style-1']) > input {
			padding-inline: var(--padding);
			padding-block: calc(var(--padding) / 2);
		}
		> input {
			max-width: 100%;
			border-radius: var(--border-radius);

			&:focus {
				outline: none;
			}
			&::placeholder {
			}
		}
		&[data-disabled='true'] {
			padding-inline: var(--padding);
			padding-block: calc(var(--padding) / 2);
			opacity: var(--disabled-opacity);
			cursor: not-allowed;
		}
		&[data-loading='true'][data-loading-animation-style='style-1'] .input-loading-icon {
			padding-inline: var(--padding);
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
		&[data-is-invalid='true'] {
			--color: hsl(var(--danger-100));
			border-color: hsl(var(--danger-100));
			&[data-focus='true'] {
				--color: hsl(var(--danger));
				border-color: hsl(var(--danger));
			}
		}
		&[data-is-invalid='false'] {
			--color: hsl(var(--success-100));
			border-color: hsl(var(--success-100));
			&[data-focus='true'] {
				--color: hsl(var(--success));
				border-color: hsl(var(--success));
			}
		}
		&[data-focus='true'] {
			border-color: hsl(var(--primary));
		}
		transition: all linear 0.3s;
		display: flex;
		align-items: center;
		border-radius: var(--border-radius);
		min-height: var(--min-height);
		min-width: var(--min-width);
		font-size: var(--font-size);
		line-height: var(--line-height);
		max-width: 100%;
		background-color: var(--background-color);
		cursor: var(--cursor);
		opacity: var(--opacity);
		color: var(--color);
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
</style>
