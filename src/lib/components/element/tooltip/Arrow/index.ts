import type { Color, Size } from '$components/interface';
import type { Snippet } from 'svelte';

export interface Arrow {
	children?: Snippet;
	ui?: string | string[];
	as?: keyof HTMLElementTagNameMap;
	color?: Color;
	size?: Size;
}

export const defaults: Arrow = {
	ui: ''
};
