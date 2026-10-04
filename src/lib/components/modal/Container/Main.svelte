<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { getModalContext } from '../useModalContext.svelte';
	import { setModalContainerContext } from '../useModalContext.svelte';
	import { releaseModalHeader } from '.';
	import type { ModalContainerConfigs, ModalContainerProps } from '../_interface';

	let { children, ...props }: ModalContainerProps = $props();
	const modalContext = getModalContext();
	let configs: ModalContainerConfigs = $state({
		get size() {
			return props.size ?? modalContext?.size ?? client.browser?.size ?? 'md';
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'modal-container-root',
				`size-${this.size}`,
				`placement-${this.placement}`,
				// Header/Footer tự có padding nội tại → block padding của container
				// chỉ còn ý nghĩa khi KHÔNG có component đó (flush → nội dung chạm
				// sát mép, không còn dải nền thừa khi body cuộn).
				this.children.header ? 'flush-top' : undefined,
				this.children.footer ? 'flush-bottom' : undefined,
				// Scroll nằm ở Body (`.modal-body-root` overflow-y: auto) →
				// container chỉ là flex column, không scroll. Fallback: modal
				// KHÔNG có Body (legacy auto-wrap) → container tự scroll.
				this.children.body ? undefined : 'scroll-self'
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get placement() {
			return props.placement ?? modalContext?.placement ?? 'center';
		},
		children: {} as ModalContainerConfigs['children']
	});
	if (modalContext) {
		modalContext.children.container = configs;
	}
	setModalContainerContext(configs);

	// Keep header as first child for proper visual/semantic order (requirement #8)
	$effect(() => {
		const headerRef = configs.children.header?.ref;
		if (headerRef && configs.ref && configs.ref.firstChild !== headerRef) {
			configs.ref.insertBefore(headerRef, configs.ref.firstChild);
		}
	});

	// Move content-wrapper children into container on mount (legacy auto-wrap compat)
	onMount(() => {
		if (
			modalContext?.children.contentWrapper &&
			configs.ref &&
			configs.ref.parentElement !== modalContext.children.contentWrapper
		) {
			while (
				modalContext.children.contentWrapper.firstChild &&
				modalContext.children.contentWrapper.firstChild !== configs.ref
			) {
				configs.ref.appendChild(modalContext.children.contentWrapper.firstChild);
			}
		}
	});

	onDestroy(() => {
		if (modalContext?.children.container === configs) {
			modalContext.children.container = undefined;
		}
	});
</script>

<svelte:element this={props.as ?? 'div'} bind:this={configs.ref} class={configs.style}>
	<span class="modal-sheet-handle" aria-hidden="true"></span>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	@use '$styles/sizes.scss';
	.modal-container-root {
		position: relative;
		background: var(--default-200, #18181b);
		border-radius: var(--border-radius, 1rem);
		padding: var(--padding, 1.25rem);
		width: var(--width, 32rem);
		max-width: calc(100vw - 2rem);
		max-height: calc(100dvh - 2.5rem);
		// Layout: flex column → Header/Body/Footer là flex siblings đứng yên.
		// Scroll-container là `.modal-body-root` (Body overflow-y: auto) →
		// scrollbar cao ĐÚNG vùng body (cạnh dưới header → cạnh trên footer),
		// không kéo dài qua header/footer như khi container tự scroll.
		// overflow: hidden để nội dung body tràn (trước khi body nhận
		// overflow) không tạo scrollbar trên container; chỉ fallback
		// `.scroll-self` (không có Body) mới cho container tự scroll.
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		box-shadow:
			0 25px 50px -12px rgba(0, 0, 0, 0.6),
			0 0 0 1px rgba(255, 255, 255, 0.1);
		z-index: 10001;

		// Header/Footer tự có padding nội tại → block padding của container chỉ
		// còn ý nghĩa khi KHÔNG có component đó (flush → body chạm sát mép,
		// không dư dải nền lộ ra khi body cuộn). Horizontal giữ nguyên.
		&.flush-top {
			padding-top: 0;
		}
		&.flush-bottom {
			padding-bottom: 0;
		}

		// Fallback: modal KHÔNG có `<Modal.Container.Body>` (legacy auto-wrap
		// content vào container) → không có body scroll-container → container
		// tự giữ `overflow-y: auto` để content dài vẫn cuộn được.
		&.scroll-self {
			overflow-y: auto;
		}

		&.placement-center {
			margin: auto;
		}
		&.placement-top {
			margin: 2rem auto auto auto;
		}
		&.placement-bottom {
			margin: auto auto 2rem auto;
		}

		/* Drag handle: hidden everywhere except the mobile bottom-sheet */
		.modal-sheet-handle {
			display: none;
		}

		&.size-xs { width: 20rem; }
		&.size-sm { width: 24rem; }
		&.size-md { width: 32rem; }
		&.size-lg { width: 40rem; }
		&.size-xl { width: 48rem; }
		&.size-2xl { width: 56rem; }
		&.size-3xl { width: 64rem; }
		&.size-4xl { width: 72rem; }
		&.size-5xl { width: 80rem; }
		&.size-6xl { width: 88rem; }
		&.size-7xl { width: 96rem; }
		&.size-8xl { width: 104rem; }
		&.size-9xl { width: 112rem; }
		&.size-full {
			width: 100%;
			max-width: none;
			max-height: none;
			height: 100%;
			border-radius: 0;
		}

		// ── Multi-layer (iOS-style) ──
		// Logic (index/scale) do JS trong Modal/Main.svelte tính rồi gán vào
		// CSS variables dưới đây; thể hiện (transform/filter/transition) nằm
		// ở CSS để theme override được + đồng bộ duration (không rải inline).
		// opacity LUÔN áp (kể cả reduced-motion) để user vẫn nhận ra có layer
		// phía dưới; scale/blur + transition chỉ khi có class `.has-motion`
		// (JS bỏ class khi prefers-reduced-motion → không có motion).
		--layer-scale: 1;
		--layer-blur: 0px;
		--layer-opacity: 1;
		opacity: var(--layer-opacity);

		&.has-motion {
			transform: scale(var(--layer-scale));
			transform-origin: center;
			filter: blur(var(--layer-blur));
			transition:
				transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
				filter 0.3s ease,
				opacity 0.3s ease;
		}

		// WCAG 2.3.3: reduced-motion → tắt hẳn animation đổi layer.
		@media (prefers-reduced-motion: reduce) {
			&.has-motion {
				transition: none;
			}
		}
	}

	// Mobile bottom-sheet: `placement="bottom"` becomes a full-width sheet pinned to the bottom.
	// Desktop keeps the centered/top/bottom offset behavior above.
	@media (hover: none) and (pointer: coarse) {
		.modal-container-root.placement-bottom {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			width: 100%;
			max-width: none;
			max-height: 85dvh;
			margin: 0;
			border-radius: var(--border-radius, 1rem) var(--border-radius, 1rem) 0 0;

			.modal-sheet-handle {
				display: block;
				width: 3rem;
				height: 0.375rem;
				margin: 0.375rem auto 0;
				border-radius: 9999px;
				background: rgba(255, 255, 255, 0.35);
				pointer-events: none;
			}
		}
	}
</style>
