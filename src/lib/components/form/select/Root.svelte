<!-- src/lib/components/form/select/Root.svelte -->
<script lang="ts">
	import { setContext } from 'svelte';
	import { writable, derived, type Readable, type Writable } from 'svelte/store';

	interface Props {
		value?: string | string[];
		disabled?: boolean;
		multiple?: boolean;
		placeholder?: string;
		searchable?: boolean;
		children?: any;
	}

	let { value = '', disabled = false, multiple = false, placeholder = '', searchable = false, children }: Props = $props();

	// State management
	const valueStore = writable<string | string[]>(value);
	const openStore = writable(false);
	const searchStore = writable('');
	const highlightedStore = writable<string | null>(null);

	// Items registry
	const itemsStore = writable<Map<string, any>>(new Map());
	const groupsStore = writable<Map<string, string[]>>(new Map());

	// Derived stores
	const isOpen = derived(openStore, ($open) => $open);
	const search = derived(searchStore, ($search) => $search);

	// Context for child components
	const context = {
		valueStore,
		openStore,
		searchStore,
		highlightedStore,
		itemsStore,
		groupsStore,
		disabled,
		multiple,
		placeholder,
		searchable,
		isOpen,
		search,
		toggleOpen: () => openStore.update((v) => !v),
		setOpen: (v: boolean) => openStore.set(v),
		setSearch: (v: string) => searchStore.set(v),
		selectItem: (v: string) => {
			if (multiple) {
				valueStore.update((curr) => {
					const arr = Array.isArray(curr) ? curr : [];
					return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
				});
			} else {
				valueStore.set(v);
				openStore.set(false);
				searchStore.set('');
			}
		},
		clearSearch: () => searchStore.set(''),
		setHighlighted: (v: string | null) => highlightedStore.set(v),
		getHighlighted: () => highlightedStore.subscribe((v) => v)
	};

	setContext('select', context);

	// Update internal store when prop value changes
	$effect(() => {
		valueStore.set(value);
	});

	// Close on escape key
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' && $isOpen) {
			openStore.set(false);
			searchStore.set('');
		}
	}
</script>

<div class="select-root" role="region" {disabled} onkeydown={(e) => handleKeyDown(e)}>
	{@render children?.()}
</div>

<style>
	.select-root {
		--select-bg: hsl(0, 0%, 100%);
		--select-border: hsl(0, 0%, 80%);
		--select-border-radius: var(--radius-base, 0.5rem);
		--select-padding: var(--spacing-sm, 0.5rem);
		--select-text-color: hsl(0, 0%, 20%);
		--select-hover-bg: hsl(0, 0%, 95%);
		--select-focus-ring: hsl(200, 100%, 50%);
		--select-disabled-opacity: 0.5;

		position: relative;
		display: inline-block;
		width: 100%;
	}

	.select-root[disabled] {
		opacity: var(--select-disabled-opacity);
		pointer-events: none;
	}

	@media (prefers-color-scheme: dark) {
		.select-root {
			--select-bg: hsl(0, 0%, 20%);
			--select-border: hsl(0, 0%, 40%);
			--select-text-color: hsl(0, 0%, 90%);
			--select-hover-bg: hsl(0, 0%, 30%);
		}
	}
</style>
