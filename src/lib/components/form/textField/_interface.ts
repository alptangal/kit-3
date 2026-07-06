import type { BasicProps, EventListener } from '$components/interface';
import type { Size } from '$interfaces/basic';

export interface TextField extends BasicProps {
	orientation?: 'vertical' | 'horizontal';
	required?: boolean;
	errorRequiredMessage?: string;
	size?: Size;
	hint?: string;
	error?: string;
	help?: string;
	description?: string;
	label?: string;
	name?: string;
	disabled?: boolean;
	isInvalid?: boolean;
	errorMessages?: {
		required?: string;
	};
	validate?: {
		[event in keyof EventListener]: {
			isValid: (value: object | number | string | undefined | null) => Promise<boolean> | boolean;
			message?: {
				valid?: string;
				invalid?: string;
			};
			result?: boolean;
		};
	};
}
