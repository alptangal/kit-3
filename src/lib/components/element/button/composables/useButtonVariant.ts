import type { Size } from '$components/interface';

export type ButtonVariant = 'solid' | 'outline' | 'soft' | 'subtle' | 'link' | 'ghost';

export interface UseButtonVariantReturn {
	classes: string[];
	cssVars: Record<string, string>;
}

/**
 * useButtonVariant(variant, color, size) -> { classes, cssVars }
 * Handles variant-specific structural styles.
 * Color-aware because some variants (outline/subtle/link/ghost) treat `default` differently.
 */
export function useButtonVariant(
	variant: ButtonVariant,
	color: string,
	size: Size
): UseButtonVariantReturn {
	const classes = [`variant-${variant}`, `color-${color}`, `size-${size}`];
	const cssVars: Record<string, string> = {};

	// Structural custom properties that differ by variant.
	// Palette values themselves come from useButtonColor / SCSS --_c-* vars,
	// but border / background transparency is variant-owned.
	switch (variant) {
		case 'solid':
			cssVars['--border-color'] = 'transparent';
			break;
		case 'outline':
			cssVars['--background'] = 'transparent';
			break;
		case 'soft':
			cssVars['--border-color'] = 'transparent';
			break;
		case 'subtle':
			// border/color handled by color composable
			break;
		case 'link':
			cssVars['--border-color'] = 'transparent';
			cssVars['--background'] = 'transparent';
			break;
		case 'ghost':
			cssVars['--border-color'] = 'transparent';
			cssVars['--background'] = 'transparent';
			break;
	}
	return { classes, cssVars };
}
