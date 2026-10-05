// src/lib/components/form/textarea/_interface.ts
// FORM FIELD — mirror mẫu checkbox/input: TextareaProps extends BasicProps,
// TextareaConfigs có `value`/`name`/`loading`/`validation`/`reset` (Form serialize
// đọc `'value' in children` → string).
import type { BasicConfigs, BasicProps, Color, Size, TimeUnits } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';
import type { ValidationCompact, ValidationFull } from '../input/_interface';

export interface TextareaProps extends BasicProps {
	/** Giá trị textarea — BINDABLE (source of truth). */
	value?: string;
	/** Placeholder (string hoặc TranslateContent {en, vi}). */
	placeholder?: TranslateContent | string;
	/** Bắt buộc nhập → validators required + màu validation tự động. */
	required?: boolean;
	/** Độ dài tối thiểu (validator minLength). */
	minLength?: number;
	/** Độ dài tối đa (validator maxLength + native `maxlength`). */
	maxLength?: number;
	/** Số dòng hiển thị (native `rows`), default 3. */
	rows?: number;
	/** Auto-resize theo nội dung (min-height theo rows, max-height 20rem). */
	autoResize?: boolean;
	/** Chỉ đọc (native readonly, vẫn focusable). */
	readOnly?: boolean;
	size?: Size;
	color?: Color;
	duration?: TimeUnits;
	/** Delay validation (ms / TimeUnits) — cascade `props.delay ?? client.browser?.delay ?? 300`. */
	delay?: TimeUnits;
	/** HTML id (association cho <Label> tự manage). */
	id?: string;
	'aria-label'?: string;
}

export interface TextareaConfigs extends Omit<BasicConfigs, 'status' | 'value'> {
	value: string;
	name?: string;
	loading?: boolean;
	required?: boolean;
	minLength?: number;
	maxLength?: number;
	rows?: number;
	autoResize?: boolean;
	readOnly?: boolean;
	placeholder?: TranslateContent | string;
	size: Size;
	color: Color;
	disabled?: boolean;
	duration: number;
	delay?: number;
	status: {
		/** dirty so với mốc ban đầu — Button/Form submit disabled-logic đọc qua formContext.childrens */
		changed?: boolean;
		focus?: boolean;
	};
	validation: {
		isValid?: boolean | 'pending';
		messages?: Map<string, { content?: TranslateContent; kind: 'valid' | 'invalid' }>;
	};
	reset: () => void;
}

export type { ValidationCompact, ValidationFull };
