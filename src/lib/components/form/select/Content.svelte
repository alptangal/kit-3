<!-- src/lib/components/form/select/Content.svelte -->
<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';

	interface SelectContext {
		isOpen: Readable<boolean>;
		highlightedStore: any;
		children?: any;
	}

	const context = getContext<SelectContext>('select');
	const { isOpen, children } = context;

	let contentEl: HTMLDivElement;
</script>

{#if $isOpen}
	<div
		bind:this={contentEl}
		class="select-content"
		role="listbox"
		aria-label="Select options"
	>
		{@render children?.()}
	</div>
{/if}

<style>
	.select-content {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin-top: 0.25rem;
		background-color: var(--select-bg);
		border: 1px solid var(--select-border);
		border-radius: var(--select-border-radius);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		z-index: 20;
		max-height: 300px;
		overflow-y: auto;
		min-width: 0;
	}

	@media (prefers-color-scheme: dark) {
		.select-content {
			box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
		}
	}
</style>
