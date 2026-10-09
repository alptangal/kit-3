<!-- src/routes/ui/error/+page.svelte — demo ErrorPage (matrix rain + mã lỗi đè) -->
<script lang="ts">
	import { ErrorPage } from '$components/element';
	import { page } from '$app/state';

	// Status + message từ query param (?status=404&message=...) — reactive theo navigation
	const demoStatus = $derived.by(() => {
		const s = page.url.searchParams.get('status');
		return s && /^\d{3}$/.test(s) ? Number(s) : 404;
	});
	const demoMessage = $derived.by(() => page.url.searchParams.get('message') ?? undefined);
</script>

<ErrorPage status={demoStatus} message={demoMessage} data-test="error-demo" />
