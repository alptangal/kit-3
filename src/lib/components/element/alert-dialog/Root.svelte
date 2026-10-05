<script lang="ts">
	// src/lib/components/element/alert-dialog/Root.svelte
	// AlertDialog.Root — giữ state `open` (bindable) + Symbol context + focus restore
	// khi close + scroll-lock body (counter reuse từ modal, KHÔNG sửa modal).
	//
	// Khác Modal (cố ý):
	// - Không có display/size/variant/transitionType; Content tự portal qua
	//   `createModalPortal` (import helper thẳng từ modal).
	// - close() luôn trả focus về trigger (hoặc element active trước đó).
	// - Background click: Content KHÔNG gắn handler (dialog xác nhận —
	//   tránh mis-action khi user click nhầm nền).
	import { convertToMiliseconds } from '$modules';
	import { client } from '$store/basic.svelte';
	import { onDestroy } from 'svelte';
	import {
		incrementModalScrollLock,
		decrementModalScrollLock,
		saveBodyScrollStyles,
		restoreBodyScrollStyles
	} from '../../modal/useModalContext.svelte';
	import { setAlertDialogContext } from './_context';
	import type { AlertDialogConfigs, AlertDialogRootProps } from './_interface';
	import type { TranslateContent } from '$interfaces/basic';

	let {
		children,
		open = $bindable(false),
		defaultOpen,
		title,
		description,
		duration,
		...props
	}: AlertDialogRootProps = $props();

	// Element active ngay TRƯỚC khi dialog mở (trigger khi uncontrolled, hoặc
	// nút "Mở" khi controlled) — Content ghi lại lúc mount, close() trả focus về.
	let lastActive: HTMLElement | null = null;

	// Resolve TranslateContent | string theo ngôn ngữ hiện tại (fallback en → vi),
	// cùng mẫu tag/Main.svelte.
	const getText = (content?: TranslateContent | string): string => {
		if (!content) return '';
		if (typeof content === 'string') return content;
		const lang = client.browser?.language ?? 'en';
		return content[lang] ?? content.en ?? content.vi ?? '';
	};

	const rootId = `alert-dialog-${Math.random().toString(36).slice(2, 8)}`;
	const titleId = `alert-dialog-title-${Math.random().toString(36).slice(2, 8)}`;
	const descriptionId = `alert-dialog-desc-${Math.random().toString(36).slice(2, 8)}`;

	// Duration (ms): prop > 200ms (chuẩn dialog xác nhận — ngắn, gọn).
	const durationDerived = $derived(convertToMiliseconds(duration) ?? 200);

	let configs: AlertDialogConfigs = $state({
		rootId,
		titleId,
		descriptionId,
		get open() {
			return open;
		},
		setOpen(v: boolean) {
			open = v;
		},
		/** Content gọi khi mount: ghi element active trước khi focus chuyển. */
		saveLastActive(el: HTMLElement | null) {
			lastActive = el;
		},
		close() {
			open = false;
			// rAF: DOM unmount (overlay remove) xong rồi mới trả focus.
			// Guard: chỉ trả khi focus KHÔNG còn nằm trong dialog (tránh steal
			// focus trong trường hợp user đã Tab ra ngoài trước đó — hiếm).
			requestAnimationFrame(() => {
				if (typeof document === 'undefined') return;
				const active = document.activeElement;
				if (active instanceof Element && active.closest('[data-ad-overlay]')) return;
				// Ưu tiên button TRONG trigger (span trigger không focusable);
				// fallback: trigger span / element active trước khi mở.
				const target =
					document.querySelector<HTMLElement>('[data-ad-trigger] button:not([disabled])') ??
					document.querySelector<HTMLElement>('[data-ad-trigger] [tabindex]') ??
					document.querySelector<HTMLElement>('[data-ad-trigger]') ??
					lastActive;
				if (target?.isConnected && typeof target.focus === 'function') {
					try {
						target.focus();
					} catch {
						/* element detached — bỏ qua */
					}
				}
			});
		},
		get title() {
			return getText(title) || undefined;
		},
		get description() {
			return getText(description) || undefined;
		},
		get duration() {
			return durationDerived;
		},
		action: undefined as HTMLElement | undefined,
		hasTitle: false,
		hasDescription: false
	});

	// `defaultOpen` (uncontrolled) làm seed ban đầu của `open` — CHỈ LẦN ĐẦU
	// (one-shot). Flag module-level không dùng được (mỗi component instance
	// cần state riêng) → dùng local $state. Sau lần chạy đầu tiên (dù open
	// còn true hay false), flag flip false → effect sau sẽ bỏ qua. Tránh bug:
	// user close dialog mà defaultOpen vẫn true → effect re-open.
	let seededDefaultOpen = $state(false);
	$effect(() => {
		if (seededDefaultOpen) return;
		seededDefaultOpen = true;
		if (defaultOpen && !open) open = true;
	});

	// Scroll-lock body — counter DÙNG CHUNG với modal (dialog + modal cùng mở
	// vẫn chỉ lock/release 1 lần). Không làm underlying-scale (overlay đủ).
	$effect(() => {
		if (!open || typeof document === 'undefined') return;
		const count = incrementModalScrollLock();
		if (count === 1) {
			const body = document.body;
			saveBodyScrollStyles();
			const scrollbarWidth = window.innerWidth - body.clientWidth;
			body.style.overflow = 'hidden';
			if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
		}
		return () => {
			const c = decrementModalScrollLock();
			if (c === 0) restoreBodyScrollStyles();
		};
	});

	// Unmount khi đang open (navigation): trả scroll-lock cho sạch.
	onDestroy(() => {
		if (open && typeof document !== 'undefined') {
			const c = decrementModalScrollLock();
			if (c === 0) restoreBodyScrollStyles();
		}
	});

	setAlertDialogContext(configs);
</script>

<div class="alert-dialog-root" style:--ad-duration={`${durationDerived}ms`} {...props}>
	{@render children?.()}
</div>

<style lang="scss">
	.alert-dialog-root {
		display: contents;
	}
</style>
