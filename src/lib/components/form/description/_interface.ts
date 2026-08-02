import type { BasicConfigs, BasicProps, Color, Size } from '$components/interface';

export interface DescriptionProps extends BasicProps {
	color?: Color;
}
export interface DescriptionConfigs extends BasicConfigs {
	size: Size;
}
