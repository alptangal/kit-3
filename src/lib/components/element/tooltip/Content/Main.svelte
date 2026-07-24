<script lang="ts">
	import type { DistanceUnits, EventListener } from '$components/interface';
	import { convertToMiliseconds, convertToPixels, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { keys, pickBy } from 'es-toolkit/compat';
	import { getTooltipCtx } from '..';
	import type { TooltipContentConfigs, TooltipContentProps } from '../_interface';
	import { getMetaSide } from '.';

	const OFFSET = 10;
	let { children, disabled = $bindable(), ...props }: TooltipContentProps = $props();
	let configs: TooltipContentConfigs = $state({
		ref: undefined as undefined | HTMLElement,
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'tooltip-content',
				`size-${this.size}`,
				`rounded-${this.rounded}`
			];
			return styleSynced(
				{
					defaultStyles,
					propStyles: props.class
				},
				props.overwriteDefaultStyles
			);
		},
		previousPosition: undefined,
		get size() {
			return props.size ?? tooltipCtx?.size ?? client.browser?.size ?? 'md';
		},
		get delay() {
			return convertToMiliseconds(props.delay) ?? tooltipCtx?.delay ?? client.browser?.delay ?? 300;
		},
		get offset() {
			return convertToPixels(props.offset) ?? tooltipCtx?.offset ?? OFFSET;
		},
		get rounded() {
			return props.rounded ?? tooltipCtx?.rounded ?? this.size;
		},
		position: undefined,
		get event() {
			const defaultEvents: EventListener = {
				load(e, data) {
					if (tooltipCtx?.updateContentMeta && data?.node instanceof HTMLElement) {
						tooltipCtx.updateContentMeta({
							get size() {
								return configs.size;
							},
							ref: data.node,
							get position() {
								return configs.position;
							},
							get offset() {
								return configs.offset;
							}
						});
					}
					if (
						data?.node instanceof HTMLElement &&
						tooltipCtx?.ref &&
						tooltipCtx.status?.mousePosition?.x &&
						tooltipCtx.status?.mousePosition?.y
					) {
						document.body.appendChild(data.node);
						setPositionTooltip(tooltipCtx.ref, data.node, tooltipCtx.status.mousePosition);
						const mutationObs = new MutationObserver(() => {
							if (
								data?.node instanceof HTMLElement &&
								tooltipCtx?.ref &&
								tooltipCtx.status?.mousePosition?.x
							)
								setPositionTooltip(tooltipCtx.ref, data.node, tooltipCtx.status.mousePosition);
						});
						const resizeObs = new ResizeObserver(() => {
							if (
								data?.node instanceof HTMLElement &&
								tooltipCtx?.ref &&
								tooltipCtx.status?.mousePosition?.x
							)
								setPositionTooltip(tooltipCtx.ref, data.node, tooltipCtx.status.mousePosition);
						});
						mutationObs.observe(data.node, { childList: true, subtree: true });
						resizeObs.observe(data.node);
						return () => {
							mutationObs.disconnect();
							resizeObs.disconnect();
							if (data.node instanceof HTMLElement) data.node.remove();
						};
					}
				}
			};
			return [{ events: defaultEvents }, ...(props.events ?? [])];
		}
	});
	const tooltipCtx = getTooltipCtx();

	function setPositionTooltip(
		targetRef: HTMLElement,
		contentRef: HTMLElement,
		mousePosition: { x: number; y: number }
	) {
		if (!configs.timeId) configs.timeId = new Map();
		const name = 'animation-show-content';
		const timeId = configs.timeId.get(name);
		if (timeId) clearTimeout(timeId);
		configs.timeId.set(
			name,
			setTimeout(async () => {
				contentRef.style.width = '';
				contentRef.style.maxWidth = '';
				contentRef.style.maxHeight = '';
				contentRef.style.top = '';
				contentRef.style.left = '';
				contentRef.style.right = '';
				const targetRect = targetRef.getBoundingClientRect();
				const contentRect = contentRef.getBoundingClientRect();
				let arrowSize: undefined | number = 0;
				if (tooltipCtx?.arrowMeta?.ref)
					arrowSize =
						(convertToPixels(
							getComputedStyle(tooltipCtx.arrowMeta.ref).getPropertyValue('--size') as DistanceUnits
						) ?? 0) / 2;

				const meta = getMetaSide(
					targetRef,
					contentRef,
					tooltipCtx?.arrowMeta?.ref,
					configs.offset,
					OFFSET,
					mousePosition
				);
				const finalPosition = (
					!keys(pickBy(meta, (value) => value.ready)).length
						? Object.entries(meta).sort(
								([k, value], [k1, value1]) => value1.acreage - value.acreage
							)[0][0]
						: Object.entries(pickBy(meta, (value) => value.ready)).sort(
								([k, val], [k1, val1]) => val.mousePositionToSide - val1.mousePositionToSide
							)[0][0]
				) as 'top' | 'bottom' | 'left' | 'right';
				// // if (!keys(pickBy(meta, (value) => value.ready)).length) {
				// 	const finalPosition = Object.entries(meta).sort(
				// 		([k, value], [k1, value1]) => value1.acreage - value.acreage
				// 	)[0][0] as 'top' | 'bottom' | 'left' | 'right';
				configs.position = finalPosition;
				if (!keys(pickBy(meta, (value) => value.ready)).length)
					contentRef.style.width = `${contentRef.offsetWidth}px`;
				switch (finalPosition) {
					case 'top':
						contentRef.style.maxWidth = `${(client.browser?.width ?? 0) - OFFSET * 2}px`;
						contentRef.style.maxHeight = `${targetRect.top - arrowSize - configs.offset - OFFSET}px`;
						contentRef.style.bottom = `${(client.browser?.height ?? 0) - targetRect.bottom + arrowSize + targetRect.height + configs.offset}px`;
						if (contentRef.offsetWidth > targetRect.width) {
							if (contentRef.offsetWidth < (client.browser?.width ?? 0) - OFFSET * 2) {
								contentRef.style.left = `${targetRect.left + targetRect.width / 2 - contentRef.offsetWidth / 2}px`;
							} else {
								contentRef.style.left = `${OFFSET}px`;
							}
						} else {
							contentRef.style.left = `${Math.max(targetRect.left, Math.min(mousePosition.x - contentRef.offsetWidth / 2, targetRect.right - contentRef.offsetWidth))}px`;
						}

						break;
					case 'bottom':
						contentRef.style.maxWidth = `${(client.browser?.width ?? 0) - OFFSET * 2}px`;
						contentRef.style.maxHeight = `${(client.browser?.height ?? 0) - targetRect.bottom - configs.offset - arrowSize - OFFSET}px`;
						contentRef.style.top = `${targetRect.bottom + arrowSize + configs.offset}px`;
						if (contentRef.offsetWidth > targetRect.width) {
							if (contentRef.offsetWidth < (client.browser?.width ?? 0) - OFFSET * 2) {
								contentRef.style.left = `${targetRect.left + targetRect.width / 2 - contentRef.offsetWidth / 2}px`;
							} else {
								contentRef.style.left = `${OFFSET}px`;
							}
						} else {
							contentRef.style.left = `${Math.max(targetRect.left, Math.min(mousePosition.x - contentRef.offsetWidth / 2, targetRect.right - contentRef.offsetWidth))}px`;
						}
						break;
					case 'left':
						contentRef.style.maxWidth = `${targetRect.left - arrowSize - OFFSET}px`;
						contentRef.style.maxHeight = `${(client.browser?.height ?? 0) - OFFSET * 2}px`;
						contentRef.style.right = `${(client.browser?.width ?? 0) - targetRect.right + targetRect.width + arrowSize + configs.offset}px`;
						if (contentRef.offsetHeight > targetRect.height) {
							if (contentRef.offsetHeight < (client.browser?.height ?? 0) - OFFSET * 2) {
								contentRef.style.top = `${targetRect.top + targetRect.height / 2 - contentRef.offsetHeight / 2}px`;
							} else {
								contentRef.style.top = `${OFFSET}px`;
							}
						} else {
							contentRef.style.top = `${Math.max(targetRect.top, Math.min(mousePosition.y - contentRef.offsetHeight / 2, targetRect.bottom - contentRef.offsetHeight))}px`;
						}
						break;
					case 'right':
						contentRef.style.maxWidth = `${(client.browser?.width ?? 0) - targetRect.right - arrowSize - OFFSET}px`;
						contentRef.style.maxHeight = `${(client.browser?.height ?? 0) - OFFSET * 2}px`;
						contentRef.style.left = `${targetRect.right + arrowSize + configs.offset}px`;
						if (contentRef.offsetHeight > targetRect.height) {
							if (contentRef.offsetHeight < (client.browser?.height ?? 0) - OFFSET * 2) {
								contentRef.style.top = `${targetRect.top + targetRect.height / 2 - contentRef.offsetHeight / 2}px`;
							} else {
								contentRef.style.top = `${OFFSET}px`;
							}
						} else {
							contentRef.style.top = `${Math.max(targetRect.top, Math.min(mousePosition.y - contentRef.offsetHeight / 2, targetRect.bottom - contentRef.offsetHeight))}px`;
						}
						break;
				}
				// } else {
				// 	const finalPosition = Object.entries(pickBy(meta, (value) => value.ready)).sort(
				// 		([k, val], [k1, val1]) => val.mousePositionToSide - val1.mousePositionToSide
				// 	)[0][0] as 'top' | 'bottom' | 'left' | 'right';

				// 	configs.position = finalPosition;
				// 	switch (finalPosition) {
				// 		case 'top':
				// 			contentRef.style.maxWidth = `${(client.browser?.width ?? 0) - OFFSET * 2}px`;
				// 			contentRef.style.maxHeight = `${targetRect.top - arrowSize - configs.offset - OFFSET}px`;
				// 			contentRef.style.top = `${targetRect.top - arrowSize - contentRef.offsetHeight - configs.offset}px`;
				// 			if (contentRef.offsetWidth > targetRect.width) {
				// 				if (contentRef.offsetWidth < (client.browser?.width ?? 0) - OFFSET * 2) {
				// 					contentRef.style.left = `${targetRect.left + targetRect.width / 2 - contentRef.offsetWidth / 2}px`;
				// 				} else {
				// 					contentRef.style.left = `${OFFSET}px`;
				// 				}
				// 			} else {
				// 				contentRef.style.left = `${Math.max(targetRect.left, Math.min(mousePosition.x - contentRef.offsetWidth / 2, targetRect.right - contentRef.offsetWidth))}px`;
				// 			}
				// 			break;
				// 		case 'bottom':
				// 			contentRef.style.maxWidth = `${(client.browser?.width ?? 0) - OFFSET * 2}px`;
				// 			contentRef.style.maxHeight = `${(client.browser?.height ?? 0) - targetRect.bottom - configs.offset - arrowSize - OFFSET}px`;
				// 			contentRef.style.top = `${targetRect.bottom + arrowSize + configs.offset}px`;
				// 			if (contentRef.offsetWidth > targetRect.width) {
				// 				if (contentRef.offsetWidth < (client.browser?.width ?? 0) - OFFSET * 2) {
				// 					contentRef.style.left = `${targetRect.left + targetRect.width / 2 - contentRef.offsetWidth / 2}px`;
				// 				} else {
				// 					contentRef.style.left = `${OFFSET}px`;
				// 				}
				// 			} else {
				// 				contentRef.style.left = `${Math.max(targetRect.left, Math.min(mousePosition.x - contentRef.offsetWidth / 2, targetRect.right - contentRef.offsetWidth))}px`;
				// 			}
				// 			break;
				// 		case 'left':
				// 			contentRef.style.maxWidth = `${targetRect.left - arrowSize - OFFSET}px`;
				// 			contentRef.style.maxHeight = `${(client.browser?.height ?? 0) - OFFSET * 2}px`;
				// 			contentRef.style.right = `${(client.browser?.width ?? 0) - targetRect.right + targetRect.width + arrowSize + configs.offset}px`;
				// 			if (contentRef.offsetHeight > targetRect.height) {
				// 				if (contentRef.offsetHeight < (client.browser?.height ?? 0) - OFFSET * 2) {
				// 					contentRef.style.top = `${targetRect.top + targetRect.height / 2 - contentRef.offsetHeight / 2}px`;
				// 				} else {
				// 					contentRef.style.top = `${OFFSET}px`;
				// 				}
				// 			} else {
				// 				contentRef.style.top = `${Math.max(targetRect.top, Math.min(mousePosition.y - contentRef.offsetHeight / 2, targetRect.bottom - contentRef.offsetHeight))}px`;
				// 			}
				// 			break;
				// 		case 'right':
				// 			contentRef.style.maxWidth = `${(client.browser?.width ?? 0) - targetRect.right - arrowSize - OFFSET}px`;
				// 			contentRef.style.maxHeight = `${(client.browser?.height ?? 0) - OFFSET * 2}px`;
				// 			contentRef.style.left = `${targetRect.right + arrowSize + configs.offset}px`;
				// 			if (contentRef.offsetHeight > targetRect.height) {
				// 				if (contentRef.offsetHeight < (client.browser?.height ?? 0) - OFFSET * 2) {
				// 					contentRef.style.top = `${targetRect.top + targetRect.height / 2 - contentRef.offsetHeight / 2}px`;
				// 				} else {
				// 					contentRef.style.top = `${OFFSET}px`;
				// 				}
				// 			} else {
				// 				contentRef.style.top = `${Math.max(targetRect.top, Math.min(mousePosition.y - contentRef.offsetHeight / 2, targetRect.bottom - contentRef.offsetHeight))}px`;
				// 			}
				// 			break;
				// 	}
				// }
			}, configs.delay)
		);
	}
</script>

{#if tooltipCtx?.status?.hover}
	<svelte:element
		this={props.as ?? 'div'}
		bind:this={configs.ref}
		class={configs.style}
		{@attach handleEvents(configs.event)}
	>
		{@render children?.()}
	</svelte:element>
{/if}

<style lang="scss">
	@use '$styles/sizes.scss';
	:global(html[data-theme='dark']),
	:global(html[data-theme='system']) {
		@media (prefers-color-scheme: dark) {
			.tooltip-content {
				--background: var(--color-gray-900);
				--color: white;
			}
		}
	}
	:global(html[data-theme='light']),
	:global(html[data-theme='system']) {
		@media (prefers-color-scheme: light) {
			.tooltip-content {
				--background: var(--color-gray-200);
				--color: black;
			}
		}
	}

	.tooltip-content {
		overflow: auto;
		pointer-events: none;
		background: var(--background);
		color: var(--color);
		width: fit-content;
		height: fit-content;
		padding-inline: var(--padding);
		border-radius: var(--border-radius);
		position: fixed;
		font-size: var(--font-size);
		transition: all ease-in-out 0.3s;
	}
</style>
