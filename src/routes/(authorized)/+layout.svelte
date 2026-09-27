<script lang="ts">
	// Layout group (authorized) — các trang yêu cầu đăng nhập.
	// Layout rỗng chủ ý: shell (header/footer/toast) do layout root xử lý,
	// layout này chỉ cần render children; không {@render children()} thì
	// mọi trang trong group này render trắng (Svelte 5).
	let { children } = $props();
</script>

{@render children()}
