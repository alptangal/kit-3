import { browser } from '$app/environment';
import type { NumbericKey } from '$components/keyboard/numberic_old/_interface';
import type { SvelteComponent } from 'svelte';

/**
 * Task 5: Extract profile.visualKeyboard (basic.svelte.ts:23-93) thành hook.
 * Shape + reactivity bảo toàn — profile.visualKeyboard là alias của hook return.
 * height/focusOn là ACCESSOR properties (get/set) như block gốc — consumer đọc
 * `visualKeyboard.height` nhận number, không phải object.
 * KHÔNG import profile (tránh circular) — browser type + delay truyền qua getter closures.
 */
export function useVisualKeyboard(options: {
	/** () => browser type string — đọc từ profile.browser.type của caller (tránh circular import) */
	getBrowserType: () => string | undefined;
	/** scroll delay (ms) — profile.delay của caller */
	getDelay: () => number | undefined;
}) {
	// === inner timeId (block gốc L29-31: timeId lồng trong visualKeyboard, không phải profile.timeId) ===
	const timeId = { requestAnimation: null as null | number };

	// === reactive fields (giữ reactivity như khi nằm trong profile $state) ===
	let component = $state<null | SvelteComponent>(null);
	let isShow = $state(false);
	let _height = $state<null | number>(null);
	let hasHeightValue = $state(false);
	let _focusOn = $state<null | HTMLElement>(null);

	// === plain fields (không reactive — như block gốc) ===
	let fallbackFocusOn: null | (() => void) = null;
	let onKeyup: undefined | ((val: NumbericKey) => void) = undefined;
	let input: null | ((input: string) => void) = null;

	// block gốc L34-37 — height getter dùng chung cho processFocus + accessor trả về
	function getHeight(): number | null {
		if (browser && !_height) return (visualViewport?.height ?? 0) / 3;
		return _height;
	}

	function processFocus(el: HTMLElement) {
		// block gốc L67-91 — mobile scroll compensation
		if (options.getBrowserType()?.includes('mobile')) {
			const refRect = el.getBoundingClientRect();

			const bodyH = document.body.scrollHeight;
			setTimeout(() => {
				el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
			}, options.getDelay());
			if (
				getHeight() &&
				window.innerHeight - refRect.bottom < getHeight()! &&
				bodyH - el.scrollTop < getHeight()!
			) {
				document.body.setAttribute('height-bu', document.body.style.getPropertyValue('height'));
				document.body.style.height = `${document.body.offsetHeight + (getHeight() ?? 0 - (window.innerHeight - refRect.bottom))}px`;
				window.scrollTo({ top: document.body.offsetHeight, behavior: 'smooth' });
			} else if (
				getHeight() &&
				window.innerHeight - refRect.bottom < getHeight()! &&
				bodyH - el.scrollTop > getHeight()!
			) {
				window.scrollTo({ top: el.scrollTop, behavior: 'smooth' });
			}
		}
	}

	return {
		get component() { return component; },
		set component(v: null | SvelteComponent) { component = v; },
		// block gốc L25-28
		get ref() {
			if (component) return (component as unknown as { configs: { ref?: HTMLElement } }).configs?.ref;
			return undefined;
		},
		get isShow() { return isShow; },
		set isShow(v: boolean) { isShow = v; },
		// block gốc L34-44 — accessor property: đọc trả number|null, ghi invoke setter
		get height(): number | null {
			return getHeight();
		},
		set height(val: number) {
			if (val && val > 0) {
				_height = val;
				hasHeightValue = true;
			}
		},
		get hasHeightValue() { return hasHeightValue; },
		// block gốc L45-64 — accessor property; inner timeId qua closure
		get focusOn(): HTMLElement | null { return _focusOn; },
		set focusOn(el: HTMLElement | null) {
			if (!el) {
				document.body.style.height = `${document.body.getAttribute('height-bu')}px`;
				document.body.removeAttribute('height-bu');
				_focusOn = null;
			} else {
				if (timeId.requestAnimation) {
					cancelAnimationFrame(timeId.requestAnimation);
				}
				timeId.requestAnimation = requestAnimationFrame(() => {
					_focusOn = el;
					processFocus(el);
					if (fallbackFocusOn) fallbackFocusOn();
				});
			}
		},
		get fallbackFocusOn() { return fallbackFocusOn; },
		set fallbackFocusOn(v: null | (() => void)) { fallbackFocusOn = v; },
		get onKeyup() { return onKeyup; },
		set onKeyup(v: undefined | ((val: NumbericKey) => void)) { onKeyup = v; },
		processFocus,
		get input() { return input; },
		set input(v: null | ((input: string) => void)) { input = v; }
	};
}
