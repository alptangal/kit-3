<script lang="ts">
	import { styleSynced } from '$modules';
	import { getCheckboxCtx } from '../Root';
	import type { CheckboxContent } from './_interface';

	let { children, ...props }: CheckboxContent = $props();
	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		get style() {
			const defaultStyles: string[] = ['checkbox-content'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		}
	});
	const checkboxCtx = getCheckboxCtx();
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	data-size={checkboxCtx.size}
	data-hover={checkboxCtx.status?.hover}
	data-color={checkboxCtx.color}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	.checkbox-content {
		@apply flex items-center;
		gap: var(--gap);
		color: var(--color);
		font-size: var(--font-size);
	}
</style>
