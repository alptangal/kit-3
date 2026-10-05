<script lang="ts">
	import { Icon } from '$components/element';
	import type { ToastIndicatorConfigs, ToastIndicatorProps } from '../_interface';

	let { ...props }: ToastIndicatorProps = $props();
	let configs: ToastIndicatorConfigs = $state({});
</script>

<svelte:element this={props.as ?? 'div'} bind:this={configs.ref} aria-hidden="true">
	<Icon icon={props.icon} />
</svelte:element>
