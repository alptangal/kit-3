<script lang="ts">
	import MessageComponent from '$components/element/messageComponent/MessageComponent.svelte';
	import type { TranslateContent } from '$interfaces/basic';
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { omit } from 'es-toolkit/compat';
	import { setNavigationMainCtx } from '..';
	import type { NavigationMainRoot } from '../_inteface';
	import { SvelteMap } from 'svelte/reactivity';

	const NAME_COMP: TranslateContent = { en: 'Navigator', vi: 'Thanh điều hướng' };
	const MESSAGE_ERROR = {
		main: {
			en: 'Not enough data for component ',
			vi: 'Lỗi nghiêm trọng do không đủ dữ liệu cung cấp cho component'
		} as TranslateContent
	};
	let { children, ...props }: NavigationMainRoot = $props();
	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		get style() {
			const defaultStyles: string[] = ['nav-main-root'];
			return styleSynced({ defaultStyles });
		},
		childrens: undefined as
			| undefined
			| Map<
					'center' | 'left' | 'right',
					{
						ref?: HTMLElement;
					}
			  >
	});
	setNavigationMainCtx({
		get childrens() {
			return configs.childrens;
		},
		addNode(data) {
			if (!configs.childrens) configs.childrens = new SvelteMap();
			configs.childrens.set(data.position, omit(data, ['position']));
			return configs.childrens;
		}
	});
</script>

{#if children}
	<svelte:element this={props.as ?? 'nav'} bind:this={configs.ref} class={configs.style}>
		{@render children()}
	</svelte:element>
{:else}
	<MessageComponent
		nameComponent={NAME_COMP[client.browser?.language ?? 'en'] ?? ''}
		color="danger"
		description={MESSAGE_ERROR.main[client.browser?.language ?? 'en'] ?? ''}
	/>
{/if}

<style lang="scss">
	.nav-main-root {
		@apply grid grid-cols-3;
	}
</style>
