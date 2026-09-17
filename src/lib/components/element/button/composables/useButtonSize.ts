import type { Size } from '$components/interface';

export interface UseButtonSizeReturn {
	classes: string[];
	cssVars: Record<string, string>;
}

/**
 * useButtonSize(size) -> { classes, cssVars }
 * Size vars are sourced from $styles/sizes.scss via global utility classes
 * `.size-*` / `.rounded-*`. We emit the class name; SCSS consumes it.
 */
export function useButtonSize(size: Size): UseButtonSizeReturn {
	return { classes: [`size-${size}`], cssVars: {} };
}

export function useButtonRounded(rounded?: Size | 'full' | 'none'): string[] {
	if (!rounded) return [];
	return [`rounded-${rounded}`];
}

export function useButtonAspectSquare(aspectSquare?: boolean): string[] {
	return aspectSquare ? ['aspect-square'] : [];
}
