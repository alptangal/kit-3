<script lang="ts">
	import type { EventListener } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';
	import { SvelteMap } from 'svelte/reactivity';
	import { setFormContext, type TextfieldToForm } from '.';
	import type { Form } from './_interface';
	import { every, some } from 'es-toolkit/compat';

	let { children, disabled = $bindable(), ...props }: Form = $props();
	let configs = $state({
		status: {
			get valid() {
				if (configs.childrens) {
					if (every([...configs.childrens.values()], (node) => !node.loading)) {
						return every([...configs.childrens.values()], (node) =>
							node.isValid ? node.isValid() : true
						);
					} else {
						return undefined;
					}
				}
				return true;
			},
			get loading() {
				if (configs.childrens)
					return some([...configs.childrens.values()].map((node) => node.loading));
				return false;
			}
		},
		ref: undefined as undefined | HTMLElement,
		events: {
			submit: {
				handler(e: MouseEvent) {
					console.log(configs.status.valid);
					if (configs.childrens?.size) {
						// configs.status.valid = every(
						// 	[...configs.childrens.values()].map((item) =>
						// 		item.isValid ? item.isValid() : undefined
						// 	)
						// );
					}
					if (!configs.status.valid) e.preventDefault();
					setTimeout(() => {
						console.log(configs.status.valid);
					}, 3000);
				}
			},
			reset: {
				handler(e) {
					// configs.status.valid = undefined;
					if (configs.childrens) {
						configs.childrens.values().forEach((field) => {
							if (field.reset) field.reset();
						});
					}
				}
			}
		} as EventListener,
		get style() {
			const defaultStyles: string[] = [];
			if (typeof props.class == 'object') {
				return [...defaultStyles, ...props.class];
			}
			if (typeof props.class == 'string') {
				return [...defaultStyles, props.class];
			}
			return defaultStyles;
		},
		childrens: undefined as undefined | SvelteMap<string, TextfieldToForm>
	});
	setFormContext({
		get valid() {
			return configs.status.valid;
		},
		get loading() {
			return configs.status.loading;
		},
		get size() {
			return props.size;
		},
		insertMetaNode: (field) => {
			if (!configs.childrens) configs.childrens = new SvelteMap();
			configs.childrens.set(field.name, field);
		},
		nextNode(currentNode) {
			if (!configs.childrens) return;
			const currentIndex = [...configs.childrens.values()].findIndex((item) =>
				item.ref?.contains(currentNode)
			);
			let nextIndex = currentIndex + 1;
			if (nextIndex == configs.childrens.size && configs.status.valid) {
				configs.ref?.dispatchEvent(new Event('submit'));
			} else {
				if (nextIndex == configs.childrens.size) nextIndex = 0;
				const nextNode = [...configs.childrens.values()].find((_, idx) => idx == nextIndex);
				if (nextNode && nextNode.focus) {
					nextNode.focus();
				}
			}

			// [...configs.childrens.values()].find((_, idx) => idx == nextIndex)?.focus();
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
