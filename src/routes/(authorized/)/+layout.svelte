<script lang="ts">
	// src/routes/(authorized)/+layout.svelte
	import { page } from '$app/state';
</script>

<div class="authorized-layout">
	{@render children()}
</div>

<style>
	.authorized-layout {
		min-height: 100vh;
	}
</style>