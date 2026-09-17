import type { Color } from '$components/interface';

export type ButtonColor = Color;

export interface UseButtonColorReturn {
	classes: string[];
	cssVars: Record<string, string>;
}

/** Semantic -> Tailwind palette mapping (matches _styles.scss $colorRefs) */
export const colorRefs: Record<ButtonColor, string> = {
	default: 'gray',
	secondary: 'cyan',
	success: 'green',
	info: 'sky',
	warning: 'amber',
	error: 'red',
	primary: 'indigo'
};

/**
 * useButtonColor(color, variant) -> { classes, cssVars }
 * Resolves color-specific CSS custom properties.
 * Variant affects how palette maps to --background/--color/--border-color,
 * so both params are required.
 */
export function useButtonColor(color: ButtonColor, variant: string): UseButtonColorReturn {
	const ref = colorRefs[color];
	const classes = [`color-${color}`];
	const cssVars: Record<string, string> = {};

	// Expose palette ref for SCSS fallback (e.g. inline style --_ref)
	cssVars['--_ref'] = ref;

	// Loading gradient is per-color and consumed by .loading::before
	cssVars['--loading-background'] =
		`linear-gradient(100deg, var(--color-${ref}-200) 0%, var(--color-${ref}-300) 25%, white 50%, var(--color-${ref}-400) 75%, var(--color-${ref}-200) 100%)`;

	// Variant-aware color assignments are primarily handled in SCSS via
	// color-scoped custom properties (--_solid-bg etc). This composable
	// exposes the computed class and the shared loading var for inline use
	// or JS-driven theming; no hard-coded inline palette overrides needed
	// beyond --_ref / --loading-background to keep CSS vars as single source.
	void variant;
	return { classes, cssVars };
}
