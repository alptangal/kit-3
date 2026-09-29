<!-- src/routes/ui/select/+page.svelte -->
<script lang="ts">
	import * as Select from '$lib/components/form/select';

	let singleValue = $state('');
	let multiValue: string[] = $state([]);
	let showMulti = $state(false);
</script>

<div style="padding: 2rem; max-width: 600px; font-family: system-ui;">
	<h1>Select Component Demo</h1>

	<!-- Single Select -->
	<section style="margin-bottom: 3rem;">
		<h2>Single Select</h2>
		<label for="demo-single" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
			Choose a fruit:
		</label>

		<Select.Root bind:value={singleValue} placeholder="Pick a fruit..." searchable>
			<Select.Trigger />
			<Select.Content>
				<Select.Item value="apple">Apple</Select.Item>
				<Select.Item value="banana">Banana</Select.Item>
				<Select.Item value="cherry">Cherry</Select.Item>
				<Select.Item value="date">Date</Select.Item>
				<Select.Separator />
				<Select.Group label="Citrus">
					<Select.Item value="lemon">Lemon</Select.Item>
					<Select.Item value="orange">Orange</Select.Item>
				</Select.Group>
				<Select.Item value="disabled" disabled>Disabled Option</Select.Item>
			</Select.Content>
		</Select.Root>

		<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
			Selected: <code>{singleValue || '(none)'}</code>
		</p>
	</section>

	<!-- Multi Select -->
	<section style="margin-bottom: 3rem;">
		<h2>Multi Select</h2>
		<label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
			<input type="checkbox" bind:checked={showMulti} />
			Enable Multi-Select
		</label>

		{#if showMulti}
			<label for="demo-multi" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
				Choose colors:
			</label>

			<Select.Root bind:value={multiValue} placeholder="Pick colors..." multiple searchable>
				<Select.Trigger />
				<Select.Content>
					<Select.Item value="red">Red</Select.Item>
					<Select.Item value="green">Green</Select.Item>
					<Select.Item value="blue">Blue</Select.Item>
					<Select.Item value="yellow">Yellow</Select.Item>
					<Select.Item value="purple">Purple</Select.Item>
				</Select.Content>
			</Select.Root>

			<p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
				Selected: <code>{JSON.stringify(multiValue)}</code>
			</p>
		{/if}
	</section>

	<!-- Keyboard Navigation Guide -->
	<section style="background: #f5f5f5; padding: 1rem; border-radius: 0.5rem; margin-bottom: 2rem;">
		<h3 style="margin-top: 0;">Keyboard Navigation</h3>
		<ul style="font-size: 0.875rem; margin: 0.5rem 0;">
			<li><kbd>Enter</kbd> or <kbd>Space</kbd> to open</li>
			<li><kbd>↓</kbd> / <kbd>↑</kbd> to navigate options</li>
			<li><kbd>Enter</kbd> to select</li>
			<li><kbd>Escape</kbd> to close</li>
			<li>Type to search (when searchable)</li>
		</ul>
	</section>

	<!-- Test Results Placeholder -->
	<section style="border: 1px solid #ddd; padding: 1rem; border-radius: 0.5rem;">
		<h3 style="margin-top: 0;">Test Checklist</h3>
		<label style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
			<input type="checkbox" disabled checked />
			<span>Component renders</span>
		</label>
		<label style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
			<input type="checkbox" disabled />
			<span>Click trigger opens dropdown</span>
		</label>
		<label style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
			<input type="checkbox" disabled />
			<span>Keyboard navigation works</span>
		</label>
		<label style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
			<input type="checkbox" disabled />
			<span>Search filter works</span>
		</label>
		<label style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
			<input type="checkbox" disabled />
			<span>Multi-select works</span>
		</label>
	</section>
</div>

<style>
	:global(body) {
		background: #fafafa;
	}

	h1, h2, h3 {
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
	}

	section {
		margin-bottom: 2rem;
	}

	code {
		background: #f0f0f0;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-family: 'Courier New', monospace;
		font-size: 0.9em;
	}

	kbd {
		background: #333;
		color: #fff;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.85em;
		font-family: monospace;
	}

	ul {
		list-style-position: inside;
	}
</style>
