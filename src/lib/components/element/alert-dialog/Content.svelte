<script lang="ts">
	// src/lib/components/element/alert-dialog/Content.svelte
	// AlertDialog.Content — render khi `open`: overlay (fixed, z-index 10002) +
	// dialog box (role="alertdialog"). Focus trap GIỚI HẠN 2 nút (Action ↔ Cancel).
	//
	// Khác Modal (cố ý):
	// - KHÔNG mousedown/backdrop-close handler: click nền KHÔNG đóng dialog
	//   (dialog xác nhận — tránh mis-action; semantics `preventOutsideClose`).
	// - Escape → đóng + focus trả trigger (Root.close). Escape xử lý
	//   CAPTURE trên document để thắng listener bubble của modal khi dialog
	//   này là top layer.
	// - Tab loop 2 nút: tự viết (không dùng modal `getFocusableElements` —
	//   dialog chỉ có đúng 2 nút focusable, xử lý trực tiếp tin cậy hơn).
	// - Portal: reuse `createModalPortal` từ modal (append node vào parent của
	//   layout root layer + register vào `client.browser.layers`) → stacking
	//   đúng khi modal + alert-dialog cùng tồn tại. KHÔNG sửa modal.
	// - Animation: CSS keyframes fade + scale 0.96→1 trong
	//   var(--ad-duration) (Root gán, default 200ms). Reduced-motion → none.
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { createModalPortal, isTopLayer } from '../../modal/useModalContext.svelte';
	import { getAlertDialogContext } from './_context';
	import type { AlertDialogContentProps } from './_interface';

	let { children, ...props }: AlertDialogContentProps = $props();
	const ctx = getAlertDialogContext();

	// Context luôn được Root (cha trực tiếp) set trước khi Content render —
	// defensive optional-chaining (mirror dropdown-menu/popover: KHÔNG
	// top-level `return`, Svelte 5 không cho early-return trong component).
	const open = $derived(ctx?.open ?? false);
	const titleId = $derived(ctx?.titleId ?? '');
	const descriptionId = $derived(ctx?.descriptionId ?? '');

	// Fallback title/description: Root truyền text đã resolve
	// (TranslateContent → string). User render `<AlertDialog.Title>`/
	// `<AlertDialog.Description>` → sub register hasTitle/hasDescription
	// (Context đọc tính derived → tính lại khi sub mount).
	const fallbackTitle = $derived(ctx?.title);
	const fallbackDescription = $derived(ctx?.description);
	const hasTitle = $derived(Boolean(ctx?.hasTitle) || Boolean(fallbackTitle));
	const hasDescription = $derived(Boolean(ctx?.hasDescription) || Boolean(fallbackDescription));

	// 2 nút focusable — first/last theo DOM order THẬT (không phải CSS
	// order): demo dùng thứ tự shadcn (Cancel render trước Action, footer
	// row-reverse chỉ đổi VISUAL). first = nút ở TRƯỚC trong DOM, last =
	// nút Ở SAU (Tab last → wrap first; Shift+Tab first → wrap last).
	// `compareDocumentPosition` robust cho cả 2 thứ tự render.
	let overlayEl: HTMLDivElement | undefined;
	function findAction(): HTMLElement | undefined {
		return overlayEl?.querySelector<HTMLElement>('[data-ad-action]') ?? undefined;
	}
	function findCancel(): HTMLElement | undefined {
		return overlayEl?.querySelector<HTMLElement>('[data-ad-cancel]') ?? undefined;
	}
	function focusables(): [HTMLElement | undefined, HTMLElement | undefined] {
		const action = findAction();
		const cancel = findCancel();
		if (!action || !cancel) return [action, cancel];
		// action ở SAU cancel trong DOM → [cancel, action], ngược lại → [action, cancel].
		const actionFollowsCancel =
			(cancel.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
		return actionFollowsCancel ? [cancel, action] : [action, cancel];
	}

	// Escape + Tab: capture trên document — chạy TRƯỚC listener bubble của
	// modal, để dialog xác nhận luôn thắng khi là top layer.
	$effect(() => {
		if (!open || typeof document === 'undefined') return;
		const onKey = (e: KeyboardEvent) => {
			if (!isTopLayer(overlayEl)) return;
			if (e.key === 'Escape') {
				e.stopPropagation();
				e.preventDefault();
				ctx?.close();
				return;
			}
			if (e.key !== 'Tab') return;
			const [first, last] = focusables();
			if (!first || !last) return;
			const active = document.activeElement;
			if (active === last && !e.shiftKey) {
				e.preventDefault();
				first.focus();
			} else if ((active === first || active === overlayEl) && e.shiftKey) {
				e.preventDefault();
				last.focus();
			} else if (active !== first && active !== last && active !== boxEl) {
				// Focus rơi ra ngoài 2 nút (browser quirk / focus body)
				// → kéo về Action (nút chính) để giữ trap.
				e.preventDefault();
				findAction()?.focus();
			}
		};
		document.addEventListener('keydown', onKey, true);
		return () => document.removeEventListener('keydown', onKey, true);
	});

	let boxEl: HTMLDivElement | undefined;

	let configs = $state({
		get event() {
			const defaultEvents = [
				{
					events: {
						load(_evt: unknown, data: unknown) {
							const node = (data as { node?: unknown })?.node;
							if (!(node instanceof HTMLElement)) return;
							// Portal: append vào layout parent + register layers
							// (đồng bộ với modal — isTopLayer hoạt động chung).
							const portal = createModalPortal(node);
							(configs as unknown as Record<string, unknown>)._portalDestroy =
								portal.destroy;
							// Initial focus KHI open: Action (nút chính — spec).
							// `findAction()` (KHÔNG phải focusables()[0] — thứ tự
							// DOM có thể đặt Cancel trước). rAF: DOM settle.
							requestAnimationFrame(() => {
								const action = findAction();
								if (action && !action.hasAttribute('disabled')) {
									action.focus();
									return;
								}
								// Không tìm thấy Action (user không render?)
								// → focus vào box (tabindex=-1) giữ focus trong dialog.
								if (boxEl && !boxEl.hasAttribute('tabindex')) boxEl.setAttribute('tabindex', '-1');
								boxEl?.focus();
							});
							return () => {
								const destroy = (configs as unknown as Record<string, unknown>)
									._portalDestroy as (() => void) | undefined;
								destroy?.();
							};
						}
					}
				}
			];
			return [...(defaultEvents ?? []), ...(props.events ?? [])];
		}
	});

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'alert-dialog-overlay',
			open ? 'open' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});
