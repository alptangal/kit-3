<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { client } from '$store/basic.svelte';
	import { handleEvents } from '$modules/_attachments';
	import { styleSynced } from '$modules';
	import {
		setModalContext,
		createModalPortal,
		generateModalId,
		resolveTransition,
		modalTransition,
		prefersReducedMotion,
		getFocusableElements,
		isTopLayer,
		incrementModalScrollLock,
		decrementModalScrollLock,
		saveBodyScrollStyles,
		restoreBodyScrollStyles,
		incrementUnderlyingScale,
		decrementUnderlyingScale,
		getModalRootElement
	} from './useModalContext.svelte';
	import { releaseModalContainter } from './utils';
	import type { ModalCloseReason, ModalConfigs, ModalProps } from './_interface';

	let { children, display = $bindable(), ...props }: ModalProps = $props();

	// Reason gốc của lần đóng (đặt đồng bộ ngay tại điểm đóng: ESC/backdrop/×/
	// programmatic) → $effect edge-triggered bên dưới đọc khi display flip.
	// Không reactive: chỉ cần sống qua 1 microtask (flip display → effect chạy).
	let closeReason: ModalCloseReason | null = null;

	// Unique IDs for ARIA (requirement #2) — stored in configs so Header/Body can reference
	const ariaIds = {
		modalId: generateModalId('modal'),
		headerId: generateModalId('modal-header'),
		bodyId: generateModalId('modal-body'),
		footerId: generateModalId('modal-footer')
	};

	let configs: ModalConfigs = $state({
		_display: undefined as undefined | boolean,
		get display() {
			return this._display;
		},
		set display(v) {
			this._display = v;
			display = v;
		},
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		get placement() {
			return props.placement ?? 'center';
		},
		get variant() {
			return props.variant ?? 'blur';
		},
		get isDimissable() {
			return props.isDimissable ?? true;
		},
		get preventOutsideClose() {
			return props.preventOutsideClose ?? false;
		},
		get transitionType() {
			return (props.transitionType as ModalConfigs['transitionType']) ?? 'fly';
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'modal-root',
				`size-${this.size}`,
				`variant-${this.variant}`,
				// Visual cue (C1): user cần "cảm nhận" được modal "đóng cứng"
				// khi backdrop không đóng → đổi cursor + giữ hint ESC trong
				// Header. Không dùng cursor: pointer vì click backdrop
				// KHÔNG có effect.
				this.preventOutsideClose ? 'prevent-outside-close' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get event() {
			const defaultEvents = [
				{
					events: {
						load(_evt: unknown, data: unknown) {
							const node = (data as { node?: unknown })?.node;
							if (node instanceof HTMLElement) {
								const portal = createModalPortal(node);
								(configs as unknown as Record<string, unknown>)._portalDestroy = portal.destroy;
								// Activate focus trap after portal mount
								requestAnimationFrame(() => activateFocusTrap());
							}
							return () => {
								deactivateFocusTrap(false);
								const destroy = (configs as unknown as Record<string, unknown>)._portalDestroy as
									| (() => void)
									| undefined;
								destroy?.();
							};
						},
						mousedown(e: unknown) {
							const event = e as MouseEvent;
							const target = event.target as HTMLElement;
							// preventOutsideClose: user muốn modal "đóng cứng" —
							// click ra ngoài (backdrop) KHÔNG được đóng. ESC + nút ×
							// vẫn hoạt động (điều khiển bởi isDimissable, độc lập).
							if (configs.isDimissable && !configs.preventOutsideClose) {
								if (target === configs.ref || !configs.children.container?.ref?.contains(target)) {
									// Only top layer responds to backdrop click
									if (!isTopLayer(configs.ref)) return;
									closeReason = 'backdrop';
									configs.display = false;
								}
							}
						}
					}
				}
			] as unknown as ModalProps['events'];
			return [...(defaultEvents ?? []), ...(props.events ?? [])];
		},
		children: {},
		ariaIds
	});

	// Internal bridge cho Header (nút ×): đóng kèm reason 'close-button'.
	// Đặt closeReason TRƯỚC khi flip display (đồng bộ) → $effect edge-triggered
	// bên dưới đọc đúng reason khi display đổi.
	configs.closeByReason = (reason: ModalCloseReason) => {
		closeReason = reason;
		display = false;
	};

	// ------------------------------------------------------------------
	// Focus trap (requirement #1)
	// ------------------------------------------------------------------
	let triggerElement: HTMLElement | null = null;
	let trapCleanup: (() => void) | null = null;

	function activateFocusTrap() {
		if (!configs.ref || typeof document === 'undefined') return;
		// Save trigger to restore on close
		triggerElement = document.activeElement as HTMLElement | null;

		// Respect autoFocus === false: keep current focus, only install the trap
		if (props.autoFocus === false) {
			installTabTrap();
			return;
		}

		// initialFocus selector wins over the "first focusable" default
		let initial: HTMLElement | null = null;
		if (props.initialFocus) {
			initial = configs.ref.querySelector<HTMLElement>(props.initialFocus);
		}
		if (!initial) {
			const focusables = getFocusableElements(configs.ref);
			initial = focusables[0] ?? null;
		}
		if (initial) {
			initial.focus();
		} else {
			// Make container focusable and focus it
			if (!configs.ref.hasAttribute('tabindex')) configs.ref.setAttribute('tabindex', '-1');
			configs.ref.focus();
		}

		installTabTrap();
	}

	function installTabTrap() {

		const handleTab = (e: KeyboardEvent) => {
			if (e.key !== 'Tab') return;
			if (!isTopLayer(configs.ref)) return;
			const els = getFocusableElements(configs.ref!);
			if (!els.length) return;
			const first = els[0];
			const last = els[els.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};

		configs.ref?.addEventListener('keydown', handleTab);
		trapCleanup = () => configs.ref?.removeEventListener('keydown', handleTab);
	}

	function deactivateFocusTrap(restore = true) {
		trapCleanup?.();
		trapCleanup = null;
		if (restore && triggerElement && typeof triggerElement.focus === 'function') {
			// Only restore if focus is still inside modal or on body
			try {
				triggerElement.focus();
			} catch {
				/* ignore */
			}
		}
		triggerElement = null;
	}

	// Restore focus when display becomes false (covers programmatic close + backdrop + Escape)
	$effect(() => {
		if (!display && triggerElement) {
			// Delay to let transition finish before restoring
			const t = setTimeout(() => deactivateFocusTrap(true), 0);
			return () => clearTimeout(t);
		}
	});

	// ------------------------------------------------------------------
	// Body scroll lock (requirement: page under a modal must not scroll)
	// + Scale zoom-out cho layout NẰM DƯỚI modal (`.layer` = Container root
	// của +layout.svelte, modal portal được append vào đó): khi modal mở,
	// layout co lại 4% (scale 0.96) để modal nổi bật — hiệu ứng iOS.
	// Counter-based so nested modals only apply/release on first open /
	// last close. Counter + style cũ lưu ở module scope (không reactive)
	// — tránh "effect reads and writes the same state" trên client.browser.
	// Dependency reactive duy nhất: `display`.
	// ------------------------------------------------------------------
	$effect(() => {
		if (!display || typeof document === 'undefined') return;
		const count = incrementModalScrollLock();
		const scaleCount = incrementUnderlyingScale();
		let scaleTimer: ReturnType<typeof setTimeout> | undefined;
		if (count === 1) {
			const body = document.body;
			// Save original styles (module) + offset the scrollbar to prevent layout shift
			saveBodyScrollStyles();
			const scrollbarWidth = window.innerWidth - body.clientWidth;
			body.style.overflow = 'hidden';
			if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
		}
		if (scaleCount === 1) {
			// Layout NẰM DƯỚI modal = nút 'root' trong client.browser.layers
			// (Container của +layout.svelte). Modal portal là EM của nó →
			// scale nút này KHÔNG ảnh hưởng modal (chỉ co layout phía sau).
			// untrack: KHÔNG được reactive-read layers (SvelteMap) trong body
			// effect — portal mount sau display flip sẽ layers.set → effect
			// re-run → cleanup xóa class vừa gắn. Root đã register từ layout
			// load (trước khi modal mở) → đọc 1 lần là đủ; dependency duy
			// nhất = `display`.
			const root = untrack(() => getModalRootElement());
			if (root) {
				// Class LUÔN được add ở cả 2 nhánh (transform: scale(var(...))
				// sống trong .modal-underlying-scale — không class = không
				// transform, dù biến đã gán). Reduced-motion (WCAG 2.3.3)
				// không tắt hiệu ứng mà chỉ tắt TRANSITION (media query trong
				// app.css: .modal-underlying-scale { transition: none }) →
				// layout co lại NHẢY (instant), user không thấy motion.
				// Nhánh normal: chờ 120ms trước khi gán biến để tránh nhảy
				// kích thước snapshot giữa view-transition (chuyển trang →
				// modal mở gần như đồng thời).
				root.classList.add('modal-underlying-scale');
				if (prefersReducedMotion()) {
					root.style.setProperty('--modal-underlying-scale', '0.96');
				} else {
					scaleTimer = setTimeout(
						() => root.style.setProperty('--modal-underlying-scale', '0.96'),
						120
					);
				}
			}
		}
		return () => {
			const c = decrementModalScrollLock();
			if (c === 0) restoreBodyScrollStyles();
			if (scaleTimer) clearTimeout(scaleTimer);
			const sc = decrementUnderlyingScale();
			if (sc === 0) {
				const root = getModalRootElement();
				if (root) {
					// Bỏ scale trở về 1 — transition của .modal-underlying-scale
					// sẽ chạy ngược lại; modal đóng có transition 300ms nên thời
					// điểm này overlay vẫn còn → user thấy layout "phóng to"
					// đồng thời modal bay đi. Delay 60ms: đặt SAU khi modal
					// bắt đầu đóng (sau 1 frame) để tránh chập hai animation
					// cùng thời điểm.
					setTimeout(() => {
						root.style.removeProperty('--modal-underlying-scale');
						root.classList.remove('modal-underlying-scale');
					}, 60);
				}
			}
		};
	});

	// ------------------------------------------------------------------
	// ESC-to-close — gắn trên `document` (KHÔNG trên .modal-root).
	// Lý do: focus có thể rơi ra ngoài modal (vd. click backdrop khi
	// preventOutsideClose) → event keydown không bubble lên .modal-root,
	// nên ESC sẽ bị "chìm". Trên document thì luôn bắt được.
	// Chỉ modal mở + top-layer + dismissable xử lý → modal lồng nhau đúng thứ tự.
	// ------------------------------------------------------------------
	$effect(() => {
		if (!display || !configs.isDimissable || typeof document === 'undefined') return;
		const onKeydown = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			if (!isTopLayer(configs.ref)) return;
			e.stopPropagation();
			closeReason = 'escape';
			configs.display = false;
		};
		document.addEventListener('keydown', onKeydown);
		return () => document.removeEventListener('keydown', onKeydown);
	});

	// ------------------------------------------------------------------
	// Open / close callbacks (fire only on real state change)
	// ------------------------------------------------------------------
	let wasDisplay = $state(!!display);
	$effect(() => {
		const now = !!display;
		if (now !== wasDisplay) {
			if (now) {
				props.onOpen?.();
			} else {
				// closeReason đặt đồng bộ tại điểm đóng (ESC/backdrop/×);
				// null → code bên ngoài set display = false → 'programmatic'.
				const reason = closeReason ?? 'programmatic';
				closeReason = null;
				props.onClose?.(reason);
				if (reason === 'escape') props.onCloseByEscape?.();
				else if (reason === 'backdrop') props.onCloseByBackdrop?.();
				else if (reason === 'close-button') props.onCloseByButton?.();
				else props.onCloseByProgrammatic?.();
			}
			wasDisplay = now;
		}
	});

	// ------------------------------------------------------------------
	// Multi-layer stacking (iOS-style): modal on top = scale 1, no blur;
	// modals below (by open order) get progressively smaller + blurrier,
	// so the user can still "count" how many layers are beneath.
	// Applies to ALL modal sizes (previously only size="full").
	// We transform `.modal-container-root` (the panel), not `.modal-root`
	// (the full-viewport backdrop) — backdrop stays full-viewport so the
	// dark overlay doesn't shrink away.
	// Effect reads `client.browser.layers` (reactive SvelteMap) so it
	// re-runs on every layer change (open/close nested modal).
	// ------------------------------------------------------------------
	$effect(() => {
		if (typeof document === 'undefined') return;
		const layers = client.browser?.layers;
		if (!layers || layers.size <= 1) return;

		const sorted = [...layers.entries()]
			.filter((e): e is [HTMLElement, number] => e[1] !== 'root')
			.sort((a, b) => (b[1] as number) - (a[1] as number));

		const SCALE_STEP = 0.08; // each layer below is 8% smaller
		const BLUR_STEP = 1.5; // each layer below gains 1.5px blur
		const OPACITY_STEP = 0.12; // each layer below loses 12% opacity
		const MIN_SCALE = 0.64;
		const MIN_OPACITY = 0.4;
		// CSS dưới Container đã hiện diện mọi thuộc tính (opacity/scale/blur +
		// transition). JS chỉ gán CSS variables + toggle class `.has-motion`.
		// reduced-motion (WCAG 2.3.3): bỏ class → không scale/blur/transition;
		// opacity vẫn áp (opacity là static, không phải motion).
		const hasMotion = !prefersReducedMotion();

		sorted.forEach(([root, _ts], i) => {
			const panel = root.querySelector<HTMLElement>('.modal-container-root');
			if (!panel) return;
			const opacity = i === 0 ? 1 : Math.max(MIN_OPACITY, 1 - i * OPACITY_STEP);
			panel.style.setProperty('--layer-opacity', String(opacity));
			if (i === 0) {
				// Top layer: scale 1 / blur 0 / opacity 1 — không co, không mờ.
				panel.style.setProperty('--layer-scale', '1');
				panel.style.setProperty('--layer-blur', '0px');
				// Bỏ motion nếu chỉ còn 1 layer (không còn "peel").
				panel.classList.toggle('has-motion', false);
				return;
			}
			panel.style.setProperty('--layer-scale', String(Math.max(MIN_SCALE, 1 - i * SCALE_STEP)));
			panel.style.setProperty('--layer-blur', (i * BLUR_STEP).toFixed(1) + 'px');
			panel.classList.toggle('has-motion', hasMotion);
		});
	});

	setModalContext(configs);

	// Auto-container creation when children are not wrapped in Modal.Container
	let autoContainer: (() => void) | undefined;

	$effect(() => {
		if (!configs.children.container && configs.ref && children) {
			const cleanup = releaseModalContainter(configs);
			if (cleanup) autoContainer = cleanup;
		}
	});
	$effect(() => {
		if (!display && autoContainer) {
			autoContainer();
			autoContainer = undefined;
			configs.children.container = undefined;
			configs.ref = undefined;
		}
	});

	onMount(() => {
		configs.display = display;
	});

	onDestroy(() => {
		autoContainer?.();
		deactivateFocusTrap(false);
		const destroy = (configs as unknown as Record<string, unknown>)._portalDestroy as
			| (() => void)
			| undefined;
		destroy?.();
	});

	let resolvedTransition = $derived(
		resolveTransition(configs.transitionType, configs.placement, client.browser?.transition)
	);
</script>

{#if display}
	<svelte:element
		this={props.as ?? 'div'}
		bind:this={configs.ref}
		class={configs.style}
		transition:modalTransition={{ ...resolvedTransition.params, type: resolvedTransition.name }}
		{@attach handleEvents(configs.event)}
		role="dialog"
		aria-modal="true"
		aria-labelledby={ariaIds.headerId}
		aria-describedby={ariaIds.bodyId}
		id={ariaIds.modalId}
	>
		<div class="contents" bind:this={configs.children.contentWrapper}>{@render children?.()}</div>
	</svelte:element>
{/if}

<style lang="scss">
	@use '$styles/sizes.scss';
	.modal-root {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100dvh;
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.65);
		box-sizing: border-box;
		padding: 1rem;
		overflow: hidden;

		&.variant-blur {
			-webkit-backdrop-filter: blur(8px);
			backdrop-filter: blur(8px);
		}

		&.variant-transparent {
			background: transparent;
		}

		&.variant-opaque {
			background: rgba(0, 0, 0, 0.8);
		}

		.contents {
			display: contents;
		}

		// Visual cue cho preventOutsideClose (C1): user cần "cảm nhận" rằng
		// click nền KHÔNG đóng modal → đổi cursor khỏi `pointer` (thông
		// thường các modal dismissable ngầm cho click nền = pointer; khi
		// "đóng cứng" thì default là đúng hơn). Header đồng thời hiển thị
		// hint "Press Esc or close to dismiss" (Header/Main.svelte).
		&.prevent-outside-close {
			cursor: default;

			.modal-container-root {
				cursor: auto;
			}
		}
	}
</style>
