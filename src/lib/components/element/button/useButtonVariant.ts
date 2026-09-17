// src/lib/components/element/button/useButtonVariant.ts
export type ButtonVariant = 'solid' | 'outline' | 'soft' | 'subtle' | 'link' | 'ghost';

const VALID_VARIANTS: ReadonlySet<string> = new Set([
	'solid',
	'outline',
	'soft',
	'subtle',
	'link',
	'ghost'
]);

const DEFAULT_VARIANT: ButtonVariant = 'solid';

/**
 * Resolves the button variant to a validated value and its CSS class.
 * Falls back to 'solid' for undefined / invalid input.
 */
export function useButtonVariant(variant?: string | null): {
	variant: ButtonVariant;
	className: string;
	isValid: boolean;
} {
	if (!variant || typeof variant !== 'string') {
		return { variant: DEFAULT_VARIANT, className: `variant-${DEFAULT_VARIANT}`, isValid: false };
	}
	const normalized = variant.trim().toLowerCase();
	if (VALID_VARIANTS.has(normalized)) {
		return { variant: normalized as ButtonVariant, className: `variant-${normalized}`, isValid: true };
	}
	return { variant: DEFAULT_VARIANT, className: `variant-${DEFAULT_VARIANT}`, isValid: false };
}

export function getVariantClass(variant?: string | null): string {
	return useButtonVariant(variant).className;
}

export const variantOptions = [...VALID_VARIANTS] as ButtonVariant[];
