// src/lib/components/element/card/Root.svelte
// Card (Root) — surface container (tag mặc định div, override qua prop `as`),
// class `card-root elevation-*`, p-0.
// Card KHÔNG có role (nội dung semantic); user tự đặt `as="section"` + `aria-label` khi cần.
// Spacing do sub-components (Header/Content/Footer) quản lý — Root chỉ lo elevation + nền.
<script lang="ts">
	import { styleSynced } from '$modules';
	import type { CardRootConfigs, CardRootProps } from './_interface';

let { elevation = 'border', as: asProp, class: classProp, children, ...props }: CardRootProps = $props();

let configs: CardRootConfigs = $state({
	get elevation() {
		return elevation;
	},
	get style() {
		const defaultStyles: (string | undefined)[] = [
			'card-root',
			`elevation-${this.elevation}`,
			// card p-0 (không dùng size-* vì card không có scale size chuẩn của hệ)
			'p-0'
		];
		return styleSynced({ defaultStyles, propStyles: classProp }, props.overwriteDefaultStyles);
	}
});

export { configs };
</script>

<svelte:element this={asProp ?? 'div'} class={configs.style} {...props}>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	@use '_styles.scss' as card;

	.card-root {
		min-width: 0;
		display: flex;
		flex-direction: column;

		&.elevation-border {
			@include card.card-elevation-border;
		}

		&.elevation-raised {
			@include card.card-elevation-raised;
		}

		&.elevation-none {
			@include card.card-elevation-none;
		}

		@media (prefers-color-scheme: dark) {
			&.elevation-border,
			&.elevation-raised {
				border-color: hsl(240 5.9% 24%);
			}
		}
	}
</style>
