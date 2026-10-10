<script lang="ts">
	// src/routes/(authorized)/+layout.svelte
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';

	// BẪY Svelte 5: {@render children()} mà KHÔNG destructured từ $props() →
	// "ReferenceError: children is not defined" lúc SSR. Layout này từng bị lỗi
	// tiềm ẩn từ khi tạo nhưng chưa từng render (route con luôn redirect trước
	// vì session thiếu roleName) — chỉ lộ sau khi hooks điền đủ userId/roleName.
	let { children }: { children: Snippet } = $props();
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