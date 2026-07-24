<script lang="ts">
	import { defaultContainer } from './_default';
	import type { ContainerConfigs, ContainerProps } from './_interface';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { onDestroy } from 'svelte';
	import MessageComponent from '$components/element/messageComponent/MessageComponent.svelte';
	import type { TranslateContent } from '$interfaces/basic';
	import { setContainerContext } from '.';

	const NAME_COMP: TranslateContent = {
		vi: 'Container',
		get en() {
			return this.vi;
		}
	};
	const MESSAGE_ERRORS = {
		main: {
			vi: 'chưa có nội dung',
			en: 'No data'
		} as TranslateContent
	};
	let { children, ...props }: ContainerProps = $props();
	let configs:ContainerConfigs = $state({
		get duration() {
			let d = props.transitionDuration ?? client.browser?.duration ?? 300;
			d = typeof d == 'number' ? d : parseFloat(d);
			return d;
		},
			ref: undefined as undefined | HTMLElement,
			event:{
				load: {
					handler() {
						if (props.portal) {
							if (props.portal instanceof HTMLElement && configs.ref) {
								props.portal.append(configs.ref);
							} else {
								const portal = document.getElementById(props.portal as string);
								if (portal && configs.ref) {
									portal.append(configs.ref);
								}
							}
						}
					},
					options: {}
				},
				click: {
					handler() {},
					options: {
						delay: 3000
					}
				}
			}
	});
	setContainerContext({
	get size(){
	return props.size??client.browser?.size??'md'
	}
	})

	onDestroy(() => {
		if (props.portal && configs.ref) {
			if (props.portal instanceof HTMLElement) {
				props.portal.removeChild(configs.ref);
			} else {
				const portal = document.getElementById(props.portal as string);
				if (portal && portal.contains(configs.ref)) {
					portal.removeChild(configs.ref);
				}
			}
		}
	});

	export { configs };
</script>

{#if children}
	<svelte:element
		this={props.as ?? 'div'}
		{@attach handleEvents([{events:[configs.event??{}]}, props.events])}
		bind:this={configs.ref}
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
		style:--transition-duration={props.transitionEnabled ? `${configs.duration}ms` : undefined}
	>
		{@render children()}
	</svelte:element>
{:else}
	<MessageComponent
		nameComponent={NAME_COMP[client.browser?.language ?? 'en'] ?? ''}
		color="danger"
		description={MESSAGE_ERRORS.main[client.browser?.language ?? 'en'] ?? ''}
	/>
{/if}
