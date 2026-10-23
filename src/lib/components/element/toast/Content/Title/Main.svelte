<script lang="ts">
	import { styleSynced } from '$modules';
	import { getToastContext } from '../..';
	import type { ToastContentTitleConfigs, ToastContentTitleProps } from '../../_interface';

	let { children, ...props }: ToastContentTitleProps = $props();
	let configs: ToastContentTitleConfigs = $state({
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'toast-content-title-root',
				`color-${this.color}`
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get color() {
			return props.color ?? toastContext?.color ?? 'default';
		}
	});
	const toastContext = getToastContext();
</script>

<svelte:element this={props.as ?? 'div'} bind:this={configs.ref} class={configs.style}>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	@use '$styles/colors.scss';
	@use '$styles/theme-mixins' as *;
	.toast-content-title-root {
		color: var(--color);

		/* AA: .color-* map -500 chỉ 3.08–3.81 light → -700 (tự đảo dark);
		   dark -500 đã PASS nên giữ (chỉ sửa light). Mixin theme-light = OS light
		   + data-theme=light (đồng bộ app theme toggle). */
		@include theme-light {
			&.color-warning { --color: var(--warning-700); }
			&.color-success { --color: var(--success-700); }
			&.color-error { --color: var(--danger-700); }
			&.color-info,
			&.color-primary { --color: var(--primary-700); }
		}
	}
</style>
