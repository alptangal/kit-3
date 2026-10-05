<script lang="ts">
	// src/lib/components/element/accordion/Root.svelte
	// Accordion.Root — composite root (shadcn accordion). value (bindable, loose
	// typing: 'single' → string · 'multiple' → string[]) + defaultValue (uncontrolled
	// ban đầu). Symbol context: type, collapsible, isOpen(id), toggle(id), duration.
	//
	// State source-of-truth cho RENDER = `openValue` (mẫu Tabs activeValue):
	//  - init = value ?? defaultValue (SSR an toàn)
	//  - controlled: $effect sync openValue theo value khi parent đổi (không qua toggle)
	//  - toggle: tính next theo type/collapsible → ghi openValue + value (parent bound
	//    thì propagate lên; uncontrolled thì giá trị vẫn đúng vì openValue là source).
	//
	// toggle logic:
	//  single:   mở ? (collapsible ? undefined : giữ) : id
	//  multiple: array toggle (có → remove, không → add)
	//
	// duration → 0 khi prefers-reduced-motion (matchMedia check, guard typeof window).
	import { styleSynced, convertToMiliseconds } from '$modules';
	import { setAccordionContext } from './_context';
	import type { AccordionConfigs, AccordionRootProps } from './_interface';

	let {
		value = $bindable<string | string[] | undefined>(undefined),
		defaultValue,
		type = 'single',
		collapsible,
		duration,
		children,
		...props
	}: AccordionRootProps = $props();

	// id instance cho liên kết trigger ↔ content (aria-controls / aria-labelledby).
	const rootId = Math.random().toString(36).slice(2, 10);

	// runtime reducedMotion (prefers-reduced-motion: reduce → duration 0).
	let reducedMotion = $state(false);
	$effect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = mq.matches;
		const onChange = (e: MediaQueryListEvent) => (reducedMotion = e.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	// SOURCE OF TRUTH cho render (mẫu Tabs activeValue).
	let openValue = $state<string | string[] | undefined>(value ?? defaultValue);

	// Controlled: parent đổi value (không qua toggle, vd button ngoài) → theo.
	$effect(() => {
		const v = value;
		if (v !== undefined && v !== openValue) openValue = v;
	});

	let configs: AccordionConfigs = $state({
		rootId,
		get type() {
			return type;
		},
		get collapsible() {
			// Spec: single → default true (click item đang mở → đóng). multiple: không dùng.
			return collapsible ?? true;
		},
		get duration() {
			// reduced-motion → 0 (animation off, hiển thị nội dung ngay)
			return reducedMotion ? 0 : convertToMiliseconds(duration) ?? 300;
		},
		/**
		 * NORMALIZE theo type. Gọi từ $derived Trigger/Content → PHẢI track
		 * openValue (không untrack): đổi → derived re-eval → aria-expanded/hidden theo.
		 */
		isOpen(id: string) {
			const v = openValue;
			if (type === 'multiple') return Array.isArray(v) ? v.includes(id) : false;
			return v === id;
		},
		toggle(id: string) {
			const v = openValue;
			if (type === 'multiple') {
				const arr = Array.isArray(v) ? [...v] : [];
				if (arr.includes(id)) arr.splice(arr.indexOf(id), 1);
				else arr.push(id);
				openValue = arr;
				value = arr;
				return;
			}
			// single: item đang mở → collapsible ? đóng (undefined) : giữ nguyên
			// (đọc configs.collapsible — getter có default true; KHÔNG đọc prop
			//  `collapsible` trực tiếp: undefined → falsy → luôn "giữ").
			if (v === id) {
				if (configs.collapsible) {
					openValue = undefined;
					value = undefined;
				}
				return;
			}
			// single: item khác → switch
			openValue = id;
			value = id;
		}
	});

	setAccordionContext(configs);
</script>

<div
	class={styleSynced(
		{
			defaultStyles: ['accordion-root', `type-${type}`],
			propStyles: props.class
		},
		props.overwriteDefaultStyles
	)}
	style:--duration={`${configs.duration}ms`}
>
	{@render children?.()}
</div>

<style lang="scss">
	.accordion-root {
		display: block;
	}
</style>
