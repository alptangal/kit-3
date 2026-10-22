<script lang="ts">
	// Trang demo/verify Button: ma trận variant × color để probe contrast AA.
	import { Button } from '$components/element';
	const colors = ['default', 'secondary', 'success', 'info', 'warning', 'error', 'primary'] as const;
	const variants = ['solid', 'outline', 'soft', 'subtle', 'ghost', 'link'] as const;
	const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
</script>

{#each variants as v (v)}
	<section data-variant={v}>
		<h3>{v}</h3>
		{#each colors as c (c)}
			<Button variant={v} color={c}>{c}</Button>
		{/each}
	</section>
{/each}

<section data-testid="sizes">
	<h3>sizes</h3>
	{#each sizes as s (s)}
		<Button size={s} color="primary">size-{s}</Button>
	{/each}
	<Button size="sm" icon="material-symbols-light:search" aspect-square data-testid="icon-only-sm" />
</section>

<section data-testid="tooltip-test">
	<h3>tooltip</h3>
	<Button tooltip="Hello tooltip" color="primary">tooltip btn</Button>
</section>

<section data-testid="loading-test">
	<h3>loading</h3>
	<Button loading color="primary">loading</Button>
</section>

<style>
	section {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		padding: 1rem;
	}
</style>
