// src/routes/(storefront)/store/+page.svelte — landing tại /store
// Landing storefront: hero + CTA vào /store/products.
<script lang="ts">
	import { client } from '$store/basic.svelte';
	import { Button } from '$components/element';
	import { STOREFRONT_CONTENTS, sf } from '../_interface';

	const lang: 'vi' | 'en' = $derived(
		client.browser?.language === 'vi' ? 'vi' : 'en'
	);
	const t = STOREFRONT_CONTENTS;
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
