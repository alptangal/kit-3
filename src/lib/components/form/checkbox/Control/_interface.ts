import type { BasicProps } from '$components/interface';
import type { Size } from '$interfaces/basic';

export interface CheckboxControl extends BasicProps {
	radius?: Size | 'full' | 'none';
}
