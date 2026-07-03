<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { profile } from '$store/basic.svelte';
	import { onDestroy, onMount } from 'svelte';
	import '../app.css';
	import { Container, Footer, Header } from '$components/layout';
	import { browser } from '$app/environment';
	import { Button, Tooltip } from '$components/element/index.js';
	import { iconify } from '$assets/icons/iconify.js';
	import Icon from '@iconify/svelte';
	import Input from '$components/form/input/Input.svelte';
	import { detectBrowserType, updateResizeWindow, watchClipboard } from '$modules';
	import Numberic from '$components/keyboard/numberic/Numberic.svelte';
	import { Description, Form, Label, TextField } from '$components/form/index.js';

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
	let t = $state('');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" id="themeMetaTag" content="#defaultColor" />
</svelte:head>
<Button
	events={{
		events: [
			{
				click: {
					handler() {
						if (profile.theme == 'system') {
							profile.theme = 'dark';
							//document.documentElement.style.backgroundColor = 'hsl(var(--black))';
						} else if (profile.theme == 'dark') {
							profile.theme = 'light';
							//document.documentElement.style.backgroundColor = 'hsl(var(--white))';
						} else if (profile.theme == 'light') {
							profile.theme = 'system';
						}
						setTimeout(() => {
							console.log(profile.theme);
						}, 1000);
					}
				}
			}
		]
	}}>{profile.theme}</Button
>
<Container
	touchActionDisabled={profile.visualKeyboard.focusOn ? true : false}
	transitionEnabled
	width={profile.browser.dimensions?.width ?? 0}
	height={profile.browser.dimensions?.height ?? 0}
	class="overflow-auto"
>
	{#snippet snippet()}
		<Header>
			{#snippet left()}
				<Button
					size="9xl"
					label="haha"
					description="here is description here is description"
					color="success"
					icon={iconify['arrow-left-rounded']}
					loadingIcon={iconify['loading-fill']}
					loadingAnimation={{ style: 'style-1', duration: 3000 }}
					loading
				></Button>

				<Form method="get" action="/">
					<TextField required isInvalid={false}>
						<Label>Username</Label>
						<Input
							class="border border-solid border-gray-500"
							overwriteDefaultStyles
							placeholder="Please enter your keys"
							clearButtonEnabled
							type="number"
							loading
							loadingAnimation={{ style: 'style-4', duration: '1s' }}
						/>
						<Description>Here is username field very large</Description>
					</TextField>
					<TextField required>
						<Label>Password</Label>
						<Input
							class="border border-solid border-gray-500"
							overwriteDefaultStyles
							placeholder="Please enter your keys"
							clearButtonEnabled
							type="password"
							loading
							loadingAnimation={{ style: 'style-4', duration: '1s' }}
							focusAtStart
							showPassword
							showPasswordButtonEnabled
						/>
						<Description>Here is username field very large</Description>
					</TextField>
				</Form>
				<p>{t}</p>
				<button
					class="w-12 h-12"
					onclick={() => {
						t += 1;
					}}>1</button
				>
				<button
					class="w-12 h-12"
					onclick={() => {
						t += 2;
					}}>2</button
				>
				<button
					class="w-12 h-12"
					onclick={() => {
						t += 3;
					}}>3</button
				>
			{/snippet}
		</Header>
		{@render children()}
		<Footer></Footer>
	{/snippet}
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