</script>

{#if open}
	<!-- {@attach} gắn TRÊN overlay div (element được portal) — đúng pattern
	     của Modal (đặt trên svelte:element). `load` nhận data.node = overlay
	     này → createModalPortal(overlayEl) + initial focus Action. Ngặt nếu
	     để {@attach} đứng lẻ ngoài div → không có element nào để gắn. -->
	<div
		class={styleDerived}
		bind:this={overlayEl}
		data-ad-overlay
		role="presentation"
		{@attach handleEvents(configs.event)}
	>
		<div
			class="alert-dialog-box"
			bind:this={boxEl}
			role="alertdialog"
			aria-modal="true"
			aria-labelledby={hasTitle ? titleId : undefined}
			aria-describedby={hasDescription ? descriptionId : undefined}
			id={ctx?.rootId}
			tabindex="-1"
		>
			<!-- Fallback title/description: render khi user truyền prop
			     `title`/`description` cho Root NHƯNG không render
			     `<AlertDialog.Title>`/`<AlertDialog.Description>` — để
			     aria-labelledby/describedby không trỏ id "vô chủ". -->
			{#if (!ctx?.hasTitle && fallbackTitle) || (!ctx?.hasDescription && fallbackDescription)}
				<div class="ad-fallback">
					{#if !ctx?.hasTitle && fallbackTitle}
						<h3 class="ad-fallback-title" id={titleId}>{fallbackTitle}</h3>
					{/if}
					{#if !ctx?.hasDescription && fallbackDescription}
						<p class="ad-fallback-desc" id={descriptionId}>{fallbackDescription}</p>
					{/if}
				</div>
			{/if}
			{@render children?.()}
		</div>
	</div>
{/if}

<style lang="scss">
	.alert-dialog-overlay {
		position: fixed;
		inset: 0;
		// Trên modal (root 10000 / container 10001): alert-dialog là top layer
		// được portal làm EM của layout root (chị em với modal-root) → cần
		// z-index cao hơn để phủ lên modal khi cả hai cùng tồn tại.
		z-index: 10002;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		box-sizing: border-box;
		// Overlay copy modal: dark + blur nhẹ (modal-root: rgba(0,0,0,0.65)).
		background: rgba(0, 0, 0, 0.65);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		// Fade + scale 0.96→1 — duration theo var(--ad-duration) (Root,
		// default 200ms). `both`: giữ final state (scale(1), opacity 1).
		animation: alert-dialog-in var(--ad-duration, 200ms) cubic-bezier(0.65, 0, 0.35, 1) both;

		.alert-dialog-box {
			width: 400px;
			max-width: 90vw;
			background: var(--background, hsl(0 0% 100%));
			color: var(--foreground, hsl(0 0% 8%));
			border-radius: var(--border-radius-lg, var(--radius, 0.5rem));
			// Shadow lg copy modal container.
			box-shadow:
				0 25px 50px -12px rgba(0, 0, 0, 0.6),
				0 0 0 1px rgba(255, 255, 255, 0.1);
			padding: 0;
			display: flex;
			flex-direction: column;
			box-sizing: border-box;
			outline: none;

			// Fallback title/description — style mirror Title/Description sub,
			// padding block đầu khớp Header (1.5rem 1.5rem 0).
			.ad-fallback {
				padding: 1.5rem 1.5rem 0;
				display: flex;
				flex-direction: column;
				gap: 0.5rem;

				.ad-fallback-title {
					font-size: 1.0625rem;
					font-weight: 600;
					line-height: 1.4;
					margin: 0;
					color: var(--foreground, hsl(0 0% 8%));
				}

				.ad-fallback-desc {
					font-size: 0.875rem;
					line-height: 1.6;
					margin: 0;
					color: var(--muted, var(--foreground));
				}
			}
		}
	}

	@keyframes alert-dialog-in {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	// WCAG 2.3.3 — reduced-motion: tắt animation mở (content vẫn hiện).
	@media (prefers-reduced-motion: reduce) {
		.alert-dialog-overlay {
			animation: none;
		}
	}
</style>
