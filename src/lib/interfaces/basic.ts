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
export type Color = 'default' | 'accent' | 'success' | 'warning' | 'danger';
export type Variant =
	| 'outline'
	| 'solid'
	| 'outline'
	| 'soft'
	| 'subtle'
	| 'ghost'
	| 'link'
	| 'shadow'
	| 'flat'
	| 'faded'
	| 'light';
export interface Browser {
	type?:
		| 'mobile/android'
		| 'mobile/ios'
		| 'desktop/window'
		| 'desktop/macos'
		| 'desktop/linux'
		| 'desktop/chromeos';
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
	safariBrowser?: {
		addressBarMinimized?: boolean;
		visualKeyboardDisplay?: boolean;
	};
}
export type AppTheme = 'system' | 'dark' | 'light';
