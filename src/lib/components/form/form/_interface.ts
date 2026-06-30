import type { BasicProps } from '$components/interface';
import type { Size } from '$interfaces/basic';

export interface Form extends BasicProps {
	action?: string;
	encryptDataType?: 'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain';
	method?: 'get' | 'post';
	target?: '_self' | '_blank' | '_parent' | '_top';
	disabled?: boolean;
	loading?: boolean;
	onSubmit?: () => void;
	onReset?: () => void;
	onInvalid?: () => void;
	size?: Size;
}
