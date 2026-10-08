// src/lib/components/form/input-otp/index.ts
// Export InputOtp + defaultValidation (required = đủ `length` ký tự, KHÔNG chỉ non-empty).
// Mirror mẫu textarea/index.ts + radiogroup/index.ts (defaultValidation vi/en).
import type { InputOtpConfigs, InputOtpProps } from './_interface';
import type { ValidationFull } from '../input/_interface';
import { setInputOtpContext } from './_context';

export { default as InputOtp } from './Main.svelte';
export { setInputOtpContext, getInputOtpContext } from './_context';
export type { InputOtpProps, InputOtpConfigs, OtpType } from './_interface';

export const defaultValidation: {
	/** required: isValid = value.length === expectedLength (mặc định 6). */
	required: (fieldName?: string, expectedLength?: number) => ValidationFull;
} = {
	required: (fieldName, expectedLength = 6) => {
		return {
			// ValidationFull input là union `string | boolean | string[] | File[]` (form-wide) —
			// OTP chỉ nhận STRING (compact value); non-string → invalid.
			isValid(input?: string | boolean | string[] | File[]) {
				return typeof input === 'string' && input.length === expectedLength;
			},
			message: {
				invalid: {
					en: `Please enter the full ${expectedLength}-digit verification code`,
					vi: `Vui lòng nhập đủ ${expectedLength} ký tự mã xác nhận`
				},
				valid: {
					en: `Verification code is valid`,
					vi: 'Mã xác nhận hợp lệ'
				}
			}
		};
	}
};
