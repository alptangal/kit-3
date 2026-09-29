<script lang="ts">
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';
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
    value?: string | null;
    disabled?: boolean;
    name?: string;
    orientation?: 'vertical' | 'horizontal';
    children?: any;
  }

  let {
    value = null,
    disabled = false,
    name = 'radio-group',
    orientation = 'vertical',
    children,
  }: Props = $props();

  const selectedId = writable<string | null>(null);
  const focusedId = writable<string | null>(null);
  const options = writable<Record<string, { label: string; disabled?: boolean }>>({});
  const disabledStore = writable(false);
  const nameStore = writable('radio-group');
  const orientationStore = writable<'vertical' | 'horizontal'>('vertical');

  const context: RadioGroupContext = {
    selectedId,
    focusedId,
    options,
    disabled: disabledStore,
    name: nameStore,
    orientation: orientationStore,
  };

  setContext('radio-group', context);

  // Sync prop changes to stores
  $effect.pre(() => {
    selectedId.set(value ?? null);
    disabledStore.set(disabled);
    nameStore.set(name);
    orientationStore.set(orientation);
  });

  // Keyboard navigation
  function handleKeydown(e: KeyboardEvent) {
    if (disabled) return;

    const enabledIds = Object.entries($options)
      .filter(([, opt]) => !opt.disabled)
      .map(([id]) => id);

    if (enabledIds.length === 0) return;

    const currentIndex = $focusedId ? enabledIds.indexOf($focusedId) : -1;

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % enabledIds.length;
      focusedId.set(enabledIds[nextIndex]);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = currentIndex <= 0 ? enabledIds.length - 1 : currentIndex - 1;
      focusedId.set(enabledIds[prevIndex]);
    } else if (e.key === ' ' && $focusedId) {
      e.preventDefault();
      selectedId.set($focusedId);
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div
  class="radio-group"
  class:vertical={$orientationStore === 'vertical'}
  class:horizontal={$orientationStore === 'horizontal'}
  class:disabled={disabled}
  role="radiogroup"
  aria-disabled={disabled}
>
  {@render children?.()}
</div>

<style>
  .radio-group {
    --radio-gap: var(--space-2);
    --radio-size: 20px;
    --radio-border: 2px;
    --radio-disabled-opacity: 0.5;

    display: flex;
  }

  .vertical {
    flex-direction: column;
    gap: var(--radio-gap);
  }

  .horizontal {
    flex-direction: row;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .disabled {
    opacity: var(--radio-disabled-opacity);
    pointer-events: none;
  }
</style>
