<script lang="ts">
  import { getContext } from 'svelte';
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
    placeholder?: string;
  }

  let { placeholder = 'Select an option' }: Props = $props();

  const context = getContext<SelectContext>('select');
  const { isOpen, value, search, highlighted, items, isMulti, isSearchable } = context;

  let isFocused = $state(false);

  function getDisplayValue() {
    const val = $value;
    const itemsMap = $items;
    const multi = $isMulti;

    if (multi && Array.isArray(val)) {
      return val
        .map(v => itemsMap[v]?.label || v)
        .join(', ') || placeholder;
    }

    if (typeof val === 'string') {
      return itemsMap[val]?.label || val || placeholder;
    }

    return placeholder;
  }

  function handleClick() {
    isOpen.set(!$isOpen);
    if ($isOpen) {
      highlighted.set(null);
      search.set('');
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleClick();
    }
  }
</script>

<button
  class="select-trigger"
  class:open={$isOpen}
  class:focused={isFocused}
  onclick={handleClick}
  onkeydown={handleKeydown}
  onfocus={() => (isFocused = true)}
  onblur={() => (isFocused = false)}
  aria-haspopup="listbox"
  aria-expanded={$isOpen}
>
  <span class="value">{getDisplayValue()}</span>

  {#if $isSearchable && $isOpen}
    <input
      type="text"
      class="search"
      placeholder="Search..."
      bind:value={$search}
      onclick={(e) => e.stopPropagation()}
      aria-label="Search options"
    />
  {/if}

  <span class="icon">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </span>
</button>

<style>
  .select-trigger {
    display: flex;
    align-items: center;
    gap: var(--select-padding);
    width: 100%;
    padding: var(--select-padding);
    background-color: var(--select-bg);
    border: 1px solid var(--select-border);
    border-radius: var(--select-border-radius);
    color: var(--select-text-color);
    cursor: pointer;
    font-size: 1rem;
    transition: all 150ms ease;
    min-height: 44px;
  }

  .select-trigger:hover:not(:disabled) {
    background-color: var(--select-hover-bg);
  }

  .select-trigger:focus {
    outline: none;
    box-shadow: var(--select-focus-ring);
  }

  .open {
    border-radius: var(--select-border-radius) var(--select-border-radius) 0 0;
  }

  .focused {
    box-shadow: var(--select-focus-ring);
  }

  .value {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--select-border);
    border-radius: var(--select-border-radius);
    background-color: var(--color-surface);
    color: var(--select-text-color);
    font-size: 0.875rem;
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    transition: transform 150ms ease;
  }

  .open .icon {
    transform: rotate(180deg);
  }
</style>
