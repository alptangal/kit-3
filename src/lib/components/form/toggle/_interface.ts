import type { BasicProps, Color } from '$components/interface';

export interface ToggleProps extends BasicProps {
	checked?: boolean;
	color?: Color;
	loading?: boolean;
	onchange?: (checked: boolean) => void;
}
