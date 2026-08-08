<script lang="ts">
	import { styleSynced } from '$modules';
	import type { Snippet } from 'svelte';
	import type { PageProps } from './$types';
	import { NavigationMenu } from '$components/navigation';
	import { SearchMain } from '$components/search/Main';

	let { data, children }: { data: PageProps; children: Snippet } = $props();
	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		get style() {
			const defaultStyles: string[] = [];
			return styleSynced({ defaultStyles });
		}
	});
</script>

<div bind:this={configs.ref} class={configs.style}>
	<NavigationMenu>
		<NavigationMenu.left>left</NavigationMenu.left>
		<NavigationMenu.center>
			<SearchMain class="w-full">
				<SearchMain.Control />
			</SearchMain>
		</NavigationMenu.center>
		<NavigationMenu.right>right</NavigationMenu.right>
	</NavigationMenu>
	{@render children()}
</div>

<style lang="scss">
</style>
