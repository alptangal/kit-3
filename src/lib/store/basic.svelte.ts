import { browser } from '$app/environment';
import type { NumbericKey } from '$components/keyboard/numberic_old/_interface';
import type { AppTheme, Browser, MetaBrowser, MetaUser, Screen } from '$interfaces/basic';
import { convertToMiliseconds, detectBrowserType } from '$modules';
import type { SvelteComponent } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import type { FlyParams } from 'svelte/transition';

export const profile = $state({
	timeId: {
		theme: {
			timeOut: null as null | NodeJS.Timeout,
			requestAnimation: null as null | number
		}
	},
	visualKeyboard: {
		component: null as null | SvelteComponent,
		get ref() {
			if (this.component) return this.component.configs.ref;
			return undefined;
		},
		timeId: {
			requestAnimation: null as null | number
		},
		isShow: false,
		_height: null as null | number,
		get height() {
			if (browser && !this._height) return (visualViewport?.height ?? 0) / 3;
			return this._height;
		},
		hasHeightValue: false,
		set height(val) {
			if (val && val > 0) {
				this._height = val;
				this.hasHeightValue = true;
			}
		},
		_focusOn: null as null | HTMLElement,
		get focusOn() {
			return this._focusOn;
		},
		set focusOn(el) {
			if (!el) {
				document.body.style.height = `${document.body.getAttribute('height-bu')}px`;
				document.body.removeAttribute('height-bu');
				this._focusOn = null;
			} else {
				if (profile.visualKeyboard.timeId.requestAnimation) {
					cancelAnimationFrame(profile.visualKeyboard.timeId.requestAnimation);
				}
				profile.visualKeyboard.timeId.requestAnimation = requestAnimationFrame(() => {
					this._focusOn = el;
					this.processFocus(el);
					if (this.fallbackFocusOn) this.fallbackFocusOn();
				});
			}
		},
		fallbackFocusOn: null as null | (() => void),
		onKeyup: undefined as undefined | ((val: NumbericKey) => void),
		processFocus: (el: HTMLElement) => {
			if (profile.browser.type && profile.browser.type.includes('mobile')) {
				const refRect = el.getBoundingClientRect();

				const bodyH = document.body.scrollHeight;
				setTimeout(() => {
					el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
				}, profile.delay);
				if (
					profile.visualKeyboard.height &&
					window.innerHeight - refRect.bottom < profile.visualKeyboard.height &&
					bodyH - el.scrollTop < profile.visualKeyboard.height
				) {
					document.body.setAttribute('height-bu', document.body.style.getPropertyValue('height'));
					document.body.style.height = `${document.body.offsetHeight + (profile.visualKeyboard.height ?? 0 - (window.innerHeight - refRect.bottom))}px`;
					window.scrollTo({ top: document.body.offsetHeight, behavior: 'smooth' });
				} else if (
					profile.visualKeyboard.height &&
					window.innerHeight - refRect.bottom < profile.visualKeyboard.height &&
					bodyH - el.scrollTop > profile.visualKeyboard.height
				) {
					window.scrollTo({ top: el.scrollTop, behavior: 'smooth' });
				}
			}
		},
		input: null as null | ((input: string) => void)
	},
	screen: {
		height: null,
		width: null
	} as Screen,
	browser: {
		userAgent: undefined as undefined | string,
		get type() {
			if (profile.browser.userAgent) return detectBrowserType(profile.browser.userAgent);
			return undefined;
		}
	} as Browser,
	_theme: null as null | AppTheme,
	get preferSchemaColor(): 'dark' | 'light' {
		if (!browser) return 'light';
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	},
	get theme() {
		let th: AppTheme;
		if (!browser) return 'system';
		if (
			!this._theme &&
			localStorage.getItem('theme') &&
			['system', 'dark', 'light'].includes(localStorage.getItem('theme') ?? '')
		) {
			th = localStorage.getItem('theme') as AppTheme;
		} else if (!this._theme) {
			th = 'system';
		} else {
			th = this._theme;
		}
		localStorage.setItem('theme', th);
		if (th == 'system') {
			document.documentElement.setAttribute(
				'data-theme',
				window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
			);
		} else {
			document.documentElement.setAttribute('data-theme', th);
		}
		const bodyBackgroundColor = getComputedStyle(document.body).backgroundColor;
		const themeMetaTag = document.getElementById('themeMetaTag');
		if (bodyBackgroundColor && themeMetaTag) {
			themeMetaTag.setAttribute('content', bodyBackgroundColor);
		}
		if (!this._theme) document.body.style.background = `hsl(var(--background))`;
		return th;
	},
	set theme(val: AppTheme) {
		this._theme = val;
		localStorage.setItem('theme', val);
		profile.preferColor =
			val != 'system'
				? val
				: window.matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light';
		document.documentElement.setAttribute('data-theme', val);
		const startAt = performance.now();
		const duration = profile.delay ?? 300;
		function animationTheme() {
			const currentTime = performance.now();
			const percent = ((currentTime - startAt) * 100) / duration;
			document.body.style.background = `radial-gradient(circle at ${profile.cursor.x}px ${profile.cursor.y}px, hsl(var(--background)) ${Math.min(percent, 100)}%,hsl(var(--background-invert)) )`;
			if (Math.min(percent, 100) == 100 && profile.timeId.theme.requestAnimation) {
				cancelAnimationFrame(profile.timeId.theme.requestAnimation);
			} else {
				profile.timeId.theme.requestAnimation = requestAnimationFrame(animationTheme);
			}
		}
		if (profile.timeId.theme.requestAnimation)
			cancelAnimationFrame(profile.timeId.theme.requestAnimation);
		profile.timeId.theme.requestAnimation = requestAnimationFrame(animationTheme);
		const themeMetaTag = document.getElementById('themeMetaTag');
		if (themeMetaTag) {
			requestAnimationFrame(() => {
				const bodyBackgroundColor = getComputedStyle(document.body).backgroundColor;
				themeMetaTag.setAttribute('content', bodyBackgroundColor);
			});
		}
	},
	preferColor: 'dark' as AppTheme,
	cursor: {
		x: 0,
		y: 0
	},
	/** duration in miliseconds */
	delay: 300,
	transition: {
		classString: 'transition-all ease-in-out',
		templates: {
			flyX: {
				x: 30,
				get duration() {
					return profile.delay;
				}
			} as FlyParams,
			flyXReverse: {
				x: -30,
				get duration() {
					return profile.delay;
				}
			} as FlyParams,
			flyY: {
				y: 30,
				get duration() {
					return profile.delay;
				}
			} as FlyParams,
			flyYReverse: {
				y: -30,
				get duration() {
					return profile.delay;
				}
			} as FlyParams,
			fade: {
				get duration() {
					return profile.delay;
				}
			}
		},
		get duration() {
			return profile.delay ?? 300;
		}
	},
	clipboard: {
		status: {
			get hasData() {
				if (browser) return profile.clipboard.value ?? localStorage.getItem('clipboard');
				return false;
			}
		},
		value: undefined as undefined | string | null
	},
	visualNodes: {
		input: {
			ref: undefined as undefined | HTMLInputElement
		}
	}
});

