<script lang="ts">
	import { styleSynced } from '$modules';
	import { onMount } from 'svelte';
	import type { ToastWrapperConfigs, ToastWrapperProps } from '../_interface';
	import { client } from '$store/basic.svelte';
	import { browser } from '$app/environment';
	import { Button, Toast } from '$components/element';
	import { handleEvents } from '$modules/_attachments';
	import { SvelteMap } from 'svelte/reactivity';
	import { setToastWrapperContext } from '.';
	import * as uuid from 'uuid';

	let { ...props }: ToastWrapperProps = $props();
	let configs: ToastWrapperConfigs = $state({
		get disabled() {
			return props.disabled;
		},
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		get style() {
			const defaultStyles: (string | undefined)[] = ['toast-wrapper'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get event() {
			const defaultEvents: ToastWrapperConfigs['event'] = [
				{
					events: {
						load(_, data) {
							if (
								data?.node instanceof HTMLElement &&
								client.browser?.toasts &&
								!client.browser.toasts.ref
							) {
								document.body.appendChild(data.node);
								client.browser.toasts.ref = data.node;
							}
						}
					}
				}
			];
			const propEvents = props.events ?? [];
			return [...defaultEvents, ...propEvents];
		}
	});
	setToastWrapperContext(configs);

	$effect(() => {
		if (client.browser?.toasts?.children.size) {
			const positions = ['top', 'left', 'bottom', 'right'];
			positions.forEach((pos) => {
				if (!client.browser?.toasts) return;
				const childrensFiltered = [...client.browser.toasts.children.values()].filter(
					(children) => children.position == pos
				);
				const size = childrensFiltered.length;
				for (const children of childrensFiltered) {
					if (children.ref) {
						positions.forEach((side) => {
							if (!children.ref) return;
							children.ref.style.removeProperty(side);
						});

						const currentIndex = childrensFiltered.findIndex((k) => k.id == children.id);
						const step = 5;
						children.ref.style.transform = `${['bottom', 'top'].includes(children.position ?? '') ? 'translateX(-50%)' : 'translateY(-50%)'} scale(${(100 - (size - 1 - currentIndex) * step) / 100})`;
						children.ref.style.position = 'absolute';
						switch (children.position) {
							case 'bottom':
								children.ref.style.transformOrigin = 'bottom';
								children.ref.style.bottom = `${(size - currentIndex - 1) * step * 2 + (children.offset ?? 0)}px`;
								break;
							case 'top':
								children.ref.style.transformOrigin = 'top';
								children.ref.style.top = `${(size - currentIndex - 1) * step * 2 + (children.offset ?? 0)}px`;
								break;
							case 'left':
								console.log(children.position);
								children.ref.style.transformOrigin = 'left';
								children.ref.style.left = `${(size - currentIndex - 1) * step * 2 + (children.offset ?? 0)}px`;
								break;
							case 'right':
								children.ref.style.transformOrigin = 'right';
								children.ref.style.right = `${(size - currentIndex - 1) * step * 2 + (children.offset ?? 0)}px`;
								break;
						}
					}
				}
			});
		}
	});

	onMount(() => {
		if (browser) {
			if (!client.browser) client.browser = {};
			if (!client.browser.toasts)
				client.browser.toasts = {
					children: new SvelteMap(),
					create(data) {
						const id = data.id ?? uuid.v7();
						const showCloseButton = data.showCloseButton ?? true;
						this.children.set(id, { ...data, id, showCloseButton });
					},
					remove(key) {
						this.children.delete(key);
					}
				};
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	{@attach handleEvents(configs.event)}
>
	{#each [...(client.browser?.toasts?.children?.values() ?? [])] as children, _ (children.id)}
		<Toast
			duration={children.duration}
			id={children.id}
			position={children.position}
			color={children.color}
			offset={children.offset}
			disabled={children.disabled}
		>
			{#if children.indicator}
				<Toast.Indicator icon={children.indicator}></Toast.Indicator>
			{/if}
			<Toast.Content>
				<Toast.Content.Title>{children.title}</Toast.Content.Title>
				{#if children.description}
					<Toast.Content.Description>Hello description</Toast.Content.Description>
				{/if}
			</Toast.Content>
			{#if children.showCloseButton}
				<Toast.Close></Toast.Close>
			{/if}
			{#if children.action}
				<Button {...children.action}></Button>
			{/if}
		</Toast>
	{/each}
</svelte:element>

<style lang="scss">
	.toast-wrapper {
	}
</style>
