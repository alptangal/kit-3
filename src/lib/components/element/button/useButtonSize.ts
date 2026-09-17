// src/lib/components/element/button/useButtonSize.ts
import type { Size } from '$components/interface';

export type ButtonSize = Size;

const VALID_SIZES: ReadonlySet<string> = new Set([
	'xs',
	'sm',
	'md',
	'lg',
	'xl',
	'2xl',
	'3xl',
	'4xl',
	'5xl',
	'6xl',
	'7xl',
	'8xl',
	'9xl'
]);

const DEFAULT_SIZE: ButtonSize = 'md';

/**
 * Resolves the button size to a validated value and its CSS class.
 * Falls back to 'md' for undefined / invalid input.
 */
export function useButtonSize(size?: string | null, fallback?: string | null): {
	size: ButtonSize;
	className: string;
	isValid: boolean;
} {
	if (!size || typeof size !== 'string') {
		const effectiveFallback = fallback ?? DEFAULT_SIZE;
		return { size: effectiveFallback as ButtonSize, className: `size-${effectiveFallback}`, isValid: false };
	}
	const normalized = size.trim().toLowerCase();
	if (VALID_SIZES.has(normalized)) {
		return { size: normalized as ButtonSize, className: `size-${normalized}`, isValid: true };
	}
	return { size: DEFAULT_SIZE, className: `size-${DEFAULT_SIZE}`, isValid: false };
}

export function getSizeClass(size?: string | null, fallback?: string | null): string {
	return useButtonSize(size, fallback).className;
}

export const sizeOptions = [...VALID_SIZES] as ButtonSize[];