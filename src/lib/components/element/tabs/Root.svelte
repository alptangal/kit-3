<script lang="ts">
	// src/lib/components/element/tabs/Root.svelte
	// Tabs.Root — composite root (shadcn tabs). Giữ value (bindable, controlled) +
	// defaultValue (uncontrolled) → activeValue. Symbol context (leaf _context.ts):
	// rootId, select(v), register/unregister (triggerRefs SvelteMap), duration,
	// orientation, type, activation, listEl.
	//
	// ARIA tabs: List (role=tablist) xử lý roving focus (mẫu form/radiogroup):
	// ArrowRight/Left (horizontal) · ArrowDown/Up (vertical), wrap + skip disabled,
	// Home/End. activation='automatic': FOCUS trigger → chọn luôn; 'manual': chỉ
	// Enter/Space/click mới chọn.
	import { styleSynced, convertToMiliseconds } from '$modules';
	import { SvelteMap } from 'svelte/reactivity';
	import { untrack } from 'svelte';
	import { setTabsContext } from './_context';
	import type { TabsConfigs, TabsRootProps } from './_interface';

	let {
		value = $bindable<string | undefined>(undefined),
		defaultValue,
		type = 'default',
		orientation = 'horizontal',
		activation = 'automatic',
		duration,
		children,
		...props
	}: TabsRootProps = $props();

	// id instance cho liên kết trigger ↔ panel (aria-controls / aria-labelledby).
	// Math.random đủ duy nhất theo instance, không phụ thuộc crypto (SSR an toàn).
	const rootId = Math.random().toString(36).slice(2, 10);

	let configs: TabsConfigs = $state({
		rootId,
		activeValue: value ?? defaultValue,
		// duration/type/orientation/activation là getter LIVE (props đổi → theo)
		get duration() {
			return convertToMiliseconds(duration) ?? 300;
		},
		get type() {
			return type;
		},
		get orientation() {
			return orientation;
		},
		get activation() {
			return activation;
		},
		select(v: string) {
			// Uncontrolled (parent không bind value): tự đồng bộ props.value để
			// behavior "value ?? defaultValue ?? first trigger" nhất quán.
			if (!value) value = v;
			configs.activeValue = v;
		},
		register(v: string, ref: HTMLElement) {
			configs.triggerRefs.set(v, ref);
			// register chạy THỂ $effect của trigger → mọi read activeValue bên trong
			// sẽ thành dependency; write activeValue (fallback select) → re-run effect
			// → unregister → select → ... (effect_update_depth_exceeded). Wrap
			// read + write bằng untrack để register không leak dependency.
			if (!untrack(() => configs.activeValue)) {
				untrack(() => configs.select(v));
			}
		},
		unregister(v: string, ref: HTMLElement) {
			// unregister chạy ở cleanup của $effect trigger → untrack toàn bộ (tránh
			// write activeValue → re-run effect của trigger → unregister lại).
			untrack(() => {
				if (configs.triggerRefs.get(v) === ref) {
					configs.triggerRefs.delete(v);
					if (configs.activeValue === v) {
						// tab active bị unmount → fallback trigger còn lại (theo thứ tự)
						const next = configs.triggerRefs.keys().next().value;
						if (next !== undefined) configs.select(next);
						else configs.activeValue = undefined;
					}
				}
			});
		},
		triggerRefs: new SvelteMap<string, HTMLElement>(),
		listEl: undefined
	});

	// Controlled: parent đổi value (bind:value) → activeValue theo (bỏ qua trigger
	// không tồn tại là do parent — triggerRefs check).
	$effect(() => {
		const v = value;
		if (v !== undefined && v !== configs.activeValue && configs.triggerRefs.get(v)) {
			configs.activeValue = v;
		}
	});

	setTabsContext(configs);
</script>

<div
	class={styleSynced(
		{
			defaultStyles: [
				'tabs-root',
				`type-${type}`,
				orientation === 'vertical' ? 'vertical' : undefined
			],
			propStyles: props.class
		},
		props.overwriteDefaultStyles
	)}
	style:--duration={`${configs.duration}ms`}
>
	{@render children?.()}
</div>

<style lang="scss">
	@use '_styles.scss';
</style>
