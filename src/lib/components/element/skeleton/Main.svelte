<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import type { SkeletonConfigs, SkeletonProps } from './_interface';

	let { ...props }: SkeletonProps = $props();
	let configs: SkeletonConfigs = $state({
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		get style() {
			const defaultStyles: string[] = ['skeleton'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	class={configs.style}
	bind:this={configs.ref}
	data-size={configs.size}
></svelte:element>

<style>
	.skeleton {
		border-radius: var(--border-radius);
		background: hsl(var(--foreground-200));
		overflow: hidden;
		&::before {
			border-radius: inherit;
			display: block;
			content: '';
			width: 100%;
			height: 100%;
			background: linear-gradient(
				90deg,
				hsl(var(--foreground-300)) 0,
				hsl(var(--foreground-500)) 20%,
				hsl(var(--foreground-600)) 60%,
				hsl(var(--foreground-300))
			);
			animation: animate-shimmer 1s infinite linear;
			opacity: 0.3;
		}
	}
	@keyframes animate-shimmer {
		from {
			transform: translateX(0%);
		}
		to {
			transform: translateX(100%);
		}
	}
</style>
