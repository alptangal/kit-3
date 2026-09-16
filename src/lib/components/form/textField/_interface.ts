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
	/** Giá trị mốc ban đầu khi component mount — dùng để xác định changed và reset */
	initialValue?: string;
	status: {
		hover?: boolean;
		focus?: boolean;
		changed?: boolean;
		reseting?: boolean;
		selectAll?: boolean;
		touched?: boolean;
	};
	disabled?: boolean;
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
	onEnter?: () => void;
	onTab?: () => void;
	focus?: () => void;
}
export interface TextFieldContext extends TextFieldConfigs {
	setValue?: (value?: string) => void;
}
