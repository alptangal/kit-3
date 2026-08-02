import type { BasicConfigs, BasicProps, Color, Size } from '$components/interface';

export interface LabelProps extends BasicProps {
	disabled?: boolean;
	invalid?: boolean;
	hiddenRequiredIndicator?: boolean;
	size?: Size;
	color?: Color;
}
export interface LabelConfigs extends BasicConfigs {
	color: Color;
}
