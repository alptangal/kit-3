<script lang="ts">
	import { styleSynced } from '$modules';
	import { onMount, onDestroy } from 'svelte';
	import type { ToastWrapperConfigs, ToastWrapperProps } from '../_interface';
	import { client } from '$store/basic.svelte';
	import { browser } from '$app/environment';
	import { Button, Toast } from '$components/element';
	import { handleEvents } from '$modules/_attachments';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { setToastWrapperContext, toastWrapperRegistry } from '.';
	import * as uuid from 'uuid';

	let { ...props }: ToastWrapperProps = $props();

	// Dedup: 1 trang có thể mount NHIỀU <ToastWrapper> (global layout + demo riêng). Vì tất
	// cả cùng đọc MỘT store reactive (client.browser.toasts.children), nếu không dedup mỗi
	// toast sẽ render một lần trên MỌI wrapper. Quy tắc: wrapper có `data-test` (primary)
	// luôn render; wrapper không `data-test` (global) chỉ render khi không có primary nào.
	// → demo page: chỉ demo-wrapper render; production page: chỉ global wrapper render.
	// Chỉ đăng ký trên CLIENT (browser) để tránh leak registry qua nhiều request SSR
	// (SSR không chạy onDestroy, nên nếu register trong SSR thì stale primary tích lũy).
	const isPrimary = !!props['data-test'];
	const wrapperId = uuid.v7();
	let registered = false;
	if (browser) {
		toastWrapperRegistry.set(wrapperId, isPrimary);
		registered = true;
	}
	onDestroy(() => {
		if (registered) toastWrapperRegistry.delete(wrapperId);
	});
	const primaryCount = $derived(
		!browser
			? 0
			: [...toastWrapperRegistry.entries()].filter(([, isPrimaryWrapper]) => isPrimaryWrapper).length
	);
	// SSR: mọi wrapper đều "render" (không có toasts ở SSR nên không ảnh hưởng output).
	// Client: primary luôn render, non-primary render khi chưa có primary nào.
	const shouldRender = $derived(!browser || isPrimary || primaryCount === 0);

	let configs: ToastWrapperConfigs = $state({
		get disabled() {
			return props.disabled;
		},
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		get style() {
			const defaultStyles: (string | undefined)[] = ['toast-wrapper'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get event() {
			// (Việc append node lên <body> + claim toasts.ref nằm trong onMount — ở đó
			// store client.browser.toasts CHẮC CHẮN đã tồn tại. load-attach chạy trước
			// onMount nên không được dùng để append/claim.)
			const propEvents = props.events ?? [];
			return propEvents;
		},
		// Hover-expand group: getter lazy (thân getter chỉ chạy khi toast item đọc qua
		// context — sau khi script cha chạy xong, setGroupHover chắc chắn đã init).
		get setGroupHover() {
			return setGroupHover;
		},
		get releaseGroupHover() {
			return releaseGroupHover;
		}
	});
	setToastWrapperContext(configs);

	// ── Hover-expand group ──
	// Hover vào vùng có toast (mouseenter trên TỪNG toast, không phải wrapper — wrapper
	// là div rỗng 0×0 không nhận pointer event) → toàn bộ toast cùng position EXPAND
	// thẳng hàng (column với top/bottom, row với left/right), mỗi toast full nguyên bản
	// (scale 1, không chồng). Mouse rời (delay collapse 150ms chống flicker khi chuột
	// đi qua khoảng trống giữa các toast) → trả về stack chồng như cũ.
	// hoveredToasts: Set id của các toast đang giữ chuột (reactive) — size > 0 →
	// expanded. Dùng Set theo id (không counter) vì mouseleave toast A bắn TRƯỚC
	// mouseenter toast B khi di chuột qua A→B (counter bị drift), và vì toast bị XÓA
	// khi đang hover KHÔNG bắn mouseleave (releaseGroupHover từ destroy xử lý).
	const hoveredToasts = new SvelteSet<string>();
	const collapseTimeIds = new Map<string, ReturnType<typeof setTimeout>>();
	// setGroupHover/releaseGroupHover được toast item (Main.svelte) gọi qua wrapper context.
	const setGroupHover = (hovering: boolean, id?: string) => {
		const key = id ?? 'anonymous';
		if (hovering) {
			// Hủy collapse đang chờ của cùng toast (chuột quay lại nhanh).
			const pending = collapseTimeIds.get(key);
			if (pending) {
				clearTimeout(pending);
				collapseTimeIds.delete(key);
			}
			hoveredToasts.add(key);
		} else {
			// Delay 150ms: nếu chuột đi vào toast khác trong nhóm (mouseenter mới) thì hủy
			// collapse; nếu thực sự rời nhóm → collapse về stack chồng.
			const pending = collapseTimeIds.get(key);
			if (pending) clearTimeout(pending);
			collapseTimeIds.set(
				key,
				setTimeout(() => {
					hoveredToasts.delete(key);
					collapseTimeIds.delete(key);
				}, 150)
			);
		}
	};
	// Toast bị XÓA khi đang hover (click X, auto-dismiss) KHÔNG bắn mouseleave → gọi
	// ngay từ destroy của toast item để group không kẹt expanded.
	const releaseGroupHover = (id?: string) => {
		const key = id ?? 'anonymous';
		const pending = collapseTimeIds.get(key);
		if (pending) {
			clearTimeout(pending);
			collapseTimeIds.delete(key);
		}
		hoveredToasts.delete(key);
	};
	onDestroy(() => {
		collapseTimeIds.forEach((timeId) => clearTimeout(timeId));
	});
	const groupExpanded = $derived(shouldRender && hoveredToasts.size > 0);

	$effect(() => {
		if (!shouldRender) return;
		if (client.browser?.toasts?.children.size) {
			const positions = ['top', 'left', 'bottom', 'right'];
			positions.forEach((pos) => {
				if (!client.browser?.toasts) return;
				const childrensFiltered = [...client.browser.toasts.children.values()].filter(
					(children) => children.position == pos
				);
				const size = childrensFiltered.length;
				// groupExpanded đọc ở đây → effect re-run khi hover state đổi.
				const expanded = groupExpanded && size > 0;
				// Gap giữa các toast khi expanded (px).
				const gap = 10;
				for (const children of childrensFiltered) {
					if (children.ref) {
						positions.forEach((side) => {
							if (!children.ref) return;
							children.ref.style.removeProperty(side);
						});

						const currentIndex = childrensFiltered.findIndex((k) => k.id == children.id);
						// rank: 0 = toast MỚI NHẤT (ở mép neo), tăng dần với toast cũ hơn — cùng
						// thứ tự với stack chồng → expand/collapse KHÔNG đảo vị trí toast.
						const rank = size - 1 - currentIndex;
						const isVertical = pos == 'bottom' || pos == 'top';
						// Hướng dịch vào trong: bottom → lên (-Y), top → xuống (+Y),
						// left → phải (+X), right → trái (-X).
						const direction = pos == 'bottom' || pos == 'right' ? -1 : 1;
						const centering = isVertical ? 'translateX(-50%)' : 'translateY(-50%)';
						const axis = isVertical ? 'Y' : 'X';
						// Anchor MỘT giá trị chung cho cả nhóm ở CẢ HAI chế độ (children.offset) —
						// stagger của stack chồng cũng đặt vào transform → chuyển trạng thái thuần
						// transform (KHÔNG transition top/right/bottom/left — px nhảy).
						children.ref.style.position = 'absolute';
						children.ref.style.transformOrigin = pos;
						// `pos` là string từ array — style indexable cần cast qua unknown
						// (svelte-check: CSSStyleDeclaration không có index signature).
						(children.ref.style as unknown as Record<string, string>)[pos] = `${children.offset ?? 0}px`;
						if (expanded) {
							// EXPAND thẳng hàng: mỗi toast full nguyên bản (scale 1), xếp hàng theo
							// rank * (size + gap). Size đo FRESH từ ref (offsetWidth/Height — layout
							// size, KHÔNG bị transform scale ảnh hưởng) để đúng cả khi font load muộn.
							const step = isVertical ? children.ref.offsetHeight : children.ref.offsetWidth;
							children.ref.style.transform = `${centering} translate${axis}(${direction * rank * (step + gap)}px)`;
						} else {
							// STACK chồng nguyên trạng: scale step 5% (toast cũ nhỏ dần) + peek
							// rank * 10px qua transform (tương đương anchor stagger cũ — visual giữ
							// nguyên,verify bằng probe).
							const peek = rank * 10;
							const scale = (100 - rank * 5) / 100;
							children.ref.style.transform = `${centering} translate${axis}(${direction * peek}px) scale(${scale})`;
						}
					}
				}
			});
		}
	});

	onMount(() => {
		if (!browser) return;
		if (!client.browser) client.browser = {};
		if (!client.browser.toasts)
			client.browser.toasts = {
				children: new SvelteMap(),
				create(data) {
					const id = data.id ?? uuid.v7();
					const showCloseButton = data.showCloseButton ?? true;
					this.children.set(id, { ...data, id, showCloseButton });
					return id;
				},
				remove(key) {
					this.children.delete(key);
				}
			};
		// Chỉ wrapper SỞ HỮI (shouldRender) append node của mình lên <body> + claim
		// toasts.ref (để Main.svelte gắn ref + chạy auto-dismiss timer). Dedup bảo đảm
		// mỗi trang chỉ có MỘT owner nên chỉ một lần append; guard `!toasts.ref` thêm
		// lớp an toàn nếu hai owner mount (không xảy ra nhờ shouldRender).
		if (shouldRender && configs.ref instanceof HTMLElement && !client.browser.toasts.ref) {
			document.body.appendChild(configs.ref);
			client.browser.toasts.ref = configs.ref;
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	data-test={props['data-test']}
	{@attach handleEvents(configs.event)}
>
	{#if shouldRender}
		{#each [...(client.browser?.toasts?.children?.values() ?? [])] as children, _ (children.id)}
			<Toast
				duration={children.duration}
				id={children.id}
				position={children.position}
				color={children.color}
				offset={children.offset}
				disabled={children.disabled}
			>
				{#if children.indicator}
					<Toast.Indicator icon={children.indicator}></Toast.Indicator>
				{/if}
				<Toast.Content>
					<Toast.Content.Title>{children.title}</Toast.Content.Title>
					{#if children.description}
						<Toast.Content.Description>{children.description}</Toast.Content.Description>
					{/if}
				</Toast.Content>
				{#if children.showCloseButton}
					<Toast.Close></Toast.Close>
				{/if}
				{#if children.action}
					{@const action = children.action}
					<Button
							variant={action.variant == 'ghost' ? 'ghost' : 'solid'}
							onClick={() => action.onClick()}
							>
							{action.label}
						</Button>
				{/if}
			</Toast>
		{/each}
	{/if}
</svelte:element>

<style lang="scss">
	.toast-wrapper {
	}
</style>
