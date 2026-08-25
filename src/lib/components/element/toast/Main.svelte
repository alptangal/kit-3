<script lang="ts">
	import { convertToMiliseconds, styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import type { ToastConfigs, ToastProps } from './_interface';
	import { getToastWrapperContext } from './Wrapper';
	import { handleEvents } from '$modules/_attachments';
	import { SvelteMap } from 'svelte/reactivity';
	import { fly } from 'svelte/transition';
	import { setToastContext } from '.';
	import { omit } from 'es-toolkit';

	let { children, ...props }: ToastProps = $props();
	let configs: ToastConfigs = $state({
		status: {},
		get id() {
			return props.id;
		},
		get disabled() {
			return toastWrapperContext?.disabled ?? props.disabled;
		},
		get color() {
			return props.color ?? 'default';
		},
		get size() {
			return props.size ?? toastWrapperContext?.size ?? client.browser?.size ?? 'md';
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'toast-root',
				`color-${this.color}`,
				`size-${this.size}`,
				this.disabled ? 'disabled' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get duration() {
			if (props.duration == 'infinite') return 'infinite';
			return convertToMiliseconds(props.duration) ?? 300;
		},
		get offset() {
			return props.offset ?? 10;
		},
		get position() {
			return props.position ?? 'bottom';
		},
		get event() {
			const defaultEvents: ToastConfigs['event'] = [
				{
					events: {
						load(_, data) {
							if (
								client.browser?.toasts?.children &&
								data?.node instanceof HTMLElement &&
								client.browser.toasts.ref &&
								props.id
							) {
								if (!configs.timeId) configs.timeId = new SvelteMap();
								const timeName = 'processingDuration';
								const startAt = performance.now();
								const currentIndex = [...client.browser.toasts.ref.children].findIndex((children) =>
									children.isSameNode(data.node as Node)
								);
								const initValue = client.browser.toasts.children.get(props.id);
								if (initValue) {
									client.browser.toasts.children.set(props.id, {
										...initValue,
										ref: data.node,
										position: configs.position,
										offset: configs.offset
									});
								}

								if (typeof configs.duration == 'number') {
									const processingDuration = () => {
										if (configs.duration == 'infinite') return;
										const currentTime = performance.now();
										if (currentTime - startAt >= configs.duration) {
											if (client.browser?.toasts?.remove && props.id) {
												client.browser.toasts.remove(props.id);
											}
										} else {
											if (!configs.timeId) configs.timeId = new SvelteMap();
											configs.timeId.set(timeName, requestAnimationFrame(processingDuration));
										}
									};
									configs.timeId.set(timeName, requestAnimationFrame(processingDuration));
								}
							}
						},
						mouseenter() {
							configs.status.hover = true;
						},
						mouseleave() {
							configs.status.hover = false;
						}
					}
				}
			];
			const propEvents = props.events ?? [];
			return [...defaultEvents, ...propEvents];
		}
	});
	const toastWrapperContext = getToastWrapperContext();
	setToastContext(configs);

	onMount(() => {});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	transition:fly={omit(client.browser?.transition?.fly ?? {}, ['x'])}
	data-position={configs.position}
	style:--offset={`${configs.offset}px`}
	{@attach handleEvents(configs.event)}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	@use '$styles/sizes.scss';
	.toast-root {
		&[data-position='bottom'],
		&[data-position='top'] {
			transform: translateX(-50%);
			left: 50%;
		}
		&[data-position='bottom'] {
			bottom: var(--offset);
		}
		&[data-position='top'] {
			top: var(--offset);
		}
		&[data-position='left'],
		&[data-position='right'] {
			top: 50%;
			transform: translateY(-50%);
		}
		&[data-position='left'] {
			left: var(--offset);
		}
		&[data-position='right'] {
			right: var(--offset);
		}
		&.disabled {
			--cursor: not-allowed;
		}
		display: flex;
		cursor: var(--cursor);
		backdrop-filter: blur(10px);
		border-radius: var(--border-radius);
		width: fit-content;
		height: fit-content;
		padding-inline: var(--padding);
		padding-block: calc(var(--padding) / 4);
	}
</style>
