// src/lib/components/element/button/useButtonColor.ts
import type { Color } from '$components/interface';

export type ButtonColor = Color;

const VALID_COLORS: ReadonlySet<string> = new Set([
	'default',
	'secondary',
	'success',
	'info',
	'warning',
	'error',
	'primary'
]);

const DEFAULT_COLOR: ButtonColor = 'default';

/**
 * Resolves the button color to a validated value and its CSS class.
 * Falls back to 'default' for undefined / invalid input.
 */
export function useButtonColor(color?: string | null): {
	color: ButtonColor;
	className: string;
	isValid: boolean;
} {
	if (!color || typeof color !== 'string') {
		return { color: DEFAULT_COLOR, className: `color-${DEFAULT_COLOR}`, isValid: false };
	}
	const normalized = color.trim().toLowerCase();
	if (VALID_COLORS.has(normalized)) {
		return { color: normalized as ButtonColor, className: `color-${normalized}`, isValid: true };
	}
	return { color: DEFAULT_COLOR, className: `color-${DEFAULT_COLOR}`, isValid: false };
}

export function getColorClass(color?: string | null): string {
	return useButtonColor(color).className;
}

export const colorOptions = [...VALID_COLORS] as ButtonColor[];