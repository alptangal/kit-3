import { mount, unmount, type MountOptions } from 'svelte';
import KeyboardHost from '$components/keyboard/number/Main.svelte';
import type { NumberInputTarget } from '$components/form/input/_interface';
import { numberKeyboardState } from './numberKeyboardState.svelte';

let hostComponent: Record<string, MountOptions> | null = null;
let hostContainer: HTMLElement | null = null;
let refCount = 0;
let timeId: number;
export function ensureKeyboardHost(
	target: NumberInputTarget,
	currentIndexCursor?: number
): (() => void) | undefined {
	if (typeof document === 'undefined') return () => {};

	if (timeId) cancelAnimationFrame(timeId);

	let released = false;
	refCount++;
	numberKeyboardState.target = target;

	timeId = requestAnimationFrame(() => {
		if (released) return; // cleanup đã chạy trước khi rAF kịp fire → không mount nữa
		if (!hostComponent) {
			hostContainer = document.createElement('div');
			hostContainer.setAttribute('data-keyboard-host', '');
			document.body.appendChild(hostContainer);
			hostComponent = mount(KeyboardHost, { target: hostContainer });
		}
	});

	return () => {
		if (released) return;
		released = true;
		refCount--;
		if (refCount <= 0 && hostComponent) {
			unmount(hostComponent);
			hostContainer?.remove();
			hostComponent = null;
			hostContainer = null;
			refCount = 0;
		}
	};
}
