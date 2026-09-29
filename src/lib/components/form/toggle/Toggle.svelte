<script lang="ts">
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';
  import type { Writable } from 'svelte/store';

  interface ToggleContext {
    isChecked: Writable<boolean>;
    isDisabled: Writable<boolean>;
    isLoading: Writable<boolean>;
  }

  interface Props {
    checked?: boolean;
    disabled?: boolean;
    loading?: boolean;
    onchange?: (checked: boolean) => void;
    children?: any;
  }

  let {
    checked = false,
    disabled = false,
    loading = false,
    onchange,
    children,
  }: Props = $props();

  const isChecked = writable(false);
  const isDisabled = writable(false);
  const isLoading = writable(false);

  const context: ToggleContext = {
    isChecked,
    isDisabled,
    isLoading,
  };

  setContext('toggle', context);

  // Sync prop changes to stores
  $effect.pre(() => {
    isChecked.set(checked);
    isDisabled.set(disabled);
    isLoading.set(loading);
  });

  function handleToggle() {
    if (!$isDisabled && !$isLoading) {
      const newValue = !$isChecked;
      isChecked.set(newValue);
      onchange?.(newValue);
    }
  }
</script>

<div class="toggle-root" class:disabled={$isDisabled} class:loading={$isLoading}>
  <button
    type="button"
    role="switch"
    aria-checked={$isChecked}
    aria-disabled={$isDisabled}
    disabled={$isDisabled || $isLoading}
    class="toggle-button"
    class:checked={$isChecked}
    onclick={handleToggle}
  >
    <span class="toggle-track">
      <span class="toggle-thumb" />
    </span>
  </button>

  {#if children}
    <div class="toggle-content">
      {@render children?.()}
    </div>
  {/if}
</div>

<style>
  .toggle-root {
    display: inline-flex;
    align-items: center;
    gap: 1rem;
  }

  .toggle-button {
    position: relative;
    width: 56px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 16px;
    transition: all 200ms ease;
    flex-shrink: 0;
  }

  .toggle-button:disabled {
    cursor: not-allowed;
    opacity: var(--toggle-disabled-opacity, 0.5);
  }

  .toggle-button:not(:disabled):hover {
    background-color: var(--color-surface-hover, rgba(0, 0, 0, 0.04));
  }

  .toggle-button:focus-visible {
    outline: 2px solid var(--color-primary, #3b82f6);
    outline-offset: 2px;
  }

  .toggle-track {
    position: absolute;
    inset: 0;
    background-color: var(--toggle-track-bg-off, #cbd5e1);
    border-radius: 16px;
    transition: background-color 200ms ease;
  }

  .toggle-button.checked .toggle-track {
    background-color: var(--toggle-track-bg-on, #3b82f6);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 28px;
    height: 28px;
    background-color: white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: transform 200ms ease;
  }

  .toggle-button.checked .toggle-thumb {
    transform: translateX(24px);
  }

  .toggle-button:active:not(:disabled) .toggle-thumb {
    width: 32px;
  }

  .toggle-button.checked:active:not(:disabled) .toggle-thumb {
    transform: translateX(20px);
  }

  .toggle-root.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .toggle-root.loading {
    opacity: 0.7;
  }

  .toggle-content {
    flex: 1;
  }
</style>
