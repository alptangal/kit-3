<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import type { Writable } from 'svelte/store';

  interface RadioGroupContext {
    selectedId: Writable<string | null>;
    focusedId: Writable<string | null>;
    options: Writable<Record<string, { label: string; disabled?: boolean }>>;
    disabled: Writable<boolean>;
    name: Writable<string>;
    orientation: Writable<'vertical' | 'horizontal'>;
  }

  interface Props {
    id: string;
    label: string;
    disabled?: boolean;
  }

  let { id, label, disabled = false }: Props = $props();

  const context = getContext<RadioGroupContext>('radio-group');
  const { selectedId, focusedId, options, disabled: groupDisabled, name } = context;

  let isSelected = $derived($selectedId === id);
  let isFocused = $derived($focusedId === id);

  onMount(() => {
    options.update(current => ({
      ...current,
      [id]: { label, disabled },
    }));

    return () => {
      options.update(current => {
        const { [id]: _, ...rest } = current;
        return rest;
      });
    };
  });

  function handleChange() {
    if (!disabled && !$groupDisabled) {
      selectedId.set(id);
    }
  }

  function handleFocus() {
    if (!disabled && !$groupDisabled) {
      focusedId.set(id);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === ' ') {
      e.preventDefault();
      handleChange();
    }
  }
</script>

<label class="radio-item" class:focused={isFocused} class:selected={isSelected} class:disabled-item={disabled || $groupDisabled}>
  <input
    type="radio"
    name={$name}
    value={id}
    checked={isSelected}
    disabled={disabled || $groupDisabled}
    class="radio-input"
    onchange={handleChange}
    onfocus={handleFocus}
    onkeydown={handleKeydown}
    aria-label={label}
  />
  <span class="radio-circle"></span>
  <span class="radio-label">{label}</span>
</label>

<style>
  .radio-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
    padding: 0.5rem;
    border-radius: var(--radius-md);
    transition: background-color 100ms ease;
    min-height: 44px;
  }

  .radio-item:hover:not(.disabled-item) {
    background-color: var(--color-surface-hover);
  }

  .focused:not(.disabled-item) {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .disabled-item {
    opacity: var(--radio-disabled-opacity);
    cursor: not-allowed;
  }

  .radio-input {
    width: var(--radio-size);
    height: var(--radio-size);
    cursor: pointer;
    accent-color: var(--color-primary);
    margin: 0;
  }

  .radio-circle {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--radio-size);
    height: var(--radio-size);
    border: var(--radio-border) solid var(--color-border);
    border-radius: 50%;
    transition: all 100ms ease;
  }

  .radio-input:checked ~ .radio-circle {
    border-color: var(--color-primary);
    background-color: var(--color-primary);
  }

  .radio-input:checked ~ .radio-circle::after {
    content: '';
    position: absolute;
    width: 6px;
    height: 6px;
    background-color: white;
    border-radius: 50%;
  }

  .radio-label {
    font-weight: 500;
  }

  .selected .radio-label {
    color: var(--color-primary);
    font-weight: 600;
  }
</style>
