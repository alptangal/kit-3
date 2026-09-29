<script lang="ts">
  interface Props {
    children?: any;
  }

  let { children }: Props = $props();
</script>

<label class="toggle-label">
  {@render children?.()}
</label>

<style>
  .toggle-label {
    display: inline-block;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    user-select: none;
  }
</style>
