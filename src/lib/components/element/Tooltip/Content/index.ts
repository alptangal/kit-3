import type { Positions } from '$components/interface';
import type { Snippet } from 'svelte';

export interface Content {
	as?: keyof HTMLElementTagNameMap;
	children?: Snippet;
	portal?: HTMLElement | `#${string}` | 'body';
	content?:
		| string
		| {
				main: string;
				description?: string;
		  };
	position?: Positions | 'auto';
	ui?: string | string[];
	size?: 'auto' | 'maximum';
	transition?: 'fade' | 'fly';
	/**offset in pixels */
	offset?: number | `${number}`;
	class?: string | string[];
}

//--------------------------------BEGIN DEFAULTS----------------------
export const defaults: Content = {
	ui: 'w-fit fixed'
};

//--------------------------------END DEFAULTS----------------------
