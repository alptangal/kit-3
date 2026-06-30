import type { BasicProps } from '$components/interface';
import type { Size } from '$interfaces/basic';

export interface Label extends BasicProps {
	disabled?: boolean;
	invalid?: boolean;
	required?: boolean;
	size?: Size;
}
