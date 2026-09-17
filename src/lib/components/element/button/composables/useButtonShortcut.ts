import type { ButtonConfigs } from '../_interface';

/**
 * Keyboard shortcut composable — activates button on matching key press.
 * Skips when the user is typing in an input / textarea / select / contenteditable.
 */
export function useButtonShortcut(
	shortcuts: string[] | undefined,
	getDisabled: () => boolean,
	getLoading: () => boolean | undefined,
	getNode: () => HTMLElement | undefined
): { attach: () => (() => void) | undefined } {
	function attach() {
		if (!shortcuts?.length) return;
		const node = getNode();
		if (!node) return;
		const handleKey = (ev: KeyboardEvent) => {
			if (getDisabled() || getLoading()) return;
			const activeEl = document.activeElement;
			if (
				activeEl &&
				(activeEl.tagName === 'INPUT' ||
					activeEl.tagName === 'TEXTAREA' ||
					activeEl.tagName === 'SELECT' ||
					(activeEl as HTMLElement).isContentEditable)
			) {
				return;
			}
			if (shortcuts.includes(ev.key.toLowerCase())) {
				ev.preventDefault();
				node.click();
			}
		};
		window.addEventListener('keydown', handleKey);
		return () => window.removeEventListener('keydown', handleKey);
	}
	return { attach };
}

/**
 * Tooltip composable — exposes derived tooltip / aria-label.
 */
export function useButtonTooltip(tooltip?: string, ariaLabel?: string) {
	const resolvedTooltip = tooltip;
	const resolvedAriaLabel = ariaLabel ?? tooltip;
	return { tooltip: resolvedTooltip, ariaLabel: resolvedAriaLabel };
}

/**
 * Confirmation composable — wraps a click handler with window.confirm.
 */
export function useButtonConfirm(confirmText?: string) {
	async function guard(): Promise<boolean> {
		if (!confirmText) return true;
		return window.confirm(confirmText);
	}
	return { guard };
}
