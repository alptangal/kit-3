import type { Color, Size } from '$interfaces/basic';
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
