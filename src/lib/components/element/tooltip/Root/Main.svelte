<script lang="ts">
	import { fly } from 'svelte/transition';
	import type { Root } from '.';
	import { getTooltipContext } from '../Provider';
	import { profile } from '$store/basic.svelte';
	import { onDestroy, untrack } from 'svelte';
	import type { EventListener } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';

	let { children, ...props }: Root = $props();
	let tooltipCtx = getTooltipContext();
	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		status: {
			get hover() {
				return tooltipCtx.isHover ?? false;
			},
			position: {
				x: undefined as undefined | number,
				y: undefined as undefined | number
			},
			placement: undefined as undefined | 'top' | 'bottom' | 'left' | 'right',
			timeId: {
				frameAnimation: undefined as undefined | number
			}
		},
		get offset() {
			if (typeof tooltipCtx.props?.offset == 'number') return tooltipCtx.props.offset;
			if (typeof tooltipCtx.props?.offset == 'string') return parseFloat(tooltipCtx.props.offset);
			return 0;
		},
		event: {
			load: {
				handler(e, data) {
					if (data?.node instanceof HTMLElement) {
						if (tooltipCtx.props?.portal) {
							(tooltipCtx.props.portal as HTMLElement).appendChild(data.node);
						}
						const childrens = data.node.children;
						if (
							childrens.length > 1 &&
							[...childrens].some((el) => [...el.classList].includes('tooltip-arrow'))
						) {
							const arrowElement = [...childrens].find((el) =>
								[...el.classList].includes('tooltip-arrow')
							);
							if (arrowElement) data.node.prepend(arrowElement);
						}
						const mutationObs = new MutationObserver(() => {
							console.log(data.node);
						});
						mutationObs.observe(data.node, { childList: true });
						return () => {
							if (data.node instanceof HTMLElement) data.node.remove();
							mutationObs.disconnect();
						};
					}
				}
			}
		} as EventListener
	});
	const defaults = {
		min: {
			w: 200,
			h: 100
		},
		class: ''
	};

	/*-------------------------------------------* BEGIN METHODS *---------------------------------*/
	function getSide(
		mx: number,
		my: number,
		el: HTMLElement
	): undefined | 'top' | 'left' | 'bottom' | 'right' {
		const providerRect = el.getBoundingClientRect();
		const bw = configs.ref?.offsetWidth ?? defaults.min.w,
			bh = configs.ref?.offsetHeight ?? defaults.min.h;
		let readySide: { id: 'top' | 'left' | 'bottom' | 'right'; dist: number; fits: boolean }[] = [
			{
				id: 'top',
				fits: providerRect.top - configs.offset >= bh,
				dist: my - providerRect.top
			},
			{
				id: 'bottom',
				fits: window.innerHeight - providerRect.bottom - configs.offset >= bh,
				dist: providerRect.bottom - my
			},
			{
				id: 'left',
				fits: providerRect.left - configs.offset >= bw,
				dist: mx - providerRect.left
			},
			{
				id: 'right',
				fits: window.innerWidth - providerRect.right - configs.offset >= bw,
				dist: providerRect.right - mx
			}
		];
		return readySide.filter((s) => s.fits).sort((a, b) => a.dist - b.dist)[0].id;
	}
	export function update(mx: number, my: number, el: HTMLElement) {
		const providerRect = el.getBoundingClientRect();

		configs.status.placement = getSide(
			tooltipCtx.mousePosition?.clientX ?? 0,
			tooltipCtx.mousePosition?.clientY ?? 0,
			el
		);
		const bh = configs.ref?.offsetHeight ?? 0,
			bw = configs.ref?.offsetWidth ?? 0,
			vw = window.innerWidth,
			vh = window.innerHeight;

		if (configs.status.placement == 'top') {
			configs.status.position.y = providerRect.top - bh - configs.offset;
			configs.status.position.x = mx - bw * ((mx - providerRect.left) / providerRect.width);
			configs.status.position.x = Math.max(8, Math.min(configs.status.position.x, vw - bw - 8));
		} else if (configs.status.placement == 'bottom') {
			configs.status.position.y = providerRect.bottom + configs.offset;
			configs.status.position.x = mx - bw * ((mx - providerRect.left) / providerRect.width);
			configs.status.position.x = Math.max(8, Math.min(configs.status.position.x, vw - bw - 8));
		} else if (configs.status.placement == 'left') {
			configs.status.position.y = my - bh * ((my - providerRect.top) / providerRect.height);
			configs.status.position.y = Math.max(8, Math.min(configs.status.position.y, vh - bh - 8));
			configs.status.position.x = providerRect.left - bw - configs.offset;
		} else if (configs.status.placement == 'right') {
			configs.status.position.y = my - bh * ((my - providerRect.top) / providerRect.height);
			configs.status.position.y = Math.max(8, Math.min(configs.status.position.y, vh - bh - 8));
			configs.status.position.x = providerRect.right + configs.offset;
		}
	}
	function hide() {
		configs.ref = undefined;
	}
	/*-------------------------------------------* END METHODS *---------------------------------*/

	$effect(() => {
		// Chỉ track mouse position và hover
		const hover = configs.status.hover;
		const mx = tooltipCtx.mousePosition?.clientX ?? 0;
		const my = tooltipCtx.mousePosition?.clientY ?? 0;
		const el = tooltipCtx.ref;

		if (!hover || !el) return;

		// Dùng untrack cho phần ghi để không trigger lại effect
		untrack(() => {
			update(mx, my, el);
			tooltipCtx.updateFinalPosition?.(configs.status.placement!);
		});
	});

	$effect(() => {
		// Effect riêng cho contentRef, chỉ chạy khi ref thay đổi
		const ref = configs.ref;
		if (!ref) return;

		untrack(() => {
			tooltipCtx.updateContentRef?.(ref);
		});
	});
	onDestroy(() => {
		if (configs.ref) {
			configs.ref.remove();
		}
	});
</script>

{#if configs.status.hover}
	<svelte:element
		this={props.as ?? 'div'}
		bind:this={configs.ref}
		transition:fly={profile.transition.templates.flyY}
		class={[
			typeof (props.class ?? defaults.class) == 'string'
				? (props.class ?? defaults.class)
				: typeof (props.class ?? defaults.class) == 'object'
					? [...(props.class ?? defaults.class)]
					: '',
			'tooltip-root'
		]}
		data-placement={configs.status.placement}
		style:top={configs.status.position.y ? `${configs.status.position.y}px` : undefined}
		style:left={configs.status.position.x ? `${configs.status.position.x}px` : undefined}
		style:max-width={`${window.innerWidth - 16}px`}
		style:max-height={`${window.innerHeight - 16}px`}
		{@attach handleEvents([{ events: [configs.event] }])}
	>
		{@render children?.()}
	</svelte:element>
{/if}

<style lang="scss">
	.tooltip-root {
		@apply fixed flex z-[9999];
		&[data-placement='top'] {
			@apply flex-col-reverse;
		}
		&[data-placement='bottom'] {
			@apply flex-col;
		}
		&[data-placement='left'] {
			@apply flex-row-reverse;
		}
	}
</style>
