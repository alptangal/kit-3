<script lang="ts">
	import { defaultHeader } from './_default';
	import type { HeaderProps } from './_interface';

	let { ...props }: HeaderProps = $props();

	let configs = $state({
		root: {
			ref: undefined as undefined | HTMLElement
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.root.ref}
	class={props.overwriteDefaultStyles
		? props.class
		: [
				...(typeof defaultHeader.class == 'object'
					? (defaultHeader.class ?? [])
					: typeof defaultHeader.class == 'string'
						? [defaultHeader.class]
						: []),
				...(typeof props.class == 'object'
					? (props.class ?? [])
					: typeof props.class == 'string'
						? [props.class]
						: [])
			]}
>
	{#if props.left}
		{#if typeof props.left == 'function'}
			{@render props.left()}
		{:else if typeof props.left == 'object'}
			<div class="flex flex-col">
				{#if props.left.title}
					<div>{props.left.title}</div>
				{/if}
				{#if props.left.icon}
					<div>{props.left.icon}</div>
				{/if}
				{#if props.left.subtitle}
					<div>{props.left.subtitle}</div>
				{/if}
			</div>
		{/if}
	{/if}
</svelte:element>
