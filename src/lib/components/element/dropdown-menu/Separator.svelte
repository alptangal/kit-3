<script lang="ts">
	// src/lib/components/element/dropdown-menu/Separator.svelte
	// DropdownMenu.Separator — đường chia nhóm item trong menu (role="separator").
	// Khác Element.Separator (component độc lập): đây là item con của Content,
	// không focusable, không phải menu item.
	import { styleSynced } from '$modules';
	import type { DropdownMenuSeparatorProps } from './_interface';

	let { ...props }: DropdownMenuSeparatorProps = $props();

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = ['dropdown-menu-separator'];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});
</script>

<div class={styleDerived} role="separator" {...props}></div>

<style lang="scss">
	.dropdown-menu-separator {
		height: 1px;
		margin: 0.25rem 0;
		background-color: var(--border, hsl(240 5.9% 90%));

		@media (prefers-color-scheme: dark) {
			background-color: hsl(240 5.9% 20%);
		}
	}
</style>
