<script lang="ts">
	// src/lib/components/element/alert-dialog/Action.svelte
	// AlertDialog.Action — nút CHÍNH (confirm action) của dialog xác nhận.
	//
	// Mặc định `color="danger"` (nền --danger, text white, hover --danger-600):
	// hành động nguy hiểm ("Xóa", "Đăng xuất"). `color="primary"` cho variant
	// thông tin; `color="default"` (nền --content2) cho trường hợp trung tính.
	//
	// Click → gọi `onselect` (nếu có) RỒI close (Root.close: setOpen(false) +
	// focus trả trigger). data-ad-action: Content dùng để autofocus khi open
	// + focus trap 2 nút.
	import { styleSynced } from '$modules';
	import { getAlertDialogContext } from './_context';
	import type { AlertDialogActionProps } from './_interface';

	let {
		color = 'danger',
		onselect: onSelect,
		onclick: onClick,
		disabled = false,
		children,
		...props
	}: AlertDialogActionProps = $props();
	// Guard: KHÔNG top-level `return` (Svelte 5 parse error) — ctx luôn có
	// vì Root là cha trực tiếp; handler tự guard `!ctx`.
	const ctx = getAlertDialogContext();

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'alert-dialog-action',
			`color-${color}`,
			disabled ? 'disabled' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	function handleClick(e: MouseEvent) {
		// Prop onclick của user chạy TRƯỚC (tương quan với event ngoài).
		onClick?.(e);
		if (disabled || !ctx) return;
		e.stopPropagation();
		// onselect = tác vụ confirm ("đã chọn Xóa") — chạy TRƯỚC khi close.
		onSelect?.();
		ctx.close();
	}
</script>

<button
	type="button"
	class={styleDerived}
	data-ad-action
	disabled={disabled || undefined}
	onclick={handleClick}
	{...props}
>
	{@render children?.()}
</button>

<style lang="scss">
	.alert-dialog-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		min-height: 2.375rem;
		padding: 0 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		font-family: inherit;
		line-height: 1;
		border: none;
		border-radius: var(--border-radius-md, 0.375rem);
		cursor: pointer;
		user-select: none;
		// Transition ngắn (khác component Button — alert-dialog tự chủ).
		transition: background-color 150ms cubic-bezier(0.65, 0, 0.35, 1);

		// DANGER (mặc định): nền --danger, text white, hover --danger-600.
		&.color-danger {
			background: var(--danger, hsl(0 72% 51%));
			color: hsl(0 0% 100%);

			@media (hover: hover) and (pointer: fine) {
				&:hover:not(.disabled) {
					background: var(--danger-600, var(--danger));
				}
			}
		}

		// PRIMARY (variant info): nền --primary.
		&.color-primary {
			background: var(--primary, hsl(243 75% 59%));
			color: hsl(0 0% 100%);

			@media (hover: hover) and (pointer: fine) {
				&:hover:not(.disabled) {
					opacity: 0.9;
				}
			}
		}

		// DEFAULT (trung tính): nền --content2, text --foreground.
		&.color-default {
			background: var(--content2, hsl(240 4.8% 96%));
			color: var(--foreground);

			@media (hover: hover) and (pointer: fine) {
				&:hover:not(.disabled) {
					opacity: 0.85;
				}
			}
		}

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, hsl(241 100% 68.6%));
			outline-offset: 2px;
		}

		&.disabled {
			opacity: var(--disabled-opacity, 0.5);
			pointer-events: none;
			cursor: var(--cursor-disabled, not-allowed);
		}
	}
</style>
