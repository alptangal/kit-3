<script lang="ts">
	import type { NavigationMainRight } from "../_inteface";

    let {children,...props}:NavigationMainRight=$props()
</script>
<svelte:element this={props.as??'div'}>
    {@render children?.()}
</svelte:element>
