<script lang="ts">
	// src/lib/components/element/alert-dialog/Header.svelte
	// AlertDialog.Header — flex column: icon (optional, bên phải) +
	// Title + Description. Padding 1.5rem 1.5rem 0 (top-left-right), bottom
	// bằng 0 vì Footer tự có padding-top riêng (spec: header bottom 0).
	//
	// `leading`: icon trước (snippet) — demo truyền `<Icon icon="...warning">`.
	// Icon đặt TRƯỚC title+description (cột bên trái, baseline align title).
	// Variant 'danger' (mặc định) → icon màu `--danger`; 'info' → `--primary`;
	// 'default' → `--foreground`.
	import { styleSynced } from '$modules';
	import type { AlertDialogHeaderProps } from './_interface';

	let { leading, variant = 'danger', children, ...props }: AlertDialogHeaderProps = $props();
	// Header không dùng context (chỉ style + slot) — không import getAlertDialogContext.

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'alert-dialog-header',
			`variant-${variant}`,
			leading ? 'with-leading' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});
</script>

<div class={styleDerived} data-ad-header>
	{#if leading}
		<div class="leading" aria-hidden="true">{@render leading()}</div>
	{/if}
	<div class="body">
		{@render children?.()}
	</div>
</div>

<style lang="scss">
	.alert-dialog-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1.5rem 1.5rem 0;
		// body (title + desc) gap 0.5rem (spec).
		.body {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			min-width: 0;
		}

		// icon: 1.5rem (24px) — cùng chiều cao title (line-height ~1.5rem).
		.leading {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
			width: 1.5rem;
			height: 1.5rem;
			font-size: 1.5rem;
			line-height: 1;
			margin-top: 0.125rem; // align visual baseline với title.

			// @iconify/svelte render SVG 1em theo font-size, nhưng element Icon
			// có :global(.icon){ font-size: var(--font-size) } (sm ~14px) ÁT font-size
			// của .leading → SVG chỉ 14px. Ép trực tiếp SVG xuống đúng 1.5rem
			// (descendant selector — scoped CSS vẫn match svg con từ @iconify).
			svg {
				width: 1.5rem;
				height: 1.5rem;
				display: block;
			}
		}

		&.variant-danger .leading {
			color: var(--danger, var(--foreground));
		}
		&.variant-info .leading {
			color: var(--primary, var(--foreground));
		}
		&.variant-default .leading {
			color: var(--foreground);
		}
	}
</style>
