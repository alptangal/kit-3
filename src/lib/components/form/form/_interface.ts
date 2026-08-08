import type { BasicConfigs, BasicProps, Size } from '$components/interface';
import type { CheckboxConfigs } from '../checkbox/_interface';
import type { TextFieldConfigs } from '../textField/_interface';

export interface FormProps extends BasicProps {
	method?: 'post' | 'get' | 'dialog';
}
export interface FormConfigs extends Omit<BasicConfigs, 'childrens'> {
	method: 'post' | 'get' | 'dialog';
	action?: string;
	encryptDataType?: 'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain';
	target?: '_self' | '_blank' | '_parent' | '_top';
	disabled?: boolean;
	loading?: boolean;
	onSubmit?: () => void;
	onReset?: () => void;
	onInvalid?: () => void;
	size?: Size;
	childrens?: Set<TextFieldConfigs | CheckboxConfigs>;
	validation: {
		isValid?: boolean;
	};
}
export interface FormContext {
	size?: Size;
}
