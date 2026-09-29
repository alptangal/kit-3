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
    children?: any;
    maxHeight?: string;
  }

  let { children, maxHeight = '300px' }: Props = $props();

  const context = getContext<SelectContext>('select');
  const { isOpen } = context;
</script>

{#if $isOpen}
  <div
    class="content"
    style:max-height={maxHeight}
    role="listbox"
    aria-label="Options"
  >
    {@render children?.()}
  </div>
{/if}

<style>
  .content {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 1000;
    background-color: var(--select-bg);
    border: 1px solid var(--select-border);
    border-top: none;
    border-radius: 0 0 var(--select-border-radius) var(--select-border-radius);
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  @media (prefers-color-scheme: dark) {
    .content {
      background-color: var(--select-bg);
      border-color: var(--select-border);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
  }
</style>
