import type { Snippet } from 'svelte';

export interface Trigger {
	as?: keyof HTMLElementTagNameMap;
	children?: Snippet;
	ui?: string | string[];
	class?: string[] | string;
}

//------------------------------------BEGIN DEFAULTS-------------------
//
export const defaults: Trigger = {
	ui: 'overflow-auto'
};
//------------------------------------END DEFAULTS-------------------
