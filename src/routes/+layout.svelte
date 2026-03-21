<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { profile } from '$store/basic.svelte';
	import { onDestroy, onMount } from 'svelte';
	import '../app.css';
	import { Container, Footer, Header } from '$components/layout';
	import { browser } from '$app/environment';
	import { Button, Tooltip } from '$components/element/index.js';
	import { iconify } from '$assets/icons/iconify.js';

	let { data, children } = $props();

	let configs = $state({
		timeoutId: undefined as undefined | NodeJS.Timeout
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
	onMount(async () => {
		if (browser) {
			await import('virtual:uno.css');
		}
		profile.browser.dimensions = {
			width: window.innerWidth,
			height: window.innerHeight
		};
		if (data.userAgent) profile.browser.userAgent = data.userAgent;
		window.addEventListener('resize', handleResize);
	});
	onDestroy(() => {
		if (browser) {
			try {
				if (window) window.removeEventListener('resize', handleResize);
			} catch (e) {}
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Container
	touchActionDisabled
	transitionEnabled
	width={profile.browser.dimensions?.width ?? 0}
	height={profile.browser.dimensions?.height ?? 0}
	class=""
>
	{#snippet snippet()}
		<Header>
			{#snippet left()}
				<Tooltip portal="body" offset={10} position="top">
					<Button
						label="Button"
						loading
						disabled
						variant="shadow"
						color="secondary"
						leading={iconify['mdi:loading']}
						trailing={iconify['mdi:loading']}
						loadingAnimation={{
							style: 'style-3',
							duration: '100s'
						}}
					></Button>
				</Tooltip>
			{/snippet}
		</Header>
		{@render children()}
		<Footer></Footer>
	{/snippet}
</Container>

<style lang="scss">
	/* @import '$assets/styles/safari_15/tailwind.scss'; */
	@import '$assets/styles/basic.scss';
</style>
