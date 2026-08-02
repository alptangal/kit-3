<script lang="ts">
	import { iconify } from '$assets/icons/iconify';
	import { Button, Tooltip } from '$components/element';
	import { Input } from '$components/form';
	import { onMount } from 'svelte';

	onMount(() => {});
</script>

<div class="flex flex-col justify-center items-center w-full h-full">
	<Button icon={iconify['search-rounded']} rounded="full" variant="outline" color="info"
		>Button</Button
	>
	<Tooltip>
		<Button
			icon={iconify['search-rounded']}
			rounded="full"
			variant="solid"
			color="info"
			aspect-square>Tooltip</Button
		>
		<Tooltip.Content class="p-2">
			<Tooltip.Arrow />
			hello this my world something here hello
		</Tooltip.Content>
	</Tooltip>
	<Tooltip>
		<Input
			loading
			variant="primary"
			type="number"
			actionButtons={{ copy: { display: true }, paste: { display: true } }}
		>
			{#snippet leading(data)}
				<Button
					icon={iconify['search-rounded']}
					class={[...(data?.defaultStyles ?? []), 'p-0! ']}
					aspect-square
					size={data?.size}
					events={[
						{
							events: {
								mousedown: {
									handler(e) {
										console.log(e);
									},
									options: {
										stopPropagation: true
									}
								}
							}
						}
					]}
				/>
			{/snippet}
		</Input>
		<Tooltip.Content class="p-2">
			<Tooltip.Arrow />
			hello this my world something here hello111
		</Tooltip.Content>
	</Tooltip>
	<Input
		loading
		variant="primary"
		type="number"
		actionButtons={{ copy: { display: true }, paste: { display: true } }}
		required
		minNumber="3"
		maxNumber="99"
		name="my name"
		validation={{
			operator: 'or'
		}}
	>
		{#snippet leading(data)}
			<Button
				icon={iconify['search-rounded']}
				class={[...(data?.defaultStyles ?? []), 'p-0! ']}
				aspect-square
				size={data?.size}
				events={[
					{
						events: {
							mousedown: {
								handler(e) {
									console.log(e);
								},
								options: {
									stopPropagation: true
								}
							}
						}
					}
				]}
			/>
		{/snippet}
	</Input>
</div>
