<script lang="ts">
	import { styleSynced } from '$modules';
	import type { Snippet } from 'svelte';
	import type { PageProps } from './$types';

	let { data, children }: { data: PageProps; children: Snippet } = $props();
	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		get style() {
			const defaultStyles: string[] = ['unauthorized-layout', 'min-h-dvh', 'w-full'];
			return styleSynced({ defaultStyles });
		}
	});
</script>

<div bind:this={configs.ref} class={configs.style}>
	{@render children()}
</div>

<style lang="scss">
	.unauthorized-layout {
		min-height: 100dvh;
		width: 100%;
		display: flex;
		flex-direction: column;
	}
</style>
