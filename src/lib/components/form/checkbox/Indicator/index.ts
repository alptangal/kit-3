import { Checkbox } from '$components/form';
import { getContext, mount, setContext, unmount, type Component } from 'svelte';
import type { CheckboxIndicatorConfigs, CheckboxIndicatorProps } from '../_interface';

export function releaseCheckboxIndicatorDefault(
	target: HTMLElement,
	options: CheckboxIndicatorProps
) {
	let component: Component;
	if (options.checked) {
		component = Checkbox.Indicator.Checked;
	} else {
		component = Checkbox.Indicator.Unchecked;
	}
	mount(component, { target });
	return () => {
		console.log('clear');
		unmount(component);
	};
}

const NAME = Symbol('checkbox-indicator-context');
export function setCheckboxIndicatorContext(context: CheckboxIndicatorConfigs) {
	setContext(NAME, context);
}
export function getCheckboxIndicatorContext(): CheckboxIndicatorConfigs | undefined {
	return getContext(NAME);
}
