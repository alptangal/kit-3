<script lang="ts">
	import type {
		CheckboxIndicatorUncheckedConfigs,
		CheckboxIndicatorUncheckedProps
	} from '../../_interface';

	let { children, ...props }: CheckboxIndicatorUncheckedProps = $props();
	let configs: CheckboxIndicatorUncheckedConfigs = $state({});
</script>

<svelte:element this={props.as ?? 'div'} bind:this={configs.ref}>uncheck</svelte:element>
