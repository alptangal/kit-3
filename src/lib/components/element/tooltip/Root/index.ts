import type { Snippet } from 'svelte';

export interface Root {
	children?: Snippet;
	as?: keyof HTMLElementTagNameMap;
	class?: string | string[];
}
