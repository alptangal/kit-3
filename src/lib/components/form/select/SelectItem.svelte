<script lang="ts">
  import { getContext, onMount, onDestroy } from 'svelte';
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
    id: string;
    label: string;
    disabled?: boolean;
  }

  let { id, label, disabled = false }: Props = $props();

  const context = getContext<SelectContext>('select');
  const { value, highlighted, items, isOpen, isMulti } = context;

  let isSelected = $derived.by(() => {
    const val = $value;
    const multi = $isMulti;
    if (multi && Array.isArray(val)) {
      return val.includes(id);
    }
    return val === id;
  });

  let isHighlighted = $derived($highlighted === id);

  // Register item on mount
  onMount(() => {
    items.update(current => ({
      ...current,
      [id]: { label, disabled },
    }));

    return () => {
      items.update(current => {
        const { [id]: _, ...rest } = current;
        return rest;
      });
    };
  });

  function handleClick() {
    if (disabled) return;

    const multi = $isMulti;
    if (multi) {
      const current = Array.isArray($value) ? $value : [];
      if (current.includes(id)) {
        value.set(current.filter(v => v !== id));
      } else {
        value.set([...current, id]);
      }
    } else {
      value.set(id);
      isOpen.set(false);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }
</script>

<div
  class="item"
  class:selected={isSelected}
  class:highlighted={isHighlighted}
  class:disabled-item={disabled}
  role="option"
  aria-selected={isSelected}
  aria-disabled={disabled}
  tabindex={disabled ? -1 : 0}
  onclick={handleClick}
  onmouseenter={() => !disabled && highlighted.set(id)}
  onmouseleave={() => highlighted.set(null)}
  onkeydown={handleKeydown}
>
  {#if $isMulti}
    <input
      type="checkbox"
      checked={isSelected}
      disabled={disabled}
      class="checkbox"
      aria-hidden="true"
      onclick={(e) => e.stopPropagation()}
    />
  {/if}
  <span class="label">{label}</span>
  {#if isSelected && !$isMulti}
    <span class="check">✓</span>
  {/if}
</div>

<style>
  .item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: var(--select-padding);
    cursor: pointer;
    user-select: none;
    transition: background-color 100ms ease;
    min-height: 44px;
  }

  .item:hover:not(.disabled-item) {
    background-color: var(--select-hover-bg);
  }

  .highlighted:not(.disabled-item) {
    background-color: var(--select-hover-bg);
  }

  .selected {
    background-color: var(--color-primary-alpha-10);
    color: var(--color-primary);
    font-weight: 500;
  }

  .disabled-item {
    opacity: var(--select-disabled-opacity);
    cursor: not-allowed;
  }

  .checkbox {
    width: 20px;
    height: 20px;
    cursor: pointer;
    accent-color: var(--color-primary);
  }

  .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .check {
    flex-shrink: 0;
    color: var(--color-primary);
    font-weight: bold;
  }

  @media (prefers-color-scheme: dark) {
    .selected {
      background-color: var(--color-primary-alpha-20);
    }
  }
</style>
