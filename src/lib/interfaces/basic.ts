import type { Timezone } from './timezone';

export type Size =
	| 'xs'
	| 'sm'
	| 'md'
	| 'lg'
	| 'xl'
	| '2xl'
	| '3xl'
	| '4xl'
	| '5xl'
	| '6xl'
	| '7xl'
	| '8xl'
	| '9xl';
export type Theme = 'dark' | 'light' | 'system';
export interface Browser {
	type?: 'mobile' | 'desktop';
	userAgent?: string;
	dimensions?: {
		/**Pixel units */
		width?: number;
		/**Pixcel units */
		height?: number;
	};
	theme?: Theme;
	timezone?: Timezone;
	region?: string;
	OS?: string;
}