class User {
	private _browser = $state<MetaBrowser | undefined>(undefined);
	private _user = $state<undefined | MetaUser>(undefined);
	timeId: Map<string | symbol, number | NodeJS.Timeout>;

	constructor() {
		this._browser = {
			language: 'en',
			duration: '300ms',
			get delay() {
				if (!this.duration) return 0;
				return typeof this.duration == 'number'
					? this.duration
					: typeof this.duration == 'string' && this.duration.includes('ms')
						? parseFloat(this.duration)
						: parseFloat(this.duration) * 10;
			},
			set delay(val) {
				this.duration = val;
			},
			get preferColor() {
				if (!browser) return 'light';
				return this.theme == 'system' || !this.theme
					? window.matchMedia('(prefers-color-scheme: dark)').matches
						? 'dark'
						: 'light'
					: this.theme;
			},
			layers: new SvelteMap(),
			transition: {
				fly: {
					get duration() {
						return convertToMiliseconds(client._browser?.duration ?? 300);
					},
					x: 30,
					y: 30
				},
				fade: {
					get duration() {
						return convertToMiliseconds(client._browser?.duration ?? 300);
					}
				}
			}
		};
		this.timeId = new SvelteMap();
		$effect.root(() => {
			$effect(() => {
				this._browser?.theme;
				this.syncMetaTheme();
			});
		});
	}
	get browser() {
		return this._browser;
	}
	set browser(meta) {
		this._browser = { ...this._browser, ...meta };
	}
	updateMetaBrowser(meta: MetaBrowser) {
		this._browser = { ...this._browser, ...meta };
		this.syncMetaTheme();
	}
	private syncMetaTheme() {
		let themeChanged = false;
		if (
			this._browser &&
			this._browser.theme &&
			this._browser.theme != localStorage.getItem('theme')
		) {
			localStorage.setItem('theme', this._browser.theme);
			themeChanged = true;
		}
		if (
			!document.documentElement.getAttribute('data-theme') ||
			!document.documentElement.getAttribute('data-prefer-color') ||
			themeChanged
		) {
			if (!this._browser || !this._browser.theme) return;
			document.documentElement.setAttribute('data-theme', this._browser.theme);
			document.documentElement.setAttribute(
				'data-prefer-color',
				this._browser.theme == 'system'
					? window.matchMedia('(prefers-color-scheme: dark)').matches
						? 'dark'
						: 'light'
					: this._browser.theme
			);
		}
	}
	createInputVisual(): HTMLInputElement {
		if (this.browser?.visualInput) return this.browser.visualInput;
		const inputEl = document.createElement('input');
		inputEl.style.position = 'fixed';
		inputEl.style.zIndex = '-1';
		inputEl.style.width = '.1px';
		inputEl.style.height = '.1px';
		inputEl.style.bottom = '0';
		inputEl.style.left = '0';
		document.body.appendChild(inputEl);
		if (!this.browser) this.browser = {};
		this.browser.visualInput = inputEl;
		return this.browser.visualInput;
	}
	async getVisualKeyboardMeta() {
		if (!this.browser?.visualInput) return undefined;
		if (this.browser.visualKeyboard) return this.browser.visualKeyboard;
		let result: boolean = false;

		function resize() {
			if (!visualViewport) return;
			if (!client.browser) client.browser = {};
			if (!client.browser.originalResolution)
				client.browser.originalResolution = {
					width: window.innerWidth,
					height: window.innerHeight
				};
			client.browser.visualKeyboard = {
				width: client.browser.originalResolution.width,
				height: client.browser.originalResolution.height - visualViewport.height
			};
			client.browser.visualInput?.blur();
			result = true;
			visualViewport?.removeEventListener('resize', resize);
		}
		visualViewport?.addEventListener('resize', resize);

		this.browser.visualInput.focus();

		return new Promise<void>((resolve) => {
			function tes() {
				if (result) {
					resolve();
				} else {
					requestAnimationFrame(tes);
				}
			}
			tes();
		});
	}
}
export const client = new User();
