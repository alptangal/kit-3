<script lang="ts">
	// src/lib/components/navigation/sidebar/SidebarSearch.svelte
	// P2 — ô tìm kiếm menu item (dùng Input sẵn có). Gắn trong Sidebar.Header/Content.
	// value push lên Provider (ctx.setSearchQuery) → menu items tự filter (ẩn item
	// không khớp `match`), SidebarMenuGroup tự mở (auto-expand) khi có query.
	//
	// A11y: `placeholder` là accessible name (Icon forward được, input không được
	// qua Input component — Input không spread aria-label). Không cần label element
	// riêng (icon + placeholder đủ cho SR + user).
	//
	// Icon iconify: wrap trong <span aria-hidden> (span forward attr được,
	// Icon component không forward aria-*) — bẫy Svelte: attribute unknown trên
	// component con → type error (IconProps chỉ có icon + BasicProps).
	import { client } from '$store/basic.svelte';
	import { Icon } from '$components/element';
	import { Input } from '$components/form';
	import { getSidebarContext } from './_context';
	import type { SidebarSearchProps } from './_interface';
	import type { TranslateContent } from '$interfaces/basic';

	let {
		placeholder = { en: 'Search menu…', vi: 'Tìm kiếm menu…' },
		...props
	}: SidebarSearchProps = $props();

	const ctx = getSidebarContext();

	// i18n: string | TranslateContent (fallback en → vi)
	const lang = $derived(client.browser?.language ?? 'en');
	const placeholderText = $derived.by(() =>
		typeof placeholder === 'string' ? placeholder : placeholder[lang] ?? placeholder.en ?? placeholder.vi ?? ''
	);

	// value nội bộ (bind vào Input), push lên Provider.
	let text = $state('');
	$effect(() => {
		ctx?.setSearchQuery(text);
	});
</script>

<!-- leading: icon search (Icon iconify). Snippet TRỰC TIẾP con của component
     (bẫy Svelte 5: không bọc trong {#if} → snippet không extract).
     Icon wrap trong span aria-hidden (Icon không forward aria-*). -->
{#snippet searchLeading()}
	<span class="sidebar-search-icon" aria-hidden="true">
		<Icon icon="lucide:search" />
	</span>
{/snippet}

<div class="sidebar-search" data-test="sidebar-search">
	<Input
		type="text"
		size="sm"
		bind:value={text}
		placeholder={placeholderText}
		autocomplete="off"
		leading={searchLeading}
	/>
</div>

<style lang="scss">
	.sidebar-search {
		width: 100%;
	}

	/* Icon search (iconify) — span wrap mang scoped hash của SidebarSearch;
	   CSS var --muted inherit. Cỡ: svg inline 1em → điều khiển qua font-size
	   (1rem = bám size sm của Input); KHÔNG cần width/height cho svg (bẫy:
	   selector `svg` con thuộc hash Icon → svelte-check "unused selector"). */
	:global(.sidebar-search-icon) {
		display: inline-flex;
		align-items: center;
		width: 1rem;
		height: 1rem;
		font-size: 1rem;
		color: var(--muted, var(--foreground));
	}
</style>
