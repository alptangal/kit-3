<!-- src/lib/components/form/select/select.example.svelte -->
<script lang="ts">
	import * as Select from './index';

	let value = $state('');
	let multiple = $state(false);
	let placeholder = $state('Select an option');
</script>

<div style="padding: 2rem; max-width: 300px;">
	<label for="select-example">Choose:</label>
	<Select.Root bind:value {placeholder} {multiple}>
		<Select.Trigger />
		<Select.Content>
			<Select.Item value="option1">Option 1</Select.Item>
			<Select.Item value="option2">Option 2</Select.Item>
			<Select.Item value="option3">Option 3</Select.Item>
			<Select.Separator />
			<Select.Group label="Disabled">
				<Select.Item value="disabled" disabled>Disabled Option</Select.Item>
			</Select.Group>
		</Select.Content>
	</Select.Root>

	<div style="margin-top: 1rem;">
		<label>
			<input type="checkbox" bind:checked={multiple} />
			Multiple Select
		</label>
	</div>

	<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
		Selected: <code>{JSON.stringify(value)}</code>
	</p>
</div>
