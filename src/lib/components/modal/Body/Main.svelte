<script lang="ts">
	import { styleSynced } from '$modules';
	import type { ModalBodyConfigs, ModalBodyProps } from '../_interface';
	import { getModalContainerContext } from '../Container';
	import { getModalContext } from '../useModalContext.svelte';

	let { children, ref = $bindable(), ...props }: ModalBodyProps = $props();
	const modalContainerContext = getModalContainerContext();
	const modalContext = getModalContext();
	let configs: ModalBodyConfigs = $state({
		get ref() {
			return ref;
		},
		set ref(v) {
			ref = v;
		},
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
		/* Safari iOS ≤15.4: scroll bên trong flex container chết nếu không có
		   momentum scroll (-webkit-overflow-scrolling) và pan chạm bị container
		   cha nuốt (overscroll-behavior contain chặn bounce chain). */
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-y: contain;
		/* Safari cũ không tính min-height:0 trong flex — ép height cụ thể qua
		   display -webkit-box fallback giúp vùng cuộn nhận touch đúng vùng. */
		@supports (-webkit-touch-callout: none) and (not (translate: none)) {
			/* iOS ≤15.3 (không hỗ trợ translate) — đảm bảo height flow chuẩn */
			height: 100%;
		}
	}

	// ── Form fields trong modal (P2 modal-style-field) ──
	// Input/Select/Textarea mặc định (variant-secondary) BÁN TRONG SUỐT +
	// border transparent → chìm vào nền modal var(--default-200), user không
	// nhận biết được vùng nhập. Chỉnh TRONG phạm vi modal body (không đụng
	// style component dùng nơi khác):
	//   - nền field: surface nhô hơn nền modal (--default-100 trên default-200)
	//   - border: viền rõ --default-400 để phân biệt cả khi field rỗng
	// Dùng token hệ thống var(--...) → tự theo theme sáng/tối.
	// :global bắt buộc — field là markup của trang/component khác (slot),
	// scoped selector không match element ngoài component này.
	.modal-body-root {
		:global(.input-root),
		:global(.textarea-root),
		:global(.admin-select),
		:global(.modal-select),
		:global(.modal-input),
		:global(.modal-textarea) {
			--background: var(--default-100, #27272a);
			border-color: var(--default-400, #52525b);
			background: var(--default-100, #27272a);
		}

		// Input/textarea/select thô (trang cũ viết tay không bọc class).
		:global(> input),
		:global(> textarea),
		:global(> select) {
			border-color: var(--default-400, #52525b);
			background-color: var(--default-100, #27272a);
		}

		// Focus giữ nguyên hành vi gốc (outline/glow sky) — chỉ đổi nền tĩnh.
		:global(.input-root:focus-within),
		:global(.textarea-root:focus-within) {
			border-color: var(--color-sky-500, #0ea5e9);
		}
	}
</style>
