<script lang="ts">
	import type { Direction } from '$interfaces/basic';
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { setSearchMainContext } from '../_context';
	import type { SearchMainRootConfigs, SearchMainRootProps } from '../_interface';
	import { Button, Skeleton } from '$components/element';
	import { some } from 'es-toolkit/compat';
	import { fly } from 'svelte/transition';
	import { Modal } from '$components/modal';

	let { children, ...props }: SearchMainRootProps = $props();
	const defaults = [
		'xs',
		'sm',
		'md',
		'lg',
		'xl',
		'2xl',
		'3xl',
		'4xl',
		'5xl',
		'6xl',
		'8xl',
		'9xl'
	].reduce((obj, key, idx) => {
		return {
			...obj,
			[key]: {
				min: {
					w: 50 * (idx + 1) + 50
				}
			}
		};
	}, {});
	let configs: SearchMainRootConfigs = $state({
		status: {
			loaded: false,
			hover: false,
			focus: false,
			get direction(): Direction {
				return props.direction ?? client.browser?.direction ?? 'ltr';
			}
		},
		get disabled() {
			return props.disabled ?? client.browser?.disabled;
		},
		timeId: undefined,
		_mode: undefined as SearchMainRootProps['mode'],
		get mode() {
			return this._mode ?? props.mode;
		},
		set mode(val) {
			this._mode = val;
		},
		value: undefined,
		ref: undefined,
		event: {
			mouseover: {
				handler() {
					if (configs.status) configs.status.hover = true;
				}
			},
			mouseleave: {
				handler() {
					if (configs.status) configs.status.hover = false;
				}
			},
			load: {
				handler(_, data) {
					if (data?.node instanceof HTMLElement) {
						function detectMode(openModal?: boolean) {
							if (!configs.timeId) configs.timeId = new Map();
							const timeId = configs.timeId.get('switch-mode');
							if (typeof timeId == 'number') clearTimeout(timeId);
							configs.timeId.set(
								'switch-mode',
								setTimeout(() => {
									if (data?.node instanceof HTMLElement) {
										console.log(data.node.clientWidth, data.node.scrollWidth);
										if (configs.mode == 'compact') return;
										if (data.node.clientWidth < data.node.scrollWidth) {
											configs.mode = 'compact';
											if (openModal) configs.modal.status.display = true;
										}
										const childrens = data.node.children;
										const mustSwitchToCompact = some(
											[...childrens],
											(node) => node.clientWidth < node.scrollWidth
										);
										if (mustSwitchToCompact) {
											configs.mode = 'compact';
										}
									}
								}, client.browser?.delay ?? 300)
							);
						}
						const mutationObs = new MutationObserver(() => {
							detectMode(true);
						});
						mutationObs.observe(data.node, { subtree: true, childList: true });
						const resizeObs = new ResizeObserver(() => {
							detectMode();
						});
						resizeObs.observe(data.node);
						return () => {
							mutationObs.disconnect();
							resizeObs.disconnect();
						};
					}
				}
			}
		},
		get style() {
			const defaultStyles: string[] = ['search-main-root'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get size() {
			return props.size ?? 'md';
		},
		modal: {
			ref: undefined,
			status: {
				display: false
			}
		}
	});
	setSearchMainContext({
		get size() {
			return configs.size;
		},
		get status() {
			return configs.status;
		},
		childrens: configs.childrens,
		insertNode(data) {
			if (!data.ref) return;
			if (!configs.childrens) configs.childrens = new Map();
			configs.childrens.set(data.ref, data);
			// console.log([...configs.childrens.entries()]);
		},
		onKeyup(value) {
			configs.value = value;
		},
		onKeydown(value) {
			configs.value = value;
		},
		onBlur(value) {
			configs.value = value;
		},
		onFocus(value) {
			configs.value = value;
		},
		onEnter(value) {
			configs.value = value;
		},
		onChange(value) {
			configs.value = value;
		},
		onClear(value) {
			configs.value = value;
		}
	});
	$effect(() => {});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	data-size={configs.size}
	data-hover={configs.status?.hover}
	data-direction={configs.status?.direction ?? 'ltr'}
	{@attach handleEvents([{ events: [configs.event ?? {}] }])}
>
	{#if configs.mode == 'normal' || !configs.mode}
		{@render children?.()}
	{:else}
		<div transition:fly={client.browser?.transition?.fly}>compact</div>
	{/if}
	<Modal display={configs.modal?.status?.display}>hello</Modal>
</svelte:element>

<style lang="scss">
	.search-main-root {
		@apply flex items-center justify-center overflow-hidden relative;
		&[data-direction='ltr'] {
			--flex-direction: row;
		}
		&[data-direction='rtl'] {
			--flex-direction: row-reverse;
		}
		flex-direction: var(--flex-direction);
	}
</style>
