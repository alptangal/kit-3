<script lang="ts">
	//$components/element/badge/Main.svelte
	// Badge — "mặt hàng" nhỏ (pill/chip): trạng thái, phân loại, số lượng.
	// Atom nhẹ: $derived cho style (mẫu tag); variant map copy cấu trúc @each từ tag.
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { Icon } from '$components/element';
	import type { BadgeConfigs, BadgeProps } from './_interface';
	import type { TranslateContent } from '$interfaces/basic';

	// Destructure props riêng của component + BasicProps để rest chỉ còn attrs
	// passthrough (data-*, aria-*, id...) — spread an toàn lên svelte:element (mẫu card/avatar).
	let {
		label,
		color,
		variant,
		dot,
		icon,
		as,
		href,
		size,
		disabled,
		class: classProp,
		overwriteDefaultStyles,
		events,
		children,
		...props
	}: BadgeProps = $props();

	// Resolve TranslateContent | string theo ngôn ngữ hiện hành (fallback en → vi)
	const getText = (content?: TranslateContent | string): string => {
		if (!content) return '';
		if (typeof content === 'string') return content;
		const lang = client.browser?.language ?? 'en';
		return content[lang] ?? content.en ?? content.vi ?? '';
	};

	const sizeDerived = $derived(size ?? 'sm');
	const colorDerived = $derived(color ?? 'primary');
	const variantDerived = $derived(variant ?? 'soft');
	const dotDerived = $derived(!!dot);
	const asDerived = $derived(as ?? 'span');

	// Badge là atom: link/badge nên inline trong text (không chặn dòng như block)
	const textDerived = $derived(getText(label));

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'badge-root',
			`size-${sizeDerived}`,
			`color-${colorDerived}`,
			`variant-${variantDerived}`,
			dotDerived ? 'has-dot' : undefined,
			icon ? 'has-icon' : undefined,
			disabled ? 'disabled' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: classProp }, overwriteDefaultStyles);
	});

	let configs: BadgeConfigs = $state({
		get style() {
			return styleDerived;
		},
		get event() {
			return events;
		},
		get size() {
			return sizeDerived;
		},
		get color() {
			return colorDerived;
		},
		get variant() {
			return variantDerived;
		},
		get dot() {
			return dotDerived;
		},
		get icon() {
			return icon;
		},
		get text() {
			return textDerived;
		}
	});

	export { configs };
</script>

<svelte:element
	this={asDerived}
	href={asDerived === 'a' ? href : undefined}
	type={asDerived === 'button' ? 'button' : undefined}
	class={configs.style}
	{@attach handleEvents(configs.event)}
	{...props}
>
	{#if configs.dot}
		<span class="badge-dot" aria-hidden="true"></span>
	{/if}
	{#if configs.icon}
		<span class="badge-icon" aria-hidden="true">
			<Icon icon={configs.icon} />
		</span>
	{/if}
	{#if configs.text}
		<span class="badge-text">{configs.text}</span>
	{/if}
</svelte:element>

<style lang="scss">
	@use '_styles.scss';
</style>
