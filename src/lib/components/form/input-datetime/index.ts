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
	/** minDate: value ISO ≥ bound (so ngày-tháng-năm; time chỉ so khi cả 2 có giờ). */
	minDate: (min: string, fieldName?: string) => ValidationFull;
	/** maxDate: value ISO ≤ bound. */
	maxDate: (max: string, fieldName?: string) => ValidationFull;
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
	},
	// ── Pha 3 (B4): validate khoảng ngày — mirror minNumber/maxNumber của
	// form/input (message theo pattern; KHÔNG snap như minYear/maxYear — snap
	// thay đổi input user, validate chỉ BÁO LỖI).
	minDate(min, fieldName) {
		return {
			// So sánh CHUỔI ISO an toàn cho mốc date-only: value `2024-01-05T00:00`
			// so bound `2024-01-05` — so trực tiếp chuỗi sẽ sai (T > mọi ký tự số…
			// thực tế so lexical vẫn đúng chiều vì prefix khớp → so phần thời gian
			// như 00:00). Dùng so theo NGÀY (10 ký tự đầu) để nhất quán: cùng ngày
			// → pass (time tự do); khác ngày → lexical so đúng `YYYY-MM-DD`.
			isValid(input?: string | boolean | string[] | File[]) {
				// RỖNG (< 10 ký tự) → PASS: chưa nhập thì chưa sai khoảng (required
				// bắt lỗi thiếu riêng nếu có) — tránh viền đỏ trên field trống.
				if (typeof input !== 'string' || input.length < 10) return true;
				if (!InputDatetimeIsValidIso(input, false) && !InputDatetimeIsValidIso(input, true)) return false;
				return input.slice(0, 10) >= min.slice(0, 10);
			},
			message: {
				invalid: {
					en: `${fieldName ?? 'this field'} must be on or after ${min.slice(0, 10)}`,
					vi: `${fieldName ?? 'Trường này'} phải từ ${min.slice(0, 10)} trở đi`
				},
				valid: {
					en: `${fieldName ?? 'this field'} is valid min date=${min.slice(0, 10)}`,
					vi: `${fieldName ?? 'Trường này'} hợp lệ từ ${min.slice(0, 10)}`
				}
			}
		};
	},
	maxDate(max, fieldName) {
		return {
			isValid(input?: string | boolean | string[] | File[]) {
				// RỖNG → PASS (mirror minDate)
				if (typeof input !== 'string' || input.length < 10) return true;
				if (!InputDatetimeIsValidIso(input, false) && !InputDatetimeIsValidIso(input, true)) return false;
				return input.slice(0, 10) <= max.slice(0, 10);
			},
			message: {
				invalid: {
					en: `${fieldName ?? 'this field'} must be on or before ${max.slice(0, 10)}`,
					vi: `${fieldName ?? 'Trường này'} phải đến ${max.slice(0, 10)} trở lại`
				},
				valid: {
					en: `${fieldName ?? 'this field'} is valid max date=${max.slice(0, 10)}`,
					vi: `${fieldName ?? 'Trường này'} hợp lệ đến ${max.slice(0, 10)}`
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
