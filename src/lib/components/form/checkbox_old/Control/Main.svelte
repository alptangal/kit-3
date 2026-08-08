<script lang="ts">
	import { styleSynced } from '$modules';
	import type { CheckboxControl } from '../Control/_interface';
	import { getCheckboxCtx } from '../Root';

	let { children, ...props }: CheckboxControl = $props();

	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		get style() {
			const defaultStyles: string[] = ['checkbox-control'];
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
	data-checked={checkboxCtx.checked}
	data-color={checkboxCtx.color}
	data-hover={checkboxCtx.status?.hover}
	data-radius={props.radius ?? checkboxCtx.radius ?? checkboxCtx.size ?? 'md'}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	.checkbox-control {
		@apply flex w-fit h-fit items-center justify-center aspect-square;

		* {
			@apply top-0 left-0 z-50;
		}

		border-width: var(--border-width);
		border-style: solid;
		border-color: var(--color);
		border-radius: var(--border-radius);

		color: var(--color);
		font-size: var(--font-size);
		min-width: calc(var(--font-size) + var(--border-width) * 2);
		opacity: var(--opacity);
		transition: all ease-in-out 0.3s;
	}
</style>
