import type { BasicComponent, BasicConfigs, BasicProps, Color } from '$components/interface';

export interface LoadingRotateProps extends BasicProps {
	color?: Color;
}
export interface LoadingRotateConfigs extends BasicConfigs {
	canvas: BasicConfigs;
}
