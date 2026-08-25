<script lang="ts">
	import { styleSynced } from '$modules';
	import { getToastContext } from '../..';
	import type { ToastContentTitleConfigs, ToastContentTitleProps } from '../../_interface';

	let { children, ...props }: ToastContentTitleProps = $props();
	let configs: ToastContentTitleConfigs = $state({
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'toast-content-title-root',
				`color-${this.color}`
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get color() {
			return props.color ?? toastContext?.color ?? 'default';
		}
	});
	const toastContext = getToastContext();
</script>

<svelte:element this={props.as ?? 'div'} bind:this={configs.ref} class={configs.style}>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	@use '$styles/colors.scss';
	.toast-content-title-root {
		color: var(--color);
	}
</style>
