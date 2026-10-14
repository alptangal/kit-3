// src/routes/(storefront)/store/products/[id]/+page.svelte
// Chi tiết sản phẩm: tên, giá theo variant, mô tả, ảnh (placeholder khi trống),
// chọn variant (attributes) → Thêm vào giỏ (POST /api/storefront/cart/add).
// Kèm related products cùng category (tối đa 4).
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page as pageStore } from '$app/state';
	import { client } from '$store/basic.svelte';
	import { encryption } from '$modules/encryption';
	import { Button } from '$components/element';
	import { STOREFRONT_CONTENTS, sf, resolveServerMessage } from '../../../_interface';

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
		categoryId?: string | null;
		variants?: VariantLite[];
	}

	const productId = $derived((pageStore.params as { id?: string }).id ?? '');

	let encryptionKeys = $state<undefined | { publicKey: CryptoKey; privateKey: CryptoKey }>(undefined);
	let product = $state<ProductLite | undefined>(undefined);
	let related = $state<ProductLite[]>([]);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let notFound = $state(false);

	let selectedVariantId = $state<string | undefined>(undefined);
	let quantity = $state(1);
	let adding = $state(false);
	let added = $state(false);

	const isLoggedIn = $derived(!!pageStore.data?.user);
	const variants = $derived(product?.variants ?? []);
	const selectedVariant = $derived(
		variants.find((v) => v.variantId === selectedVariantId) ?? undefined
	);

	// Nhóm attribute name → các option có trong variants (để render picker)
	const attributeOptions = $derived.by(() => {
		const map: Record<string, string[]> = {};
		for (const v of variants) {
			if (!v.attributes) continue;
			for (const [key, value] of Object.entries(v.attributes)) {
				if (!map[key]) map[key] = [];
				if (!map[key]!.includes(value)) map[key]!.push(value);
			}
		}
		return map;
	});

	function formatPrice(value: number | undefined | null): string {
		if (typeof value !== 'number') return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
			style: 'currency',
			currency: 'VND',
			maximumFractionDigits: 0
		}).format(value);
	}

	function priceRange(): { min?: number; max?: number } {
		const prices = variants.map((v) => v.price).filter((x): x is number => typeof x === 'number');
		if (!prices.length) return {};
		return { min: Math.min(...prices), max: Math.max(...prices) };
	}

	function variantLabel(v: VariantLite): string {
		if (v.displayName) return v.displayName;
		if (v.attributes) {
			const parts = Object.values(v.attributes).filter(Boolean);
			if (parts.length) return parts.join(' / ');
		}
		return v.sku ?? v.variantId;
	}

	// Chọn option theo attribute key → variant khớp TẤT CẢ các option đã chọn
	function pickOption(key: string, value: string) {
		const match = variants.find(
			(v) => v.attributes?.[key] === value && matchesOtherKeys(v, key, value)
		);
		if (match) {
			selectedVariantId = match.variantId;
			added = false;
		}
	}

	function matchesOtherKeys(v: VariantLite, pickKey: string, pickValue: string): boolean {
		for (const [k, val] of Object.entries(attributeOptions)) {
			if (k === pickKey) continue;
			// với attribute khác, giữ selection hiện tại nếu variant khớp, nếu không bỏ qua
			const currentSel = selectedVariant?.attributes?.[k];
			if (currentSel && v.attributes?.[k] !== currentSel && k !== pickKey) {
				// thử tìm variant khớp cả pickKey/pickValue lẫn selection hiện tại
				const candidate = variants.find(
					(x) => x.attributes?.[pickKey] === pickValue && x.attributes?.[k] === currentSel
				);
				if (!candidate) return false;
			}
		}
		return true;
	}

	async function fetchProduct() {
		if (!encryptionKeys || !productId) return;
		loading = true;
		loadError = undefined;
		notFound = false;
		try {
			const response = await encryption.fetchSecure(
				'/api/storefront/products/get',
				{ method: 'POST', body: { productId } },
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| { product?: ProductLite; related?: ProductLite[] }
					| undefined;
				product = data?.product;
				related = data?.related ?? [];
				if (!product) {
					notFound = true;
				} else {
					// mặc định chọn variant đầu tiên (hoặc variant duy nhất)
					selectedVariantId = variants[0]?.variantId;
				}
			} else {
				if (response.message) {
					loadError = resolveServerMessage(response.message, lang, sf(t.detail.loadFailed, lang));
				} else {
					notFound = true;
				}
			}
		} catch (err) {
			loading = false;
			loadError = err instanceof Error ? err.message : String(err);
		}
	}

	async function addToCart() {
		if (!encryptionKeys || !selectedVariantId) return;
		if (!isLoggedIn) {
			goto(`/login?redirect=${encodeURIComponent(`/store/products/${productId}`)}`);
			return;
		}
		adding = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/storefront/cart/add',
				{ method: 'POST', body: { variantId: selectedVariantId, quantity } },
				encryptionKeys
			);
			if (response.ok) {
				added = true;
				client.browser?.toasts?.create?.({
					title: sf(t.detail.addedToCart, lang),
					color: 'success'
				});
			} else {
				client.browser?.toasts?.create?.({
					title: resolveServerMessage(response.message, lang, sf(t.detail.loadFailed, lang)),
					color: 'error'
				});
			}
		} catch {
			// bỏ qua lỗi mạng — người dùng có thể thử lại.
		} finally {
			adding = false;
		}
	}

	onMount(async () => {
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await fetchProduct();
	});
