<script lang="ts">
	import { convertToMiliseconds, convertToPixels, styleSynced } from '$modules';
	import { onMount } from 'svelte';
	import { releaseCheckboxIndicatorDefault, setCheckboxIndicatorContext } from '.';
	import type { CheckboxIndicatorConfigs, CheckboxIndicatorProps } from '../_interface';
	import { getCheckboxContext } from '..';
	import { Checkbox } from '$components/form';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';

	let { children, checked = $bindable(), ...props }: CheckboxIndicatorProps = $props();
	let configs: CheckboxIndicatorConfigs = $state({
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'checkbox-indicator-root',
				`size-${this.size}`,
				`color-${this.color}`,
				`rounded-${this.rounded}`
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get checked() {
			return checked ?? checkboxContext?.checked;
		},
		get size() {
			return props.size ?? checkboxContext?.size ?? 'md';
		},
		get color() {
			return props.color ?? checkboxContext?.color ?? 'default';
		},
		get duration() {
			return (
				convertToMiliseconds(props.duration) ??
				checkboxContext?.duration ??
				convertToMiliseconds(client.browser?.duration) ??
				300
			);
		},
		get rounded() {
			return props.rounded ?? this.size;
		},
		get event(): CheckboxIndicatorConfigs['event'] {
			return [
				{
					events: {}
				}
			];
		}
	});
	const checkboxContext = getCheckboxContext();
	setCheckboxIndicatorContext(configs);

	onMount(() => {
		if (checkboxContext) {
			checkboxContext.children.indicator = configs;
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	{@attach handleEvents(configs.event)}
>
	{#if children}
		{@render children()}
	{:else if configs.checked}
		<Checkbox.Indicator.Checked />
	{/if}
</svelte:element>

<style lang="scss">
	@use '$styles/sizes.scss';
	@use '$styles/colors.scss';
	.checkbox-indicator-root {
		@apply flex items-center justify-center;
		width: var(--font-size);
		height: var(--font-size);
		border-width: var(--border-width);
		border-style: solid;
		border-color: var(--color);
		border-radius: var(--border-radius);
	}
</style>
