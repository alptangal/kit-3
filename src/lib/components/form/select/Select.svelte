<script lang="ts">
  import { setContext, getContext } from 'svelte';
  import { writable } from 'svelte/store';
  import type { Writable } from 'svelte/store';

  interface SelectContext {
    isOpen: Writable<boolean>;
    value: Writable<string | string[] | null>;
    search: Writable<string>;
    highlighted: Writable<string | null>;
    items: Writable<Record<string, { label: string; disabled?: boolean }>>;
    isMulti: Writable<boolean>;
    isSearchable: Writable<boolean>;
  }

  interface Props {
    value?: string | string[] | null;
    isMulti?: boolean;
    isSearchable?: boolean;
    disabled?: boolean;
    children?: any;
  }

  let {
    value = null,
    isMulti = false,
    isSearchable = false,
    disabled = false,
    children,
  }: Props = $props();

  // State stores
  const isOpen = writable(false);
  const valueStore = writable<string | string[] | null>(value);
  const search = writable('');
  const highlighted = writable<string | null>(null);
  const items = writable<Record<string, { label: string; disabled?: boolean }>>({});
  const isMultiStore = writable(isMulti);
  const isSearchableStore = writable(isSearchable);

  let containerId = 'select-' + Math.random().toString(36).slice(2);

  // Expose context via string key
  const context: SelectContext = {
    isOpen,
    value: valueStore,
    search,
    highlighted,
    items,
    isMulti: isMultiStore,
    isSearchable: isSearchableStore,
  };

  setContext('select', context);

  // Sync prop changes
  $effect(() => {
    valueStore.set(value);
  });

  $effect(() => {
    isMultiStore.set(isMulti);
  });

  $effect(() => {
    isSearchableStore.set(isSearchable);
  });

  // Close on escape
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && $isOpen) {
      isOpen.set(false);
      highlighted.set(null);
      search.set('');
    }
  }

  // Close on click outside
  function handleClickOutside(e: Event) {
    const target = e.target as Node;
    const container = document.getElementById(containerId);
    if (container && !container.contains(target) && $isOpen) {
      isOpen.set(false);
      highlighted.set(null);
      search.set('');
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} on:click={handleClickOutside} />

<div
  id={containerId}
  class="select-root"
  class:select-disabled={disabled}
  role="combobox"
  aria-expanded={$isOpen}
  aria-haspopup="listbox"
  aria-controls={containerId + '-listbox'}
>
  {@render children?.()}
</div>

<style>
  .select-root {
    --select-bg: var(--color-surface);
    --select-border: var(--color-border);
    --select-border-radius: var(--radius-md);
    --select-padding: var(--space-2);
    --select-text-color: var(--color-text);
    --select-hover-bg: var(--color-surface-hover);
    --select-focus-ring: 0 0 0 3px var(--color-primary-alpha-20);
    --select-disabled-opacity: 0.5;

    position: relative;
  }

  .select-disabled {
    opacity: var(--select-disabled-opacity);
    pointer-events: none;
  }

  @media (prefers-color-scheme: dark) {
    .select-root {
      --select-bg: var(--color-surface-dark);
      --select-border: var(--color-border-dark);
      --select-text-color: var(--color-text-dark);
      --select-hover-bg: var(--color-surface-hover-dark);
    }
  }
</style>
