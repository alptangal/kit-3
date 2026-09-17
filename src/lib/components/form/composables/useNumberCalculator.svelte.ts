// composables/useNumberCalculator.svelte.ts
// Spec: useNumberCalculator(value, min, max) — extracted from Input.svelte
export function useNumberCalculator(
	getValue: () => string | undefined,
	setValue: (v: string | undefined) => void,
	options: { min?: () => number | undefined; max?: () => number | undefined; getDelay?: () => number } = {}
) {
	let previousValue = $state<string | undefined>(undefined);
	let timeIds = new Map<string, ReturnType<typeof setTimeout>>();

	function clamp(n: number): number {
		const min = options.min?.();
		const max = options.max?.();
		if (min != null) n = Math.max(min, n);
		if (max != null) n = Math.min(max, n);
		return n;
	}

	function calculate(input: string): number | undefined {
		try {
			const res = Function(`'use strict'; return (${input.toString().replaceAll('x', '*').replaceAll(':', '/')})`)();
			if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
				const c = clamp(res);
				previousValue = c.toString();
				return c;
			}
			return previousValue ? parseFloat(previousValue) : undefined;
		} catch {
			return previousValue ? parseFloat(previousValue) : undefined;
		}
	}

	function scheduleCalculate() {
		const delay = options.getDelay?.() ?? 300;
		const key = 'timeout-calculate';
		const prev = timeIds.get(key);
		if (prev) clearTimeout(prev);
		const tid = setTimeout(() => {
			const v = getValue();
			if (v) {
				const rs = calculate(v);
				if (rs != null && rs.toString() !== v) setValue(rs.toString());
			}
		}, delay);
		timeIds.set(key, tid);
	}

	function calculatorCursor(event: MouseEvent, value: string, inputElement: HTMLElement) {
		let index: number | undefined = undefined;
		const mirror = document.createElement('span');
		mirror.classList.add('input-mirror');
		mirror.style.position = 'absolute';
		mirror.style.visibility = 'hidden';
		mirror.style.whiteSpace = 'pre';
		const cs = getComputedStyle(inputElement);
		mirror.style.font = cs.font;
		mirror.style.letterSpacing = cs.letterSpacing;
		document.body.append(mirror);
		for (let i = 0; i <= value.length; i++) {
			mirror.textContent = value.slice(0, i);
			if (mirror.offsetWidth >= event.clientX - (inputElement.getBoundingClientRect().left ?? 0) + inputElement.scrollLeft) {
				index = i;
				break;
			}
		}
		mirror.remove();
		return index;
	}

	function cleanup() {
		for (const t of timeIds.values()) clearTimeout(t);
		timeIds.clear();
	}

	return {
		calculate,
		scheduleCalculate,
		calculatorCursor,
		cleanup,
		get previousValue() { return previousValue; },
		set previousValue(v: string | undefined) { previousValue = v; }
	};
}
