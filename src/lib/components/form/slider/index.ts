// src/lib/components/form/slider/index.ts
// Export Slider + defaultValidation (required / minValue / maxValue).
// Mirror mẫu textarea/index.ts + radiogroup/index.ts (defaultValidation vi/en).
import type { SliderConfigs, SliderProps } from './_interface';
import type { ValidationFull } from '../input/_interface';
import { setSliderContext } from './_context';

export { default as Slider } from './Main.svelte';
export { setSliderContext, getSliderContext } from './_context';
export type { SliderProps, SliderConfigs } from './_interface';

// Slider value là number — ValidationFull.input là union
// `string | boolean | File[]` (form-wide) → coerce qua Number() trước so sánh.
// TypeScript: widen tham số lên union rồi cast (behavior: Number() đã an toàn
// với number/string; boolean/File[] không được gọi từ Slider).
export const defaultValidation: {
	required: (fieldName?: string) => ValidationFull;
	minValue: (minCount: number, fieldName?: string) => ValidationFull;
	maxValue: (maxCount: number, fieldName?: string) => ValidationFull;
} = {
	required: (fieldName) => {
		return {
			isValid(input?: string | boolean | File[]) {
				// Slider LUÔN có giá trị (native range input luôn có value) →
				// required chỉ fail khi input NaN (trạng thái bất thường).
				const n = Number(input);
				if (input != null && !Number.isNaN(n)) return true;
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
	minValue: (minCount, fieldName) => {
		return {
			isValid(input?: string | boolean | File[]) {
				const n = Number(input);
				if (Number.isNaN(n)) return false;
				return n >= minCount;
			},
			message: {
				invalid: {
					en: `${fieldName ?? 'this field'} must be at least ${minCount}`,
					vi: `${fieldName ?? 'Trường này'} phải ít nhất bằng ${minCount}`
				},
				valid: {
					en: `${fieldName ?? 'this field'} value is valid`,
					vi: `${fieldName ?? 'Trường này'} có giá trị hợp lệ`
				}
			}
		};
	},
	maxValue: (maxCount, fieldName) => {
		return {
			isValid(input?: string | boolean | File[]) {
				const n = Number(input);
				if (Number.isNaN(n)) return false;
				return n <= maxCount;
			},
			message: {
				invalid: {
					en: `${fieldName ?? 'this field'} must be at most ${maxCount}`,
					vi: `${fieldName ?? 'Trường này'} phải tối đa ${maxCount}`
				},
				valid: {
					en: `${fieldName ?? 'this field'} value is valid`,
					vi: `${fieldName ?? 'Trường này'} có giá trị hợp lệ`
				}
			}
		};
	}
};
