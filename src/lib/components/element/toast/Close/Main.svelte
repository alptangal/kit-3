<script lang="ts">
	import { iconify } from '$assets/icons/iconify';
	import { Button } from '$components/element';
	import type { ButtonConfigs, ButtonProps } from '$components/element/button/_interface';
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { getToastContext } from '..';
	import type { ToastProps } from '../_interface';

	let { ...props }: ButtonProps = $props();
	let configs: Partial<ButtonConfigs> = $state({
		// Icon-only button: ratio vuông (width == height) để cân đối ở góc toast.
		'aspect-square': true,
		get size() {
			// Chuẩn design framework lớn (sonner/MUI/Chakra): nút đóng toast nhỏ,
			// vừa với chiều cao toast (toast-md ≈ 32px — button-md 40px tràn viền).
			// Bỏ qua size cha (toastContext.size), luôn xs; caller ghi đè bằng props.size.
			return props.size ?? 'xs';
		},
		get color() {
			return props.color ?? 'error';
		},
		get disabled() {
			return props.disabled ?? toastContext?.disabled;
		},
		get style() {
			const defaultStyles: (string | undefined)[] = ['toast-close', 'p-0! h-fit'];
			const propsClass =
				typeof props.class == 'string'
					? [props.class]
					: Array.isArray(props.class)
						? [...props.class]
						: typeof props.class == 'object'
							? [...(typeof props.class.root == 'object' ? props.class.root : [props.class.root])]
							: [];
			return styleSynced({ defaultStyles, propStyles: propsClass }, props.overwriteDefaultStyles);
		},
		get variant() {
			return props.variant ?? 'solid';
		},
		get event() {
			const defaultEvent: ToastProps['events'] = [
				{
					events: {
						mousedown() {
							if (client.browser?.toasts && toastContext?.id)
								client.browser.toasts.remove(toastContext.id);
						}
					}
				}
			];
			return [...defaultEvent];
		}
	});

	const toastContext = getToastContext();
</script>

{#if toastContext?.status.hover}
	<Button
		{...configs}
		events={configs.event}
		icon={iconify['close-rounded']}
		class={configs.style}
		aria-label="Đóng thông báo"
	/>
{/if}

<style lang="scss">
	:global(.toast-close) {
		position: absolute !important;
		top: 0;
		right: 0;
		z-index: 1;
		/* Nút nhỏ hơn nửa nút (xs ≈ 24px) nên dịch 30% thay vì 50% — icon vẫn nằm
		   trong góc toast, không tràn ra ngoài (chuẩn sonner/shadcn). */
		transform: translateX(30%) translateY(-30%) !important;
	}
</style>
