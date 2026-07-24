<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { IconConfigs, IconProps } from './_interface';
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { getTextfieldCtx } from '$components/form/textField';
	import { getFormContext } from '$components/form/form';
	import { getSearchMainContext } from '$components/search/Main/_context';
	import { handleEvents } from '$modules/_attachments';
	import { onDestroy } from 'svelte';

	let { ...props }: IconProps = $props();
	let configs: IconConfigs = $state({
		get size() {
			return (
				props.size ??
				searchMainCtx?.size ??
				textfieldCtx?.size ??
				formCtx?.size ??
				client.browser?.size ??
				'md'
			);
		},
		get style() {
			const defaultStyles: string[] = ['icon'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		event: {
			load: {
				handler() {
					if (props.onLoad)
						props.onLoad({
							ref: configs.ref,
							get width() {
								return this.ref?.offsetWidth;
							},
							get height() {
								return this.ref?.offsetHeight;
							}
						});
				}
			}
		}
	});
	const textfieldCtx = getTextfieldCtx();
	const formCtx = getFormContext();
	const searchMainCtx = getSearchMainContext();

	onDestroy(() => {
		if (props.onDestroy)
			props.onDestroy({
				ref: configs.ref
			});
	});

	export { configs };
</script>

<svelte:element
	this={props.as ?? 'span'}
	data-size={configs.size}
	class={configs.style}
	bind:this={configs.ref}
	{@attach handleEvents([{ events: [configs.event ?? {}] }])}
>
	<Icon icon={props.icon} />
</svelte:element>

<style lang="scss">
	:global(.icon) {
		width: fit-content;
		font-size: var(--font-size);
	}
</style>
