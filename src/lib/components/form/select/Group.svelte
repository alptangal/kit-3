<!-- src/lib/components/form/select/Group.svelte -->
<script lang="ts">
	interface Props {
		label: string;
		children?: any;
	}

	let { label, children }: Props = $props();
</script>

<div class="select-group" role="group" aria-label={label}>
	<div class="select-group__label">{label}</div>
	<div class="select-group__items">
		{@render children?.()}
	</div>
</div>

<style>
	.select-group {
		padding: var(--select-padding) 0;
	}

	.select-group__label {
		padding: 0.5rem var(--select-padding);
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--select-text-color);
		opacity: 0.7;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.select-group__items {
		display: flex;
		flex-direction: column;
	}
</style>
