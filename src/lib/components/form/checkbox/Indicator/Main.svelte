<script lang="ts">
	import Icon from '@iconify/svelte';
	import { getCheckboxCtx } from '../Root';
	import type { CheckboxIndicator } from './_interface';
	import { iconify } from '$assets/icons/iconify';
	import { fade } from 'svelte/transition';
	import { profile } from '$store/basic.svelte';

	let { children, ...props }: CheckboxIndicator = $props();
	const checkboxCtx = getCheckboxCtx();
</script>

<svelte:element
	this={props.as ?? 'div'}
	transition:fade={profile.transition.templates.fade}
	class="checkbox-indicator"
>
	{#if children}
		{@render children()}
	{:else if checkboxCtx.checked}
		<Icon icon={iconify['check-rounded']} />
	{/if}
</svelte:element>

<style lang="ts">
	.checkbox-indicator {
		font-size: var(--font-size);
	}
</style>
