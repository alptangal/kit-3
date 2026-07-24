import type { BasicComponent, BasicConfigs, BasicProps } from '$components/interface';
import type { Color } from '$interfaces/basic';

export interface LoadingRotateProps extends BasicProps {
	color?: Color;
}
export interface LoadingRotateConfigs extends BasicConfigs {
	canvas: BasicConfigs;
}
