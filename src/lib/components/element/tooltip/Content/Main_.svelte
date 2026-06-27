<script lang="ts">
	import type { EventListener, Positions } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';
	import { fade, fly } from 'svelte/transition';
	import { defaults, type Content } from '.';
	import { getTooltipContext } from '../Provider';
	import { profile } from '$store/basic.svelte';
	import { SvelteSet } from 'svelte/reactivity';

	let { children, ...props }: Content = $props();

	let transitions = { fly, fade };
	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		status: {
			instance: false,
			timeoutId: undefined as undefined | NodeJS.Timeout,
			size: {
				width: undefined as undefined | number,
				height: undefined as undefined | number
			},
			position: undefined as undefined | Positions,
			get positionAvailable(): Positions[] {
				const arr = new SvelteSet<Positions>();
				if (tooltipCtx.space?.top != null && configs.status.size.height != null) {
					if (tooltipCtx.space.top > configs.status.size.height) {
						arr.add('top-center');
						arr.add('top-left');
						arr.add('top-right');
					} else if (tooltipCtx.space.top == configs.status.size.height) {
						arr.add('top-center');
					}
				}
				if (tooltipCtx.space?.bottom != null && configs.status.size.height != null) {
					if (tooltipCtx.space.bottom > configs.status.size.height) {
						arr.add('bottom-center');
						arr.add('bottom-left');
						arr.add('bottom-right');
					} else if (tooltipCtx.space.bottom == configs.status.size.height) {
						arr.add('bottom-center');
					}
				}
				if (
					tooltipCtx.space?.left != null &&
					configs.status.size.width != null &&
					tooltipCtx.space.left >= configs.status.size.width
				) {
					if (
						tooltipCtx.rect?.top != null &&
						configs.status.size.height &&
						tooltipCtx.rect.bottom != null &&
						tooltipCtx.rect.bottom - tooltipCtx.rect.top > configs.status.size.height
					) {
						arr.add('left-center');
						arr.add('left-top');
						arr.add('left-bottom');
					} else if (
						tooltipCtx.rect?.top != null &&
						configs.status.size.height &&
						tooltipCtx.rect.bottom != null &&
						tooltipCtx.rect.bottom - tooltipCtx.rect.top == configs.status.size.height
					) {
						arr.add('left-center');
					}
				}
				if (
					tooltipCtx.space?.right != null &&
					configs.status.size.width != null &&
					tooltipCtx.space.right >= configs.status.size.width
				) {
					if (
						tooltipCtx.rect?.top != null &&
						configs.status.size.height &&
						tooltipCtx.rect.bottom != null &&
						tooltipCtx.rect.bottom - tooltipCtx.rect.top > configs.status.size.height
					) {
						arr.add('right-center');
						arr.add('right-top');
						arr.add('right-bottom');
					} else if (
						tooltipCtx.rect?.top != null &&
						configs.status.size.height &&
						tooltipCtx.rect.bottom != null &&
						tooltipCtx.rect.bottom - tooltipCtx.rect.top == configs.status.size.height
					) {
						arr.add('right-center');
					}
				}
				return [...arr];
			}
		},
		event: {
			load: {
				handler(e, data) {
					if (data?.node && data.node instanceof HTMLElement && tooltipCtx.mousePosition?.clientX) {
						if (props.portal) {
							if (props.portal === 'body') {
								document.body.insertAdjacentElement('beforeend', data.node);
							} else if (props.portal instanceof HTMLElement) {
								props.portal.insertAdjacentElement('beforeend', data.node);
							} else if (props.portal.includes('.')) {
								document
									.getElementById(props.portal)
									?.insertAdjacentElement('beforeend', data.node);
							}
						}
						const resizeObs = new ResizeObserver(() => {
							requestAnimationFrame(() => {
								requestAnimationFrame(() => {
									setTimeout(() => {
										if (data.node instanceof HTMLElement) {
											updateSize(data.node);
										}
									}, 300);
								});
							});
						});
						const mutationObs = new MutationObserver(() => {
							if (data.node instanceof HTMLElement) {
								requestAnimationFrame(() => {
									requestAnimationFrame(() => {
										setTimeout(() => {
											if (data.node instanceof HTMLElement) {
												updateSize(data.node);
											}
										}, 300);
									});
								});
							}
						});
						mutationObs.observe(data.node as HTMLElement, {
							childList: true,
							subtree: true
						});
						resizeObs.observe(data.node);
						return () => {
							mutationObs.disconnect();
							resizeObs.disconnect();
							if (data.node instanceof HTMLElement) data.node.remove();
						};
					}
				}
			}
		} as EventListener
	});
	const positionCoords: Record<Positions, { x: number; y: number }> = $state({
		'top-left': {
			get x() {
				return tooltipCtx.rect?.left ?? 0;
			},
			get y() {
				return tooltipCtx.rect?.top ?? 0;
			}
		},
		'top-center': {
			get x() {
				return (tooltipCtx.rect?.right ?? 0) / 2;
			},
			get y() {
				return tooltipCtx.rect?.top ?? 0;
			}
		},
		'top-right': {
			get x() {
				return tooltipCtx.rect?.right ?? 0;
			},
			get y() {
				return tooltipCtx.rect?.top ?? 0;
			}
		},
		'left-top': {
			get x() {
				return tooltipCtx.rect?.left ?? 0;
			},
			get y() {
				return tooltipCtx.rect?.top ?? 0;
			}
		},
		'left-center': {
			get x() {
				return tooltipCtx.rect?.left ?? 0;
			},
			get y() {
				return (tooltipCtx.rect?.bottom ?? 0) / 2;
			}
		},
		'left-bottom': {
			get x() {
				return tooltipCtx.rect?.left ?? 0;
			},
			get y() {
				return tooltipCtx.rect?.bottom ?? 0;
			}
		},
		'right-top': {
			get x() {
				return tooltipCtx.rect?.right ?? 0;
			},
			get y() {
				return tooltipCtx.rect?.top ?? 0;
			}
		},
		'right-center': {
			get x() {
				return tooltipCtx.rect?.right ?? 0;
			},
			get y() {
				return (tooltipCtx.rect?.bottom ?? 0) / 2;
			}
		},
		'right-bottom': {
			get x() {
				return tooltipCtx.rect?.right ?? 0;
			},
			get y() {
				return tooltipCtx.rect?.bottom ?? 0;
			}
		},
		'bottom-left': {
			get x() {
				return tooltipCtx.rect?.left ?? 0;
			},
			get y() {
				return tooltipCtx.rect?.bottom ?? 0;
			}
		},
		'bottom-center': {
			get x() {
				return (tooltipCtx.rect?.right ?? 0) / 2;
			},
			get y() {
				return tooltipCtx.rect?.bottom ?? 0;
			}
		},
		'bottom-right': {
			get x() {
				return tooltipCtx.rect?.right ?? 0;
			},
			get y() {
				return tooltipCtx.rect?.bottom ?? 0;
			}
		},
		'center-center': { x: 3, y: 3 }
	});
	let tooltipCtx = getTooltipContext();

	/**
	 * ==========================================BEGIN FUNCTIONS==================================
	 */
	function updateSize(element: HTMLElement) {
		if (configs.status.timeoutId) clearTimeout(configs.status.timeoutId);
		configs.status.timeoutId = setTimeout(() => {
			if (element && element instanceof HTMLElement) {
				configs.status.size.width = element.clientWidth;
				configs.status.size.height = element.clientHeight;
				console.log(configs.status.size);
				calculatePosition();
			}
		}, profile.delay);
	}
	function calculatePosition() {
		if (configs.status.positionAvailable && tooltipCtx.props?.position) {
			if (configs.status.positionAvailable.includes(tooltipCtx.props?.position)) {
				configs.status.position = tooltipCtx.props?.position;
			} else {
				configs.status.position = configs.status.positionAvailable[0];
			}
		} else if (configs.status.positionAvailable && !tooltipCtx.props?.position) {
			const bestDistance = configs.status.positionAvailable.reduce((best, current) => {
				return getDistance(
					best,
					tooltipCtx.mousePosition?.clientX ?? 0,
					tooltipCtx.mousePosition?.clientY ?? 0
				) >
					getDistance(
						current,
						tooltipCtx.mousePosition?.clientX ?? 0,
						tooltipCtx.mousePosition?.clientY ?? 0
					)
					? current
					: best;
			});
			console.log(bestDistance);
			configs.status.position = bestDistance; //configs.status.positionAvailable[0];
		}
		tooltipCtx.updateFinalPosition?.(configs.status.position);
	}
	function dynamicTransition(node: HTMLElement, options?: Positions) {
		if (options) {
			switch (options) {
				case 'top-center':
				case 'top-left':
				case 'top-right': {
					const trans = props.transition ?? 'fly';
					if (trans == 'fly') {
						return transitions[trans](node, profile.transition.templates.flyYReverse);
					}
					return transitions[trans](node, profile.transition.templates.fade);
				}
				case 'bottom-center':
				case 'bottom-left':
				case 'bottom-right': {
					const trans = props.transition ?? 'fly';
					if (trans == 'fly') {
						return transitions[props.transition ?? 'fly'](node, profile.transition.templates.flyY);
					}
					return transitions[trans](node, profile.transition.templates.fade);
				}
				case 'right-center':
				case 'right-top':
				case 'right-bottom': {
					const trans = props.transition ?? 'fly';
					if (trans == 'fly') {
						return transitions[props.transition ?? 'fly'](node, profile.transition.templates.flyX);
					}
					return transitions[trans](node, profile.transition.templates.fade);
				}
				case 'left-center':
				case 'left-top':
				case 'left-bottom': {
					const trans = props.transition ?? 'fly';
					if (trans == 'fly') {
						return transitions[props.transition ?? 'fly'](
							node,
							profile.transition.templates.flyXReverse
						);
					}
					return transitions[trans](node, profile.transition.templates.fade);
				}
			}
		}
		return transitions['fade'](node, profile.transition.templates.fade);
	}

	function getDistance(pos: Positions, mouseX: number, mouseY: number): number {
		const { x, y } = positionCoords[pos];

		// Tọa độ thực của position trên màn hình
		const posX = x;
		const posY = y;
		// Euclidean distance
		return (
			Math.hypot(mouseX - posX, posY - mouseY) +
			(['left', 'right'].includes(pos.split('-')[0])
				? Math.abs(mouseX - posX)
				: Math.abs(mouseY - posY))
		);
	}
	/**
	 * ==========================================END FUNCTIONS==================================
	 */

	$effect(() => {});
