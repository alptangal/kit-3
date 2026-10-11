<script lang="ts">
	//$components/navigation/breadcrumb/Main.svelte
	// Breadcrumb — điều hướng hạng. items rỗng / fromCurrentPage → derive từ page.url
	// (SvelteKit $app/state, reactive theo navigation). Item cuối = aria-current="page".
	//
	// P2 hoàn thiện:
	//  - icon / description per item (Icon iconify + Tooltip)
	//  - separator tùy biến (string / Snippet) — global + per-item
	//  - ellipsis: maxItems → "…" (DropdownMenu) khi items vượt ngưỡng
	//  - FIX: separator render trước CURRENT item (trước đó chỉ có trong links)
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { Icon, Tooltip, DropdownMenu } from '$components/element';
	import type { BreadcrumbConfigs, BreadcrumbItem, BreadcrumbProps } from './_interface';
	import type { TranslateContent } from '$interfaces/basic';
	import type { Snippet } from 'svelte';

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

	// Entry render: item bình thường HOẶC nút "…" (ellipsis) gộp các item giữa.
	type ItemEntry = { kind: 'item'; item: BreadcrumbItem; current: boolean };
	type EllipsisEntry = { kind: 'ellipsis'; items: BreadcrumbItem[] };
	type VisibleEntry = ItemEntry | EllipsisEntry;

	// maxItems: giữ item đầu + (maxItems - 1) item cuối, gộp phần giữa thành "…".
	const visible = $derived.by<VisibleEntry[]>(() => {
		const all = derivedItems;
		const n = all.length;
		const max = props.maxItems;
		if (max && n > max) {
			const tailCount = Math.max(1, max - 1);
			const out: VisibleEntry[] = [{ kind: 'item', item: all[0], current: false }];
			out.push({ kind: 'ellipsis', items: all.slice(1, n - tailCount) });
			for (let i = n - tailCount; i < n; i++) {
				out.push({ kind: 'item', item: all[i], current: i === n - 1 });
			}
			return out;
		}
		return all.map((item, i) => ({ kind: 'item', item, current: i === n - 1 }));
	});

	// Separator TRƯỚC mỗi entry (index 0 không dùng). per-item → global → default chevron.
	const seps = $derived.by<(string | Snippet | undefined)[]>(() =>
		visible.map((entry) =>
			entry.kind === 'item' ? entry.item.separator ?? props.separator : props.separator
		)
	);

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

	// onselect của item trong menu "…" → điều hướng SPA (internal) / tab mới (external)
	function go(href?: string) {
		if (!href) return;
		if (/^https?:\/\//.test(href)) window.open(href, '_blank', 'noopener');
		else goto(href, { noScroll: true });
	}

	export { configs };
</script>

{#snippet itemContent(entry: ItemEntry)}
	{#if entry.item.icon}
		<Icon icon={entry.item.icon} class="breadcrumb-item-icon" />
	{/if}
	{resolveLabel(entry.item.label)}
{/snippet}

{#snippet itemTarget(entry: ItemEntry)}
	{#if entry.item.snippet}
		{@render entry.item.snippet()}
	{:else if entry.current}
		<span class="breadcrumb-label">{@render itemContent(entry)}</span>
	{:else}
		<a
			class="breadcrumb-link"
			href={entry.item.href ?? '#'}
			target={isExternal(entry.item.href) ? '_blank' : undefined}
			rel={isExternal(entry.item.href) ? 'noopener noreferrer' : undefined}
		>
			{@render itemContent(entry)}
		</a>
	{/if}
{/snippet}

<nav
	class={configs.style}
	aria-label={props['aria-label'] ?? 'Breadcrumb'}
	data-test={props['data-test']}
>
	<ol class="breadcrumb-list">
		{#each visible as entry, i (i)}
			<li
				class={entry.kind === 'item' && entry.current
					? 'breadcrumb-item breadcrumb-item--current'
					: 'breadcrumb-item'}
				aria-current={entry.kind === 'item' && entry.current ? 'page' : undefined}
			>
				<!-- Separator TRƯỚC item (bao gồm item current — fix bug P1) -->
				{#if i > 0}
					<span class="breadcrumb-sep" aria-hidden="true">
						{#if typeof seps[i] === 'string'}
							<span class="breadcrumb-sep--text">{seps[i]}</span>
						{:else if seps[i]}
							{@render seps[i]()}
						{:else}
							<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
								<path
									d="M6 4l4 4-4 4"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						{/if}
					</span>
				{/if}

				{#if entry.kind === 'ellipsis'}
					<!-- Nút "…": gộp các item giữa, mở DropdownMenu để chọn.
					 Trigger không bọc snippet trong {#if} (bẫy Svelte 5). "…" để SR đọc. -->
					<DropdownMenu aria-label="Trang trung gian">
						<DropdownMenu.Trigger class="breadcrumb-ellipsis-trigger">…</DropdownMenu.Trigger>
						<DropdownMenu.Content>
							{#each entry.items as mi (mi.href ?? resolveLabel(mi.label))}
								<DropdownMenu.Item onselect={() => go(mi.href)}>
									{resolveLabel(mi.label)}
								</DropdownMenu.Item>
							{/each}
						</DropdownMenu.Content>
					</DropdownMenu>
				{:else}
					<!-- Item bình thường / current (bọc Tooltip khi có description).
					 Trigger (link/span) đứng TRƯỚC Content — Content append vào body,
					 anchor = firstElementChild của root Tooltip. -->
					{#if entry.item.description}
						<Tooltip>
							{@render itemTarget(entry)}
							<Tooltip.Content>{resolveLabel(entry.item.description)}</Tooltip.Content>
						</Tooltip>
					{:else}
						{@render itemTarget(entry)}
					{/if}
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style lang="scss">
	@use '_styles.scss';
</style>
