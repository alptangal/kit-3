<script lang="ts">
	//$components/element/separator/Main.svelte
	// Separator — vạch ngăn cách (horizontal/vertical) chạy qua design token.
	// Building block nhỏ cho Sidebar / form / cards.
	import { styleSynced } from '$modules';
	import type { SeparatorConfigs, SeparatorProps } from './_interface';

	let { orientation = 'horizontal', decorative = false, ...props }: SeparatorProps = $props();

	let configs: SeparatorConfigs = $state({
		get orientation() {
			return orientation;
		},
		get decorative() {
			return decorative;
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'separator-root',
				orientation === 'vertical' ? 'vertical' : 'horizontal',
				props.disabled ? 'disabled' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	role={decorative ? undefined : 'separator'}
	aria-orientation={decorative ? undefined : orientation}
	class={configs.style}
>
</svelte:element>

<style lang="scss">
	@use '_styles.scss';
</style>
