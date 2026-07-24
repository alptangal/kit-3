<script lang="ts">
	import type { Arrow } from '.';
	import { getTooltipContext } from '../Provider';

	let { children, ...props }: Arrow = $props();
	const tooltipCtx = getTooltipContext();
	let configs = $state({
		get contentRef() {
			return tooltipCtx.contentRef;
		},
		get contentRect() {
			return this.contentRef?.getBoundingClientRect();
		},
		get size() {
			switch (props.size) {
				case 'xs':
					return 2;
				case 'sm':
					return 4;
				case 'md':
					return 6;
				case 'lg':
					return 8;
				case 'xl':
					return 10;
				case '2xl':
					return 12;
				case '3xl':
					return 14;
				case '4xl':
					return 16;
				case '5xl':
					return 18;
				case '6xl':
					return 20;
				case '7xl':
					return 22;
				case '8xl':
					return 24;
				case '9xl':
					return 26;
			}
			return 6;
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	class={'tooltip-arrow ' + (tooltipCtx.placement ? `tooltip-arrow-${tooltipCtx.placement}` : '')}
	data-size={props.size ?? 'md'}
	style:--arrow-color={`hsl(var(--${props.color ?? 'primary'}))`}
	style:left={tooltipCtx.mousePosition?.clientX &&
	tooltipCtx.placement &&
	configs.contentRect?.left &&
	['top', 'bottom'].includes(tooltipCtx.placement)
		? `${Math.min(configs.contentRect.width - configs.size, Math.max(0, tooltipCtx.mousePosition.clientX - configs.contentRect.left))}px`
		: undefined}
	style:top={tooltipCtx.mousePosition?.clientY &&
	tooltipCtx.placement &&
	configs.contentRect &&
	['left', 'right'].includes(tooltipCtx.placement)
		? `${Math.min(configs.contentRect.height - configs.size, Math.max(0, tooltipCtx.mousePosition.clientY - configs.contentRect.top))}px`
		: undefined}
	style:--arrow-size={`calc(${configs.size} * 1px)`}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	.tooltip-arrow {
		@apply flex relative transition-all ease-in-out duration-300;
	}
	.tooltip-arrow-top {
		&::before {
			content: '';
			width: 0px;
			height: 0px;
			border-top: calc(var(--arrow-size)) var(--arrow-color) solid;
			border-left: calc(var(--arrow-size) / 1.73205081) transparent solid;
			border-right: calc(var(--arrow-size) / 1.73205081) transparent solid;
		}
	}
	.tooltip-arrow-bottom::before {
		content: '';
		width: 0;
		height: 0;
		border-bottom: var(--arrow-size) var(--arrow-color) solid;
		border-left: calc(var(--arrow-size) / 1.73205081) transparent solid;
		border-right: calc(var(--arrow-size) / 1.73205081) transparent solid;
	}

	.tooltip-arrow-left::before {
		content: '';
		width: 0;
		height: 0;
		border-left: var(--arrow-size) var(--arrow-color) solid;
		border-top: calc(var(--arrow-size) / 1.73205081) transparent solid;
		border-bottom: calc(var(--arrow-size) / 1.73205081) transparent solid;
	}

	.tooltip-arrow-right::before {
		content: '';
		width: 0;
		height: 0;
		border-right: var(--arrow-size) var(--arrow-color) solid;
		border-top: calc(var(--arrow-size) / 1.73205081) transparent solid;
		border-bottom: calc(var(--arrow-size) / 1.73205081) transparent solid;
	}
</style>
