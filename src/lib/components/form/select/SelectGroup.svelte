<script lang="ts">
  interface Props {
    label: string;
    children?: any;
  }

  let { label, children }: Props = $props();
</script>

<div class="group">
  <div class="label" role="presentation">
    {label}
  </div>
  <div class="items" role="group">
    {@render children?.()}
  </div>
</div>

<style>
  .group {
    display: flex;
    flex-direction: column;
  }

  .label {
    padding: var(--select-padding);
    padding-bottom: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    user-select: none;
  }

  .items {
    display: flex;
    flex-direction: column;
  }

  @media (prefers-color-scheme: dark) {
    .label {
      color: var(--color-text-muted-dark);
    }
  }
</style>
