import { browser } from '$app/environment';
import type { NumbericKey } from '$components/keyboard/numberic/_interface';
import type { AppTheme, Browser } from '$interfaces/basic';
import { detectBrowserType } from '$modules';
import type { SvelteComponent } from 'svelte';
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
			if (browser) return window.innerHeight / 3;
			return 0; //this._height;
		},
		set height(val) {
			this._height = val;
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
					window.innerHeight - refRect.bottom < profile.visualKeyboard.height &&
					bodyH - el.scrollTop < profile.visualKeyboard.height
				) {
					document.body.setAttribute('height-bu', document.body.style.getPropertyValue('height'));
					document.body.style.height = `${document.body.offsetHeight + (profile.visualKeyboard.height - (window.innerHeight - refRect.bottom))}px`;
					window.scrollTo({ top: document.body.offsetHeight, behavior: 'smooth' });
				} else if (
					window.innerHeight - refRect.bottom < profile.visualKeyboard.height &&
					bodyH - el.scrollTop > profile.visualKeyboard.height
				) {
					window.scrollTo({ top: el.scrollTop, behavior: 'smooth' });
				}
			}
		},
		input: null as null | ((input: string) => void)
	},
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
				return profile.clipboard.value;
			}
		},
		value: undefined as undefined | string | null
	}
});
