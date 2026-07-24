import type { BasicConfigs, BasicProps } from '$components/interface';
import type { Direction, TranslateContent } from '$interfaces/basic';
import type { SvelteComponent } from 'svelte';

export interface SearchMainRootProps extends BasicProps {
	direction?: Direction;
	mode?: 'compact' | 'normal';
}
export interface SearchMainRootConfigs extends BasicConfigs {
	status?: BasicConfigs['status'] & {
		direction?: Direction;
	};
	mode?: 'compact' | 'normal';
	timeId?: Map<string, number | NodeJS.Timeout>;
	modal?: {
		status?: {
			display?: boolean;
		};
	};
}
export interface SearchMainInput extends BasicProps {}
export interface SearchMainInputConfigs extends BasicConfigs {
	component?: SvelteComponent & BasicConfigs;
	placeholder?: TranslateContent;
}
export interface SearchMainControlProps extends BasicProps {
	disabled?: boolean;
}
export interface SearchMainControlConfigs extends BasicConfigs {
	disabled?: boolean;
}
