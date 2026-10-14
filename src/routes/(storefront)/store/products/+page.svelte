// src/routes/(storefront)/store/products/+page.svelte
// Danh sách sản phẩm công khai — fetchSecure POST /api/storefront/products/list
// (public API, không cần đăng nhập). Card grid + nút thêm vào giỏ (nếu có
// session → gọi cart/add; không có → điều hướng /login?redirect=).
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page as pageStore } from '$app/state';
	// user từ +layout.server.ts của (storefront) — page.data.user.
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
		sku?: string;
		displayName?: string;
		attributes?: Record<string, string>;
		price?: number;
		imageUrl?: string;
	}
	interface ProductLite {
		productId: string;
		name?: string;
		description?: string;
		imageUrl?: string;
		variants?: VariantLite[];
	}

	// ── RSA keys cho fetchSecure ──
	let encryptionKeys = $state<undefined | { publicKey: CryptoKey; privateKey: CryptoKey }>(undefined);

	let products = $state<ProductLite[]>([]);
	let total = $state(0);
	let pageNumber = $state(1);
	const pageSize = 12;
	let searchQuery = $state('');
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let addingVariantId = $state<string | undefined>(undefined);

	const isLoggedIn = $derived(!!pageStore.data?.user);
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

	async function fetchProducts() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/storefront/products/list',
				{
					method: 'POST',
					body: { page: pageNumber, pageSize, search: searchQuery || undefined }
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as { products?: ProductLite[]; total?: number } | undefined;
				products = data?.products ?? [];
				if (typeof data?.total === 'number') total = data.total;
			} else {
				loadError = resolveServerMessage(response.message, lang, sf(t.products.loadFailed, lang));
			}
		} catch (err) {
			loading = false;
			loadError = err instanceof Error ? err.message : String(err);
		}
	}

	async function addToCart(variantId: string) {
		if (!encryptionKeys) return;
		if (!isLoggedIn) {
			goto(`/login?redirect=${encodeURIComponent('/store/products')}`);
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
				// toast nhẹ qua browser toasts (nếu có).
				client.browser?.toasts?.create?.({
					title: sf(t.products.addedToCart, lang),
					color: 'success'
				});
			} else {
				client.browser?.toasts?.create?.({
					title: resolveServerMessage(response.message, lang, sf(t.products.loadFailed, lang)),
					color: 'error'
				});
			}
		} catch {
			// bỏ qua lỗi mạng — người dùng có thể thử lại.
		} finally {
			addingVariantId = undefined;
		}
	}

	// Search debounce 400ms — theo dõi searchQuery bằng $effect (Input không
	// có prop oninput; bind:value là nguồn đủ — pattern brands page).
	// Bỏ qua lần đầu (tránh trùng onMount).
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let searchArmed = false;
	$effect(() => {
		void searchQuery;
		if (!searchArmed) {
			searchArmed = true;
			return;
		}
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			pageNumber = 1;
			void fetchProducts();
		}, 400);
	});

	onMount(async () => {
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await fetchProducts();
	});
</script>

<svelte:head>
	<title>{sf(t.products.title, lang)}</title>
</svelte:head>

<section class="products-page">
	<header class="products-header">
		<h1 class="products-title">{sf(t.products.title, lang)}</h1>
		<div class="products-search">
			<Input placeholder={sf(t.products.searchPlaceholder, lang)} bind:value={searchQuery} />
		</div>
	</header>

	{#if loadError}
		<div class="products-state products-state--error">{loadError}</div>
	{:else if loading && !products.length}
		<div class="products-state">{sf(t.products.title, lang)}…</div>
	{:else if !products.length}
		<div class="products-state">{sf(t.products.empty, lang)}</div>
	{:else}
		<div class="products-grid">
			{#each products as p (p.productId)}
				<article class="product-card" data-product-id={p.productId}>
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
									{sf(t.products.from, lang)} {formatPrice(minPrice(p) as number)}
								{/if}
							</span>
							{#if (p.variants ?? []).length === 1}
								<Button
									size="sm"
									color="primary"
									disabled={addingVariantId === p.variants![0]!.variantId}
									onClick={() => void addToCart(p.variants![0]!.variantId)}
								>
									{sf(t.products.addToCart, lang)}
								</Button>
							{:else if (p.variants ?? []).length > 1}
								<Button size="sm" color="primary" to="/store/cart">
									{sf(t.products.variantLabel, lang)} ({(p.variants ?? []).length})
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
	.products-page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.products-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.products-title {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 700;
	}

	.products-search {
		min-width: 16rem;
	}

	.products-state {
		padding: 2.5rem 1rem;
		text-align: center;
		color: var(--muted-foreground, #666);

		&--error {
			color: var(--error, #b3261e);
		}
	}

	.products-grid {
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
		color: inherit;
	}

	.product-name-link {
		text-decoration: none;
		color: inherit;
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
