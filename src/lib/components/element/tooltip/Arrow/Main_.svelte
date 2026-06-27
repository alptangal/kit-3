<script lang="ts">
	import type { EventListener } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';
	import { profile } from '$store/basic.svelte';
	import { defaults, type Arrow } from '.';
	import { getTooltipContext } from '../Provider';

	let { children, ...props }: Arrow = $props();
	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		status: {
			timeoutId: undefined as undefined | NodeJS.Timeout,
			size: {
				width: undefined as undefined | number,
				height: undefined as undefined | number
			}
		},
		event: {
			load: {
				handler(e, data) {
					if (data?.node && data.node instanceof HTMLElement) {
						const resizeObs = new ResizeObserver(() => {
							if (data.node instanceof HTMLElement) {
								updateSize(data.node);
							}
						});
						const mutationObs = new MutationObserver(() => {
							if (data.node instanceof HTMLElement) {
								updateSize(data.node);
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
						};
					}
				}
			}
		} as EventListener
	});
	const tooltipCtx = getTooltipContext();

	/**
	 * ==========================================BEGIN FUNCTIONS==================================
	 */
	function updateSize(element: HTMLElement) {
		if (configs.status.timeoutId) clearTimeout(configs.status.timeoutId);
		configs.status.timeoutId = setTimeout(() => {
			if (element && element instanceof HTMLElement) {
				configs.status.size.width = element.clientWidth;
				configs.status.size.height = element.clientHeight;
			}
		}, profile.delay);
	}
	/**
	 * ==========================================END FUNCTIONS==================================
	 */
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={props.ui ?? defaults.ui}
	{@attach handleEvents([{ events: [configs.event] }])}
	class:arrow-default={!children}
	data-position={typeof tooltipCtx.updateFinalPosition == 'function'
		? (tooltipCtx.updateFinalPosition() ?? 'bottom-center')
		: 'bottom-center'}
	data-color={props.color ?? 'default'}
	data-size={props.size ?? 'md'}
>
	{#if typeof children == 'function'}
		{@render children()}
	{/if}
</svelte:element>

<style lang="scss">
	[data-color='default'] {
		--arrow-color: black;
	}
	[data-color='accent'] {
		--arrow-color: oklch(0.6204 0.195 253.83);
	}
	[data-color='success'] {
		--arrow-color: oklch(0.7329 0.1935 150.81);
	}
	[data-color='warning'] {
		--arrow-color: oklch(0.7819 0.1585 72.3301);
	}
	[data-color='danger'] {
		--arrow-color: oklch(0.6532 0.2328 25.7401);
	}
	.arrow-default {
		&[data-size='xs'] {
			--arrow-size: 2;
		}
		&[data-size='sm'] {
			--arrow-size: 4;
		}
		&[data-size='md'] {
			--arrow-size: 6;
		}
		&[data-size='lg'] {
			--arrow-size: 8;
		}
		&[data-size='xl'] {
			--arrow-size: 10;
		}
		&[data-size='2xl'] {
			--arrow-size: 12;
		}
		&[data-size='3xl'] {
			--arrow-size: 14;
		}
		&[data-size='4xl'] {
			--arrow-size: 16;
		}
		&[data-size='5xl'] {
			--arrow-size: 18;
		}
		&[data-size='6xl'] {
			--arrow-size: 20;
		}
		&[data-size='7xl'] {
			--arrow-size: 22;
		}
		&[data-size='8xl'] {
			--arrow-size: 24;
		}
		&[data-size='9xl'] {
			--arrow-size: 26;
		}
		width: 0px;
		height: 0px;
		transition: all ease-in-out 0.3s;
		&[data-position='bottom-center'] {
			border-bottom: calc(var(--arrow-size) * 1px) var(--arrow-color) solid;
			border-left: calc(var(--arrow-size) / sqrt(3) * 1px) transparent solid;
			border-right: calc(var(--arrow-size) / sqrt(3) * 1px) transparent solid;
		}
		&[data-position='bottom-left'] {
			border-bottom: calc(var(--arrow-size) * 1px) var(--arrow-color) solid;
			border-right: calc(var(--arrow-size) * 1px) transparent solid;
		}
		&[data-position='bottom-right'] {
			border-bottom: calc(var(--arrow-size) * 1px) var(--arrow-color) solid;
			border-left: calc(var(--arrow-size) * 1px) transparent solid;
		}
		&[data-position='top-center'] {
			border-top: calc(var(--arrow-size) * 1px) var(--arrow-color) solid;
			border-left: calc(var(--arrow-size) / sqrt(3) * 1px) transparent solid;
			border-right: calc(var(--arrow-size) / sqrt(3) * 1px) transparent solid;
		}
		&[data-position='top-left'] {
			border-top: calc(var(--arrow-size) * 1px) var(--arrow-color) solid;
			border-right: calc(var(--arrow-size) * 1px) transparent solid;
		}
		&[data-position='top-right'] {
			border-top: calc(var(--arrow-size) * 1px) var(--arrow-color) solid;
			border-left: calc(var(--arrow-size) * 1px) transparent solid;
		}
		&[data-position='left-center'] {
			border-left: calc(var(--arrow-size) * 1px) var(--arrow-color) solid;
			border-top: calc(var(--arrow-size) / sqrt(3) * 1px) transparent solid;
			border-bottom: calc(var(--arrow-size) / sqrt(3) * 1px) transparent solid;
		}
		&[data-position='left-top'] {
			border-left: calc(var(--arrow-size) * 1px) var(--arrow-color) solid;
			border-bottom: calc(var(--arrow-size) * 1px) transparent solid;
		}
		&[data-position='left-bottom'] {
			border-left: calc(var(--arrow-size) * 1px) var(--arrow-color) solid;
			border-top: calc(var(--arrow-size) * 1px) transparent solid;
		}
		&[data-position='right-center'] {
			border-right: calc(var(--arrow-size) * 1px) var(--arrow-color) solid;
			border-top: calc(var(--arrow-size) / sqrt(3) * 1px) transparent solid;
			border-bottom: calc(var(--arrow-size) / sqrt(3) * 1px) transparent solid;
		}
		&[data-position='right-top'] {
			border-right: calc(var(--arrow-size) * 1px) var(--arrow-color) solid;
			border-bottom: calc(var(--arrow-size) * 1px) transparent solid;
		}
		&[data-position='right-bottom'] {
			border-right: calc(var(--arrow-size) * 1px) var(--arrow-color) solid;
			border-top: calc(var(--arrow-size) * 1px) transparent solid;
		}
	}
</style>
