<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { profile, client } from '$store/basic.svelte';
	import { onDestroy, onMount } from 'svelte';
	import '../app.css';
	import { Container, Footer, Header } from '$components/layout';
	import { browser } from '$app/environment';
	import { Button, Tooltip } from '$components/element/index.js';
	import { iconify } from '$assets/icons/iconify.js';
	import Icon from '@iconify/svelte';
	import { detectBrowserType, updateResizeWindow, watchClipboard } from '$modules';
	import Numberic from '$components/keyboard/numberic/Numberic.svelte';
	import { Checkbox, Description, Form, Label, TextField } from '$components/form/index.js';
	import { getFormContext } from '$components/form/form/index.js';
	import type { Theme } from '$interfaces/basic.js';

	let { data, children } = $props();

	let configs = $state({
		timeoutId: undefined as undefined | NodeJS.Timeout,
		tooltip: {
			portal: undefined as undefined | HTMLElement | Body
		},
		timeId: {
			click: null as null | number
		}
	});

	function handleResize() {
		if (configs.timeoutId) clearTimeout(configs.timeoutId);
		configs.timeoutId = setTimeout(() => {
			profile.browser.dimensions = {
				width: window.innerWidth,
				height: window.innerHeight
			};
		}, profile.delay);
	}
	function handleClick(e: MouseEvent) {
		if (configs.timeId.click) cancelAnimationFrame(configs.timeId.click);
		configs.timeId.click = requestAnimationFrame(() => {
			profile.cursor.x = e.clientX;
			profile.cursor.y = e.clientY;
		});
	}
	onMount(async () => {
		if (browser) {
			await import('virtual:uno.css');
			configs.tooltip.portal = document.body;
			if (window.visualViewport) {
				window.visualViewport.addEventListener('resize', updateResizeWindow);
				window.visualViewport.addEventListener('scroll', updateResizeWindow);
			} else {
				window.addEventListener('resize', handleResize);
			}
			profile.browser.dimensions = {
				width: window.innerWidth,
				height: window.innerHeight
			};

			if (data.userAgent) profile.browser.userAgent = data.userAgent;
			document.body.addEventListener('click', handleClick);
			if (!profile.screen.height || !profile.screen.width) {
				profile.screen = {
					width: window.innerWidth,
					height: window.innerHeight
				};
			}
			client.browser = {
				userAgent: data.userAgent,
				originalResolution: {
					width: window.innerWidth,
					height: window.innerHeight
				},
				get isMobile() {
					if (!this.userAgent) return undefined;
					return detectBrowserType(this.userAgent)?.includes('desktop') ? false : true;
				},
				get os() {
					if (!this.userAgent) return undefined;
					const result = detectBrowserType(this.userAgent);
					switch (result) {
						case 'desktop/chrome':
							return 'chrome';
						case 'desktop/linux':
							return 'linux';
						case 'desktop/mac':
							return 'mac';
						case 'desktop/window':
							return 'window';
						case 'mobile/android':
							return 'android';
						case 'mobile/ios':
							return 'ios';
					}
				},
				width: window.innerWidth,
				height: window.innerHeight,
				get theme() {
					if (localStorage.getItem('theme')) return localStorage.getItem('theme') as Theme;
					return 'system';
				},
				get size() {
					return this.isMobile ? 'md' : 'sm';
				}
			};
		}
	});
	onDestroy(() => {
		if (browser) {
			try {
				if (window) window.removeEventListener('resize', handleResize);
				if (window.visualViewport) {
					window.visualViewport.removeEventListener('resize', updateResizeWindow);
					window.visualViewport.removeEventListener('scroll', updateResizeWindow);
				}
				watchClipboard((e, data) => {
					profile.clipboard.value = data;
				});
				document.body.removeEventListener('click', handleClick);
			} catch (e) {}
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" id="themeMetaTag" content="#defaultColor" />
</svelte:head>

<Container
	touchActionDisabled={profile.visualKeyboard.focusOn ? true : false}
	transitionEnabled
	width={profile.browser.dimensions?.width ?? 0}
	height={profile.browser.dimensions?.height ?? 0}
	class="overflow-auto"
>
	{@render children()}
</Container>
{#if profile.visualKeyboard.focusOn}
	<Numberic
		doneButtonEnabled
		otherFieldsButtonEnabled
		bind:this={profile.visualKeyboard.component}
		output={(val) => {
			if (profile.visualKeyboard.onKeyup) profile.visualKeyboard.onKeyup(val);
		}}
		disableKeys={[]}
	/>
{/if}

<style lang="scss">
	@use '$assets/styles/basic.scss';
</style>
