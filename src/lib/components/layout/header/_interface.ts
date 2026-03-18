import type { BasicProps } from '$components/interface';

export interface HeaderProps extends BasicProps {
	left?:
		| SvelteSlots
		| (Pick<BasicProps, 'events' | 'class' | 'overwriteDefaultStyles'> & {
				snippet?: SvelteSlots;
				title?: string;
				subtitle?: string;
				icon?: string;
		  });
	center?:
		| SvelteSlots
		| (Pick<BasicProps, 'events' | 'class' | 'overwriteDefaultStyles'> & {
				snippet?: SvelteSlots;
				title?: string;
				icon?: string;
		  });
	right?:
		| SvelteSlots
		| (Pick<BasicProps, 'events' | 'class' | 'overwriteDefaultStyles'> & {
				snippet?: SvelteSlots;
				title?: string;
				icon?: string;
		  });
}
