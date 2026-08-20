import type { BasicConfigs, BasicProps, Color, Size, TimeUnits } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

export interface CheckboxIndicatorProps extends BasicProps {
	checked?: boolean;
	color?: Color;
	duration?: TimeUnits;
	rounded?: Size;
}
export interface CheckboxIndicatorConfigs extends BasicConfigs {
	checked?: boolean;
	color: Color;
	duration: number;
	rounded: Size;
}
export interface CheckboxIndicatorCheckedProps extends BasicProps {
	color?: Color;
	duration?: TimeUnits;
}
export interface CheckboxIndicatorCheckedConfigs extends BasicConfigs {
	color: Color;
	duration: number;
}
export interface CheckboxIndicatorUncheckedProps extends BasicProps {}
export interface CheckboxIndicatorUncheckedConfigs extends BasicConfigs {}
export interface CheckboxProps extends BasicProps {
	size?: Size;
	color?: Color;
	checked?: boolean;
	duration?: TimeUnits;
	required?: boolean;
	delay?: TimeUnits;
	name?: string;
}
export interface CheckboxConfigs extends Omit<BasicConfigs, 'status' | 'value'> {
	status: {
		changed?: boolean;
	};
	children: {
		indicator?: CheckboxIndicatorConfigs;
	};
	name?: string;
	loading?: boolean;
	checked?: boolean;
	previousValue?: boolean;
	color: Color;
	duration: number;
	required?: boolean;
	delay?: number;
	validation: {
		process?: Map<keyof EventListener | 'required', boolean | 'pending'>;
		isValid?: boolean | 'pending';
		messages?: Map<
			string | ((output?: string) => boolean | Promise<boolean>),
			{ content?: TranslateContent; kind: 'valid' | 'invalid' }
		>;
	};
	reset: () => void;
	focus?: () => void;
}
