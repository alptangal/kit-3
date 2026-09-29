<script lang="ts">
  interface Props {
    for?: string;
    children?: any;
  }

  let { for: forId, children }: Props = $props();
</script>

<label for={forId} class="radio-group-label">
  {@render children?.()}
</label>

<style>
  .radio-group-label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.75rem;
    color: var(--color-text);
  }
</style>
