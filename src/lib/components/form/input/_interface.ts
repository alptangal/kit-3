import type { BasicProps } from '$components/interface';
import type { Size } from '$interfaces/basic';

export interface InputProps extends BasicProps {
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
	onEnter?: () => void;
}
