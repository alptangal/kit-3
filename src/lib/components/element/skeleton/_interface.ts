import type { BasicConfigs, BasicProps } from '$components/interface';
import type { Color } from '$interfaces/basic';

export interface SkeletonButtonProps extends BasicProps {
	color?: Color;
}
export interface SkeletonButtonConfigs extends BasicConfigs {
	color?: Color;
}

export interface SkeletonTextProps extends BasicProps {}
export interface SkeletonTextConfigs extends BasicConfigs {}

export interface SkeletonWrapperProps extends BasicProps {}
export interface SkeletonWrapperConfigs extends BasicConfigs {}

export interface SkeletonProps extends BasicProps {}
export interface SkeletonConfigs extends BasicConfigs {}
