<script lang="ts">
	import type { NavigationMainCenter } from "../_inteface";


    let {children,...props}:NavigationMainCenter=$props()
</script>
<svelte:element this={props.as??'div'}>
    {@render children?.()}
</svelte:element>
