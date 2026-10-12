<script lang="ts">
	import type { Snippet } from 'svelte';
	import { applyUserPrefsFromLayout, type LayoutData } from '$store/user-prefs.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// B1: bootstrap per-user preferences (theme/language) 1 lần từ layout server data.
	// Hàm tự guard (browser-only + userPrefs.loaded chống apply 2 lần khi nav client).
	applyUserPrefsFromLayout(data as LayoutData);
</script>

<div class="authorized-layout">
	{@render children()}
</div>

<style>
	/* 100dvh (KHÔNG 100vh cứng — mobile Safari URL bar chiếm chỗ, dvh phản hồi
	   khi URL bar thu/mở + keyboard co layout qua interactive-widget). */
	.authorized-layout {
		min-height: 100dvh;
	}
</style>
