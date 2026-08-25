<script lang="ts">
	import { styleSynced } from '$modules';
	import type { ToastContentConfigs, ToastContentProps } from '../_interface';

	let { children, ...props }: ToastContentProps = $props();
	let configs: ToastContentConfigs = $state({
		get style() {
			const defaultStyles: (string | undefined)[] = ['toast-content-root'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		}
	});
</script>

<svelte:element this={props.as ?? 'div'} bind:this={configs.ref} class={configs.style}>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	.toast-content-root {
	}
</style>
