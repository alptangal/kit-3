<script lang="ts">
	import { defaultContainer } from './_default';
	import type { ContainerConfigs, ContainerProps } from './_interface';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { onDestroy } from 'svelte';
	import MessageComponent from '$components/element/messageComponent/MessageComponent.svelte';
	import type { TranslateContent } from '$interfaces/basic';
	import { setContainerContext } from '.';
	import { fly } from 'svelte/transition';

	const NAME_COMP: TranslateContent = {
		vi: 'Container',
		get en() {
			return this.vi;
		}
	};
	const MESSAGE_ERRORS = {
		main: {
			vi: 'chưa có nội dung',
			en: 'No data'
		} as TranslateContent
	};

	// === VisualViewport keyboard handling (mobile) ===
	// Safari iOS KHÔNG hỗ trợ meta `interactive-widget` → keyboard mở nhưng layout viewport
	// KHÔNG co (dvh giữ nguyên) → input focus bị che. Chrome 108+ co layout sẵn (meta đủ).
	// Handler này set CSS var `--vvh` (chiều cao visual viewport — phần KHÔNG bị keyboard
	// che) + class `keyboard-open` trên <html> để CSS điều chỉnh (vd: thu padding, giữ
	// action bar trên keyboard). Chỉ chạy khi visualViewport tồn tại (client-side).
	// Cleanup qua onDestroy — Svelte 5 component destroy.
	let keyboardOpen = $state(false);
	let vvh = $state<number | undefined>(undefined);
	if (typeof window !== 'undefined' && window.visualViewport) {
		const vv = window.visualViewport;
		const syncViewport = () => {
			// Keyboard mở: visual viewport co (~60% gốc). Ngưỡng 150px loại trừ resize
			// nhỏ (rotation, URL bar thu/mở trên Safari chỉ chênh ~60-100px).
			const isOpen = window.innerHeight - vv.height > 150;
			keyboardOpen = isOpen;
			vvh = vv.height;
			document.documentElement.classList.toggle('keyboard-open', isOpen);
			document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
		};
		vv.addEventListener('resize', syncViewport);
		vv.addEventListener('scroll', syncViewport);
		syncViewport();
		onDestroy(() => {
			vv.removeEventListener('resize', syncViewport);
			vv.removeEventListener('scroll', syncViewport);
			document.documentElement.classList.remove('keyboard-open');
			document.documentElement.style.removeProperty('--vvh');
		});
	}

	let { children, ...props }: ContainerProps = $props();
	let configs: ContainerConfigs = $state({
		get duration() {
			let d = props.transitionDuration ?? client.browser?.duration ?? 300;
			d = typeof d == 'number' ? d : parseFloat(d);
			return d;
		},
		ref: undefined as undefined | HTMLElement,
		get event() {
			const defaultEvents = [
				{
					events: {
						load: {
							handler() {
								if (props.portal) {
									if (props.portal instanceof HTMLElement && configs.ref) {
										// appendChild: @types/node override Body.append đè ParentNode.append
										props.portal.appendChild(configs.ref);
									} else {
										const portal = document.getElementById(props.portal as string);
										if (portal && configs.ref) {
											portal.appendChild(configs.ref);
										}
									}
								}
							},
							options: {}
						},
						click: {
							handler() {},
							options: {
								delay: 3000
							}
						}
					}
				}
			];
			return [...defaultEvents, ...(props.events ?? [])];
		}
	});
	setContainerContext({
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		}
	});

	onDestroy(() => {
		if (props.portal && configs.ref) {
			if (props.portal instanceof HTMLElement) {
				props.portal.removeChild(configs.ref);
			} else {
				const portal = document.getElementById(props.portal as string);
				if (portal && portal.contains(configs.ref)) {
					portal.removeChild(configs.ref);
				}
			}
		}
	});

	export { configs, keyboardOpen };

	// Safe-area height (viewport-fit=cover): height number + prop safeArea → bọc
	// `calc(h - env(inset-top) - env(inset-bottom))`. Body padding env (theme.scss)
	// đẩy Container vào vùng an toàn → height trừ env giữ tổng = viewport khả dụng,
	// Container root KHÔNG tràn khi có notch/tai tai. Chỉ bật ở Container root layout.
	const safeAreaHeight = $derived.by(() => {
		if (!props.safeArea || typeof props.height !== 'number') return undefined;
		return `calc(${props.height}px - env(safe-area-inset-top) - env(safe-area-inset-bottom))`;
	});
</script>

{#if children}
	<svelte:element
		this={props.as ?? 'div'}
		{@attach handleEvents(configs.event)}
		bind:this={configs.ref}
		class={props.overwriteDefaultStyles
			? props.class
			: [
					...(typeof defaultContainer.class == 'object'
						? (defaultContainer.class ?? [])
						: typeof defaultContainer.class == 'string'
							? [defaultContainer.class]
							: []),
					...(typeof props.class == 'object'
						? (props.class ?? [])
						: typeof props.class == 'string'
							? [props.class]
							: [])
				]}
		style:touch-action={props.touchActionDisabled ? 'none' : 'auto'}
		style:width={typeof props.width == 'number' ? `${props.width}px` : (props.width ?? 'auto')}
		style:height={safeAreaHeight ?? (typeof props.height == 'number' ? `${props.height}px` : (props.height ?? 'auto'))}
		style:transition-duration="var(--transition-duration)"
		style:--transition-duration={props.transitionEnabled ? `${configs.duration}ms` : undefined}
		transition:fly={client.browser?.transition?.fly}
	>
		{@render children()}
	</svelte:element>
{:else}
	<MessageComponent
		nameComponent={NAME_COMP[client.browser?.language ?? 'en'] ?? ''}
		color="danger"
		description={MESSAGE_ERRORS.main[client.browser?.language ?? 'en'] ?? ''}
	/>
{/if}
