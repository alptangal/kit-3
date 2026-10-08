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

	// block gốc L34-37 — height getter dùng chung cho processFocus + accessor trả về.
	// Chưa có giá trị đo (meta) → fallback 1/3 viewport (visualViewport.height) —
	// xấp xỉ chiều cao keyboard trên thiết bị di động.
	function getHeight(): number | null {
		if (browser && !_height) return (visualViewport?.height ?? 0) / 3;
		return _height;
	}

	function processFocus(el: HTMLElement) {
		// block gốc L67-91 — mobile scroll compensation
		if (!options.getBrowserType()?.includes('mobile')) return;
		const refRect = el.getBoundingClientRect();
		const bodyH = document.body.scrollHeight;
		const kbH = getHeight();
		if (!kbH) return;
		setTimeout(() => {
			el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
		}, options.getDelay());
		// Input gần đáy viewport (keyboard sẽ che) — đền bù theo khoảng thân trang
		// còn cuộn được. Cả 2 nhánh dưới chung điều kiện này (block gốc lặp 2 lần).
		if (window.innerHeight - refRect.bottom >= kbH) return;
		if (bodyH - el.scrollTop < kbH) {
			// Ít chỗ cuộn phía dưới input: nới body thêm phần keyboard lộ ra +
			// cuộn xuống đáy. Backup height gốc 1 LẦN (focus phím sau không đè
			// backup bằng giá trị đã nới — restore vẫn về đúng mốc ban đầu).
			if (!document.body.hasAttribute('height-bu')) {
				document.body.setAttribute('height-bu', document.body.style.height);
			}
			document.body.style.height = `${
				document.body.offsetHeight + kbH - (window.innerHeight - refRect.bottom)
			}px`;
			window.scrollTo({ top: document.body.offsetHeight, behavior: 'smooth' });
		} else if (bodyH - el.scrollTop > kbH) {
			// Còn nhiều chỗ cuộn: chỉ cuộn tới vị trí scroll hiện có của el.
			window.scrollTo({ top: el.scrollTop, behavior: 'smooth' });
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
				// Restore height về đúng giá trị backup (raw string, ví dụ "800px" hoặc
				// rỗng) — block gốc gán `${attr}px` nên raw có đơn vị thành "800pxpx"
				// (invalid, restore thất bại). Xóa attr để chu kỳ focus sau backup lại.
				document.body.style.height = document.body.getAttribute('height-bu') ?? '';
				document.body.removeAttribute('height-bu');
				_focusOn = null;
			} else {
				if (timeId.requestAnimation) {
					cancelAnimationFrame(timeId.requestAnimation);
				}
				timeId.requestAnimation = requestAnimationFrame(() => {
					// Gán _focusOn TRƯỚC processFocus để consumer reactive (layout
					// touchActionDisabled) kịp đọc, rồi mới scroll compensation.
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
