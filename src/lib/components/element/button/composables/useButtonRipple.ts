import type { ButtonConfigs } from '../_interface';

/**
 * Ripple effect composable - extracted from Main.svelte
 * Creates and manages Material Design style ripple effects
 */
export interface UseButtonRippleReturn {
	spawnRipple: (e: MouseEvent | PointerEvent, node: HTMLElement) => () => void;
}

export function useButtonRipple(configs: ButtonConfigs): UseButtonRippleReturn {
	/**
	 * Spawn ripple effect at click position
	 */
	function spawnRipple(e: MouseEvent | PointerEvent, node: HTMLElement): () => void {
		const rect = node.getBoundingClientRect();
		const ripple = document.createElement('span');
		const size = Math.max(rect.width, rect.height) * 2;
		ripple.className = 'button-ripple';
		ripple.style.cssText = `
			width:${size}px; height:${size}px;
			left:${e.clientX - rect.left - size / 2}px;
			top:${e.clientY - rect.top - size / 2}px;
		`;
		node.appendChild(ripple);
		const tid = setTimeout(() => ripple.remove(), 600);
		// Cleanup if component unmounts before timeout
		return () => {
			clearTimeout(tid);
			ripple.remove();
		};
	}

	return { spawnRipple };
}

/**
 * Debounce composable - extracted from Main.svelte
 */
export interface UseButtonDebounceReturn {
	isDebouncing: boolean;
	startDebounce: (duration: number) => void;
}

export function useButtonDebounce(configs: ButtonConfigs): UseButtonDebounceReturn {
	let isDebouncing = false;

	function startDebounce(duration: number) {
		if (isDebouncing) return;
		if (!configs.status) configs.status = {};
		if (!configs.timeId) configs.timeId = new Map();
		isDebouncing = true;
		configs.status.debouncing = true;
		configs.timeId.set(
			'debounce',
			setTimeout(() => {
				if (configs.status) configs.status.debouncing = false;
				isDebouncing = false;
			}, duration)
		);
	}

	return { get isDebouncing() { return isDebouncing; }, startDebounce };
}

/**
 * Long press composable - extracted from Main.svelte
 */
export interface UseButtonLongPressReturn {
	startLongPress: (e: PointerEvent, callback: (e: PointerEvent) => void | Promise<void>, duration: number) => void;
	cancelLongPress: () => void;
}

export function useButtonLongPress(configs: ButtonConfigs): UseButtonLongPressReturn {
	function startLongPress(
		e: PointerEvent,
		callback: (e: PointerEvent) => void | Promise<void>,
		duration: number
	) {
		if (!configs.status) configs.status = {};
		if (!configs.timeId) configs.timeId = new Map();
		const prevLp = configs.timeId.get('long-press');
		if (prevLp) clearTimeout(prevLp);

		// Store start coordinates to detect scroll distance
		configs.status.pointerStartX = e.clientX;
		configs.status.pointerStartY = e.clientY;

		configs.timeId.set(
			'long-press',
			setTimeout(async () => {
				if (!configs.status) configs.status = {};
				configs.status.longPress = true;
				configs.status.longPressFired = true; // Flag to block upcoming click
				await callback(e);
				if (configs.status) configs.status.longPress = false;
			}, duration)
		);
	}

	function cancelLongPress() {
		const lpId = configs.timeId?.get('long-press');
		if (lpId) {
			clearTimeout(lpId);
			configs.timeId?.delete('long-press');
		}
		if (configs.status) {
			configs.status.longPress = false;
			configs.status.pointerStartX = undefined;
			configs.status.pointerStartY = undefined;
		}
	}

	return { startLongPress, cancelLongPress };
}

/**
 * Tap animation composable - extracted from Main.svelte
 */
export interface UseButtonTapReturn {
	startTap: (delay: number) => void;
	cancelTap: () => void;
}

export function useButtonTap(configs: ButtonConfigs): UseButtonTapReturn {
	function startTap(delay: number) {
		if (!configs.status) configs.status = {};
		if (!configs.timeId) configs.timeId = new Map();
		const prevTap = configs.timeId.get('animation-tap');
		if (prevTap) clearTimeout(prevTap);
		configs.status.tap = true;
		configs.timeId.set(
			'animation-tap',
			setTimeout(() => {
				if (configs.status) configs.status.tap = false;
			}, delay)
		);
	}

	function cancelTap() {
		if (configs.status?.tap) {
			configs.status.tap = false;
			const prevTap = configs.timeId?.get('animation-tap');
			if (prevTap) clearTimeout(prevTap);
		}
	}

	return { startTap, cancelTap };
}