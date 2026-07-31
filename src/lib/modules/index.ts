import type { DistanceUnits, TimeUnits } from '$components/interface';
import type { Browser } from '$interfaces/basic';
import { client, profile } from '$store/basic.svelte';

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
let visualViewportLastSize: { height: number; width: number };
let startAt: number;
export function updateResizeWindow() {
	const WINDOW_RESIZE = 'window_resize';
	let delay = client.browser?.duration ?? 300;
	delay = typeof delay == 'number' ? delay : parseFloat(delay);
	const timeId = client.timeId.get(WINDOW_RESIZE);
	if (timeId) clearTimeout(timeId);
	client.timeId.set(
		WINDOW_RESIZE,
		setTimeout(() => {
			if (
				!visualViewportLastSize ||
				(visualViewport && visualViewport.height != visualViewportLastSize.height) ||
				(visualViewport && visualViewport.width == visualViewportLastSize.width)
			) {
				if (!startAt) startAt = performance.now();
				visualViewportLastSize = {
					height: visualViewport?.height ?? 0,
					width: visualViewport?.width ?? 0
				};
			} else {
				if (!profile.browser.safariBrowser) {
					profile.browser.safariBrowser = {
						visualKeyboardDurationShow: performance.now() - startAt
					};
				} else {
					profile.browser.safariBrowser.visualKeyboardDurationShow = performance.now() - startAt;
				}
			}
			if (profile.browser.dimensions) {
				profile.browser.dimensions.width = window.visualViewport?.width ?? 0;
				profile.browser.dimensions.height = window.visualViewport?.height ?? 0;
			} else {
				profile.browser.dimensions = {
					width: window.visualViewport?.width ?? 0,
					height: window.visualViewport?.height ?? 0
				};
			}
			client.updateMetaBrowser({
				width: window.visualViewport?.width ?? 0,
				height: window.visualViewport?.height ?? 0
			});
		}, delay)
	);

	// if (profile.visualKeyboard.isShow && !profile.visualKeyboard.height) {
	// 	profile.visualKeyboard.height = window.innerHeight - (profile.browser.dimensions.height ?? 0);
	// }
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
		return 'desktop/mac';
	}

	if (/linux/.test(ua)) {
		// ChromeOS thường có "cros" trong UA
		if (/cros/.test(ua)) {
			return 'desktop/chrome';
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
		defaultStyles?: string | (string | undefined)[];
		propStyles?: string | (string | undefined)[];
	},
	overwriteDefaultStyles = false
) {
	const { defaultStyles, propStyles } = params;
	const _defaultStyles =
		typeof defaultStyles == 'object'
			? defaultStyles.filter((item): item is string => !!item)
			: typeof defaultStyles == 'string'
				? [defaultStyles]
				: [];
	const _propsStyles =
		typeof propStyles == 'object'
			? propStyles.filter((item): item is string => !!item)
			: typeof propStyles == 'string'
				? [propStyles]
				: [];

	if (overwriteDefaultStyles) {
		return [...new Set(_defaultStyles.flatMap((item) => item.trim().split(/\s+/).filter(Boolean)))];
	} else {
		return [
			...new Set(_defaultStyles.flatMap((item) => item.trim().split(/\s+/).filter(Boolean))),
			...new Set(_propsStyles.flatMap((item) => item.trim().split(/\s+/).filter(Boolean)))
		];
	}
}
export function convertToMiliseconds(input?: TimeUnits): number | undefined {
	if (input) {
		return typeof input == 'number'
			? input
			: input.includes('ms')
				? parseFloat(input)
				: parseFloat(input) * 1000;
	}
	return undefined;
}
export function convertToPixels(input?: DistanceUnits): number | undefined {
	if (input) {
		const baseFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
		return typeof input == 'number'
			? input
			: input.includes('px')
				? parseFloat(input)
				: parseFloat(input) * baseFontSize;
	}
	return undefined;
}
export function measureTextWidth(text: string, referenceEl: HTMLElement): number {
	const mirror = document.createElement('span');
	mirror.style.position = 'absolute';
	mirror.style.visibility = 'hidden';
	mirror.style.whiteSpace = 'pre';
	// Copy font styles từ input thật để đo chính xác
	const computed = getComputedStyle(referenceEl);
	mirror.style.font = computed.font;
	mirror.style.letterSpacing = computed.letterSpacing;
	mirror.textContent = text || '';
	document.body.appendChild(mirror);
	const width = mirror.offsetWidth;
	mirror.remove();
	return width;
}
