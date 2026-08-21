import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
//import tailwindcss from '@tailwindcss/vite';
import UnoCSS from '@unocss/svelte-scoped/vite';
import UnoCSSVite from 'unocss/vite';
import extractorSvelte from '@unocss/extractor-svelte';
import path from 'node:path';
import fs from 'fs';

export default defineConfig({
	plugins: [
		sveltekit(),
		//tailwindcss()
		UnoCSS({
			onlyGlobal: true,
			injectReset: '@unocss/reset/tailwind.css'
		}),
		UnoCSSVite({
			extractors: [extractorSvelte()]
		})
	],
	css: {
		preprocessorOptions: {
			scss: {
				loadPaths: [path.resolve('src/lib/assets')]
			}
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	},
	resolve: {
		alias: {
			'@': path.resolve('./src'),
			'@components': path.resolve('./src/lib/components'),
			'@lib': path.resolve('./src/lib'),
			$lib: path.resolve('./src/lib'),
			$styles: path.resolve('./src/lib/assets/styles'),
			$modules: path.resolve('./src/lib/modules'),
			$plugins: path.resolve('./src/lib/plugins'),
			$assets: path.resolve('./src/lib/assets')
		}
	},
	build: {
		// Safari 15 = WebKit 15 → target safari15
		target: ['es2020', 'safari15']
	},
	server: {
		https: {
			cert: fs.readFileSync('./192-168-2-30.sslip.io.pem'),
			key: fs.readFileSync('./192-168-2-30.sslip.io-key.pem')
		},
		host: '0.0.0.0', // cho phép truy cập từ thiết bị khác trong LAN,
		port: 3000,
		hmr: {
			host: 'phuongdomega.test',
			port: 3000,
			protocol: 'wss' // Sử dụng wss vì bạn chạy HTTPS
		}
	}
	// server: {
	// 	https: {
	// 		key: fs.readFileSync('localhost-key.pem'),
	// 		cert: fs.readFileSync('localhost.pem')
	// 	}
	// }
});
