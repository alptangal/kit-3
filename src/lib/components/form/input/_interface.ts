//$components/form/input/_interface.ts
import type { BasicConfigs, BasicProps, EventListener, Color, Size } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';
import type { Snippet, SvelteComponent } from 'svelte';
import type { FullAutoFill } from 'svelte/elements';

type InputTypes = 'text' | 'password' | 'number' | 'currency' | 'phone' | 'email' | 'file';
type InputVariants = 'primary' | 'secondary';
export type ValidationCompact = (output?: string | boolean | File[]) => boolean | Promise<boolean>;
export type ValidationFull = {
	id?: string | number;
	isValid: (output?: string | boolean | File[]) => boolean | Promise<boolean>;
	message?: {
		valid?: TranslateContent;
		invalid?: TranslateContent;
	};
};
export type NumberKeyAllowed =
	| '0'
	| '1'
	| '2'
	| '3'
	| '4'
	| '5'
	| '6'
	| '7'
	| '8'
	| '9'
	| 'ac'
	| 'del'
	| '('
	| ')'
	| '.'
	| '+'
	| '-'
	| 'x'
	| ':'
	| '=';
export interface NumberInputTarget {
	value: string | undefined;
	ref?: HTMLInputElement;
	maxLength?: number;
}

export interface InputProps extends BasicProps {
	type?: InputTypes;
	rounded?: Size | 'full' | 'none';
	size?: Size;
	value?: string;
	placeholder?: TranslateContent | string;
	variant?: InputVariants;
	maxLength?: number | string;
	maxNumber?: number | string;
	minNumber?: number | string;
	required?: boolean;
	showPassword?: boolean;
	/** HTML autocomplete attribute — bỏ qua nếu không cần */
	autocomplete?: FullAutoFill | null | undefined;
	/** HTML inputmode attribute — hiển thị đúng keyboard trên mobile */
	inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
	/** HTML id attribute — dùng cho label association */
	id?: string;
	actionButtons?: {
		clear?: {
			display?: boolean;
		};
		copy?: {
			display?: boolean;
		};
		paste?: {
			display?: boolean;
		};
		showPassword?: {
			display?: boolean;
		};
	};
	leading?: Snippet<[{ defaultStyles?: (string | undefined)[]; size?: Size; color?: Color }?]>;
	trailing?: Snippet<[{ defaultStyles?: (string | undefined)[]; size?: Size; color?: Color }?]>;
	validation?: {
		[k in keyof EventListener]:
			| (ValidationCompact | ValidationFull)[]
			| {
					operator?: 'and' | 'or';
					handles: (ValidationCompact | ValidationFull)[];
			  };
	} & { operator?: 'and' | 'or' };
	loading?: boolean;
	color?: Color;
	name?: string;
	highlight?: string;
	caseSensitive?: boolean;
	/** Danh sách email domains gợi ý khi gõ @ (mặc định các domain phổ biến: gmail, outlook, icloud, atomicmail, proton, yahoo, hotmail) */
	emailDomains?: string[];
	/** Bật/tắt gợi ý email auto-complete (mặc định bật khi type='email') */
	emailSuggest?: boolean;
	/** Danh sách mã quốc gia cho phone auto-complete */
	phoneCountryCodes?: Array<{
		code: string;
		name: string;
		format: string;
		mask: string;
		example: string;
	}>;
	/** Bật/tắt gợi ý phone auto-complete (mặc định bật khi type='phone') */
	phoneSuggest?: boolean;
	// ── type='file' ──
	/**
	 * Danh sách tệp đã chọn (type='file' only). Bindable — DUY NHẤT source-of-truth
	 * cho file input; `value` (string) không dùng cho file. Form KHÔNG serialize
	 * file (configs không có key `value`) — page upload qua FormData + bind:files.
	 */
	files?: File[];
	/** HTML accept attribute (mime/extensions, vd "image/*,.csv,.json") */
	accept?: string;
	/** Cho phép chọn nhiều tệp (mặc định false = single-select, chọn mới thay thế) */
	multiple?: boolean;
	/** Giới hạn số tệp (multiple) — vượt quá sẽ bị cắt khi chọn */
	maxFiles?: number;
	/** Giới hạn kích thước mỗi tệp (bytes) — tệp vượt quá bị loại khi chọn */
	maxSize?: number;
}
export interface InputConfigs extends BasicConfigs {
	previousValue?: string;
	type: InputTypes;
	size: Size;
	rounded: Size | 'full' | 'none';
	duration: number;
	variant: InputVariants;
	disabled?: boolean;
	delay: number;
	color: Color;
	maxLength?: number;
	maxNumber?: number;
	minNumber?: number;
	required?: boolean;
	placeholder: Omit<BasicConfigs, 'value'> & {
		value: TranslateContent;
	};
	status: {
		focus?: boolean;
		selectAll?: boolean;
		currentCursor?: number;
		hover?: boolean;
		mousePos?: {
			clientX: number;
			clientY: number;
		};
		/** dirty so với mốc ban đầu — Button/Form submit disabled-logic đọc qua formContext.childrens */
		changed?: boolean;
		reseting?: boolean;
	};
	input: { [k in Exclude<InputTypes, 'password' | 'number'>]: BasicConfigs } & {
		password: BasicConfigs & {
			value?: string;
			showPassword?: boolean;
		};
		number: BasicConfigs & {
			resolveCalculator?: (value: string) => void;
		};
		status: {
			focus?: boolean;
		};
	};
	maskValue: BasicConfigs & {
		width?: number;
		height?: number;
		positionCharacters?: Map<string, number>;
	};
	actionButtons: {
		clear: BasicConfigs & {
			display?: boolean;
			component?: SvelteComponent;
		};
		copy: BasicConfigs & {
			display?: boolean;
			status: {
				copied?: boolean;
			};
		};
		paste: BasicConfigs & {
			display?: boolean;
			status: {
				pasted?: boolean;
			};
		};
		showPassword: BasicConfigs & {
			display?: boolean;
			status: {
				showing?: boolean;
			};
		};
	};
	leading: BasicConfigs;
	trailing: BasicConfigs;
	lastValue?: string;
	validation: {
		process?: Map<keyof EventListener | 'required', boolean | 'pending'>;
		isValid?: boolean | 'pending';
		messages?: Map<
			string | ((output?: string | boolean | File[]) => boolean | Promise<boolean>),
			{ content?: TranslateContent; kind: 'valid' | 'invalid' }
		>;
	};
	name?: string;
	highlight?: string;
	caseSensitive?: boolean;
	// ── type='file' (configs KHÔNG có key `value` → Form serialize bỏ qua field) ──
	/**
	 * Danh sách tệp (type='file'). Bind qua props.files —
	 * LUÔN gán array MỚI khi đổi (kỷ luật $bindable, không mutation tại chỗ).
	 */
	files?: File[];
	accept?: string;
	multiple?: boolean;
	maxFiles?: number;
	maxSize?: number;
	focus: () => void;
	loading?: boolean;
	reset: () => void;
}
