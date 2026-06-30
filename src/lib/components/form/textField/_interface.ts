import type { BasicProps } from '$components/interface';
import type { Size } from '$interfaces/basic';

export interface TextField extends BasicProps {
	orientation?: 'vertical' | 'horizontal';
	required?: boolean;
	size?: Size;
	hint?: string;
	error?: string;
	help?: string;
	description?: string;
	label?: string;
	name?: string;
	disabled?: boolean;
	isInvalid?: boolean;
}
