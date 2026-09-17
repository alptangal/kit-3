import type { ButtonProps, ButtonConfigs, Color, Size, ButtonVariants } from '../_interface';
import { useButtonVariant } from './useButtonVariant';
import { useButtonColor } from './useButtonColor';
import { useButtonSize, useButtonRounded, useButtonAspectSquare } from './useButtonSize';
import { useButtonState } from './useButtonState';
import { styleSynced } from '$modules';

export interface UseButtonReturn {
	classes: string[];
	cssVars: Record<string, string>;
	variantData: ReturnType<typeof useButtonVariant>;
	colorData: ReturnType<typeof useButtonColor>;
	sizeData: ReturnType<typeof useButtonSize>;
	stateData: ReturnType<typeof useButtonState>;
}

/**
 * Main composable that combines all button composables
 * Provides a unified API for button styling and behavior
 */
export function useButton(
	props: ButtonProps,
	configs: ButtonConfigs,
	formContext?: { size?: Size; loading?: boolean; disabled?: boolean; childrens?: Map<any, any>; validation?: { isValid?: boolean } }
): UseButtonReturn {
	// Derive values from props and context
	const type = props.type ?? 'button';
	const variant = props.variant ?? 'solid';
	const size = props.size ?? formContext?.size ?? 'md';
	const color = props.color ?? 'default';
	const loading = props.loading ?? (type === 'submit' && formContext?.loading);
	const disabled = props.disabled ?? (formContext?.disabled ?? false);
	const transitionDisabled = props.transitionDisabled ?? false;
	const rounded = props.rounded;
	const aspectSquare = props['aspect-square'];
	const tooltip = props.tooltip;

	// Get data from each composable
	const variantData = useButtonVariant(variant, color, size);
	const colorData = useButtonColor(color, variant);
	const sizeData = useButtonSize(size);
	const roundedClasses = useButtonRounded(rounded);
	const aspectClasses = useButtonAspectSquare(aspectSquare);
	const stateData = useButtonState({ ...configs, tooltip, transitionDisabled }, loading, disabled);

	// Combine all classes
	const allDefaultStyles: (string | undefined)[] = [
		...variantData.classes,
		...colorData.classes,
		...sizeData.classes,
		...roundedClasses,
		...aspectClasses,
		...stateData.classes
	];

	// Combine all CSS vars
	const allCssVars: Record<string, string> = {
		...variantData.cssVars,
		...colorData.cssVars,
		...sizeData.cssVars,
		...stateData.cssVars
	};

	// Handle prop styles
	const propStyles: (string | undefined)[] | undefined | string =
		typeof props.class == 'object' && !Array.isArray(props.class)
			? props.class.root
			: props.class;

	// Merge with styleSynced
	const finalClasses = styleSynced({ defaultStyles: allDefaultStyles, propStyles }, props.overwriteDefaultStyles);

	return {
		classes: finalClasses,
		cssVars: allCssVars,
		variantData,
		colorData,
		sizeData,
		stateData
	};
}

/**
 * Parse duration string to milliseconds
 */
export function parseDuration(duration?: number | `${number}s` | `${number}ms` | 'none', fallback: number = 300): number | undefined {
	if (!duration) return fallback;
	if (duration === 'none') return undefined;
	if (typeof duration === 'number') return duration;
	return duration.includes('ms') ? parseFloat(duration) : parseFloat(duration) * 1000;
}

/**
 * Parse loading duration
 */
export function parseLoadingDuration(duration?: number | `${number}s` | `${number}ms`, fallback: number = 3000): number {
	if (!duration) return fallback;
	if (typeof duration === 'number') return duration;
	return duration.includes('ms') ? parseFloat(duration) : parseFloat(duration) * 1000;
}

/**
 * Parse debounce
 */
export function parseDebounce(debounce?: number): number | undefined {
	return debounce;
}

/**
 * Parse long press duration
 */
export function parseLongPressDuration(duration?: number, fallback: number = 500): number {
	return duration ?? fallback;
}

/**
 * Get tag for rendering (button vs a)
 */
export function getButtonTag(props: ButtonProps): 'button' | 'a' {
	if (props.as) return props.as as 'button' | 'a';
	if (props.to) return 'a';
	return 'button';
}

/**
 * Get href for anchor tag
 */
export function getButtonHref(props: ButtonProps): string | undefined {
	if (!props.to) return undefined;
	try {
		// Use resolve from $app/paths in actual component
		return props.to;
	} catch {
		return props.to;
	}
}

/**
 * Get tooltip and aria-label
 */
export function getButtonTooltip(props: ButtonProps): { tooltip: string | undefined; ariaLabel: string | undefined } {
	const tooltip = props.tooltip;
	const ariaLabel = props['aria-label'] ?? props.tooltip;
	return { tooltip, ariaLabel };
}

/**
 * Get shortcut keys
 */
export function getButtonShortcuts(shortcut?: string | string[]): string[] | undefined {
	if (!shortcut) return undefined;
	return Array.isArray(shortcut)
		? shortcut.map((s) => s.toLowerCase())
		: [shortcut.toLowerCase()];
}