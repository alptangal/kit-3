<script lang="ts">
	// src/lib/components/element/dropdown-menu/Label.svelte
	// DropdownMenu.Label — nhãn phân nhóm trong menu (không phải item, không focusable).
	// variant "sub": dòng phụ nhỏ bên dưới label chính.
	import { styleSynced } from '$modules';
	import type { DropdownMenuLabelProps } from './_interface';

	let {
		variant = 'default',
		children,
		...props
	}: DropdownMenuLabelProps = $props();

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'dropdown-menu-label',
			variant === 'sub' ? 'sub' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});
</script>

<div class={styleDerived} role="none" data-dm-label {...props}>
	{@render children?.()}
</div>

<style lang="scss">
	.dropdown-menu-label {
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1rem;
		color: var(--muted, var(--foreground));
		text-transform: uppercase;
		letter-spacing: 0.03em;

		&.sub {
			font-size: 0.8125rem;
			font-weight: 400;
			color: var(--muted, var(--foreground));
			text-transform: none;
			letter-spacing: 0;
		}
	}
</style>
