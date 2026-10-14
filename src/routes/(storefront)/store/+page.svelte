// src/routes/(storefront)/store/+page.svelte — landing tại /store
// Landing storefront: hero + CTA + section "Sản phẩm mới" (8 sản phẩm mới
// nhất qua POST /api/storefront/products/list — client fetch mã hoá như
// products page).
<script lang="ts">
	import { onMount } from 'svelte';
	import { client } from '$store/basic.svelte';
	import { encryption } from '$modules/encryption';
	import { Button } from '$components/element';
	import { STOREFRONT_CONTENTS, sf, resolveServerMessage } from '../_interface';

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
	let featured = $state<ProductLite[]>([]);
	let featuredLoading = $state(false);
	let featuredError = $state<string | undefined>(undefined);

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

	async function fetchFeatured() {
		if (!encryptionKeys) return;
		featuredLoading = true;
		featuredError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/storefront/products/list',
				{ method: 'POST', body: { page: 1, pageSize: 8 } },
				encryptionKeys
			);
			featuredLoading = false;
			if (response.ok) {
				const data = response.data as { products?: ProductLite[] } | undefined;
				featured = data?.products ?? [];
			} else {
				featuredError = resolveServerMessage(response.message, lang, sf(t.home.loadFailed, lang));
			}
		} catch (err) {
			featuredLoading = false;
			featuredError = err instanceof Error ? err.message : String(err);
		}
	}

	onMount(async () => {
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await fetchFeatured();
	});
</script>

<svelte:head>
	<title>{sf(t.layout.brand, lang)}</title>
</svelte:head>

<section class="landing">
	<div class="landing-hero">
		<h1 class="landing-title">{sf(t.landing.heroTitle, lang)}</h1>
		<p class="landing-subtitle">{sf(t.landing.heroSubtitle, lang)}</p>
		<Button color="primary" to="/store/products">
			{sf(t.landing.ctaBrowse, lang)}
		</Button>
	</div>

	<div class="landing-featured" data-test="home-featured">
		<div class="landing-featured-head">
			<div>
				<h2 class="landing-featured-title">{sf(t.home.featuredTitle, lang)}</h2>
				<p class="landing-featured-subtitle">{sf(t.home.featuredSubtitle, lang)}</p>
			</div>
			<Button size="sm" variant="outline" color="primary" to="/store/products">
				{sf(t.home.viewAll, lang)}
			</Button>
		</div>

		{#if featuredError}
			<div class="landing-featured-state landing-featured-state--error">{featuredError}</div>
		{:else if featuredLoading}
			<div class="landing-featured-state">…</div>
		{:else if featured.length}
			<div class="landing-featured-grid" data-test="featured-grid">
				{#each featured as p (p.productId)}
					<a class="featured-card" href="/store/products/{encodeURIComponent(p.productId)}">
						<div class="featured-thumb">
							{#if p.imageUrl}
								<img src={p.imageUrl} alt={p.name ?? ''} loading="lazy" />
							{:else}
								<div class="featured-thumb-placeholder">{(p.name ?? '?').slice(0, 1).toUpperCase()}</div>
							{/if}
						</div>
						<div class="featured-body">
							<span class="featured-name">{p.name}</span>
							<span class="featured-price">
								{#if minPrice(p) !== undefined}
									{sf(t.home.from, lang)} {formatPrice(minPrice(p) as number)}
								{/if}
							</span>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>

	<div class="landing-features">
		<div class="landing-feature">
			<h3>{sf(t.landing.featureShip, lang)}</h3>
			<p>{sf(t.landing.featureShipDesc, lang)}</p>
		</div>
		<div class="landing-feature">
			<h3>{sf(t.landing.featurePay, lang)}</h3>
			<p>{sf(t.landing.featurePayDesc, lang)}</p>
		</div>
		<div class="landing-feature">
			<h3>{sf(t.landing.featureSupport, lang)}</h3>
			<p>{sf(t.landing.featureSupportDesc, lang)}</p>
		</div>
	</div>
</section>

<style lang="scss">
	.landing {
		display: flex;
		flex-direction: column;
		gap: 3rem;
	}

	.landing-hero {
		text-align: center;
		padding: 3rem 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.landing-title {
		font-size: 2.1rem;
		font-weight: 800;
		margin: 0;
		color: var(--foreground, #111);
	}

	.landing-subtitle {
		margin: 0;
		font-size: 1.05rem;
		color: var(--muted-foreground, #555);
		max-width: 34rem;
	}

	.landing-featured {
		display: flex;
		flex-direction: column;
		gap: 1.125rem;
	}

	.landing-featured-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.landing-featured-title {
		margin: 0;
		font-size: 1.45rem;
		font-weight: 800;
	}

	.landing-featured-subtitle {
		margin: 0.15rem 0 0;
		font-size: 0.92rem;
		color: var(--muted-foreground, #666);
	}

	.landing-featured-state {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--muted-foreground, #666);

		&--error {
			color: var(--error, #b3261e);
		}
	}

	.landing-featured-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1.1rem;
	}

	.featured-card {
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 0.75rem;
		overflow: hidden;
		background: var(--card, #fff);
		display: flex;
		flex-direction: column;
		text-decoration: none;
		color: inherit;

		&:hover {
			border-color: var(--primary, #7c3aed);
			box-shadow: 0 4px 14px rgb(0 0 0 / 0.06);
		}
	}

	.featured-thumb {
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

	.featured-thumb-placeholder {
		font-size: 2.2rem;
		font-weight: 800;
		color: var(--muted-foreground, #bbb);
	}

	.featured-body {
		padding: 0.75rem 0.875rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.featured-name {
		font-size: 0.92rem;
		font-weight: 600;
		overflow-wrap: anywhere;
		display: -webkit-box;
		line-clamp: 1;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.featured-price {
		font-size: 0.88rem;
		font-weight: 700;
		color: var(--primary, #7c3aed);
	}

	.landing-features {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1.25rem;

		@media (max-width: 720px) {
			grid-template-columns: 1fr;
		}
	}

	.landing-feature {
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 0.75rem;
		padding: 1.25rem;
		background: var(--card, #fff);

		h3 {
			margin: 0 0 0.4rem;
			font-size: 1rem;
			font-weight: 700;
		}

		p {
			margin: 0;
			font-size: 0.9rem;
			color: var(--muted-foreground, #555);
		}
	}
</style>
