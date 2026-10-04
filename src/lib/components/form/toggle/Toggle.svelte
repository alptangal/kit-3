<script lang="ts">
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';
  import type { Writable } from 'svelte/store';
  import { styleSynced } from '$modules';
  import { client } from '$store/basic.svelte';
  import { getFormContext } from '../form';
  import type { ToggleProps } from './_interface';

  interface ToggleContext {
    isChecked: Writable<boolean>;
    isDisabled: Writable<boolean>;
    isLoading: Writable<boolean>;
  }

  let {
    checked = false,
    disabled = false,
    loading = false,
    onchange,
    children,
    ...props
  }: ToggleProps = $props();

  // Item 3: cascading size — đồng bộ Input/Checkbox/Select (formContext → browser → 'md')
  const formContext = getFormContext();

  const isChecked = writable(false);
  const isDisabled = writable(false);
  const isLoading = writable(false);

  const context: ToggleContext = {
    isChecked,
    isDisabled,
    isLoading,
  };

  setContext('toggle', context);

  // Item 3: size cascading
  const sizeDerived = $derived(props.size ?? formContext?.size ?? client.browser?.size ?? 'md');
  // Prop Toggle-specific: color (mặc định 'default' khi chưa set)
  const color = $derived(props.color ?? 'default');

  // Item 2: styleSynced thay logic class riêng (đồng bộ Checkbox/Input/Select)
  const styleDerived = $derived(
    styleSynced(
      {
        defaultStyles: [
          'toggle-root',
          `size-${sizeDerived}`,
          `color-${color}`,
          $isDisabled ? 'disabled' : undefined,
          $isLoading ? 'loading' : undefined
        ],
        propStyles: props.class
      },
      props.overwriteDefaultStyles
    )
  );

  // Sync prop changes to stores (giữ nguyên logic state — không đổi)
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

<div class={styleDerived}>
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

<style lang="scss">
  @use '_styles.scss';
</style>
