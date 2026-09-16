import type { BasicConfigs, BasicProps, Size } from '$components/interface';
import type { CheckboxConfigs } from '../checkbox/_interface';
import type { TextFieldConfigs } from '../textField/_interface';

export interface FormProps extends BasicProps {
	method?: 'post' | 'get' | 'dialog';
	action?: string;
	encryptDisabled?: boolean;
	data?: Record<string, any>;
	onSubmit?: () => void | Promise<void>;
	onReset?: () => void | Promise<void>;
	onResponse?: () => void | Promise<void>;
}
export interface FormConfigs extends Omit<BasicConfigs, 'childrens' | 'status'> {
	method: 'post' | 'get' | 'dialog';
	action: string;
	encryptDataType?: 'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain';
	target?: '_self' | '_blank' | '_parent' | '_top';
	disabled?: boolean;
	loading?: boolean;
	data?: Record<string, any>;
	status: {
		changed?: boolean;
	};
	onSubmit?: () => void | Promise<void>;
	onReset?: () => void | Promise<void>;
	onResponse?: () => void | Promise<void>;
	onInvalid?: () => void | Promise<void>;
	size?: Size;
	childrens?: Set<TextFieldConfigs | CheckboxConfigs>;
	validation: {
		isValid?: boolean;
	};
	encryptDisabled?: boolean;
	reset: () => void;
}
export interface FormContext {
	size?: Size;
}
