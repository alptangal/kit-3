// src/lib/components/form/input-datetime/index.ts
// Export InputDatetime + defaultValidation (required = đủ ô + ngày hợp lệ).
// Mirror mẫu input-otp/index.ts + radiogroup/index.ts (defaultValidation vi/en).
import type { InputDatetimeConfigs, InputDatetimeProps } from './_interface';
import type { ValidationFull } from '../input/_interface';
import { setInputDatetimeContext } from './_context';

export { default as InputDatetime } from './Main.svelte';
export { setInputDatetimeContext, getInputDatetimeContext } from './_context';
export type { InputDatetimeProps, InputDatetimeConfigs } from './_interface';

export const defaultValidation: {
	/** required: isValid = đủ ô + tháng/ngày/giờ/phút hợp lệ (ngày theo tháng, năm nhuận). */
	required: (fieldName?: string, dateOnly?: boolean) => ValidationFull;
} = {
	required: (fieldName, dateOnly) => {
		return {
			// ValidationFull input là union `string | boolean | string[] | File[]` (form-wide) —
			// datetime chỉ nhận STRING (ISO `YYYY-MM-DDTHH:MM`, dateOnly: `YYYY-MM-DD`);
			// non-string → invalid.
			isValid(input?: string | boolean | string[] | File[]) {
				return typeof input === 'string' && InputDatetimeIsValidIso(input, dateOnly);
			},
			message: {
				invalid: {
					en: `Please enter a complete, valid ${fieldName ?? 'date and time'}`,
					vi: `Vui lòng nhập ${fieldName ?? 'ngày và giờ'} đầy đủ và hợp lệ`
				},
				valid: {
					en: `${fieldName ?? 'Date'} is valid`,
					vi: `${fieldName ?? 'Ngày'} hợp lệ`
				}
			}
		};
	}
};

/** Kiểm tra ISO hợp lệ: `YYYY-MM-DDTHH:MM` (hoặc dateOnly `YYYY-MM-DD`) — tháng 01-12, ngày theo tháng (năm nhuận), giờ 00-23, phút 00-59. */
export function InputDatetimeIsValidIso(iso: string, dateOnly = false): boolean {
	// dateOnly (hideTime): buildIso sinh `YYYY-MM-DD` — regex đầy đủ T..:.. sẽ
	// TỪ CHỐI mọi giá trị date-only → field hideTime không bao giờ valid (bug
	// từng làm section demo "Date only" aria-invalid dù 1999-12-31 hợp lệ).
	if (dateOnly) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
	} else {
		if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) return false;
	}
	const year = Number(iso.slice(0, 4));
	const month = Number(iso.slice(5, 7));
	const day = Number(iso.slice(8, 10));
	if (month < 1 || month > 12) return false;
	if (!dateOnly) {
		const hour = Number(iso.slice(11, 13));
		const minute = Number(iso.slice(14, 16));
		if (hour > 23 || minute > 59) return false;
	}
	// Ngày theo tháng (năm nhuận: chia hết 4, trừ trừ trăm không chia hết 400)
	const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
	return day >= 1 && day <= (daysInMonth ?? 31);
}
