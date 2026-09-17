import type { ButtonConfigs } from '../_interface';

export interface ButtonStateReturn {
	classes: string[];
	cssVars: Record<string, string>;
	status: ButtonConfigs['status'];
}

/**
 * Extract state management into reusable composable
 * Handles loading, disabled, tapped, long-press states
 */
export function useButtonState(
	configs: ButtonConfigs,
	loading: boolean,
	disabled: boolean
): ButtonStateReturn {
	const stateClasses: string[] = [];
	const cssVars: Record<string, string> = {};
	const status = configs.status ?? {};

	if (disabled) {
		stateClasses.push('disabled');
		cssVars['--cursor'] = 'not-allowed';
		cssVars['opacity'] = '0.5';
		cssVars['pointer-events'] = 'none';
	}

	if (loading) {
		stateClasses.push('loading');
		cssVars['cursor'] = 'not-allowed';
	}

	if (status.tap) {
		stateClasses.push('button-tapped');
	}

	if (status.longPress) {
		stateClasses.push('button-long-press');
	}

	if (configs.tooltip) {
		stateClasses.push('has-tooltip');
		cssVars['overflow'] = 'visible';
	}

	// Transition
	if (!configs.transitionDisabled) {
		stateClasses.push('transition');
		cssVars['transition'] = `
			background var(--transition-duration, 200ms) ease-in-out,
			color var(--transition-duration, 200ms) ease-in-out,
			border-color var(--transition-duration, 200ms) ease-in-out,
			transform var(--transition-duration, 200ms) ease-in-out,
			opacity var(--transition-duration, 200ms) ease-in-out
		`.trim();
	}

	return { classes: stateClasses, cssVars, status };
}