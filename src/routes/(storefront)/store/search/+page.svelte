// src/routes/(storefront)/store/search/+page.svelte
// Trang tìm kiếm riêng — ô search lớn + kết quả (tái dùng logic products
// list: POST /api/storefront/products/list với search param). Đọc ?q= từ URL;
// đổi query → replaceState để shareable link.
<script lang="ts">
	import { onMount } from 'svelte';
	import { page as pageStore } from '$app/state';
	import { client } from '$store/basic.svelte';
	import { encryption } from '$modules/encryption';
	import { Button } from '$components/element';
	import { Input } from '$components/form';
	import { STOREFRONT_CONTENTS, sf, resolveServerMessage } from '../../_interface';

	const lang: 'vi' | 'en' = $derived(
		client.browser?.language === 'vi' ? 'vi' : 'en'
	);
	const t = STOREFRONT_CONTENTS;

	interface VariantLite {
		variantId: string;
		price?: number;
	}
	interface ProductLite {
		productId: string;
		name?: string;
		description?: string;
		imageUrl?: string;
		variants?: VariantLite[];
	}

	let encryptionKeys = $state<undefined | { publicKey: CryptoKey; privateKey: CryptoKey }>(undefined);

	let query = $state('');
	let products = $state<ProductLite[]>([]);
	let total = $state(0);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let searched = $state(false);
	let addingVariantId = $state<string | undefined>(undefined);
	let searchInput = $state('');

	// user từ layout — dùng cho add to cart (chưa login → /login?redirect=)
	const isLoggedIn = $derived(!!pageStore.data?.user);
	const urlQuery = $derived((pageStore.url.searchParams.get('q') ?? '').trim());

	function minPrice(p: ProductLite): number | undefined {
		const prices = (p.variants ?? []).map((v) => v.price).filter((x): x is number => typeof x === 'number');
		return prices.length ? Math.min(...prices) : undefined;
	}

	function formatPrice(value: number): string {
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
			style: 'currency',
			currency: 'VND',
			maximumFractionDigits: 0
		}).format(value);
	}

	async function runSearch(q: string) {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		searched = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/storefront/products/list',
				{
					method: 'POST',
					body: { page: 1, pageSize: 24, search: q || undefined }
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as { products?: ProductLite[]; total?: number } | undefined;
				products = data?.products ?? [];
				if (typeof data?.total === 'number') total = data.total;
			} else {
				loadError = resolveServerMessage(response.message, lang, sf(t.search.loadFailed, lang));
			}
		} catch (err) {
			loading = false;
			loadError = err instanceof Error ? err.message : String(err);
		}
	}

	function submitSearch() {
		const q = searchInput.trim();
		// đồng bộ URL (?q=) rồi chạy search — replaceState không tạo history entry mới
		const url = q ? `/store/search?q=${encodeURIComponent(q)}` : '/store/search';
		history.replaceState(history.state, '', url);
		void runSearch(q);
	}

	async function addToCart(variantId: string) {
		if (!encryptionKeys) return;
		if (!isLoggedIn) {
			window.location.href = `/login?redirect=${encodeURIComponent('/store/search')}`;
			return;
		}
		addingVariantId = variantId;
		try {
			const response = await encryption.fetchSecure(
				'/api/storefront/cart/add',
				{ method: 'POST', body: { variantId, quantity: 1 } },
				encryptionKeys
			);
			if (response.ok) {
				client.browser?.toasts?.create?.({
					title: lang === 'vi' ? 'Đã thêm vào giỏ hàng' : 'Added to cart',
					color: 'success'
				});
			} else {
				client.browser?.toasts?.create?.({
					title: resolveServerMessage(response.message, lang, sf(t.search.loadFailed, lang)),
					color: 'error'
				});
			}
		} catch {
			// bỏ qua lỗi mạng — người dùng có thể thử lại.
		} finally {
			addingVariantId = undefined;
		}
	}

	onMount(async () => {
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		// vào trang với ?q= có sẵn → search luôn
		if (urlQuery) {
			searchInput = urlQuery;
			await runSearch(urlQuery);
		}
	});
</script>

<svelte:head>
	<title>{sf(t.search.title, lang)}</title>
</svelte:head>

