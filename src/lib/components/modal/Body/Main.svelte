<script lang="ts">
	import { styleSynced } from '$modules';
	import type { ModalBodyConfigs, ModalBodyProps } from '../_interface';
	import { getModalContainerContext } from '../Container';
	import { getModalContext } from '../useModalContext.svelte';

	let { children, ...props }: ModalBodyProps = $props();
	const modalContainerContext = getModalContainerContext();
	const modalContext = getModalContext();
	let configs: ModalBodyConfigs = $state({
		get style() {
			const defaultStyles: (string | undefined)[] = ['modal-body-root'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		}
	});
	if (modalContainerContext) {
		modalContainerContext.children.body = configs;
	}
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	role="document"
	id={modalContext?.ariaIds?.bodyId}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	// Scroll-container của modal: container là flex column, body chiếm hết
	// chiều cao còn lại (flex: 1) và tự scroll → scrollbar chỉ cao bằng vùng
	// body (cạnh dưới header → cạnh trên footer), không lan qua header/footer.
	// `min-height: 0` bỏ qua min-content height của flex item để body có thể
	// co nhỏ hơn content (điều kiện bắt buộc để overflow-y: auto hoạt động
	// trong flex column).
	.modal-body-root {
		flex: 1 1 0%;
		min-height: 0;
		overflow-y: auto;
	}
</style>