</script>

<svelte:head>
	<title>{product?.name ?? sf(t.products.title, lang)}</title>
</svelte:head>

<section class="detail-page" data-test="product-detail">
	<a class="detail-back" href="/store/products">{sf(t.detail.backToProducts, lang)}</a>

	{#if loadError}
		<div class="detail-state detail-state--error">{loadError}</div>
	{:else if notFound}
		<div class="detail-state">
			<p>{sf(t.detail.notFound, lang)}</p>
			<Button color="primary" variant="outline" to="/store/products">
				{sf(t.detail.backToProducts, lang)}
			</Button>
		</div>
	{:else if loading || !product}
		<div class="detail-state">…</div>
	{:else}
		<div class="detail-main">
			<div class="detail-media">
				{#if product.imageUrl || selectedVariant?.imageUrl}
					<img src={selectedVariant?.imageUrl ?? product.imageUrl!} alt={product.name ?? ''} />
				{:else}
					<div class="detail-media-placeholder">
						{(product.name ?? '?').slice(0, 1).toUpperCase()}
					</div>
				{/if}
			</div>

			<div class="detail-info">
				<h1 class="detail-name">{product.name}</h1>
				<div class="detail-price">
					{#if selectedVariant?.price !== undefined}
						{formatPrice(selectedVariant.price)}
					{:else}
						{#if priceRange().min !== undefined}
							{sf(t.detail.from, lang)} {formatPrice(priceRange().min!)}
							{#if priceRange().max !== priceRange().min}
								– {formatPrice(priceRange().max!)}
							{/if}
						{/if}
					{/if}
				</div>

				{#if product.description}
					<p class="detail-desc">{product.description}</p>
				{/if}

				{#if variants.length === 0}
					<div class="detail-state detail-state--stock">{sf(t.detail.outOfStock, lang)}</div>
				{:else if variants.length === 1}
					<!-- variant duy nhất — không cần picker -->
					<input type="hidden" data-test="variant-single" value={variants[0]!.variantId} />
				{:else}
					<div class="detail-variants" data-test="variant-picker">
						{#each Object.entries(attributeOptions) as [key, options] (key)}
							<div class="detail-variant-group">
								<span class="detail-variant-key">{key}</span>
								<div class="detail-variant-options">
									{#each options as opt (opt)}
										<button
											type="button"
											class="detail-variant-option"
											class:detail-variant-option--active={selectedVariant?.attributes?.[key] === opt}
											onclick={() => pickOption(key, opt)}
										>
											{opt}
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if variants.length > 0}
					<div class="detail-actions">
						<div class="detail-qty">
							<button
								type="button"
								class="detail-qty-btn"
								disabled={quantity <= 1}
								onclick={() => (quantity = Math.max(1, quantity - 1))}
								aria-label="-"
							>−</button>
							<span class="detail-qty-value">{quantity}</span>
							<button
								type="button"
								class="detail-qty-btn"
								onclick={() => (quantity = quantity + 1)}
								aria-label="+"
							>+</button>
						</div>
						<Button
							color="primary"
							disabled={adding || !selectedVariantId}
							loading={adding}
							onClick={() => void addToCart()}
						>
							{sf(t.detail.addToCart, lang)}
						</Button>
						{#if added}
							<Button color="success" variant="outline" to="/store/cart">
								{sf(t.detail.goToCart, lang)}
							</Button>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		{#if related.length}
			<div class="detail-related">
				<h2 class="detail-related-title">{sf(t.detail.relatedTitle, lang)}</h2>
				<div class="detail-related-grid">
					{#each related as rp (rp.productId)}
						<a class="related-card" href="/store/products/{encodeURIComponent(rp.productId)}">
							<div class="related-thumb">
								{#if rp.imageUrl}
									<img src={rp.imageUrl} alt={rp.name ?? ''} loading="lazy" />
								{:else}
									<div class="related-thumb-placeholder">{(rp.name ?? '?').slice(0, 1).toUpperCase()}</div>
								{/if}
							</div>
							<span class="related-name">{rp.name}</span>
							<span class="related-price">
								{#if (rp.variants ?? []).some((v) => typeof v.price === 'number')}
									{sf(t.detail.from, lang)}
									{formatPrice(Math.min(...(rp.variants ?? []).map((v) => v.price as number)))}
								{/if}
							</span>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</section>

<style lang="scss">
	.detail-page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.detail-back {
		align-self: flex-start;
		color: var(--primary, #7c3aed);
		text-decoration: none;
		font-size: 0.9rem;

		&:hover {
			text-decoration: underline;
		}
	}

	.detail-state {
		padding: 2.5rem 1rem;
		text-align: center;
		color: var(--muted-foreground, #666);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;

		&--error {
			color: var(--error, #b3261e);
		}

		&--stock {
			color: var(--warning, #b26a00);
			font-weight: 600;
			align-self: flex-start;
			padding: 0.5rem 0;
		}
	}

	.detail-main {
		display: grid;
		grid-template-columns: minmax(260px, 420px) minmax(0, 1fr);
		gap: 2rem;
		align-items: start;

		@media (max-width: 760px) {
			grid-template-columns: 1fr;
		}
	}

	.detail-media {
		aspect-ratio: 1;
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 0.9rem;
		background: var(--muted, #f5f5f5);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.detail-media-placeholder {
		font-size: 4rem;
		font-weight: 800;
		color: var(--muted-foreground, #bbb);
	}

	.detail-info {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		min-width: 0;
	}

	.detail-name {
		margin: 0;
		font-size: 1.55rem;
		font-weight: 800;
		color: var(--foreground, #111);
	}

	.detail-price {
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--primary, #7c3aed);
	}

	.detail-desc {
		margin: 0;
		color: var(--muted-foreground, #555);
		font-size: 0.95rem;
		line-height: 1.55;
		white-space: pre-line;
	}

	.detail-variants {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.detail-variant-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.detail-variant-key {
		font-size: 0.82rem;
		color: var(--muted-foreground, #777);
		text-transform: capitalize;
	}

	.detail-variant-options {
		display: flex;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.detail-variant-option {
		padding: 0.4rem 0.85rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border, #ddd);
		background: var(--card, #fff);
		color: var(--foreground, #222);
		font: inherit;
		font-size: 0.88rem;
		cursor: pointer;

		&:hover {
			border-color: var(--primary, #7c3aed);
		}

		&--active {
			border-color: var(--primary, #7c3aed);
			background: color-mix(in srgb, var(--primary, #7c3aed) 10%, transparent);
			color: var(--primary, #6d28d9);
			font-weight: 600;
		}
	}

	.detail-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: 0.25rem;
	}

	.detail-qty {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--border, #ddd);
		border-radius: 0.5rem;
		padding: 0.2rem 0.35rem;
	}

	.detail-qty-btn {
		width: 2rem;
		height: 2rem;
		border: none;
		background: none;
		font-size: 1.05rem;
		cursor: pointer;
		color: var(--foreground, #222);
		border-radius: 0.35rem;

		&:hover:not(:disabled) {
			background: var(--muted, #f0f0f0);
		}

		&:disabled {
			opacity: 0.4;
			cursor: default;
		}
	}

	.detail-qty-value {
		min-width: 2.2ch;
		text-align: center;
		font-weight: 600;
	}

	.detail-related {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.detail-related-title {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 700;
	}

	.detail-related-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 1rem;
	}

	.related-card {
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 0.75rem;
		overflow: hidden;
		background: var(--card, #fff);
		display: flex;
		flex-direction: column;
		text-decoration: none;
		color: inherit;
		gap: 0.35rem;
		padding-bottom: 0.75rem;

		&:hover {
			border-color: var(--primary, #7c3aed);
		}
	}

	.related-thumb {
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

	.related-thumb-placeholder {
		font-size: 2rem;
		font-weight: 800;
		color: var(--muted-foreground, #bbb);
	}

	.related-name {
		padding: 0 0.75rem;
		font-size: 0.9rem;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.related-price {
		padding: 0 0.75rem;
		font-size: 0.85rem;
		color: var(--primary, #7c3aed);
		font-weight: 600;
	}
</style>
