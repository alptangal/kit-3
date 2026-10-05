<script lang="ts">
	//$components/element/alert/Main.svelte
	// Alert — inline notification (element): [icon] [content] (title + description).
	// Atom nhẹ (mẫu tag/badge): $derived cho style — không context, không form.
	// A11y: error/warning → role="alert" + aria-live="assertive" (nội dung quan trọng, cần chú ý ngay);
	//        còn lại → role="status" + aria-live="polite" (thông báo nền). Icon aria-hidden (trang trí).
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	// Import TRỰC TIẾP icon/Main.svelte — KHÔNG qua barrel element/index.ts
	// (barrel kéo cả DropdownMenu/Modal/Toast... vào → vòng tròn import ở layer mới của barrel).
	import { Icon } from '$components/element/icon';
	import type { Color } from '$components/interface';
	import type { AlertConfigs, AlertProps } from './_interface';
	import type { TranslateContent } from '$interfaces/basic';

	// Destructure props riêng của component + BasicProps để rest chỉ còn attrs
	// passthrough (data-*, aria-*, id...) — spread an toàn lên svelte:element (mẫu card/avatar).
	let {
		color,
		title,
		description,
		icon,
		as,
		size,
		disabled,
		class: classProp,
		overwriteDefaultStyles,
		events,
		children,
		...props
	}: AlertProps = $props();

	// Resolve TranslateContent | string theo ngôn ngữ hiện hành (fallback en → vi)
	const getText = (content?: TranslateContent | string): string => {
		if (!content) return '';
		if (typeof content === 'string') return content;
		const lang = client.browser?.language ?? 'en';
		return content[lang] ?? content.en ?? content.vi ?? '';
	};

	const colorDerived = $derived(color ?? 'default');
	const sizeDerived = $derived(size ?? 'md');
	const asDerived = $derived(as ?? 'div');

	// A11y: error/warning mang tính khẩn cấp → assertive; còn lại → polite
	const roleDerived = $derived<'alert' | 'status'>(
		colorDerived === 'error' || colorDerived === 'warning' ? 'alert' : 'status'
	);

	// Icon default theo semantic color (iconify — fetch async, offline → icon không render, chấp nhận)
	const iconByColor: Record<Color, string> = {
		default: 'lucide:info',
		info: 'lucide:info',
		primary: 'lucide:info',
		secondary: 'lucide:info',
		success: 'lucide:circle-check',
		warning: 'lucide:triangle-alert',
		error: 'lucide:circle-alert'
	};
	const iconDerived = $derived(icon ?? iconByColor[colorDerived]);

	const titleDerived = $derived(getText(title));
	const descriptionDerived = $derived(getText(description));

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'alert-root',
			`size-${sizeDerived}`,
			`color-${colorDerived}`,
			// class state KHÔNG cần :has(): JS biết sẵn title/description → gán trực tiếp
			titleDerived ? 'has-title' : 'no-title',
			descriptionDerived ? 'has-description' : 'no-description',
			disabled ? 'disabled' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: classProp }, overwriteDefaultStyles);
	});

	let configs: AlertConfigs = $state({
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
		get role() {
			return roleDerived;
		},
		get ariaLive() {
			return roleDerived === 'alert' ? 'assertive' : 'polite';
		},
		get icon() {
			return iconDerived;
		},
		get title() {
			return titleDerived;
		},
		get description() {
			return descriptionDerived;
		}
	});

	export { configs };
</script>

<svelte:element
	this={asDerived}
	class={configs.style}
	role={configs.role}
	aria-live={configs.ariaLive}
	{@attach handleEvents(configs.event)}
	{...props}
>
	<span class="alert-icon" aria-hidden="true">
		<Icon icon={configs.icon} />
	</span>
	<span class="alert-content">
		{#if configs.title}
			<span class="alert-title">{configs.title}</span>
		{/if}
		{#if configs.description}
			<span class="alert-description">{configs.description}</span>
		{/if}
		{#if children}
			{@render children()}
		{/if}
	</span>
</svelte:element>

<style lang="scss">
	@use '_styles.scss';
</style>
