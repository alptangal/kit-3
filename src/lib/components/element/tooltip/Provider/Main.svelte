<script lang="ts">
	import type { EventListener } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';
	import { profile } from '$store/basic.svelte';
	import { setTooltipContext, type Provider } from '.';

	let { children, ...props }: Provider = $props();

	let status = $state({
		hover: false,
		placement: undefined as undefined | 'top' | 'bottom' | 'right' | 'left'
	});
	let mousePoint = $state({
		clientX: undefined as undefined | number,
		clientY: undefined as undefined | number
	});
	let ref: undefined | HTMLElement = $state(undefined);
	let contentRef: undefined | HTMLElement = $state(undefined);
	let event: EventListener = {
		mouseenter: {
			handler(e) {
				status.hover = true;
				mousePoint.clientX = (e as MouseEvent).clientX;
				mousePoint.clientY = (e as MouseEvent).clientY;
			}
		},
		mousemove: {
			handler(e) {
				status.hover = true;
				mousePoint.clientX = (e as MouseEvent).clientX;
				mousePoint.clientY = (e as MouseEvent).clientY;
			},
			options: {
				get delay() {
					if (!props.delay) return profile.delay;
					if (typeof props.delay == 'number') return props.delay;
					return parseFloat(props.delay);
				}
			}
		},
		mouseleave: {
			handler() {
				status.hover = false;
			},
			options: {
				get delay() {
					if (!props.delay) return profile.delay;
					if (typeof props.delay == 'number') return props.delay;
					return parseFloat(props.delay);
				}
			}
		}
	};
	setTooltipContext({
		get delay() {
			return props.delay;
		},
		get props() {
			return {
				position: props.position,
				offset: props.offset,
				portal: props.portal
			};
		},
		get mousePosition() {
			return mousePoint;
		},
		get ref() {
			return ref;
		},
		get isHover() {
			return status.hover;
		},
		updateFinalPosition(placement) {
			if (placement) {
				status.placement = placement;
			}
		},
		get placement() {
			return status.placement;
		},
		updateContentRef(el) {
			contentRef = el;
		},
		get contentRef() {
			return contentRef;
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={ref}
	{@attach handleEvents([{ events: [event] }])}
	class="relative"
>
	{@render children?.()}
</svelte:element>
