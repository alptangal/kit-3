<script lang="ts">
	import { styleSynced } from '$modules';
	import type { ModalFooterConfigs, ModalFooterProps } from '../_interface';
	import { getModalContainerContext } from '../Container';
	import { getModalContext } from '../useModalContext.svelte';

	let { children, ...props }: ModalFooterProps = $props();
	const modalContainerContext = getModalContainerContext();
	const modalContext = getModalContext();
	let configs: ModalFooterConfigs = $state({
		get sticky() {
			// Ghim footer khi body cuộn (position: sticky). Opt-in, mặc định false.
			return props.sticky ?? false;
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'modal-footer-root',
				this.sticky ? 'modal-footer-sticky' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		}
	});
	if (modalContainerContext) {
		modalContainerContext.children.footer = configs;
	}
</script>

<svelte:element
	this={props.as ?? 'footer'}
	bind:this={configs.ref}
	class={configs.style}
	id={modalContext?.ariaIds?.footerId}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	.modal-footer-root {
		@apply flex gap-2 justify-end;

		// Khối footer tương xứng header: cùng "thickness" dọc 0.875rem
		// (header dùng vertical `0.875rem`, horizontal lấy từ `var(--padding)`
		// container). Footer không có negative-margin (không full-width như
		// header) → đã nằm trong horizontal padding của container, chỉ thêm
		// padding-block để nội dung nút không bám sát mép container.
		padding-block: 0.875rem;
	}

	// Prop `sticky` (giữ cho API ổn định; mặc định false). KIẾN TRÚC MỚI:
	// container là flex column, scroll nằm ở `.modal-body-root` → footer là
	// flex sibling ĐỨNG YÊN tự nhiên (không cần sticky). `position: sticky`
	// relative container (overflow: hidden, không scroll được) là no-op.
	// Nền + bottom:0 giữ nguyên — vô hại với layout mới, an toàn nếu container
	// nào đó quay lại làm scroll-container.
	.modal-footer-sticky {
		position: sticky;
		bottom: 0;
		// Nổi trên body content cuộn qua phía dưới khi ghim.
		z-index: 1;
		background: var(--default-200, #18181b);
		// Bo tròn đồng bộ góc dưới cùng container (khớp border-radius container).
		border-bottom-left-radius: inherit;
		border-bottom-right-radius: inherit;
	}
</style>