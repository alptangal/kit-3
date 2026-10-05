// src/lib/components/form/textarea/index.ts
// Export Textarea + defaultValidation (required / minLength / maxLength).
// Mirror mẫu checkbox/index.ts + radiogroup/index.ts (defaultValidation vi/en).
import type { TextareaConfigs, TextareaProps } from './_interface';
import type { ValidationFull } from '../input/_interface';
import { setTextareaContext } from './_context';

export { default as Textarea } from './Main.svelte';
export { setTextareaContext, getTextareaContext } from './_context';
export type { TextareaProps, TextareaConfigs } from './_interface';

// Textarea chỉ nhận string → narrow input (ValidationFull input là
// `string | boolean | File[]` — không dùng `.length` trực tiếp).
type TextareaInput = string;

export const defaultValidation: {
	required: (fieldName?: string) => ValidationFull;
	minLength: (minCount: number, fieldName?: string) => ValidationFull;
	maxLength: (maxCount: number, fieldName?: string) => ValidationFull;
} = {
	required: (fieldName) => {
		return {
			isValid(input: TextareaInput) {
				if (input?.length) return true;
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
	},
	minLength: (minCount, fieldName) => {
		return {
			isValid(input: TextareaInput) {
				if (input?.length >= minCount) return true;
				return false;
			},
			message: {
				invalid: {
					en: `${fieldName ?? 'this field'} must be at least ${minCount} characters`,
					vi: `${fieldName ?? 'Trường này'} phải có ít nhất ${minCount} ký tự`
				},
				valid: {
					en: `${fieldName ?? 'this field'} length is valid`,
					vi: `${fieldName ?? 'Trường này'} có độ dài hợp lệ`
				}
			}
		};
	},
	maxLength: (maxCount, fieldName) => {
		return {
			isValid(input: TextareaInput) {
				if (input?.length <= maxCount) return true;
				return false;
			},
			message: {
				invalid: {
					en: `${fieldName ?? 'this field'} must be at most ${maxCount} characters`,
					vi: `${fieldName ?? 'Trường này'} phải có tối đa ${maxCount} ký tự`
				},
				valid: {
					en: `${fieldName ?? 'this field'} length is valid`,
					vi: `${fieldName ?? 'Trường này'} có độ dài hợp lệ`
				}
			}
		};
	}
};
