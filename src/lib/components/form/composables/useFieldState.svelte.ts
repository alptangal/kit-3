// composables/useFieldState.svelte.ts
// Common state: value, initialValue, touched, changed, dirty, focus, hover, error/success color derivation
import type { Color, Size } from '$components/interface';

export interface FieldStateOptions {
	getValue: () => string | boolean | undefined;
	setValue?: (v: string | boolean | undefined) => void;
	getValidationIsValid?: () => boolean | 'pending' | undefined;
	color?: Color;
	required?: boolean;
	inputType?: string;
	/** optional external focus/hover signals to sync */
	getFocus?: () => boolean | undefined;
	getHover?: () => boolean | undefined;
}

export function useFieldState(options: FieldStateOptions) {
	let initialValue = $state<string | boolean | undefined>(undefined);
	let initialCaptured = $state(false);
	let touched = $state(false);
	let focusState = $state(false);
	let hoverState = $state(false);
	let wasFocused = $state(false);

	const changed = $derived((initialValue ?? '') !== (options.getValue() ?? ''));
	const dirty = $derived(changed);

	const validationColor = $derived.by<Color>(() => {
		if (options.color) return options.color;
		const isValid = options.getValidationIsValid?.();
		if (isValid !== undefined && isValid !== 'pending') {
			return isValid ? 'success' : 'error';
		}
		if (options.required || options.inputType === 'email') {
			if (isValid === false) return 'error';
			if (isValid === true) return 'success';
		}
		return options.color ?? 'default';
	});

	// capture initial once on first read
	$effect(() => {
		const v = options.getValue();
		if (!initialCaptured) {
			initialValue = v;
			initialCaptured = true;
		}
	});

	// touched via focus -> blur
	$effect(() => {
		const f = focusState;
		if (f) wasFocused = true;
		else if (wasFocused && !f) {
			touched = true;
		}
	});

	function setTouched(v: boolean) {
		touched = v;
		if (!v) wasFocused = false;
	}
	function setFocus(v: boolean) {
		focusState = v;
	}
	function setHover(v: boolean) {
		hoverState = v;
	}
	function reset() {
		touched = false;
		focusState = false;
		hoverState = false;
		wasFocused = false;
		if (options.setValue && initialCaptured) options.setValue(initialValue);
	}

	return {
		get value() {
			return options.getValue();
		},
		set value(v: string | boolean | undefined) {
			options.setValue?.(v);
		},
		get initialValue() {
			return initialValue;
		},
		set initialValue(v: string | boolean | undefined) {
			initialValue = v;
			initialCaptured = true;
		},
		get touched() {
			return touched;
		},
		set touched(v: boolean) {
			touched = v;
		},
		get changed() {
			return changed;
		},
		get dirty() {
			return dirty;
		},
		get focus() {
			return focusState;
		},
		set focus(v: boolean) {
			focusState = v;
		},
		get hover() {
			return hoverState;
		},
		set hover(v: boolean) {
			hoverState = v;
		},
		get color() {
			return validationColor;
		},
		setTouched,
		setFocus,
		setHover,
		reset
	};
}
