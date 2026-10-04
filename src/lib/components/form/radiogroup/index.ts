//$components/form/radiogroup/index.ts
import type { RadioGroupConfigs, RadioItemProps, RadioGroupProps } from './_interface';
import type { ValidationFull } from '../input/_interface';
import { setRadioContext } from './_context';

export { default as RadioGroup } from './Main.svelte';
export { default as RadioItem } from './RadioItem.svelte';
export { setRadioContext, getRadioContext } from './_context';
export type { RadioGroupProps, RadioGroupConfigs, RadioItemProps, RadioOrientation } from './_interface';
export const defaultValidation: {
	required: (fieldName?: string) => ValidationFull;
} = {
	required: (fieldName) => {
		return {
			isValid(input) {
				if (input) return true;
				return false;
			},
			message: {
				invalid: {
					en: `${fieldName ?? 'this field'} is required`,
					vi: `${fieldName ?? 'Trường này'} là bắt buộc`
				},
				valid: {
					en: `${fieldName ?? 'this field'} is valid`,
					vi: `${fieldName ?? 'Trường này'} hợp lệ`
				}
			}
		};
	}
};
