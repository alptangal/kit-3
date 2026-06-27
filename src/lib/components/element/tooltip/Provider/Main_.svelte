<script lang="ts">
	import type { EventListener, Positions } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';
	import { profile } from '$store/basic.svelte';
	import { omit, pick } from 'es-toolkit/compat';
	import { defaults, setTooltipContext, type Provider } from '.';

	let { children, ...props }: Provider = $props();

	let configs = $state({
		status: {
			hover: false,
			size: {
				width: undefined as undefined | number,
				height: undefined as undefined | number
			},
			timeoutId: undefined as undefined | NodeJS.Timeout,
			position: {
				x: undefined as undefined | number,
				y: undefined as undefined | number
			},
			mousePosition: {
				clientX: undefined as undefined | number,
				clientY: undefined as undefined | number
			},
			finalPosition: undefined as undefined | Positions,
			rect: {
				top: undefined as undefined | number,
				left: undefined as undefined | number,
				get bottom() {
					return this.top != null && configs.ref ? this.top + configs.ref.clientHeight : undefined;
				},
				get right() {
					return this.left != null && configs.ref ? this.left + configs.ref.clientWidth : undefined;
				}
			},
			space: {
				get top() {
					return configs.status.rect.top ? configs.status.rect.top : undefined;
				},
				get bottom() {
					return configs.status.rect.bottom
						? window.innerHeight - configs.status.rect.bottom
						: undefined;
				},
				get left() {
					return configs.status.rect.left ? configs.status.rect.left : undefined;
				},
				get right() {
					return configs.status.rect.right
						? window.innerWidth - configs.status.rect.right
						: undefined;
				}
			}
		},
		ref: undefined as undefined | HTMLElement,
		event: {
			load: {
				handler(e, data) {
					if (data?.node && data.node instanceof HTMLElement) {
						const resizeObs = new ResizeObserver(() => {
							if (data.node instanceof HTMLElement) {
								updateSize(data.node);
								updatePosition(data.node);
							}
						});
						const mutationObs = new MutationObserver(() => {
							if (data.node instanceof HTMLElement) {
								updateSize(data.node);
								updatePosition(data.node);
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
			},
			mousemove: {
				handler(e: MouseEvent) {
					configs.status.hover = true;
					configs.status.mousePosition.clientX = e.clientX;
					configs.status.mousePosition.clientY = e.clientY;
				},
				options: {
					get delay() {
						return props.delay ?? profile.delay;
					}
				}
			},
			mouseout: {
				handler() {
					configs.status.hover = false;
				},
				options: {
					get delay() {
						return props.delay ?? profile.delay;
					}
				}
			},
			scroll: {
				handler() {
					if (configs.ref) {
						updatePosition(configs.ref);
					}
				}
			}
		} as EventListener
	});

	/**
	 *====================================BEGIN FUNCTION==================================
	 */
	function updatePosition(element: HTMLElement) {
		if (configs.status.timeoutId) clearTimeout(configs.status.timeoutId);
		configs.status.timeoutId = setTimeout(() => {
			if (element && element instanceof HTMLElement) {
				const rect = element.getBoundingClientRect();
				configs.status.rect.top = rect.top;
				configs.status.rect.left = rect.left;
			}
		}, profile.delay);
	}
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
	 *====================================END FUNCTION==================================
	 */

	/**
	 *====================================BEGIN SHARE CONTEXT==================================
	 */
	setTooltipContext({
		get delay() {
			return props.delay;
		},
		get isHover() {
			return configs.status.hover;
		},
		get space() {
			return configs.status.space;
		},
		get props() {
			return {
				position: props.position,
				offset: props.offset
			};
		},
		get rect() {
			return configs.status.rect;
		},
		updateFinalPosition(input) {
			if (input) configs.status.finalPosition = input;
			return configs.status.finalPosition;
		},
		get mousePosition() {
			return configs.status.mousePosition;
		}
	});
	/**
	 *====================================END SHARE CONTEXT==================================
	 */
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	{@attach handleEvents([
		{ events: [omit(configs.event, ['scroll'])] },
		{ events: [pick(configs.event, ['scroll'])], target: window }
	])}
	class={props.ui ?? defaults.ui}
>
	{@render children?.()}
</svelte:element>
