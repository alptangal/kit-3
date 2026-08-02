<script lang="ts">
	import { MessageComponent } from '$components/element';
	import { styleSynced } from '$modules';
	import { getFormContext } from '../form';
	import { getTextfieldCtx } from '../textField';
	import type { Description } from './_interface';

	let { children, ...props }: Description = $props();
	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		get style() {
			const defaultStyles: string[] = ['description text-[hsl(var(--foreground-400))]'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		}
	});
	const textFieldCtx = getTextfieldCtx();
	const formCtx = getFormContext();
</script>

{#if typeof children == 'function'}
	<svelte:element
		this={props.as ?? 'div'}
		bind:this={configs.ref}
		class={configs.style}
		data-size={props.size ?? textFieldCtx.size ?? formCtx.size ?? 'md'}
	>
		{@render children()}
	</svelte:element>
{:else}
	<MessageComponent nameComponent="Description" description="not contain content" color="danger" />
{/if}

<style lang="scss">
	.description {
		@apply truncate;
		font-size: var(--font-size);
	}
</style>
