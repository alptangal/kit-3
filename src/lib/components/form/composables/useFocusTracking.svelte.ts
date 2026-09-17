// composables/useFocusTracking.svelte.ts
// Shared focus/blur/touched/hover tracking
export function useFocusTracking(
	options: { onFocusChange?: (v: boolean) => void; onBlurTouched?: (v: boolean) => void; initialFocus?: boolean; initialHover?: boolean } = {}
) {
	let focus = $state(options.initialFocus ?? false);
	let hover = $state(options.initialHover ?? false);
	let touched = $state(false);
	let wasFocused = $state(false);
	let selectAll = $state(false);

	$effect(() => {
		if (focus) wasFocused = true;
		else if (wasFocused && !focus) {
			touched = true;
			options.onBlurTouched?.(true);
		}
		options.onFocusChange?.(focus);
	});

	function onFocus() {
		focus = true;
	}
	function onBlur() {
		focus = false;
		selectAll = false;
	}
	function onHover(v: boolean) {
		hover = v;
	}
	function reset() {
		focus = false;
		hover = false;
		touched = false;
		wasFocused = false;
		selectAll = false;
	}

	return {
		get focus() {
			return focus;
		},
		set focus(v: boolean) {
			focus = v;
		},
		get hover() {
			return hover;
		},
		set hover(v: boolean) {
			hover = v;
		},
		get touched() {
			return touched;
		},
		set touched(v: boolean) {
			touched = v;
		},
		get selectAll() {
			return selectAll;
		},
		set selectAll(v: boolean) {
			selectAll = v;
		},
		onFocus,
		onBlur,
		onHover,
		reset
	};
}
