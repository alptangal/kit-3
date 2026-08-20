import { SvelteMap } from 'svelte/reactivity';
import type { InputConfigs, InputProps, ValidationCompact, ValidationFull } from './_interface';
import type { EventListener } from '$components/interface';
import type { TextFieldContext } from '../textField/_interface';
import type { FormConfigs } from '../form/_interface';

export const text_keys_allowed = [
	'arrowleft',
	'arrowright',
	'arrowup',
	'arrowdown',
	'backspace',
	'delete',
	'home'
];
export const number_keys_allowed = [
	'0',
	'1',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	'.',
	'+',
	'-',
	':',
	'/',
	'*',
	'(',
	')',
	'%',
	...text_keys_allowed
];
export const defaultValidation: {
	required: (fieldName?: string) => ValidationCompact | ValidationFull;
	minNumber?: (minValue: number, fieldName?: string) => ValidationCompact | ValidationFull;
	maxNumber?: (maxValue: number, fieldName?: string) => ValidationCompact | ValidationFull;
	isEmail?: (fieldName?: string) => ValidationCompact | ValidationFull;
} = {
	required: (fieldName) => {
		return {
			isValid(input) {
				if (input?.length) return true;
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
	},
	minNumber(minValue, fieldName) {
		return {
			isValid(input) {
				if (input && parseFloat(input) >= minValue) return true;
				return false;
			},
			message: {
				invalid: {
					en: `${fieldName ?? 'this field'} is required min number=${minValue}`
				},
				valid: {
					en: `${fieldName ?? 'this field'} is valid min number=${minValue}`
				}
			}
		};
	},
	maxNumber(maxValue, fieldName) {
		return {
			isValid(input) {
				if (input && parseFloat(input) <= maxValue) return true;
				return false;
			},
			message: {
				invalid: {
					en: `${fieldName ?? 'this field'} is required max number=${maxValue}`
				},
				valid: {
					en: `${fieldName ?? 'this field'} is valid max number=${maxValue}`
				}
			}
		};
	},
	isEmail(fieldName) {
		return {
			isValid(input) {
				const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
				if (input && emailRegex.test(input)) return true;
				return false;
			},
			message: {
				invalid: {
					en: `${fieldName ?? 'this field'} must be an email`
				},
				valid: {
					en: `${fieldName ?? 'this field'} is valid email`
				}
			}
		};
	}
};
export function createDefaultInputEvents(
	value: string | undefined,
	configs: InputConfigs,
	textFieldContext?: TextFieldContext,
	formContext?: FormConfigs
): InputProps['events'] {
	return [
		{
			events: {
				load(_, data) {
					if (data?.node instanceof HTMLInputElement) {
						data.node.focus();
					}
				},
				mousedown(e, data) {
					const event = e as MouseEvent;
					const target = data?.node;
					// if (configs.status.focus) event.preventDefault();
					if (event.detail == 2 && value?.length) {
						configs.status.selectAll = true;
						if (target instanceof HTMLInputElement && value?.length) {
							target.setSelectionRange(0, value.length);
						}
					}
				},
				focus(e) {
					configs.input.status.focus = true;
				},
				blur() {
					configs.input.status.focus = false;
					configs.status.focus = false;
					if (textFieldContext) textFieldContext.status.selectAll = false;
				},
				keydown(e) {
					const event = e as KeyboardEvent;
					if (event.key.toLowerCase() == 'enter' && textFieldContext?.onEnter) {
						textFieldContext.onEnter();
						if (!formContext?.validation.isValid) {
							event.preventDefault();
						}
					} else if (event.key == 'a' && event.ctrlKey) {
						configs.status.selectAll = true;
					} else if (event.key.toLowerCase() == 'tab' && textFieldContext?.onTab) {
						textFieldContext.onTab();
					}
				}
			}
		}
	];
}
