// src/lib/components/form/switch/index.ts
// Export Switch + setSwitchContext/getSwitchContext (leaf _context.ts) +
// defaultValidation.required — mirror checkbox/index.ts + slider/index.ts
// (defaultValidation message vi/en).
import type { SwitchConfigs, SwitchProps } from './_interface';
import type { ValidationCompact, ValidationFull } from '../input/_interface';
import { setSwitchContext } from './_context';

export { default as Switch } from './Main.svelte';
export { setSwitchContext, getSwitchContext } from './_context';
export type { SwitchProps, SwitchConfigs } from './_interface';

// Switch value là BOOLEAN — required = checked truthy (form field on/off).
export const defaultValidation: {
	required: (fieldName?: string) => ValidationCompact | ValidationFull;
} = {
	required: (fieldName) => {
		return {
			isValid(input?: string | boolean | File[]) {
				// boolean field: on = valid, off/undefined = invalid
				return Boolean(input);
			},
			message: {
				invalid: {
					en: `${fieldName ?? 'this field'} is required`,
					vi: `${fieldName ?? 'Trường này'} là bắt buộc (phải BẬT)`
				},
				valid: {
					en: `${fieldName ?? 'this field'} is valid`,
					vi: `${fieldName ?? 'Trường này'} hợp lệ (đang bật)`
				}
			}
		};
	}
};
