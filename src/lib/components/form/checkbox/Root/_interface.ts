import type { BasicProps } from '$components/interface';
import type { Color, Size } from '$interfaces/basic';

export interface Checkbox extends BasicProps {
	name?: string;
	checked?: boolean;
	size?: Size;
	color?: Color;
	radius?: Size | 'full';
	required?: boolean;
}
