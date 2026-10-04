<script lang="ts">
	import { fade } from 'svelte/transition';
	import type {
		CheckboxIndicatorCheckedConfigs,
		CheckboxIndicatorCheckedProps
	} from '../../_interface';
	import { cubicOut } from 'svelte/easing';
	import { getCheckboxIndicatorContext } from '..';
	import { convertToMiliseconds, convertToPixels, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { type DistanceUnits } from '$components/interface';

	let { children, ...props }: CheckboxIndicatorCheckedProps = $props();
	let configs: CheckboxIndicatorCheckedConfigs = $state({
		get size() {
			return checkboxIndicatorContext?.size ?? 'md';
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'checkbox-indicator-checked',
				`color-${this.color}`
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get color() {
			return props.color ?? checkboxIndicatorContext?.color ?? 'default';
		},
		get duration() {
			return (
				convertToMiliseconds(props.duration) ??
				checkboxIndicatorContext?.duration ??
				convertToMiliseconds(client.browser?.duration) ??
				300
			);
		},
		get event(): CheckboxIndicatorCheckedConfigs['event'] {
			return [
				{
					events: {
						load(_, data) {
							if (data?.node instanceof HTMLElement) {
								data.node.style.setProperty('--duration', `${configs.duration}ms`);
							}
						}
					}
				}
			];
		}
	});
	const checkboxIndicatorContext = getCheckboxIndicatorContext();

	// Set stroke-width and stroke color on mount
	let svgRef = $state<SVGSVGElement | null>(null);
	onMount(() => {
		if (svgRef) {
			const checkboxRoot = svgRef.closest('.checkbox-indicator-root');
			if (checkboxRoot) {
				const computedStyle = getComputedStyle(checkboxRoot);
				// Use the actual computed border-width for stroke-width so checkmark thickness matches checkbox border
				let borderWidth = computedStyle.getPropertyValue('--border-width');
				let color = computedStyle.getPropertyValue('--color');
				// Provide fallback for border-width (1px default)
				if (borderWidth) {
					svgRef.setAttribute('stroke-width', borderWidth.trim());
				} else {
					svgRef.setAttribute('stroke-width', '2'); // Default to 2px for visibility
				}
				if (color) {
					svgRef.setAttribute('stroke', color.trim());
				} else {
					svgRef.setAttribute('stroke', 'white');
				}
			}
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	in:fade={{ duration: 300 }}
	out:fade={{ duration: 300 }}
	class={configs.style}
	{@attach handleEvents(configs.event)}
>
	{#if children}
		{@render children()}
	{:else}
		<svg
			class="check-draw w-full h-full"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			bind:this={svgRef}
		>
			<polyline
				points="4 12 9 17 20 6"
				stroke-linecap="round"
				stroke-linejoin="round"
				pathLength="1"
				class="check-draw"
				stroke="white"
				stroke-width="2"
			/>
		</svg>
	{/if}
</svelte:element>

<style lang="scss">
	@use '$styles/colors.scss';
	.checkbox-indicator-checked {
		/* Match the size of checkbox-indicator-root: 20px (1.25rem) */
		width: 1.25rem;
		height: 1.25rem;
		/* Prevent size overflow from SVG */
		max-width: 1.25rem;
		max-height: 1.25rem;
		/* Prevent layout shift and overflow */
		contain: strict;
		overflow: hidden;
		flex-shrink: 0;
	}

	.check-draw {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: draw-check var(--duration) cubic-bezier(0.65, 0, 0.35, 1) forwards;
	}

	@keyframes draw-check {
		to {
			stroke-dashoffset: 0;
		}
	}
</style>