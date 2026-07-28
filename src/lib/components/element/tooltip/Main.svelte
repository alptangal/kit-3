<script lang="ts">
	import type { EventListener } from '$components/interface';
	import { convertToMiliseconds, convertToPixels, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { pick } from 'es-toolkit/compat';
	import { setToolTipCtx, type ArrowMeta, type ContentMeta } from '.';
	import type { TooltipConfigs, TooltipProps } from './_interface';
	import { onMount } from 'svelte';
	import { Button } from '$components/element';
	import { iconify } from '$assets/icons/iconify';
	import { browser } from '$app/environment';

	const OFFSET = 10;
	let { children, disabled = $bindable(), ...props }: TooltipProps = $props();
	let configs: TooltipConfigs = $state({
		status: {},
		get style() {
			const defaultStyles: (string | undefined)[] = ['tooltip-root', `size-${this.size}`];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		get delay() {
			return convertToMiliseconds(props.delay) ?? client.browser?.delay ?? 300;
		},
		get offset() {
			return convertToPixels(props.offset) ?? OFFSET;
		},
		get rounded() {
			return props.rounded ?? this.size ?? client.browser?.size ?? 'md';
		},
		get event() {
			const defaultEvents: EventListener = client.browser?.isMobile
				? {}
				: {
						load(e, data) {
							if (data?.node instanceof HTMLElement) {
								if (!client.browser) client.browser = {};
								if (!client.browser.tooltips) client.browser.tooltips = new Map();
								client.browser.tooltips.set(data.node, configs);
								return () => {
									if (data.node instanceof HTMLElement) client.browser?.tooltips?.delete(data.node);
								};
							}
						},
						mousemove(e) {
							if (!e) return;
							const event = e as MouseEvent;
							if (!configs.status) configs.status = {};
							configs.status.mousePosition = { x: event.clientX, y: event.clientY };
						},
						mouseover: {
							handler(e) {
								{
									const target = (e as Event).target as HTMLElement;
									const tooltips = client.browser?.tooltips;
									if (!tooltips || !configs.ref) return;
									const candidates = [...tooltips.keys()].filter((element) =>
										element.contains(target)
									);
									if (candidates.length === 0) return;
									const topmost = candidates.find(
										(el) => !candidates.some((other) => other !== el && el.contains(other))
									);
									if (!topmost) return;
									for (const el of candidates) {
										if (el === topmost) continue;
										const otherConfigs = tooltips.get(el);
										if (otherConfigs?.status?.hover) otherConfigs.status.hover = false;
									}
									if (topmost === configs.ref) {
										if (!configs.status) configs.status = {};
										configs.status.hover = true;
									}
								}
							},
							options: {
								stopPropagation: true,
								passive: true
							}
						},
						mouseleave() {
							if (!configs.status) configs.status = {};
							configs.status.hover = false;
						}
					};
			const propEvents = (props.events ?? []).map((ev) =>
				disabled ? { ...ev, events: pick(ev.events, ['load']) } : ev
			);
			return [{ events: disabled ? pick(defaultEvents, ['load']) : defaultEvents }, ...propEvents];
		},
		actionButtons: {
			info: {
				get style() {
					const defaultStyles: (string | undefined)[] = ['tooltip-info', 'p-0!'];
					return styleSynced({ defaultStyles });
				},
				get ref() {
					return configs.actionButtons.info.component?.configs.ref;
				},
				get event() {
					if (!browser) return undefined;
					return [
						{
							events: {
								load() {
									if (!configs.timeId) configs.timeId = new Map();
									const name = 'timeout-info';
									const timeId = configs.timeId.get(name);
									if (timeId) clearTimeout(timeId);
									configs.timeId.set(
										name,
										setTimeout(() => {
											if (
												!configs.ref ||
												!configs.ref.firstElementChild ||
												!configs.actionButtons.info.ref
											)
												return;

											const infoBtn = configs.actionButtons.info.ref;
											document.body.appendChild(infoBtn);
											const target = configs.ref.firstElementChild as HTMLElement;
											if (!target) return;
											target.style.position = 'relative';
											target.style.overflow = 'unset';
											target.appendChild(infoBtn);
										}, configs.delay)
									);
									return () => {
										const timeId = configs.timeId?.get(name);
										if (timeId) clearTimeout(timeId);
										if (configs.actionButtons.info.ref) configs.actionButtons.info.ref.remove();
									};
								},
								mouseleave() {
									configs.status.hover = false;
									configs.actionButtons.info.actived = false;
								},

								mouseenter: {
									handler() {
										configs.status.hover = true;
										configs.actionButtons.info.actived = true;
									},
									options: {
										stopPropagation: true
									}
								}
							}
						}
					];
				}
			}
		}
	});
	let contentMeta: ContentMeta = $state({});
	let arrowMeta: ArrowMeta = $state({});
	setToolTipCtx({
		get size() {
			return configs.size;
		},
		get ref() {
			return configs.ref?.firstElementChild;
		},
		get status() {
			return configs.status;
		},
		get delay() {
			return configs.delay;
		},
		get offset() {
			return configs.offset;
		},
		get contentMeta() {
			return contentMeta;
		},
		get rounded() {
			return configs.rounded;
		},
		updateContentMeta(data) {
			contentMeta = data;
		},
		get arrowMeta() {
			return arrowMeta;
		},
		updateArrowMeta(data) {
			arrowMeta = data;
		}
	});
	onMount(() => {});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	{@attach handleEvents(configs.event)}
>
	{@render children?.()}
	{#if client.browser?.isMobile && !props.actionButtons?.info?.hide}
		<Button
			bind:this={configs.actionButtons.info.component}
			class={configs.actionButtons.info.style}
			icon={iconify['info-i-rounded']}
			events={configs.actionButtons.info.event}
			size="xs"
			rounded="full"
			color="info"
			actived={configs.actionButtons.info.actived}
			variant="soft"
		/>
	{/if}
</svelte:element>

<style lang="scss">
	@use '$styles/sizes.scss';
	.tooltip-root {
		font-size: var(--font-size);
		width: fit-content;
		min-width: 0;
		max-width: 100%;
		display: contents;
		:global(.tooltip-info) {
			position: absolute;
			bottom: 100%;
			left: 100%;
			transform: translateX(-50%) translateY(50%);
		}
	}
</style>
