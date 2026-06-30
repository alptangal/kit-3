import type { Browser } from '$interfaces/basic';
import { profile } from '$store/basic.svelte';

export async function copyToClipboard(content: string) {
	try {
		await navigator.clipboard.writeText(content);
		return true;
	} catch {
		if (profile.browser.type?.includes('mobile')) {
			localStorage.setItem('clipboard', content);
		} else {
			const el = document.createElement('textarea');
			el.value = content;
			el.style.position = 'fixed';
			el.style.opacity = '0';
			document.body.appendChild(el);
			el.select();
			document.execCommand('copy');
			document.body.removeChild(el);
		}
		return true;
	}
}
export async function pasteFromClipboard() {
	try {
		return await navigator.clipboard.readText();
	} catch {
		if (profile.browser.type?.includes('mobile')) {
			return localStorage.getItem('clipboard');
		}
		return null;
	}
}
export function watchClipboard(callback: (status: boolean, data: string | null) => void) {
	let lastText = '';

	async function check() {
		try {
			const text = await navigator.clipboard.readText();
			if (text !== lastText) {
				lastText = text;
				callback(text.length > 0, text);
			}
		} catch {
			callback(false, null);
		}
	}

	// Check mỗi khi user focus lại tab
	window.addEventListener('focus', check);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') check();
	});

	check(); // Check lần đầu

	return () => {
		window.removeEventListener('focus', check);
		document.removeEventListener('visibilitychange', check);
	};
}
export function updateResizeWindow() {
	if (profile.browser.dimensions) {
		profile.browser.dimensions.width = window.visualViewport?.width ?? 0;
		profile.browser.dimensions.height = window.visualViewport?.height ?? 0;
	} else {
		profile.browser.dimensions = {
			width: window.visualViewport?.width ?? 0,
			height: window.visualViewport?.height ?? 0
		};
	}
	if (profile.visualKeyboard.isShow && !profile.visualKeyboard.height) {
		profile.visualKeyboard.height = window.innerHeight - (profile.browser.dimensions.height ?? 0);
	}
}
export function detectBrowserType(userAgent: string, maxTouchPoints = 0): Browser['type'] {
	const ua = userAgent.toLowerCase();

	// Mobile detection (phải check trước desktop)
	const isMobile = /mobile|android|iphone|ipad|ipod/.test(ua);
	if (/macintosh/.test(ua) && maxTouchPoints > 1) {
		return 'mobile/ios';
	}
	if (isMobile) {
		// iOS: iPhone, iPad, iPod
		if (/iphone|ipad|ipod/.test(ua)) {
			return 'mobile/ios';
		}
		// Android mobile
		if (/android/.test(ua)) {
			return 'mobile/android';
		}
	}

	// Desktop OS detection
	if (/macintosh|mac os x/.test(ua) && !/mobile/.test(ua)) {
		return 'desktop/macos';
	}

	if (/linux/.test(ua)) {
		// ChromeOS thường có "cros" trong UA
		if (/cros/.test(ua)) {
			return 'desktop/chromeos';
		}
		return 'desktop/linux';
	}

	if (/windows/.test(ua)) {
		return 'desktop/window';
	}

	return undefined;
}
export function styleSynced(
	params: {
		defaultStyles?: string | string[];
		propStyles?: string | string[];
	},
	overwriteDefaultStyles = false
) {
	const { defaultStyles, propStyles } = params;
	const _defaultStyles =
		typeof defaultStyles == 'object'
			? defaultStyles
			: typeof defaultStyles == 'string'
				? [defaultStyles]
				: [];
	const _propsStyles =
		typeof propStyles == 'object' ? propStyles : typeof propStyles == 'string' ? [propStyles] : [];

	if (overwriteDefaultStyles) {
		return _propsStyles;
	} else {
		return [..._defaultStyles, ..._propsStyles];
	}
}
