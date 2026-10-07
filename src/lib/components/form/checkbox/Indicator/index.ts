// Import trực tiếp 2 file indicator (KHÔNG qua barrel $components/form —
// barrel có Object.assign(CheckboxRoot) top-level: khi DataTable import
// checkbox Main trước → circular → CheckboxRoot chưa init → TypeError SSR).
import CheckboxIndicatorChecked from './Checked/Main.svelte';
import CheckboxIndicatorUnchecked from './Unchecked/Main.svelte';
import { getContext, mount, setContext, unmount, type Component } from 'svelte';
import type { CheckboxIndicatorConfigs, CheckboxIndicatorProps } from '../_interface';

export function releaseCheckboxIndicatorDefault(
	target: HTMLElement,
	options: CheckboxIndicatorProps
) {
	let component: Component;
	if (options.checked) {
		component = CheckboxIndicatorChecked;
	} else {
		component = CheckboxIndicatorUnchecked;
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
