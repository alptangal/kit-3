<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { ModalConfigs, ModalContainerConfigs, ModalProps } from './_interface';
	import { client } from '$store/basic.svelte';
	import { handleEvents } from '$modules/_attachments';
	import { SvelteMap } from 'svelte/reactivity';
	import { styleSynced } from '$modules';
	import { fly } from 'svelte/transition';
	import { omit } from 'es-toolkit';
	import { releaseModalContainter, setModalContext } from '.';

	let { children, display = $bindable(), ...props }: ModalProps = $props();
	let configs: ModalConfigs = $state({
		_display: undefined as undefined | boolean,
		get display() {
			return this._display;
		},
		set display(v) {
			this._display = v;
			display = v;
		},
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		get placement() {
			return props.placement ?? 'center';
		},
		get variant() {
			return props.variant ?? 'blur';
		},
		get isDimissable() {
			return props.isDimissable ?? false;
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'modal-root',
				`size-${this.size}`,
				`variant-${this.variant}`
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get event() {
			const defaultEvents = [
				{
					events: {
						load(_, data) {
							if (data?.node instanceof HTMLElement) {
								data.node.classList.add('layer');
								if (!client.browser) {
									client.browser = {};
								}
								if (!client.browser.layers) client.browser.layers = new SvelteMap();

								client.browser.layers.set(data.node, performance.now());
								const rootEntry = [...client.browser.layers.entries()].find(
									([k, v]) => v == 'root'
								);
								if (rootEntry) {
									const rootLayer = rootEntry[0];
									rootLayer.parentElement?.appendChild(data.node);
								} else if (typeof document !== 'undefined' && document.body) {
									document.body.appendChild(data.node);
								}
								return () => {
									if (client.browser?.layers && data.node instanceof HTMLElement) {
										client.browser.layers.delete(data.node);
									}
									if (data.node instanceof HTMLElement && data.node.parentElement) {
										data.node.remove();
									}
								};
							}
						},
						mousedown(e) {
							const event = e as MouseEvent;
							const target = event.target as HTMLElement;
							if (configs.isDimissable) {
								if (target === configs.ref || !configs.children.container?.ref?.contains(target)) {
									configs.display = false;
								}
							}
						}
					}
				}
			] as ModalProps['events'];
			return [...(defaultEvents ?? []), ...(props.events ?? [])];
		},
		children: {}
	});

	$effect(() => {
		if (client.browser?.layers?.size && configs.size == 'full') {
			const totalLayers = client.browser.layers.size + 1;
			const sortedEntries = [...client.browser.layers.entries()]
				.filter((entry): entry is [HTMLElement, number] => entry[1] != 'root')
				.sort(([k, v], [k1, v1]) => v1 - v);
			let i = 0;
			for (const entry of sortedEntries) {
				const node = entry[0];
				if (node) {
					node.style.transform = `scale(${(100 - i) / 100})`;
					node.style.position = 'absolute';
					node.style.zIndex = `${totalLayers - i}`;
					node.style.transformOrigin = 'top';
				}
				i += 2;
			}
			const rootEntry = [...client.browser.layers.entries()].find(([k, v]) => v == 'root');
			if (rootEntry) {
				const rootLayer = rootEntry[0];
				if (totalLayers <= 2) {
					['transform', 'top', 'transform-origin', 'z-index'].forEach((pr) =>
						rootLayer.style.removeProperty(pr)
					);
				} else {
					rootLayer.style.transform = `scale(${(100 - i) / 100})`;
					rootLayer.style.top = '0px';
					rootLayer.style.transformOrigin = 'top';
				}
			}
			let a = 0;
			for (const entry of sortedEntries.reverse()) {
				const node = entry[0];
				if (node) {
					node.style.top = `${(a + 1) * 10}px`;
				}
				a++;
			}
		}
	});
	setModalContext(configs);

	let autoContainer: (() => void) | undefined;

	$effect(() => {
		if (!configs.children.container && configs.ref && children) {
			autoContainer = releaseModalContainter(configs);
		}
	});
	$effect(() => {
		if (!display && autoContainer) {
			autoContainer();
			autoContainer = undefined;
			configs.children.container = undefined; // reset để lần mở lại tạo mới
			configs.ref = undefined;
		}
	});

	onMount(() => {
		configs.display = display;
	});

	onDestroy(() => {
		autoContainer?.();
	});
</script>

{#if display}
	<svelte:element
		this={props.as ?? 'div'}
		bind:this={configs.ref}
		class={configs.style}
		transition:fly={omit(client.browser?.transition?.fly ?? {}, ['x'])}
		{@attach handleEvents(configs.event)}
	>
		<div class="contents" bind:this={configs.children.contentWrapper}>{@render children?.()}</div>
	</svelte:element>
{/if}

<style lang="scss">
	@use '$styles/sizes.scss';
	.modal-root {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100dvh;
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.65);
		box-sizing: border-box;
		padding: 1rem;
		overflow: hidden;

		&.variant-blur {
			-webkit-backdrop-filter: blur(8px);
			backdrop-filter: blur(8px);
		}

		&.variant-transparent {
			background: transparent;
		}

		.contents {
			display: contents;
		}
	}
</style>
