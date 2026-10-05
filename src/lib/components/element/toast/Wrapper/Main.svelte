<script lang="ts">
	import { styleSynced } from '$modules';
	import { onMount, onDestroy } from 'svelte';
	import type { ToastWrapperConfigs, ToastWrapperProps } from '../_interface';
	import { client } from '$store/basic.svelte';
	import { browser } from '$app/environment';
	import { Button, Toast } from '$components/element';
	import { handleEvents } from '$modules/_attachments';
	import { SvelteMap } from 'svelte/reactivity';
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
		}
	});
	setToastWrapperContext(configs);

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
				for (const children of childrensFiltered) {
					if (children.ref) {
						positions.forEach((side) => {
							if (!children.ref) return;
							children.ref.style.removeProperty(side);
						});

						const currentIndex = childrensFiltered.findIndex((k) => k.id == children.id);
						const step = 5;
						children.ref.style.transform = `${['bottom', 'top'].includes(children.position ?? '') ? 'translateX(-50%)' : 'translateY(-50%)'} scale(${(100 - (size - 1 - currentIndex) * step) / 100})`;
						children.ref.style.position = 'absolute';
						switch (children.position) {
							case 'bottom':
								children.ref.style.transformOrigin = 'bottom';
								children.ref.style.bottom = `${(size - currentIndex - 1) * step * 2 + (children.offset ?? 0)}px`;
								break;
							case 'top':
								children.ref.style.transformOrigin = 'top';
								children.ref.style.top = `${(size - currentIndex - 1) * step * 2 + (children.offset ?? 0)}px`;
								break;
							case 'left':
								children.ref.style.transformOrigin = 'left';
								children.ref.style.left = `${(size - currentIndex - 1) * step * 2 + (children.offset ?? 0)}px`;
								break;
							case 'right':
								children.ref.style.transformOrigin = 'right';
								children.ref.style.right = `${(size - currentIndex - 1) * step * 2 + (children.offset ?? 0)}px`;
								break;
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
