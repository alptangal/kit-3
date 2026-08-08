import type { BasicConfigs, BasicProps } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

export interface FieldMessagesProps extends BasicProps {}
export interface fieldMessagesConfigs extends BasicConfigs {
	messages?: Map<
		string | ((output?: string) => boolean | Promise<boolean>),
		{ content?: TranslateContent; kind: 'valid' | 'invalid' }
	>;
}
