import type { BasicConfigs, BasicProps, Color, Size } from '$components/interface';

export interface LabelProps extends BasicProps {
	disabled?: boolean;
	invalid?: boolean;
	hiddenRequiredIndicator?: boolean;
	size?: Size;
	color?: Color;
	/** Gắn label với field theo id (attribute `for`). Mặc định tự sinh từ context name. */
	for?: string;
}
export interface LabelConfigs extends BasicConfigs {
	color: Color;
}
