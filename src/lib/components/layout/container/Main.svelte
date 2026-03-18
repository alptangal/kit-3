<script lang="ts">
	import type { BasicProps } from '$components/interface';

	import { defaultContainer } from './_default';
	import type { ContainerProps } from './_interface';
	import { handleEvents } from '$modules/_attachments';
	import { profile } from '$store/basic.svelte';
	import { onDestroy } from 'svelte';

	let { ...props }: ContainerProps = $props();
	let configs = $state({
		root: {
			ref: undefined as undefined | HTMLElement,
			events: {
				event: [
					{
						load: {
							handler() {
								if (props.portal) {
									if (props.portal instanceof HTMLElement && configs.root.ref) {
										props.portal.append(configs.root.ref);
									} else {
										const portal = document.getElementById(props.portal as string);
										if (portal && configs.root.ref) {
											portal.append(configs.root.ref);
										}
									}
								}
							},
							options: {}
						},
						click: {
							handler(e) {},
							options: {
								delay: 3000
							}
						}
					}
				]
			} as BasicProps['events']
		}
	});

	onDestroy(() => {
		if (props.portal && configs.root.ref) {
			if (props.portal instanceof HTMLElement) {
				props.portal.removeChild(configs.root.ref);
			} else {
				const portal = document.getElementById(props.portal as string);
				if (portal && portal.contains(configs.root.ref)) {
					portal.removeChild(configs.root.ref);
				}
			}
		}
	});

	export { configs };
</script>

<svelte:element
	this={props.as ?? 'div'}
	{@attach handleEvents([configs.root.events])}
	bind:this={configs.root.ref}
	class={props.overwriteDefaultStyles
		? props.class
		: [
				...(typeof defaultContainer.class == 'object'
					? (defaultContainer.class ?? [])
					: typeof defaultContainer.class == 'string'
						? [defaultContainer.class]
						: []),
				...(typeof props.class == 'object'
					? (props.class ?? [])
					: typeof props.class == 'string'
						? [props.class]
						: [])
			]}
	style:touch-action={props.touchActionDisabled ? 'none' : 'auto'}
	style:width={typeof props.width == 'number' ? `${props.width}px` : (props.width ?? 'auto')}
	style:height={typeof props.height == 'number' ? `${props.height}px` : (props.height ?? 'auto')}
	style:transition-duration="var(--transition-duration)"
	style:--transition-duration={props.transitionEnabled
		? `${props.transitionDuration ?? profile.transition.duration}ms`
		: undefined}
>
	{#if props.snippet && typeof props.snippet == 'function'}
		{@render props.snippet()}
	{/if}
</svelte:element>
