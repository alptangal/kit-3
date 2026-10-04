<script lang="ts">
	// SidebarMenuButton — nút menu (li/a hoặc button). href → <a> SPA; active →
	// aria-current="page" + class .active. leading/trailing/badge qua slot.
	import { styleSynced } from '$modules';
	import type { SidebarMenuButtonProps } from './_interface';

	let {
		href,
		active = false,
		disabled = false,
		badge,
		leading,
		trailing,
		children,
		...props
	}: SidebarMenuButtonProps = $props();

	const isLink = $derived(!!href && !disabled);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'sidebar-menu-button',
			active ? 'active' : undefined,
			disabled ? 'disabled' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});
</script>

{#if isLink}
	<a class={styleDerived} {href} aria-current={active ? 'page' : undefined}>
		{#if leading}
			<span class="leading" aria-hidden="true">{@render leading()}</span>
		{/if}
		{#if children}
			<span class="label">{@render children()}</span>
		{/if}
		{#if trailing || badge}
			<span class="trailing">
				{#if trailing}
					{@render trailing()}
				{/if}
				{#if badge}
					{@render badge()}
				{/if}
			</span>
		{/if}
	</a>
{:else}
	<button
		class={styleDerived}
		type="button"
		{disabled}
		aria-current={active ? 'page' : undefined}
	>
		{#if leading}
			<span class="leading" aria-hidden="true">{@render leading()}</span>
		{/if}
		{#if children}
			<span class="label">{@render children()}</span>
		{/if}
		{#if trailing || badge}
			<span class="trailing">
				{#if trailing}
					{@render trailing()}
				{/if}
				{#if badge}
					{@render badge()}
				{/if}
			</span>
		{/if}
	</button>
{/if}

<style lang="scss">
	// Nút menu — scoped (a hoặc button cùng hash của SidebarMenuButton).
	.sidebar-menu-button {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		min-height: 2.25rem;
		width: 100%;
		padding: 0.375rem 0.75rem;
		border-radius: var(--border-radius-sm, 0.375rem);
		font-size: 0.875rem;
		color: var(--content2-foreground, var(--foreground));
		text-decoration: none;
		cursor: pointer;
		background: transparent;
		border: 0;
		transition: background-color var(--transition-duration, 150ms) ease;

		@media (hover: hover) and (pointer: fine) {
			&:hover {
				background: var(--content2, hsl(240 4.8% 96%));
			}
		}

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, var(--focus, hsl(243 75% 59%)));
			outline-offset: 2px;
		}

		.leading {
			flex-shrink: 0;
			display: inline-flex;
			width: 1.125rem;
			height: 1.125rem;
			color: var(--muted, var(--foreground));
		}

		.label {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			text-align: left;
		}

		.trailing {
			flex-shrink: 0;
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
		}

		&.active {
			background: var(--content2, hsl(240 4.8% 96%));

			.leading {
				color: var(--primary, var(--color-indigo-500, hsl(243 75% 59%)));
			}
		}

		&.disabled {
			opacity: var(--disabled-opacity, 0.5);
			pointer-events: none;
		}
	}
</style>
