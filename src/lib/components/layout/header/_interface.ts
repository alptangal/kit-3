import type { Snippet } from 'svelte';
import type { BasicProps } from '$components/interface';

export interface HeaderProps extends BasicProps {
	left?:
		| Snippet
		| (Pick<BasicProps, 'events' | 'class' | 'overwriteDefaultStyles'> & {
				snippet?: Snippet;
				title?: string;
				subtitle?: string;
				icon?: string;
		  });
	center?:
		| Snippet
		| (Pick<BasicProps, 'events' | 'class' | 'overwriteDefaultStyles'> & {
				snippet?: Snippet;
				title?: string;
				icon?: string;
		  });
	right?:
		| Snippet
		| (Pick<BasicProps, 'events' | 'class' | 'overwriteDefaultStyles'> & {
				snippet?: Snippet;
				title?: string;
				icon?: string;
		  });
}
