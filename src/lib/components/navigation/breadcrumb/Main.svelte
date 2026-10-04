<script lang="ts">
	//$components/navigation/breadcrumb/Main.svelte
	// Breadcrumb — điều hướng hạng. items rỗng / fromCurrentPage → derive từ page.url
	// (SvelteKit $app/state, reactive theo navigation). Item cuối = aria-current="page".
	import { page } from '$app/state';
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import type { BreadcrumbConfigs, BreadcrumbItem, BreadcrumbProps } from './_interface';
	import type { TranslateContent } from '$interfaces/basic';

	let { items = [], fromCurrentPage = true, ...props }: BreadcrumbProps = $props();

	// Resolve label i18n (fallback en → vi)
	const resolveLabel = (label?: string | TranslateContent): string => {
		if (!label) return '';
		if (typeof label === 'string') return label;
		const lang = client.browser?.language ?? 'en';
		return label[lang] ?? label.en ?? label.vi ?? '';
	};

	// Derive items từ page.url khi user không truyền (trailing 'home' + các segment)
	const derivedItems = $derived.by<BreadcrumbItem[]>(() => {
		if (items.length) return items;
		if (!fromCurrentPage) return [];
		const segments = page.url.pathname.split('/').filter(Boolean);
		const home: BreadcrumbItem = { label: { en: 'Home', vi: 'Trang chủ' }, href: '/' };
		if (!segments.length) return [home];
		return [home, ...segments.map((seg, i) => ({
			label: prettify(seg),
			href: '/' + segments.slice(0, i + 1).join('/')
		}))];
	});

	// Prettify segment: 'ui' → 'UI', 'forgot-password' → 'Forgot Password'
	function prettify(seg: string): string {
		try {
			const decoded = decodeURIComponent(seg);
			// Viết tắt ngắn toàn chữ thường (ui, faq, api) → UPPERCASE
			if (/^[a-z]{2,3}$/.test(decoded)) return decoded.toUpperCase();
			return decoded
				.split(/[-_]/)
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
				.join(' ');
		} catch {
			return seg;
		}
	}

	// Item cuối = current page (không link, aria-current="page")
	const links = $derived(derivedItems.slice(0, -1));
	const current = $derived(derivedItems[derivedItems.length - 1]);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'breadcrumb-root',
			`size-${props.size ?? 'md'}`,
			props.disabled ? 'disabled' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	let configs: BreadcrumbConfigs = $state({
		get items() {
			return derivedItems;
		},
		get style() {
			return styleDerived;
		}
	});

	// External link (http/https/protocol) → target="_blank"
	const isExternal = (href?: string) => !!href && /^https?:\/\//.test(href);

	export { configs };
</script>

<nav class={configs.style} aria-label={props['aria-label'] ?? 'Breadcrumb'}>
	<ol class="breadcrumb-list">
		{#each links as item, i}
			<li class="breadcrumb-item">
				<!-- Separator chevron giữa các item (trừ đầu) -->
				{#if i > 0}
					<svg class="breadcrumb-sep" viewBox="0 0 16 16" fill="none" aria-hidden="true">
						<path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				{/if}
				{#if item.snippet}
					{@render item.snippet()}
				{:else}
					<a
						class="breadcrumb-link"
						href={item.href ?? '#'}
						target={isExternal(item.href) ? '_blank' : undefined}
						rel={isExternal(item.href) ? 'noopener noreferrer' : undefined}
					>
						{resolveLabel(item.label)}
					</a>
				{/if}
			</li>
		{/each}
		<!-- Item hiện tại (không link) -->
		{#if current}
			<li class="breadcrumb-item breadcrumb-item--current" aria-current="page">
				{#if current.snippet}
					{@render current.snippet()}
				{:else}
					<span class="breadcrumb-label">{resolveLabel(current.label)}</span>
				{/if}
			</li>
		{/if}
	</ol>
</nav>

<style lang="scss">
	@use '_styles.scss';
</style>