<section class="search-page" data-test="store-search">
	<header class="search-header">
		<h1 class="search-title">{sf(t.search.title, lang)}</h1>
		<form
			class="search-form"
			data-test="search-form"
			onsubmit={(e) => {
				e.preventDefault();
				submitSearch();
			}}
		>
			<div class="search-input">
				<Input placeholder={sf(t.search.searchPlaceholder, lang)} bind:value={searchInput} />
			</div>
			<Button type="submit" color="primary">{sf(t.search.searchButton, lang)}</Button>
		</form>
	</header>

	{#if urlQuery && (searched || loading)}
		<p class="search-meta">
			{sf(t.search.resultsFor, lang)} <strong>"{urlQuery}"</strong>
			{#if !loading}
				· {total} {sf(t.search.resultCount, lang)}
			{/if}
		</p>
	{/if}

	{#if loadError}
		<div class="search-state search-state--error">{loadError}</div>
	{:else if loading}
		<div class="search-state">…</div>
	{:else if searched && !products.length}
		<div class="search-state">
			<p>{sf(t.search.empty, lang)}</p>
			<p class="search-state-hint">{sf(t.search.emptyHint, lang)}</p>
			<Button color="primary" variant="outline" to="/store/products">
				{sf(t.search.browseAll, lang)}
			</Button>
		</div>
	{:else if products.length}
		<div class="search-grid" data-test="search-results">
			{#each products as p (p.productId)}
				<article class="product-card">
					<a class="product-thumb-link" href="/store/products/{encodeURIComponent(p.productId)}">
						<div class="product-thumb">
							{#if p.imageUrl}
								<img src={p.imageUrl} alt={p.name ?? ''} loading="lazy" />
							{:else}
								<div class="product-thumb-placeholder">{(p.name ?? '?').slice(0, 1).toUpperCase()}</div>
							{/if}
						</div>
					</a>
					<div class="product-body">
						<a class="product-name-link" href="/store/products/{encodeURIComponent(p.productId)}">
							<h3 class="product-name">{p.name}</h3>
						</a>
						{#if p.description}
							<p class="product-desc">{p.description}</p>
						{/if}
						<div class="product-footer">
							<span class="product-price">
								{#if minPrice(p) !== undefined}
									{sf(t.search.from, lang)} {formatPrice(minPrice(p) as number)}
								{/if}
							</span>
							{#if (p.variants ?? []).length >= 1}
								<Button
									size="sm"
									color="primary"
									disabled={addingVariantId === p.variants![0]!.variantId}
									onClick={() => void addToCart(p.variants![0]!.variantId)}
								>
									{sf(t.search.addToCart, lang)}
								</Button>
							{/if}
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style lang="scss">
	.search-page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.search-header {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.search-title {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 700;
	}

	.search-form {
		display: flex;
		gap: 0.6rem;
		align-items: stretch;
		max-width: 40rem;
	}

	.search-input {
		flex: 1;
	}

	.search-meta {
		margin: 0;
		color: var(--muted-foreground, #666);
		font-size: 0.95rem;
	}

	.search-state {
		padding: 2.5rem 1rem;
		text-align: center;
		color: var(--muted-foreground, #666);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;

		&--error {
			color: var(--error, #b3261e);
		}
	}

	.search-state-hint {
		margin: 0;
		font-size: 0.88rem;
		color: var(--muted-foreground, #999);
	}

	.search-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 1.25rem;
	}

	.product-card {
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 0.75rem;
		overflow: hidden;
		background: var(--card, #fff);
		display: flex;
		flex-direction: column;
	}

	.product-thumb-link {
		display: block;
		text-decoration: none;
	}

	.product-thumb {
		aspect-ratio: 1;
		background: var(--muted, #f5f5f5);
		display: flex;
		align-items: center;
		justify-content: center;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.product-thumb-placeholder {
		font-size: 2.4rem;
		font-weight: 800;
		color: var(--muted-foreground, #999);
	}

	.product-body {
		padding: 0.875rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		flex: 1;
	}

	.product-name-link {
		text-decoration: none;
		color: inherit;
	}

	.product-name {
		margin: 0;
		font-size: 0.98rem;
		font-weight: 600;
	}

	.product-desc {
		margin: 0;
		font-size: 0.82rem;
		color: var(--muted-foreground, #666);
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.product-footer {
		margin-top: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.product-price {
		font-weight: 700;
		font-size: 0.95rem;
	}
</style>
