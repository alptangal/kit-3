import type { BasicProps } from '$components/interface';
import type { Color } from '$interfaces/basic';

export interface MessageComponent extends BasicProps {
	nameComponent: string;
	description: string;
	color?: Color;
	nameComponentClass?: string | string[];
	descriptionClass?: string | string[];
	icon?: string;
}
