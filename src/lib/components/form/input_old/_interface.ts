import type { BasicProps, MetaChildren } from '$components/interface';
import type { Size } from '$interfaces/basic';

export interface InputProps_Old extends BasicProps {
	placeholder?: string;
	variant?: 'primary' | 'secondary';
	size?: Size | 'full-width';
	disabled?: boolean;
	value?: string | number;
	type?: 'text' | 'number' | 'phone' | 'email' | 'password';
	clearButtonEnabled?: boolean;
	loading?: boolean;
	loadingAnimation?:
		| `style-${number}`
		| {
				style: `style-${number}`;
				duration: number | `${number}` | `${number}s` | `${number}ms`;
		  };
	focusAtStart?: boolean;
	showPassword?: boolean;
	showPasswordButtonEnabled?: boolean;
	onEnter?: (value?: number | string) => void;
	name?: string;
	copyButtonEnabled?: boolean;
	onLoaded?: (data: MetaChildren) => void;
	onChange?: (value?: number | string) => void;
	onKeyup?: (value?: number | string) => void;
	onKeydown?: (value?: number | string) => void;
	onBlur?: (value?: number | string) => void;
	onFocus?: (value?: number | string) => void;
	onClear?: (value?: number | string) => void;
	leadingIcon?: string;
	trailingIcon?: string;
}
