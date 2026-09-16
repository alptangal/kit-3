import type { BasicConfigs, BasicProps, Color, Size } from '$components/interface';

export interface DescriptionProps extends BasicProps {
	color?: Color;
	persistent?: boolean;
	autoHide?: boolean;
}
export interface DescriptionConfigs extends BasicConfigs {
	size: Size;
	persistent?: boolean;
	autoHide?: boolean;
}
