<script lang="ts">
	import { convertToMiliseconds, styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { onMount, onDestroy } from 'svelte';
	import type { ToastConfigs, ToastProps } from './_interface';
	import { getToastWrapperContext } from './Wrapper';
	import { handleEvents } from '$modules/_attachments';
	import { SvelteMap } from 'svelte/reactivity';
	import { fly } from 'svelte/transition';
	import { setToastContext } from '.';
	import { omit } from 'es-toolkit';

	let { children, ...props }: ToastProps = $props();
	let configs: ToastConfigs = $state({
		status: {},
		get id() {
			return props.id;
		},
		get disabled() {
			return toastWrapperContext?.disabled ?? props.disabled;
		},
		get color() {
			return props.color ?? 'default';
		},
		get size() {
			return props.size ?? toastWrapperContext?.size ?? client.browser?.size ?? 'md';
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'toast-root',
				`color-${this.color}`,
				`size-${this.size}`,
				this.disabled ? 'disabled' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get duration() {
			if (props.duration == 'infinite') return 'infinite';
			// Mặc định auto-dismiss 3s (design). Dev truyền duration cụ thể để ghi đè.
			return convertToMiliseconds(props.duration) ?? 3000;
		},
		get offset() {
			return props.offset ?? 10;
		},
		get position() {
			return props.position ?? 'bottom';
		},
		// assertive cho success/error (urgent), polite cho còn lại (info/warning/default).
		get liveRole() {
			return this.color == 'success' || this.color == 'error' ? 'alert' : 'status';
		},
		get ariaLive() {
			return this.color == 'success' || this.color == 'error' ? 'assertive' : 'polite';
		},
		get flyTransition() {
			const base = omit(client.browser?.transition?.fly ?? {}, ['x']);
			if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
				return { ...base, duration: 0 };
			}
			return base;
		},
		get event() {
			const defaultEvents: ToastConfigs['event'] = [
				{
					events: {
						load(_, data) {
							if (
								client.browser?.toasts?.children &&
								data?.node instanceof HTMLElement &&
								client.browser.toasts.ref &&
								props.id
							) {
								if (!configs.timeId) configs.timeId = new SvelteMap();
								const timeName = 'processingDuration';
								const startAt = performance.now();
								// Elapsed-based auto-dismiss: chỉ cộng dồn thời gian KHI KHÔNG hover
								// (configs.status.hover do mouseenter/mouseleave set) → hover toast
								// (hoặc cả group) PAUSE timer, mouse rời chạy tiếp.
								let lastTick = startAt;
								let elapsed = 0;
								const currentIndex = [...client.browser.toasts.ref.children].findIndex((children) =>
									children.isSameNode(data.node as Node)
								);
								const initValue = client.browser.toasts.children.get(props.id);
								if (initValue) {
									// width/height: đo bằng offsetWidth/offsetHeight (layout size — KHÔNG
									// bị transform scale ảnh hưởng như getBoundingClientRect) để Wrapper
									// tính bước dịch khi hover-expand (mỗi toast full nguyên bản).
									client.browser.toasts.children.set(props.id, {
										...initValue,
										ref: data.node,
										position: configs.position,
										offset: configs.offset,
										width: (data.node as HTMLElement).offsetWidth,
										height: (data.node as HTMLElement).offsetHeight
									});
								}

								if (typeof configs.duration == 'number') {
									const processingDuration = () => {
										if (configs.duration == 'infinite') return;
										const currentTime = performance.now();
										if (!configs.status.hover) {
											elapsed += currentTime - lastTick;
										}
										lastTick = currentTime;
										if (elapsed >= configs.duration) {
											if (client.browser?.toasts?.remove && props.id) {
												client.browser.toasts.remove(props.id);
											}
										} else {
											if (!configs.timeId) configs.timeId = new SvelteMap();
											configs.timeId.set(timeName, requestAnimationFrame(processingDuration));
										}
									};
									configs.timeId.set(timeName, requestAnimationFrame(processingDuration));
								}
							}
						},
						mouseenter() {
							configs.status.hover = true;
							configs.status.groupHover = true;
							// Hover-expand group: báo Wrapper (qua context) để toàn bộ toast cùng
							// position EXPAND thẳng hàng. Gửi id để Wrapper track per-toast
							// (mouseleave A bắn trước mouseenter B khi di chuột A→B).
							toastWrapperContext?.setGroupHover?.(true, configs.id);
						},
						mouseleave() {
							configs.status.hover = false;
							configs.status.groupHover = false;
							// Mouse rời toast: Wrapper delay collapse 150ms (chống flicker khi chuột
							// đi qua khoảng trống giữa các toast đang expand).
							toastWrapperContext?.setGroupHover?.(false, configs.id);
						}
					}
				}
			];
			const propEvents = props.events ?? [];
			return [...defaultEvents, ...propEvents];
		}
	});
	const toastWrapperContext = getToastWrapperContext();
	setToastContext(configs);

	// Toast bị XÓA khi đang hover (click X, auto-dismiss khi hover-paused) KHÔNG bắn
	// mouseleave → release hover tại đây (chống group kẹt expanded vĩnh viễn).
	onDestroy(() => {
		if (configs.status.groupHover) {
			toastWrapperContext?.releaseGroupHover?.(configs.id);
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	transition:fly={configs.flyTransition}
	role={configs.liveRole}
	aria-live={configs.ariaLive}
	data-position={configs.position}
	style:--offset={`${configs.offset}px`}
	{@attach handleEvents(configs.event)}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	@use '$styles/sizes.scss';
	.toast-root {
		&[data-position='bottom'],
		&[data-position='top'] {
			transform: translateX(-50%);
			left: 50%;
		}
		&[data-position='bottom'] {
			bottom: var(--offset);
		}
		&[data-position='top'] {
			top: var(--offset);
		}
		&[data-position='left'],
		&[data-position='right'] {
			top: 50%;
			transform: translateY(-50%);
		}
		&[data-position='left'] {
			left: var(--offset);
		}
		&[data-position='right'] {
			right: var(--offset);
		}
		&.disabled {
			--cursor: not-allowed;
		}
		display: flex;
		/* Căn dọc: icon (Indicator) + Content + action button cùng trục giữa — mặc định
		   stretch làm Indicator div stretch full mà svg nằm đỉnh (lệch title). */
		align-items: center;
		cursor: var(--cursor);
		backdrop-filter: blur(10px);
		border-radius: var(--border-radius);
		width: fit-content;
		height: fit-content;
		padding-inline: var(--padding);
		padding-block: calc(var(--padding) / 4);
		background: var(--background);
		color: var(--foreground);
		/* Elevation: --shadow-color không được define trong theme hiện tại → token
		   --box-shadow-md resolve 'none' (toast trắng nền trắng vô hình trừ text).
		   Dùng literal (pattern tooltip Content — ĐẠT ui-checker) + border lộ viền. */
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.18),
			0 2px 4px rgba(0, 0, 0, 0.1);
		border: 1px solid var(--border-color, var(--border, rgba(0, 0, 0, 0.08)));
		/* Hover-expand group: transition transform (không top/right/bottom/left — px nhảy).
		   CSS transition hoạt động cùng WAAPI fly transition (Svelte 5) vì fly chỉ chạy
		   intro lúc mount rồi abort — sau đó inline transform thay đổi được transition mượt. */
		transition: transform 200ms ease;
	}
	/* Reduced-motion: bỏ transition transform (hover expand/collapse tức thì). */
	@media (prefers-reduced-motion: reduce) {
		.toast-root {
			transition: none;
		}
	}
</style>