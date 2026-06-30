<script lang="ts">
	import { styleSynced } from '$modules';
	import Icon from '@iconify/svelte';
	import type { MessageComponent } from './_interface';
	import { iconify } from '$assets/icons/iconify';

	let { children, ...props }: MessageComponent = $props();
	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		get style() {
			let defaultStyle = ['font-bold flex items-end gap-2'];
			switch (props.color) {
				case 'default':
					defaultStyle = [...defaultStyle, 'text-[hsl(var(--default))]'];
					break;
				case 'accent':
					defaultStyle = [...defaultStyle, 'text-[hsl(var(--accent))]'];
					break;
				case 'danger':
					defaultStyle = [...defaultStyle, 'text-[hsl(var(--danger))]'];
					break;
				case 'warning':
					defaultStyle = [...defaultStyle, 'text-[hsl(var(--warning))]'];
					break;
				case 'success':
					defaultStyle = [...defaultStyle, 'text-[hsl(var(--success))]'];
					break;
			}
			return styleSynced(
				{ defaultStyles: defaultStyle, propStyles: props.class },
				props.overwriteDefaultStyles
			);
		},
		name: {
			ref: undefined as undefined | HTMLElement,
			get style() {
				return styleSynced(
					{
						defaultStyles: ['flex items-center text-2xl'],
						propStyles: props.nameComponentClass
					},
					props.overwriteDefaultStyles
				);
			}
		},
		description: {
			ref: undefined as undefined | HTMLElement,
			get style() {
				return styleSynced(
					{ defaultStyles: [''], propStyles: props.descriptionClass },
					props.overwriteDefaultStyles
				);
			}
		}
	});
</script>

<svelte:element this={props.as ?? 'div'} bind:this={configs.ref} class={configs.style}>
	{#if typeof children == 'function'}
		{@render children()}
	{:else}
		<div bind:this={configs.name.ref} class={configs.name.style}>
			<Icon icon={iconify['dangerous-outline-rounded']} />{props.nameComponent}
		</div>

		{#if props.description}
			<div bind:this={configs.description.ref} class={configs.description.style}>
				{props.description}
			</div>
		{/if}
	{/if}
</svelte:element>
