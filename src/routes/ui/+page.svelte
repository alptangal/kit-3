<script lang="ts">
	import { iconify } from '$assets/icons/iconify';
	import { Button, Tooltip } from '$components/element';
	import { onMount } from 'svelte';

	onMount(() => {});
</script>

<div class="flex flex-col justify-center items-center w-full h-full">
	<Button icon={iconify['search-rounded']} rounded="full" size="9xl" variant="solid" color="info"
		>Button</Button
	>
	<Tooltip size="9xl" offset="2rem">
		<Button icon={iconify['search-rounded']} rounded="full" size="9xl" variant="solid" color="info"
			>Tooltip</Button
		>
		<Tooltip.Content offset="10px" size="md" class="p-2">
			<Tooltip.Arrow color="info" />
			hello this my world something here hello
		</Tooltip.Content>
	</Tooltip>
</div>
