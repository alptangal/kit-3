<script lang="ts">
	import type { IconProps } from "@iconify/svelte";


    let {...props}=$props()
</script>
<svelte:element this={props.as??'div'}></svelte:element>
