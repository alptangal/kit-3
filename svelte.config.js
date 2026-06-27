import adapter from '@sveltejs/adapter-auto';
import UnoCSS from '@unocss/svelte-scoped/preprocess';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [
		vitePreprocess(),
		UnoCSS({
			classPrefix: 'me-'
		})
	],
	kit: {
		adapter: adapter(),
		alias: {
			$components: './src/lib/components/*',
			$assets: './src/lib/assets/*',
			$interfaces: './src/lib/interfaces/*',
			$modules: './src/lib/modules/*',
			$store: './src/lib/store/*'
		}
	},
	vitePlugin: {
		inspector: {
			//showToggleButton: 'always'
		}
	}
};

export default config;
