<script lang="ts">
	import type { DistanceUnits } from '$components/interface';
	import { convertToPixels, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { getTooltipCtx } from '..';
	import type { TooltipArrowConfigs, TooltipArrowProps } from '../_interface';

	let { ...props }: TooltipArrowProps = $props();
	const tooltipCtx = getTooltipCtx();
	let configs: TooltipArrowConfigs = $state({
		get size() {
			return props.size ?? tooltipCtx?.contentMeta?.size ?? tooltipCtx?.size ?? 'md';
		},
		get color() {
			return props.color ?? 'default';
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'tooltip-arrow',
				`color-${this.color}`,
				`size-${this.size}`,
				tooltipCtx?.contentMeta?.position
					? `position-${tooltipCtx.contentMeta.position}`
					: undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		event: [
			{
				events: {
					load(e, data) {
						if (data?.node instanceof HTMLElement && tooltipCtx?.updateArrowMeta) {
							tooltipCtx.updateArrowMeta({
								get size() {
									return configs.size;
								},
								ref: data.node
							});
							document.body.append(data.node);
							return () => {
								if (data.node instanceof HTMLElement) data.node.remove();
							};
						}
					}
				}
			}
		]
	});

	$effect(() => {
		if (
			tooltipCtx?.contentMeta?.position &&
			tooltipCtx.status?.mousePosition &&
			tooltipCtx.ref &&
			tooltipCtx.contentMeta.ref &&
			configs.ref
		) {
			if (!configs.timeId) configs.timeId = new Map();
			const name = 'arrow-animation';
			const timeId = configs.timeId.get('arrow-animation');
			if (timeId) clearTimeout(timeId);
			configs.timeId.set(
				name,
				setTimeout(() => {
					if (
						tooltipCtx?.contentMeta?.position &&
						tooltipCtx.status?.mousePosition &&
						tooltipCtx.ref &&
						tooltipCtx.contentMeta.ref &&
						configs.ref
					) {
						const contentRect = tooltipCtx.contentMeta.ref.getBoundingClientRect();
						const targetRect = tooltipCtx.ref.getBoundingClientRect();
						const contentPosition = tooltipCtx.contentMeta.position;
						const { x: mouseX, y: mouseY } = tooltipCtx.status.mousePosition;
						let arrowSize: undefined | number = 0;
						if (tooltipCtx?.arrowMeta?.ref)
							arrowSize =
								(convertToPixels(
									getComputedStyle(tooltipCtx.arrowMeta.ref).getPropertyValue(
										'--size'
									) as DistanceUnits
								) ?? 0) / 2;

						configs.ref.classList.forEach((clss) =>
							clss.includes('position') ? configs.ref?.classList.remove(clss) : undefined
						);
						switch (contentPosition) {
							case 'top':
								configs.ref.style.left = `${mouseX - arrowSize / 2}px`;
								configs.ref.style.top = `${targetRect.top - (tooltipCtx.contentMeta.offset ?? 0) - arrowSize}px`;
								if (mouseX < contentRect.left + (tooltipCtx.offset ?? 0)) {
									configs.ref.classList.add('position-top-left');
								} else if (mouseX > contentRect.right - (tooltipCtx.offset ?? 0)) {
									configs.ref.classList.add('position-top-right');
								} else {
									configs.ref.classList.add('position-top');
								}
								break;
							case 'bottom':
								configs.ref.style.left = `${mouseX - arrowSize / 2}px`;
								configs.ref.style.top = `${targetRect.bottom + (tooltipCtx.contentMeta.offset ?? 0)}px`;
								if (mouseX < contentRect.left + (tooltipCtx.offset ?? 0)) {
									configs.ref.classList.add('position-bottom-left');
								} else if (mouseX > contentRect.right - (tooltipCtx.offset ?? 0)) {
									configs.ref.classList.add('position-bottom-right');
								} else {
									configs.ref.classList.add('position-bottom');
								}
								break;
							case 'left':
								configs.ref.style.top = `${mouseY - arrowSize / 2}px`;
								configs.ref.style.left = `${targetRect.left - (tooltipCtx.contentMeta.offset ?? 0) - arrowSize}px`;
								if (mouseY < contentRect.top + (tooltipCtx.offset ?? 0)) {
									configs.ref.classList.add('position-left-top');
								} else if (mouseY > contentRect.bottom - (tooltipCtx.offset ?? 0)) {
									configs.ref.classList.add('position-left-bottom');
								} else {
									configs.ref.classList.add('position-left');
								}
								break;
							case 'right':
								configs.ref.style.top = `${mouseY - arrowSize / 2}px`;
								configs.ref.style.left = `${targetRect.right + (tooltipCtx.contentMeta.offset ?? 0)}px`;
								if (mouseY < contentRect.top + (tooltipCtx.offset ?? 0)) {
									configs.ref.classList.add('position-right-top');
								} else if (mouseY > contentRect.bottom - (tooltipCtx.offset ?? 0)) {
									configs.ref.classList.add('position-right-bottom');
								} else {
									configs.ref.classList.add('position-right');
								}
								break;
						}
					}
				}, tooltipCtx.delay)
			);
		}
	});
</script>

{#if tooltipCtx?.contentMeta?.position}
	<svelte:element
		this={props.as ?? 'div'}
		bind:this={configs.ref}
		class={configs.style}
		{@attach handleEvents(configs.event)}
	></svelte:element>
{/if}

<style lang="scss">
	@use '$styles/colors.scss';
	.tooltip-arrow {
		&.size-xs {
			--size: var(--font-size-xs);
		}
		&.size-sm {
			--size: var(--font-size-sm);
		}
		&.size-md {
			--size: var(--font-size-md);
		}
		&.size-lg {
			--size: var(--font-size-lg);
		}
		&.size-xl {
			--size: var(--font-size-xl);
		}
		&.size-2xl {
			--size: var(--font-size-2xl);
		}
		&.size-3xl {
			--size: var(--font-size-3xl);
		}
		&.size-4xl {
			--size: var(--font-size-4xl);
		}
		&.size-5xl {
			--size: var(--font-size-5xl);
		}
		&.size-6xl {
			--size: var(--font-size-6xl);
		}
		&.size-7xl {
			--size: var(--font-size-7xl);
		}
		&.size-8xl {
			--size: var(--font-size-8xl);
		}
		&.size-9xl {
			--size: var(--font-size-9xl);
		}
		&.position-top {
			top: 100%;
			border-top: calc(var(--size) / 2) solid var(--color);
			border-left: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
			border-right: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
		}
		&.position-top-left {
			top: 100%;
			left: 0px;
			border-top: calc(var(--size) / 2) solid var(--color);
			border-right: calc((var(--size)) / 2) solid transparent;
		}
		&.position-top-right {
			top: 100%;
			right: 0px;
			border-top: calc(var(--size) / 2) solid var(--color);
			border-left: calc((var(--size)) / 2) solid transparent;
		}
		&.position-bottom {
			bottom: 100%;
			border-bottom: calc(var(--size) / 2) solid var(--color);
			border-left: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
			border-right: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
		}
		&.position-bottom-left {
			bottom: 100%;
			left: 0px;
			border-bottom: calc(var(--size) / 2) solid var(--color);
			border-right: calc((var(--size)) / 2) solid transparent;
		}
		&.position-bottom-right {
			bottom: 100%;
			right: 0px;
			border-bottom: calc(var(--size) / 2) solid var(--color);
			border-left: calc((var(--size)) / 2) solid transparent;
		}
		&.position-left {
			left: 100%;
			border-left: calc(var(--size) / 2) solid var(--color);
			border-top: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
			border-bottom: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
		}
		&.position-left-top {
			left: 100%;
			top: 0px;
			border-left: calc(var(--size) / 2) solid var(--color);
			border-bottom: calc((var(--size)) / 2) solid transparent;
		}
		&.position-left-bottom {
			bottom: 100%;
			right: 0px;
			border-left: calc(var(--size) / 2) solid var(--color);
			border-top: calc((var(--size)) / 2) solid transparent;
		}
		&.position-right {
			right: 100%;
			border-right: calc(var(--size) / 2) solid var(--color);
			border-top: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
			border-bottom: calc((var(--size)) / (sqrt(3) * 2)) solid transparent;
			border-left: 0 solid transparent;
		}
		&.position-right-top {
			right: 100%;
			top: 0%;
			border-right: calc(var(--size) / 2) solid var(--color);
			border-bottom: calc((var(--size)) / 2) solid transparent;
			border-top: 0 solid transparent;
			border-left: 0 solid transparent;
		}
		&.position-right-bottom {
			right: 100%;
			bottom: 0%;
			border-right: calc(var(--size) / 2) solid var(--color);
			border-top: calc((var(--size)) / 2) solid transparent;
			border-bottom: 0 solid transparent;
			border-left: 0 solid transparent;
		}
		width: 0px;
		height: 0px;
		position: fixed;
		transition: all ease-in-out 0.3s;
	}
</style>
