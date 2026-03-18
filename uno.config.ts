import { defineConfig, transformerDirectives, presetMini, presetWind4, presetWind3 } from 'unocss';

import extractorSvelte from '@unocss/extractor-svelte';

export default defineConfig({
	transformers: [transformerDirectives()],
	extractors: [extractorSvelte()],
	presets: [presetWind3()],
	content: {
		pipeline: {
			include: [
				// the default
				/\.(vue|svelte|[jt]sx|vine.ts|mdx?|astro|elm|php|phtml|marko|html)($|\?)/,
				// include js/ts files
				'src/**/*.{js,ts}'
			]
			// exclude files
			// exclude: []
		}
	}
});
