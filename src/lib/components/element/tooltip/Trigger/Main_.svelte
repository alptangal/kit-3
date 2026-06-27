<script lang="ts">
	import type { EventListener } from '$components/interface';
	import { profile } from '$store/basic.svelte';
	import { defaults, type Trigger } from '.';

	let { children, ...props }: Trigger = $props();
	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		status: {
			size: {
				width: undefined as undefined | number,
				height: undefined as undefined | number
			},
			timeoutId: undefined as undefined | NodeJS.Timeout,
			position: {
				x: undefined as undefined | number,
				y: undefined as undefined | number
			},
			rect: {
				top: undefined as undefined | number,
				left: undefined as undefined | number,
				get bottom() {
					return this.top != null && configs.ref ? this.top + configs.ref.clientHeight : undefined;
				},
				get right() {
					return this.left != null && configs.ref ? this.left + configs.ref.clientWidth : undefined;
				}
			}
		},
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
			}
		} as EventListener
	});

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
</script>

<svelte:element this={props.as ?? 'div'} class={props.ui ?? defaults.ui} bind:this={configs.ref}>
	{@render children?.()}
</svelte:element>
