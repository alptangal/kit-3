import type { BasicProps } from '$components/interface';

export interface ContainerProps extends BasicProps {
	/**Width of the container in pixels. */
	width?: string | number;
	/**Height of the container in pixels. */
	height?: string | number;
}
