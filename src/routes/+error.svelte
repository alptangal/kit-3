<script lang="ts">
	import { page } from '$app/state';
	import { ErrorPage } from '$components/element';
</script>

<ErrorPage status={page.status} message={page.error?.message} />
