import { SvelteMap } from 'svelte/reactivity';
import type { InputConfigs, InputProps, ValidationCompact, ValidationFull } from './_interface';

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
	}
};
