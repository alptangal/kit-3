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
		get size() {
			return props.size ?? toastContext?.size ?? client.browser?.size ?? 'md';
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
	/>
{/if}

<style lang="scss">
	:global(.toast-close) {
		position: absolute !important;
		top: 0;
		right: 0;
		z-index: 1;
		transform: translateX(50%) translateY(-50%) !important;
	}
</style>
