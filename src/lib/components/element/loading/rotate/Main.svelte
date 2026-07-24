<script lang="ts">
	import { browser } from '$app/environment';
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { onDestroy } from 'svelte';
	import type { LoadingRotateConfigs, LoadingRotateProps } from '../_interface';

	let { ...props }: LoadingRotateProps = $props();
	let configs: LoadingRotateConfigs = $state({
		get style() {
			const defaultStyles: string[] = ['loading-rotate'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		event: {
			load: {
				handler() {
					if (props.onLoad)
						props.onLoad({
							ref: configs.ref,
							get width() {
								return this.ref?.offsetWidth;
							},
							get height() {
								return this.ref?.offsetHeight;
							}
						});
				}
			}
		},
		canvas: {
			ref: undefined as undefined | HTMLCanvasElement,
			event: {
				load: {
					handler(_, data) {
						if (data?.node instanceof HTMLCanvasElement) {
							const elTempColor = document.querySelector(
								`[data-color="${configs.ref?.getAttribute('data-color')}"]`
							);
							const elTempSize = document.querySelector(
								`[data-size="${configs.ref?.getAttribute('data-size')}"]`
							);
							if (elTempColor && elTempSize) {
								const color = getComputedStyle(elTempColor).getPropertyValue('--color');
								let size: undefined | string | number =
									getComputedStyle(elTempSize).getPropertyValue('--font-size');
								let borderWidth: undefined | string | number =
									getComputedStyle(elTempSize).getPropertyValue('--border-width');
								let padding: undefined | string | number =
									getComputedStyle(elTempSize).getPropertyValue('--padding');
								if (size.includes('calc')) {
									size = resolveCalcToPx(size, document.documentElement);
								} else if (size.includes('rem')) {
									size =
										parseFloat(size) *
										parseFloat(getComputedStyle(document.documentElement).fontSize);
								} else {
									size = parseFloat(size);
								}
								if (borderWidth.includes('calc')) {
									borderWidth = resolveCalcToPx(borderWidth, document.documentElement);
								} else if (borderWidth.includes('rem')) {
									borderWidth =
										parseFloat(borderWidth) *
										parseFloat(getComputedStyle(document.documentElement).fontSize);
								} else {
									borderWidth = parseFloat(borderWidth);
								}
								if (padding.includes('calc')) {
									console.log(padding);
									padding = resolveCalcToPx(padding, document.documentElement);
								} else if (padding.includes('rem')) {
									padding =
										parseFloat(padding) *
										parseFloat(getComputedStyle(document.documentElement).fontSize);
								} else {
									padding = parseFloat(padding);
								}
								if (!size || !borderWidth) return;
								const ctx = data.node.getContext('2d');
								if (!ctx) return;
								data.node.width = size;
								data.node.height = size;
								ctx.beginPath();
								ctx.arc(size / 2, size / 2, size / 2 - borderWidth, 0, Math.PI / 2);
								ctx.strokeStyle = color; // màu viền
								ctx.lineWidth = borderWidth;
								ctx.stroke();
							}
						}
					},
					options: {
						delay: 1000
					}
				}
			},
			get style() {
				const defaultStyles: string[] = ['loading-rotate-canvas'];
				return styleSynced({ defaultStyles }, props.overwriteDefaultStyles);
			}
		}
	});

	function resolveCalcToPx(calcExpr: string, contextEl: undefined | HTMLElement | Document) {
		if (!contextEl) return;
		const temp = document.createElement('div');
		temp.style.position = 'absolute';
		temp.style.visibility = 'hidden';
		temp.style.width = calcExpr; // "calc(0.25rem * 3)"
		contextEl.appendChild(temp);

		const px = parseFloat(getComputedStyle(temp).width);
		temp.remove();
		return px;
	}

	onDestroy(() => {
		if (props.onDestroy)
			props.onDestroy({
				ref: configs.ref
			});
	});
</script>

<svelte:element
	this={props.as ?? 'span'}
	bind:this={configs.ref}
	data-size={configs.size}
	data-color={props.color ?? 'default'}
	class={configs.style}
	{@attach handleEvents([{ events: [configs.event ?? {}] }])}
>
	<canvas
		bind:this={configs.canvas.ref}
		class={configs.canvas.style}
		{@attach handleEvents([{ events: [configs.canvas.event ?? {}] }])}
	></canvas>
</svelte:element>

<style lang="scss">
	.loading-rotate {
		width: var(--font-size);
		height: var(--font-size);
		aspect-ratio: 1/1;
		animation: animate-rotate 0.3s infinite linear;
	}
	.loading-rotate-canvas {
	}
	@keyframes animate-rotate {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
