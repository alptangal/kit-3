<script lang="ts">
	import Button from '../../button/Main.svelte';
	import type { ButtonProps } from '../../button/_interface';

	let { children, ...props }: ButtonProps = $props();
</script>

<Button {...props}>
	{@render children?.()}
</Button>

<style lang="scss">
</style>
