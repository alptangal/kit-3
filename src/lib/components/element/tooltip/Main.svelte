<script lang="ts">
	import type { BasicProps } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';
	import { fly } from 'svelte/transition';
	import { defaultTooltip } from './_default';
	import type { TooltipProps } from './_interface';
	import { profile } from '$store/basic.svelte';
	import './_styles.scss';

	import { keys, mapValues, min, pickBy, values } from 'es-toolkit/compat';

	let { children, ...props }: TooltipProps = $props();
	let configs = $state({
		root: {
			ref: undefined as undefined | HTMLElement,
			status: {
				initialized: false,
				hover: false,
				possition: undefined as TooltipProps['position'],
				clientX: undefined as undefined | number,
				clientY: undefined as undefined | number,
				rectTop: undefined as undefined | number,
				rectBottom: undefined as undefined | number,
				rectLeft: undefined as undefined | number,
				rectRight: undefined as undefined | number
			},
			events: {
				events: [
					{
						load: {
							handler() {
								if (!configs.root.status.initialized) {
									configs.root.status.hover = true;
								}
							}
						},
						mousemove: {
							handler(e: MouseEvent) {
								if (configs.root.ref && configs.root.status.initialized) {
									const rootRect = configs.root.ref.getBoundingClientRect();
									configs.root.status.rectTop = rootRect.top;
									configs.root.status.rectBottom = rootRect.bottom;
									configs.root.status.rectLeft = rootRect.left;
									configs.root.status.rectRight = rootRect.right;
									configs.root.status.hover = true;
									configs.root.status.clientX = (e as MouseEvent).clientX;
									configs.root.status.clientY = (e as MouseEvent).clientY;

									const readyArea = {
										get top() {
											return (
												configs.tooltip.ref && rootRect.top >= configs.tooltip.ref.clientHeight
											);
										},
										get bottom() {
											return (
												configs.tooltip.ref &&
												window.innerHeight - rootRect.bottom >= configs.tooltip.ref.clientHeight
											);
										},
										get left() {
											return (
												configs.tooltip.ref && rootRect.left >= configs.tooltip.ref.clientWidth
											);
										},
										get right() {
											return (
												configs.tooltip.ref &&
												window.innerWidth - rootRect.right >= configs.tooltip.ref.clientWidth
											);
										}
									};
									if (props.position) {
										console.log(pickBy(readyArea, (k) => k));
									} else if (keys(pickBy(readyArea, (k) => k)).length) {
										const finalPosition = pickBy(
											mapValues(
												pickBy(readyArea, (k) => k),
												(val, k) => {
													switch (k) {
														case 'top':
															return e.clientY - rootRect.top;
														case 'bottom':
															return rootRect.bottom - e.clientY;
														case 'left':
															return e.clientX - rootRect.left;
														case 'right':
															return rootRect.right - e.clientX;
													}
												}
											),
											(val, key, obj) => {
												return val == min(values(obj));
											}
										);
										configs.tooltip.status.previousPosition =
											configs.tooltip.status.currentPostition;
										configs.tooltip.status.currentPostition = keys(
											finalPosition
										)[0] as keyof TooltipProps['position'];

										if (configs.tooltip.ref) {
											configs.tooltip.ref.style.transition = `all ease-in-out ${profile.transition.duration}ms`;
											configs.tooltip.ref.style.removeProperty('left');
											configs.tooltip.ref.style.removeProperty('top');

											configs.tooltip.ref.style.removeProperty('right');
											configs.tooltip.ref.style.removeProperty('transform');
										}
										if (
											['top', 'bottom'].includes(configs.tooltip.status.currentPostition) &&
											configs.tooltip.ref
										) {
											if (configs.tooltip.ref.clientWidth <= configs.root.ref.clientWidth) {
												if (e.clientX - rootRect.left < rootRect.right - e.clientX) {
													if (e.clientX - rootRect.left >= configs.tooltip.ref.clientWidth / 2) {
														configs.tooltip.ref.style.left = `${e.clientX}px`;
														configs.tooltip.ref.style.transform = `translateX(-50%)`;
													} else {
														configs.tooltip.ref.style.left = `${rootRect.left}px`;
													}
												} else {
													if (rootRect.right - e.clientX >= configs.tooltip.ref.clientWidth / 2) {
														configs.tooltip.ref.style.left = `${rootRect.right - e.clientX}px`;
														configs.tooltip.ref.style.transform = `translateX(-50%)`;
													} else {
														configs.tooltip.ref.style.left = `${rootRect.right - configs.tooltip.ref.clientWidth}px`;
													}
												}
											} else {
												configs.tooltip.ref.style.left = `${rootRect.left}px`;
											}
										} else if (
											['left', 'right'].includes(configs.tooltip.status.currentPostition) &&
											configs.tooltip.ref
										) {
											console.log(22223335455);
											configs.tooltip.ref.style.top = `${e.clientY}px`;
											configs.tooltip.ref.style.transform = `translateY(-50%)`;
											if (configs.tooltip.ref.clientWidth <= configs.root.ref.clientWidth) {
												if (e.clientX - rootRect.left < rootRect.right - e.clientX) {
													if (e.clientX - rootRect.left >= configs.tooltip.ref.clientWidth / 2) {
														configs.tooltip.ref.style.left = `${e.clientX}px`;
														configs.tooltip.ref.style.transform = `translateX(-50%)`;
													} else {
														configs.tooltip.ref.style.left = `${rootRect.left}px`;
													}
												} else {
													if (rootRect.right - e.clientX >= configs.tooltip.ref.clientWidth / 2) {
														configs.tooltip.ref.style.left = `${rootRect.right - e.clientX}px`;
														configs.tooltip.ref.style.transform = `translateX(-50%)`;
													} else {
														configs.tooltip.ref.style.left = `${rootRect.right - configs.tooltip.ref.clientWidth}px`;
													}
												}
											} else {
												configs.tooltip.ref.style.left = `${rootRect.left}px`;
											}
										}
									}
								}
							},
							options: {
								delay: 300
							}
						},
						mouseout: {
							handler() {
								configs.root.status.hover = false;
							},
							options: {
								delay: 300
							}
						}
					}
				]
			} as BasicProps['events']
		},
		tooltip: {
			ref: undefined as undefined | HTMLElement,
			status: {
				display: false,
				currentPostition: undefined as TooltipProps['position'],
				offset: 0,
				clientWidth: undefined as undefined | number,
				clientHeight: undefined as undefined | number,
				previousPosition: undefined as TooltipProps['position']
			},
			events: {
				events: [
					{
						load: {
							handler(e, data) {
								if (
									!configs.root.status.initialized &&
									configs.tooltip.ref &&
									data?.node instanceof HTMLElement
								) {
									data.node.style.opacity = '0';
									configs.tooltip.status.clientWidth = configs.tooltip.ref.clientWidth;
									configs.tooltip.status.clientHeight = configs.tooltip.ref.clientHeight;
									configs.root.status.initialized = true;
									configs.root.status.hover = false;
								}
							}
						}
					}
				]
			} as BasicProps['events'],
			arrow: {
				ref: undefined as undefined | HTMLElement,
				status: {
					loaded: false
				},
				size: {
					width: 0,
					height: 0
				}
			}
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.root.ref}
	style:--rect-top={`${configs.root.status.rectTop}px`}
	style:--rect-bottom={`${configs.root.status.rectBottom}px`}
	style:--rect-left={`${configs.root.status.rectLeft}px`}
	style:--rect-right={`${configs.root.status.rectRight}px`}
	{@attach handleEvents([configs.root.events])}
	class={props.overwriteDefaultStyles
		? props.class
		: [
				...(typeof defaultTooltip.class == 'object'
					? (defaultTooltip.class ?? [])
					: typeof defaultTooltip.class == 'string'
						? [defaultTooltip.class]
						: []),
				...(typeof props.class == 'object'
					? (props.class ?? [])
					: typeof props.class == 'string'
						? [props.class]
						: [])
			]}
>
	{#if configs.root.status.hover}
		<div
			class="bg-red-400 flex gap-2 px-2 w-fit"
			class:flex-col={configs.root.status.possition &&
				['bottom', 'top'].includes(configs.root.status.possition)}
			bind:this={configs.tooltip.ref}
			transition:fly={profile.transition.templates.flyY}
			data-position={configs.tooltip.status.currentPostition}
			data-with-arrow={props.withArrow}
			{@attach handleEvents([configs.tooltip.events])}
		>
			{#if props.withArrow}
				<div class="tooltip-arrow w-0 h-0 my-auto" bind:this={configs.tooltip.arrow.ref}></div>
			{/if}
			<div>{props.label}</div>
		</div>
	{/if}
	{#if typeof children == 'function'}
		{@render children()}
	{/if}
</svelte:element>
