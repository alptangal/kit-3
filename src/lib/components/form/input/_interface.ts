import type { BasicConfigs, BasicProps, EventListener } from '$components/interface';
import type { Color, Size, TranslateContent } from '$interfaces/basic';
import type { Snippet, SvelteComponent } from 'svelte';

type InputTypes = 'text' | 'password' | 'number' | 'currency' | 'phone' | 'email';
type InputVariants = 'primary' | 'secondary';
type ValidationCompact = (output?: string) => boolean | Promise<boolean>;
type ValidationFull = {
	id?: string | number;
	isValid: (output?: string) => boolean | Promise<boolean>;
	message?: {
		valid?: TranslateContent;
		invalid?: TranslateContent;
	};
};
export interface InputProps extends BasicProps {
	type?: InputTypes;
	rounded?: Size | 'full' | 'none';
	size?: Size;
	value?: string;
	placeholder?: TranslateContent;
	variant?: InputVariants;
	maxLength?: number | string;
	showPassword?: boolean;
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
}
export interface InputConfigs extends BasicConfigs {
	type: InputTypes;
	size: Size;
	rounded: Size | 'full' | 'none';
	duration: number;
	variant: InputVariants;
	delay: number;
	color: Color;
	maxLength?: number;
	placeholder: Omit<BasicConfigs, 'value'> & {
		value: TranslateContent;
	};
	status: {
		focus?: boolean;
		currentCursor?: number;
	};
	input: { [k in Exclude<InputTypes, 'password'>]: BasicConfigs } & {
		password: BasicConfigs & {
			value?: string;
			showPassword?: boolean;
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
		process?: Map<keyof EventListener, boolean | 'pending'>;
		isValid?: boolean | 'pending';
		messages?: Map<
			string | ((output?: string) => boolean | Promise<boolean>),
			{ content?: TranslateContent; kind: 'valid' | 'invalid' }
		>;
	};
}
