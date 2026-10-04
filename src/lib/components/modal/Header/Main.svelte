<script lang="ts">
	import { iconify } from '$assets/icons/iconify';
	import { Button } from '$components/element';
	import type { BasicProps } from '$components/interface';
	import { styleSynced } from '$modules';
	import { getModalContext } from '..';
	import type { ModalHeaderConfigs, ModalHeaderProps } from '../_interface';
	import { getModalContainerContext } from '../Container';

	let { children, ...props }: ModalHeaderProps = $props();
	let modalContainerContext = getModalContainerContext();
	let modalContext = getModalContext();
	let configs: ModalHeaderConfigs = $state({
		get preventOutsideClose() {
			// Visual cue: user cần biết modal "đóng cứng" — chỉ ESC/× đóng được.
			return modalContext?.preventOutsideClose ?? false;
		},
		get sticky() {
			// Ghim header khi body cuộn (position: sticky). Opt-in, mặc định false.
			return props.sticky ?? false;
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'modal-header-root',
				children ? 'justify-between' : 'justify-end',
				this.sticky ? 'modal-header-sticky' : undefined,
				// Cùng điều kiện container gán `flush-top` (children.header
				// truthy) → container padding-top: 0 ⇔ header margin-top: 0.
				// Hai DOM writes batch cùng frame (Svelte) → không flicker.
				modalContainerContext?.children.header ? 'modal-header-flush-top' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		actionButton: {
			close: {
				get display() {
					return props.actionButtons?.close?.display ?? true;
				},
				get size() {
					// Close button giữ tỷ lệ vuông cân đối trong header — KHÔNG theo
					// size của modal (modal lg/xl sẽ kéo button to 46-50px, mất cân
					// đối so với text header). Clamp: fullscreen → md (40px), thường
					// → sm (34px).
					if (modalContext?.size == 'full') return 'md';
					return 'sm';
				},
				get event() {
					const defaultEvents: BasicProps['events'] = [
						{
							events: {
								click() {
									if (!modalContext) return;
									// Gán reason TRƯỚC khi flip display (đồng bộ) →
									// Modal fire onClose('close-button') +
									// onCloseByButton. Fallback: bridge chưa gán
									// (context mới tạo, chưa chạy script Modal)
									// → đóng bằng display = false thường (reason sẽ
									// fallback 'programmatic').
									if (modalContext.closeByReason) {
										modalContext.closeByReason('close-button');
									} else {
										modalContext.display = false;
									}
								}
							}
						}
					];
					return defaultEvents;
				}
			}
		}
	});
	if (modalContainerContext) {
		modalContainerContext.children.header = configs;
	}
</script>

<svelte:element
	this={props.as ?? 'header'}
	bind:this={configs.ref}
	class={configs.style}
	id={modalContext?.ariaIds?.headerId}
>
	{@render children?.()}
	<div class="modal-header-actions">
		{#if configs.preventOutsideClose}
			<span class="modal-esc-hint" aria-hidden="false">
				Press <kbd class="modal-esc-hint__key">Esc</kbd> or close to dismiss
			</span>
		{/if}
		{#if configs.actionButton.close?.display}
			<Button
				icon={iconify['close-rounded']}
				size={configs.actionButton.close.size}
				events={configs.actionButton.close.event}
				color="error"
				variant="outline"
				aspect-square
				class="modal-close-button"
				aria-label="Close modal"
			/>
		{/if}
	</div>
</svelte:element>

<style lang="scss">
	// ── Header nổi khối: nền riêng + đường phân tách dưới, phủ rộng toàn bộ
	//    độ rộng container (negative-margin ra ngoài padding) để tạo "vách"
	//    đầu tiên user nhìn thấy, tăng tính nhận diện giữa modal và trang sau.
	//    Dùng var(--padding) (Container định nghĩa per-size: md=1rem, lg=1.25rem…)
	//    cho negative margin + padding horizontal → header flush đúng mép và
	//    title align với nội dung body ở MỌI size, không hardcode.
	//    Vertical padding (0.875rem) là "thickness" thiết kế riêng, giữ cố định.
	.modal-header-root {
		display: flex;
		align-items: center;
		justify-content: flex-end; // mặc định (con thêm class justify-between để title trái + close phải)
		gap: 0.5rem;

		position: relative;
		z-index: 1;

		// Nền rõ (khác với container hiện dùng --default-200 nên header --default-300
		// tạo độ tương phản vừa đủ — "nổi khối" mà không gắt).
		background: var(--default-300, #27272a);

		// Một "vách" rõ (0.09375rem = 1.5px) — không dùng shadow (nhẹ, fade theo nền)
		border-bottom: 0.09375rem solid rgba(0, 0, 0, 0.18);
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04);

		// Flush full-width: phủ ra ngoài padding của .modal-container-root.
		// Header là con trực tiếp của container → inherit được --padding.
		margin: calc(-1 * var(--padding, 1.25rem)) calc(-1 * var(--padding, 1.25rem)) 0;
		// Horizontal = padding container (title align mép body) · Vertical = thickness.
		padding: 0.875rem var(--padding, 1.25rem);

		// Corner trên cùng bo tròn đồng bộ với container (mặc định --border-radius: 1rem)
		border-top-left-radius: inherit;
		border-top-right-radius: inherit;

		// Title trong header: font slightly bold + line-height short để "đứng"
		// trong khối header (không bị chìm vào hàng text thân).
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--foreground);

		// Nút close + hint ESC gom vào 1 nhóm (cùng bên phải). Header dùng
		// justify-between → title (children) trái, nhóm này phải.
		.modal-header-actions {
			display: flex;
			align-items: center;
			gap: 0.625rem;
		}

		// Container flush-top (có Header → padding-top: 0): không còn
		// padding-top để "ăn" → bỏ negative margin-top. margin-inline giữ
		// nguyên (horizontal padding của container không đổi).
		&.modal-header-flush-top {
			margin-top: 0;
		}

		// Prop `sticky` (giữ cho API ổn định; mặc định false). KIẾN TRÚC MỚI:
		// container là flex column, scroll nằm ở `.modal-body-root` → header
		// là flex sibling ĐỨNG YÊN tự nhiên (không cần sticky). Class chỉ
		// còn ý nghĩa tối thiểu: `position: sticky` relative container
		// (overflow: hidden, không scroll được) là no-op, giữ an toàn nếu
		// container nào đó quay lại làm scroll-container. Selector compound
		// (&.) vì class nằm TRÊN CÙNG element .modal-header-root — selector
		// con cháu sẽ không match; compound để override `position: relative`.
		&.modal-header-sticky {
			position: sticky;
			top: 0;
		}

		// Visual cue cho preventOutsideClose: modal "đóng cứng" (click nền
		// không đóng) → user cần biết ESC/× là cách duy nhất. Subtle, không
		// lấn át title.
		.modal-esc-hint {
			font-size: 0.75rem;
			font-weight: 500;
			line-height: 1;
			color: var(--default-500, var(--default-400));
			white-space: nowrap;

			.modal-esc-hint__key {
				display: inline-block;
				padding: 0.125rem 0.375rem;
				margin: 0 0.125rem;
				font-size: 0.6875rem;
				font-family: inherit;
				line-height: 1;
				color: var(--foreground);
				background: var(--default-400);
				border-radius: calc(var(--radius) * 0.5);
				box-shadow: 0 1px 0 var(--default-500);
			}
		}

		// Nút close: tỷ lệ vuông (đã aspect-square từ prop).
		.modal-close-button {
			flex-shrink: 0;
		}
	}
</style>