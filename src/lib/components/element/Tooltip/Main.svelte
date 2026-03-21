<script lang="ts">
	import type { BasicProps } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';
	import { fade, fly } from 'svelte/transition';
	import { defaultTooltip } from './_default';
	import type { TooltipProps } from './_interface';
	import { profile } from '$store/basic.svelte';
	import { pick } from 'es-toolkit';
	import { pickBy } from 'es-toolkit/compat';

	let { children, portal = 'body', ...props }: TooltipProps = $props();
	let configs = $state({
		root: {
			ref: undefined as undefined | HTMLElement,
			status: {
				hover: false
			},
			events: {
				event: [
					{
						mouseover: {
							handler(e) {
								configs.root.status.hover = true;
							}
						},
						mouseout: {
							handler(e) {
								//configs.root.status.hover = false;
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
				currentPostition: undefined as undefined | 'top' | 'bottom' | 'left' | 'right'
			},
			events: {
				event: [
					{
						load: {
							handler(e, data) {
								if (data && data.node instanceof HTMLElement && configs.root.ref) {
									data.node.style.position = 'fixed';
									if (portal instanceof HTMLElement) {
										portal.appendChild(data.node);
									} else if (typeof portal == 'string') {
										const ele = document.querySelector(portal) as HTMLElement | null;
										if (ele) ele.appendChild(data.node);
									}
									const rect = data.node.getBoundingClientRect();
									const rootRect = configs.root.ref.getBoundingClientRect();
									const areaReady = {
										get top() {
											return {
												status: rootRect.top >= rect.height,
												maxWidth: window.innerWidth,
												maxHeight: rootRect.top
											};
										},
										get bottom() {
											return {
												status: window.innerHeight - rootRect.bottom >= rect.height,
												maxWidth: window.innerWidth,
												maxHeight: window.innerHeight - rootRect.bottom
											};
										},
										get left() {
											return {
												status: rootRect.left >= rect.width,
												maxWidth: rootRect.left,
												maxHeight: window.innerHeight - rootRect.top
											};
										},
										get right() {
											return {
												status: window.innerWidth - rootRect.right >= rect.width,
												maxWidth: window.innerWidth - rootRect.right,
												maxHeight: window.innerHeight - rootRect.top
											};
										}
									};
									const shouldPlace = pickBy(areaReady, (val) => {
										return val.status;
									});
									if (!props.position) {
										if (Object.keys(shouldPlace).length) {
											const pos = Object.keys(shouldPlace)[0];
											switch (pos) {
												case 'top':
													data.node.style.top = `${rootRect.top - rect.height}px`;
													data.node.style.left = `${rootRect.left}px`;
													break;
												case 'bottom':
													data.node.style.top = `${rootRect.bottom}px`;
													data.node.style.left = `${rootRect.left}px`;
													break;
												case 'left':
													data.node.style.top = `${rootRect.top}px`;
													data.node.style.left = `${rootRect.left - rect.width}px`;
													break;
												case 'right':
													data.node.style.top = `${rootRect.top}px`;
													data.node.style.left = `${rootRect.right}px`;
													break;
											}
											data.node.style.maxWidth = `${areaReady[pos as keyof typeof areaReady].maxWidth}px`;
											data.node.style.maxHeight = `${areaReady[pos as keyof typeof areaReady].maxHeight}px`;
										}
									} else {
										if (Object.keys(shouldPlace).length) {
											const pos = Object.keys(shouldPlace).filter(
												(k) => props.position && props.position.includes(k)
											);
											if (pos.length) {
												const posKey = pos[0] as keyof typeof areaReady;
												configs.tooltip.status.currentPostition = posKey;
												if (['left-start', 'right-start'].includes(props.position)) {
													data.node.style.top = `${rootRect.top}px`;
												} else if (['left', 'right'].includes(props.position)) {
													data.node.style.top = `${rootRect.top + rootRect.height / 2}px`;
												} else if (['left-end', 'right-end'].includes(props.position)) {
													data.node.style.top = `${rootRect.bottom}px`;
												}
												if (props.position.includes('left')) {
													data.node.style.left = `${rootRect.left - rect.width}px`;
												} else if (props.position.includes('right')) {
													data.node.style.left = `${rootRect.right}px`;
												}

												if (['top', 'bottom'].includes(props.position)) {
													data.node.style.left = `${rootRect.left + rootRect.width / 2 - rect.width / 2}px`;
												} else if (['top-start', 'bottom-start'].includes(props.position)) {
													data.node.style.left = `${rootRect.left}px`;
												} else if (['top-end', 'bottom-end'].includes(props.position)) {
													data.node.style.left = `${rootRect.right - rect.width}px`;
												}
												if (props.position.includes('top')) {
													data.node.style.top = `${rootRect.top - rect.height}px`;
												} else if (props.position.includes('bottom')) {
													data.node.style.top = `${rootRect.bottom}px`;
												}

												data.node.style.maxWidth = `${areaReady[posKey].maxWidth}px`;
												data.node.style.maxHeight = `${areaReady[posKey].maxHeight}px`;
											} else {
												configs.tooltip.status.currentPostition = (
													props.position.includes('-')
														? props.position.split('-')[0]
														: props.position
												) as 'top' | 'bottom' | 'left' | 'right';
												if (['top', 'bottom'].includes(props.position)) {
													data.node.style.left = `${rootRect.left + rootRect.width / 2 - rect.width / 2}px`;
												} else if (['top-start', 'bottom-start'].includes(props.position)) {
													data.node.style.left = `${rootRect.left}px`;
												} else if (['top-end', 'bottom-end'].includes(props.position)) {
													data.node.style.left = `${rootRect.right - rect.width}px`;
												}
												if (props.position.includes('top')) {
													data.node.style.top = `${rootRect.top}px`;
												} else if (props.position.includes('bottom')) {
													data.node.style.top = `${rootRect.bottom - rect.height}px`;
												}

												if (['left-start', 'right-start'].includes(props.position)) {
													data.node.style.top = `${rootRect.top}px`;
												} else if (['left', 'right'].includes(props.position)) {
													data.node.style.top = `${rootRect.top + rootRect.height / 2 - rect.height / 2}px`;
												} else if (['left-end', 'right-end'].includes(props.position)) {
													data.node.style.top = `${rootRect.bottom - rect.height}px`;
												}
												if (props.position.includes('left')) {
													data.node.style.left = `${rootRect.left}px`;
												} else if (props.position.includes('right')) {
													data.node.style.left = `${rootRect.right - rect.width}px`;
												}

												data.node.style.maxWidth = `${rootRect.width}px`;
												data.node.style.maxHeight = `${rootRect.height}px`;
												console.log(3333, props.offset);
												if (configs.tooltip.status.currentPostition && props.offset) {
													switch (configs.tooltip.status.currentPostition) {
														case 'top':
															data.node.style.top = `calc(${window.getComputedStyle(data.node).getPropertyValue('top')}- ${props.offset}px)`;
															break;
														case 'bottom':
															data.node.style.top = `${rootRect.bottom + props.offset}px`;
															break;
														case 'left':
															data.node.style.left = `${rootRect.left - props.offset}px`;
															break;
														case 'right':
															data.node.style.left = `${rootRect.right + props.offset}px`;
															break;
													}
												}
											}
										}
									}

									return () => {
										if (portal && data.node instanceof HTMLElement) {
											if (portal instanceof HTMLElement && portal.contains(data.node)) {
												portal.removeChild(data.node);
											} else if (typeof portal == 'string') {
												const ele = document.querySelector(portal) as HTMLElement | null;
												if (ele && data.node instanceof HTMLElement && ele.contains(data.node))
													ele.removeChild(data.node);
											}
										}
									};
								}
							}
						}
					}
				]
			} as BasicProps['events']
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.root.ref}
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
			class=""
			bind:this={configs.tooltip.ref}
			transition:fly={profile.transition.templates.flyY}
			{@attach handleEvents([configs.tooltip.events])}
		>
			11
		</div>
	{/if}
	{#if typeof children == 'function'}
		{@render children()}
	{/if}
</svelte:element>
