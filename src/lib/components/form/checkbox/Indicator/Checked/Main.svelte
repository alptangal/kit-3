<script lang="ts">
	import { scale } from 'svelte/transition';
	import type {
		CheckboxIndicatorCheckedConfigs,
		CheckboxIndicatorCheckedProps
	} from '../../_interface';
	import { cubicOut } from 'svelte/easing';
	import { getCheckboxIndicatorContext } from '..';
	import { convertToMiliseconds, convertToPixels, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
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
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	in:scale={{ duration: 300, start: 0.5, easing: cubicOut }}
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
		>
			<polyline
				points="4 12 9 17 20 6"
				stroke-linecap="round"
				stroke-linejoin="round"
				pathLength="1"
				class="check-draw"
				stroke="white"
				{@attach handleEvents([
					{
						events: {
							load(_, data) {
								setTimeout(() => {
									if (data?.node && configs.ref) {
										const ref = data.node as HTMLElement;
										let fixedSize: string | number = getComputedStyle(configs.ref).getPropertyValue(
											'--font-size'
										);
										fixedSize = convertToPixels(fixedSize as DistanceUnits) ?? 0;
										let borderWidth = getComputedStyle(configs.ref).getPropertyValue(
											'--border-width'
										);
										let color = getComputedStyle(configs.ref).getPropertyValue('--color');
										ref.setAttribute('stroke-width', `calc((24 / ${fixedSize}) * ${borderWidth})`);
										ref.setAttribute('stroke', color);
									}
								}, configs.duration);
							}
						}
					}
				])}
			/>
		</svg>
	{/if}
</svelte:element>

<style lang="scss">
	@use '$styles/colors.scss';
	.checkbox-indicator-checked {
		width: var(--font-size);
		height: var(--font-size);
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
