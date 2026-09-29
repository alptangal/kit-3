<!-- src/lib/components/form/select/Item.svelte -->
<script lang="ts">
	import { getContext, onMount } from 'svelte';

	interface SelectContext {
		valueStore: any;
		selectItem: (v: string) => void;
		highlightedStore: any;
		setHighlighted: (v: string | null) => void;
		itemsStore: any;
		multiple?: boolean;
	}

	interface Props {
		value: string;
		label?: string;
		disabled?: boolean;
		children?: any;
	}

	let { value, label = value, disabled = false, children }: Props = $props();

	const context = getContext<SelectContext>('select');
	const { valueStore, selectItem, highlightedStore, setHighlighted, itemsStore, multiple } = context;

	let itemEl: HTMLDivElement;

	onMount(() => {
		// Register item in store
		itemsStore.update((items: Map<string, any>) => {
			items.set(value, { label, disabled });
			return items;
		});

		return () => {
			// Unregister on unmount
			itemsStore.update((items: Map<string, any>) => {
				items.delete(value);
				return items;
			});
		};
	});

	function handleClick() {
		if (!disabled) {
			selectItem(value);
		}
	}

	function handleMouseEnter() {
		if (!disabled) {
			setHighlighted(value);
		}
	}

	function handleMouseLeave() {
		setHighlighted(null);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (!disabled) {
				selectItem(value);
			}
		}
	}

	const isSelected = $derived.by(() => {
		const val = $valueStore;
		if (Array.isArray(val)) {
			return val.includes(value);
		}
		return val === value;
	});

	const isHighlighted = $derived($highlightedStore === value);
</script>

<div
	bind:this={itemEl}
	class="select-item"
	class:selected={isSelected}
	class:highlighted={isHighlighted}
	class:disabled
	role="option"
	aria-selected={isSelected}
	aria-disabled={disabled}
	onclick={(e) => {
		if (!disabled) handleClick();
	}}
	onmouseenter={(e) => {
		if (!disabled) handleMouseEnter();
	}}
	onmouseleave={(e) => {
		if (!disabled) handleMouseLeave();
	}}
	onkeydown={handleKeyDown}
	tabindex={disabled ? -1 : 0}
>
	{#if multiple}
		<input
			type="checkbox"
			class="select-item__checkbox"
			checked={isSelected}
			{disabled}
			aria-hidden="true"
		/>
	{/if}
	<span class="select-item__label">
		{@render children?.() || label}
	</span>
</div>

<style>
	.select-item {
		display: flex;
		align-items: center;
		padding: 0.75rem var(--select-padding);
		color: var(--select-text-color);
		cursor: pointer;
		transition: background-color 150ms ease;
		user-select: none;
	}

	.select-item:hover:not(.disabled) {
		background-color: var(--select-hover-bg);
	}

	.select-item.highlighted {
		background-color: var(--select-hover-bg);
	}

	.select-item.selected {
		background-color: hsl(200, 100%, 90%);
		font-weight: 500;
	}

	.select-item.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.select-item:focus {
		outline: 2px solid var(--select-focus-ring);
		outline-offset: -2px;
	}

	.select-item__checkbox {
		margin-right: 0.5rem;
		cursor: pointer;
	}

	.select-item__label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (prefers-color-scheme: dark) {
		.select-item.selected {
			background-color: hsl(200, 100%, 25%);
		}
	}
</style>
