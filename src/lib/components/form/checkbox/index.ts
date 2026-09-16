import { getContext, mount, setContext, unmount } from 'svelte';
import type { CheckboxConfigs, CheckboxIndicatorProps } from './_interface';
import { default as Indicator } from './Indicator/Main.svelte';
import type { ValidationCompact, ValidationFull } from '../input/_interface';

const NAME = Symbol('checkbox-context');
export function setCheckboxContext(context: CheckboxConfigs) {
	setContext(NAME, context);
}
export function getCheckboxContext(): CheckboxConfigs | undefined {
	return getContext(NAME);
}
export function releaseIndicator(data?: CheckboxConfigs) {
	if (!data?.ref) return;
	const context = new Map<unknown, unknown>([[NAME, data]]);
	const instance = mount(Indicator, { target: data.ref, context });
	return () => {
		unmount(instance);
	};
}
export const defaultValidation: {
	required: (fieldName?: string) => ValidationCompact | ValidationFull;
} = {
	required: (fieldName) => {
		return {
			isValid(input) {
				if (input) return true;
				return false;
			},
			message: {
				invalid: {
					en: `${fieldName ?? 'this field'} is required`
				},
				valid: {
					en: `${fieldName ?? 'this field'} is valid`
				}
			}
		};
	}
};
