import type { BasicConfigs, BasicProps, Size } from '$components/interface';
import type { DescriptionConfigs } from '../description/_interface';
import type { InputConfigs } from '../input/_interface';
import type { LabelConfigs } from '../label/_interface';

export interface TextFieldProps extends BasicProps {
	loading?: boolean;
	required?: boolean;
}
export interface TextFieldConfigs extends BasicConfigs {
	size: Size;
	status: {
		hover?: boolean;
		focus?: boolean;
		changed?: boolean;
		reseting?: boolean;
		selectAll?: boolean;
	};
	loading?: boolean;
	name?: string;
	required?: boolean;
	value?: string;
	setValue?: (value?: string) => void;
	validation?: {
		isValid?: boolean | 'pending';
		setValid?: (value?: boolean | 'pending') => void;
	};
	children?: {
		label?: LabelConfigs;
		description?: DescriptionConfigs;
		input?: InputConfigs;
	};
	previousValue?: string;
	reset: () => void;
}
export interface TextFieldContext extends TextFieldConfigs {
	setValue?: (value?: string) => void;
}
