<!-- src/lib/components/form/select/Trigger.svelte -->
<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';

	interface SelectContext {
		valueStore: any;
		openStore: any;
		toggleOpen: () => void;
		isOpen: Readable<boolean>;
		placeholder: string;
		itemsStore: any;
		searchable: boolean;
		searchStore: any;
		setSearch: (v: string) => void;
	}

	const context = getContext<SelectContext>('select');
	const { valueStore, openStore, toggleOpen, isOpen, placeholder, itemsStore, searchable, searchStore, setSearch } = context;

	let triggerEl: HTMLButtonElement;
	let searchInputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if ($isOpen && searchable && searchInputEl) {
			setTimeout(() => searchInputEl?.focus(), 0);
		}
	});

	function handleClick() {
		toggleOpen();
		if (!$isOpen && searchable) {
			setSearch('');
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!searchable) {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				toggleOpen();
			}
		}
	}

	function handleSearchChange(e: Event) {
		const input = e.target as HTMLInputElement;
		setSearch(input.value);
	}

	// Get display value
	const displayValue = $derived.by(() => {
		const val = $valueStore;
		if (!val) return placeholder;

		if (Array.isArray(val)) {
			return val.map((v) => $itemsStore.get(v)?.label || v).join(', ');
		}
		return $itemsStore.get(val)?.label || val;
	});
</script>

<button
	bind:this={triggerEl}
	class="select-trigger"
	type="button"
	onclick={(e) => handleClick()}
	onkeydown={(e) => handleKeyDown(e)}
	aria-haspopup="listbox"
	aria-expanded={$isOpen}
	aria-label="Select option"
>
	<span class="select-trigger__value">
		{displayValue}
	</span>
	<span class="select-trigger__icon" aria-hidden="true">
		<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<polyline points="6 9 12 15 18 9"></polyline>
		</svg>
	</span>
</button>

{#if $isOpen && searchable}
	<div class="select-search">
		<input
			bind:this={searchInputEl}
			type="text"
			class="select-search__input"
			placeholder="Search..."
			value={$searchStore}
			onchange={(e) => handleSearchChange(e as Event)}
			oninput={(e) => handleSearchChange(e as Event)}
		/>
	</div>
{/if}

<style>
	.select-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: var(--select-padding);
		background-color: var(--select-bg);
		border: 1px solid var(--select-border);
		border-radius: var(--select-border-radius);
		color: var(--select-text-color);
		font-size: inherit;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.select-trigger:hover:not(:disabled) {
		background-color: var(--select-hover-bg);
	}

	.select-trigger:focus {
		outline: 2px solid var(--select-focus-ring);
		outline-offset: 2px;
	}

	.select-trigger:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.select-trigger__value {
		flex: 1;
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.select-trigger__icon {
		flex-shrink: 0;
		margin-left: 0.5rem;
		display: flex;
		align-items: center;
		color: var(--select-text-color);
	}

	.select-search {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background-color: var(--select-bg);
		border: 1px solid var(--select-border);
		border-top: none;
		border-radius: 0 0 var(--select-border-radius) var(--select-border-radius);
		padding: var(--select-padding);
		z-index: 10;
	}

	.select-search__input {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid var(--select-border);
		border-radius: var(--select-border-radius);
		font-size: inherit;
		color: var(--select-text-color);
		background-color: var(--select-hover-bg);
	}

	.select-search__input:focus {
		outline: 2px solid var(--select-focus-ring);
		outline-offset: 2px;
	}
</style>
