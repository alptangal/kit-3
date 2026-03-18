import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		alias: {
			$components: './src/lib/components/*',
			$assets: './src/lib/assets/*',
			$interfaces: './src/lib/interfaces/*',
			$modules: './src/lib/modules/*',
			$store: './src/lib/store/*'
		}
	}
};

export default config;