</script>

{#if tooltipCtx.isHover}
	<svelte:element
		this={props.as ?? 'div'}
		transition:dynamicTransition={configs.status.position}
		bind:this={configs.ref}
		{@attach handleEvents([{ events: [configs.event] }])}
		class={props.ui ?? defaults.ui}
		style:max-width={`${tooltipCtx.rect?.right}px`}
		style:--provider-rect-top={tooltipCtx.rect?.top}
		style:--provider-rect-bottom={tooltipCtx.rect?.bottom}
		style:--provider-rect-left={tooltipCtx.rect?.left}
		style:--provider-rect-right={tooltipCtx.rect?.right}
		style:--size-width={configs.status.size.width}
		style:--size-height={configs.status.size.height}
		style:--offset={tooltipCtx.props?.offset}
		data-position={configs.status.position ??
			(!configs.status.instance ? 'bottom-center' : undefined)}
	>
		{#if typeof children == 'function'}
			{@render children()}
		{:else if typeof props.content == 'object' && props.content.main}
			<div>{props.content.main}</div>

			{#if props.content.description}
				<div>{props.content.description}</div>
			{/if}
		{/if}
	</svelte:element>
{/if}

<style lang="scss">
	[data-position] {
		transition: all ease-in-out 0.3s;
	}
	[data-position='top-center'] {
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		padding-bottom: calc(var(--offset) * 1px);
		top: calc((var(--provider-rect-top) - var(--size-height)) * 1px);
		left: calc(var(--provider-rect-right) / 2 * 1px);
		transform: translateX(-50%);
	}
	[data-position='top-left'] {
		display: flex;
		flex-direction: column-reverse;
		align-items: start;
		padding-bottom: calc(var(--offset) * 1px);
		top: calc((var(--provider-rect-top) - var(--size-height)) * 1px);
		left: 0px;
	}
	[data-position='top-right'] {
		display: flex;
		flex-direction: column-reverse;
		align-items: end;
		padding-bottom: calc(var(--offset) * 1px);
		top: calc((var(--provider-rect-top) - var(--size-height)) * 1px);
		left: calc((var(--provider-rect-right) - var(--size-width)) * 1px);
	}

	[data-position='bottom-center'] {
		padding-top: calc(var(--offset) * 1px);
		display: flex;
		flex-direction: column;
		align-items: center;
		top: calc(var(--provider-rect-bottom) * 1px);
		left: calc(var(--provider-rect-right) / 2 * 1px);
		transform: translateX(-50%);
	}
	[data-position='bottom-left'] {
		padding-top: calc(var(--offset) * 1px);
		display: flex;
		flex-direction: column;
		align-items: start;
		top: calc(var(--provider-rect-bottom) * 1px);
		left: 0px;
	}
	[data-position='bottom-right'] {
		padding-top: calc(var(--offset) * 1px);
		display: flex;
		flex-direction: column;
		align-items: end;
		top: calc(var(--provider-rect-bottom) * 1px);
		left: calc((var(--provider-rect-right) - var(--size-width)) * 1px);
	}
	[data-position='left-center'] {
		display: flex;
		flex-direction: row-reverse;
		align-items: center;
		padding-right: calc(var(--offset) * 1px);
		top: calc(var(--provider-rect-bottom) / 2 * 1px);
		left: calc((var(--provider-rect-left) - var(--size-width)) * 1px);
		transform: translateY(-50%);
	}
	[data-position='left-top'] {
		display: flex;
		flex-direction: row-reverse;
		align-items: start;
		padding-right: calc(var(--offset) * 1px);
		top: calc(var(--provider-rect-top) * 1px);
		left: calc((var(--provider-rect-left) - var(--size-width)) * 1px);
	}
	[data-position='left-bottom'] {
		display: flex;
		flex-direction: row-reverse;
		align-items: end;
		padding-right: calc(var(--offset) * 1px);
		top: calc((var(--provider-rect-bottom) - var(--size-height)) * 1px);
		left: calc((var(--provider-rect-left) - var(--size-width)) * 1px);
	}

	[data-position='right-center'] {
		padding-left: calc(var(--offset) * 1px);
		display: flex;
		flex-direction: row;
		align-items: center;
		top: calc(var(--provider-rect-bottom) / 2 * 1px);
		left: calc(var(--provider-rect-right) * 1px);
		transform: translateY(-50%);
	}
	[data-position='right-top'] {
		display: flex;
		flex-direction: row;
		align-items: start;
		padding-left: calc(var(--offset) * 1px);
		top: calc(var(--provider-rect-top) * 1px);
		left: calc(var(--provider-rect-right) * 1px);
	}
	[data-position='right-bottom'] {
		display: flex;
		flex-direction: row;
		align-items: end;
		padding-left: calc(var(--offset) * 1px);
		top: calc((var(--provider-rect-bottom) - var(--size-height)) * 1px);
		left: calc(var(--provider-rect-right) * 1px);
	}
</style>
