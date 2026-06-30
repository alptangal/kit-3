<script lang="ts">
	import type { EventListener } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';
	import { setFormContext } from '.';
	import type { Form } from './_interface';

	let { children, disabled = $bindable(), ...props }: Form = $props();
	let configs = $state({
		status: {},
		ref: undefined as undefined | HTMLElement,
		events: {} as EventListener,
		get style() {
			const defaultStyles: string[] = [];
			if (typeof props.class == 'object') {
				return [...defaultStyles, ...props.class];
			}
			if (typeof props.class == 'string') {
				return [...defaultStyles, props.class];
			}
			return defaultStyles;
		}
	});
	setFormContext({
		get size() {
			return props.size;
		}
	});
</script>

{#if typeof children == 'function'}
	<svelte:element
		this={props.as ?? 'form'}
		bind:this={configs.ref}
		class={configs.style}
		action={props.action ?? '#'}
		method={props.method ?? 'post'}
		target={props.target ?? '_self'}
		{@attach handleEvents([...(!disabled ? [{ events: [configs.events] }, props.events] : [])])}
	>
		{@render children()}
	</svelte:element>
{:else}
	<div class="text-red-500 font-bold text-2xl">Form Error: Not contain childrens</div>
{/if}
