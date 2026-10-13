// src/routes/(storefront)/store/cart/+page.svelte
// #33 Giỏ hàng: xem giỏ, tăng/giảm qty, xóa item, áp mã khuyến mãi,
// nút "Tiến hành thanh toán" → /store/checkout.
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
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

	interface CartItem {
		variantId: string;
		quantity: number;
		price: number;
		promotionApplied?: boolean;
		displayName?: string;
		imageUrl?: string;
	}
	interface CartData {
		cartId?: string;
		branchId?: string | null;
		items: CartItem[];
		subtotal: number;
		discountAmount: number;
		appliedPromotionCode?: string | null;
		total: number;
	}

	let encryptionKeys = $state<undefined | { publicKey: CryptoKey; privateKey: CryptoKey }>(undefined);
	let cart = $state<CartData | undefined>(undefined);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let busyVariantId = $state<string | undefined>(undefined);
	let promoCodeInput = $state('');
	let promoBusy = $state(false);

	const isLoggedIn = $derived(!!pageStore.data?.user);

	function formatPrice(value: number | undefined | null): string {
		if (typeof value !== 'number') return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
			style: 'currency',
			currency: 'VND',
			maximumFractionDigits: 0
		}).format(value);
	}

	function toast(text: string, tone: 'success' | 'error' = 'success') {
		client.browser?.toasts?.create?.({ title: text, color: tone });
	}

	async function fetchCart() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/storefront/cart/get',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as { cart?: CartData } | undefined;
				cart = data?.cart;
			} else {
				loadError = resolveServerMessage(response.message, lang, sf(t.cart.loadFailed, lang));
			}
		} catch (err) {
			loading = false;
			loadError = err instanceof Error ? err.message : String(err);
		}
	}

	async function updateQty(item: CartItem, delta: number) {
		if (!encryptionKeys || !cart) return;
		const next = item.quantity + delta;
		busyVariantId = item.variantId;
		try {
			const response = await encryption.fetchSecure(
				'/api/storefront/cart/update-qty',
				{ method: 'POST', body: { variantId: item.variantId, quantity: next } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { cart?: CartData } | undefined;
				cart = data?.cart ?? cart;
			} else {
				toast(resolveServerMessage(response.message, lang, sf(t.cart.loadFailed, lang)), 'error');
			}
		} catch {
			// bỏ qua — user thử lại
		} finally {
			busyVariantId = undefined;
		}
	}

	async function removeItem(item: CartItem) {
		if (!encryptionKeys || !cart) return;
		busyVariantId = item.variantId;
		try {
			const response = await encryption.fetchSecure(
				'/api/storefront/cart/remove',
				{ method: 'POST', body: { variantId: item.variantId } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { cart?: CartData } | undefined;
				cart = data?.cart ?? cart;
			} else {
				toast(resolveServerMessage(response.message, lang, sf(t.cart.loadFailed, lang)), 'error');
			}
		} finally {
			busyVariantId = undefined;
		}
	}

	async function applyPromotion() {
		if (!encryptionKeys || !promoCodeInput.trim()) return;
		promoBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/storefront/cart/apply-promotion',
				{ method: 'POST', body: { promotionCode: promoCodeInput.trim() } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { cart?: CartData } | undefined;
				cart = data?.cart ?? cart;
				promoCodeInput = '';
				toast(lang === 'vi' ? 'Đã áp dụng khuyến mãi' : 'Promotion applied');
			} else {
				toast(resolveServerMessage(response.message, lang, lang === 'vi' ? 'Áp dụng thất bại' : 'Failed to apply'), 'error');
			}
		} catch {
			// bỏ qua
		} finally {
			promoBusy = false;
		}
	}

	async function clearCart() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/storefront/cart/clear',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { cart?: CartData } | undefined;
				cart = data?.cart ?? cart;
			}
		} catch {
			// bỏ qua
		}
	}

	function goCheckout() {
		if (!cart?.cartId) return;
		goto('/store/checkout');
	}

	onMount(async () => {
		if (!isLoggedIn) return; // hiện loginRequired
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await fetchCart();
	});
</script>

<svelte:head>
	<title>{sf(t.cart.title, lang)}</title>
</svelte:head>

<section class="cart-page">
	<header class="cart-header">
		<h1 class="cart-title">{sf(t.cart.title, lang)}</h1>
		{#if cart?.items?.length}
			<Button size="sm" variant="outline" color="error" onClick={() => void clearCart()}>
				{sf(t.cart.clearCart, lang)}
			</Button>
		{/if}
	</header>

	{#if !isLoggedIn}
		<div class="cart-state">
			<p>{sf(t.cart.loginRequired, lang)}</p>
			<Button color="primary" to="/login?redirect=/store/cart">
				{sf(t.cart.login, lang)}
			</Button>
		</div>
	{:else if loadError}
		<div class="cart-state cart-state--error">{loadError}</div>
	{:else if loading || !cart}
		<div class="cart-state">…</div>
	{:else if !cart.items?.length}
		<div class="cart-state">
			<p>{sf(t.cart.empty, lang)}</p>
			<Button color="primary" to="/store/products">
				{sf(t.cart.continueShopping, lang)}
			</Button>
		</div>
	{:else}
		<div class="cart-body">
			<div class="cart-items">
				{#each cart.items as item (item.variantId)}
					<div class="cart-item" class:cart-item--busy={busyVariantId === item.variantId}>
						<div class="cart-item-info">
							<span class="cart-item-name">{item.displayName ?? item.variantId}</span>
							<span class="cart-item-price">{formatPrice(item.price)}</span>
						</div>
						<div class="cart-item-qty">
							<Button
								size="sm"
								variant="outline"
								disabled={busyVariantId === item.variantId}
								onClick={() => void updateQty(item, -1)}
								aria-label="-"
							>−</Button>
							<span class="cart-item-qty-value">{item.quantity}</span>
							<Button
								size="sm"
								variant="outline"
								disabled={busyVariantId === item.variantId}
								onClick={() => void updateQty(item, 1)}
								aria-label="+"
							>+</Button>
						</div>
						<div class="cart-item-total">{formatPrice(item.price * item.quantity)}</div>
						<Button
							size="sm"
							variant="ghost"
							color="error"
							disabled={busyVariantId === item.variantId}
							onClick={() => void removeItem(item)}
						>
							{sf(t.cart.remove, lang)}
						</Button>
					</div>
				{/each}
			</div>

			<aside class="cart-summary">
				<div class="cart-summary-row">
					<span>{sf(t.cart.subtotal, lang)}</span>
					<strong>{formatPrice(cart.subtotal)}</strong>
				</div>
				{#if cart.discountAmount > 0}
					<div class="cart-summary-row cart-summary-row--discount">
						<span>{sf(t.cart.discount, lang)}{cart.appliedPromotionCode ? ` (${cart.appliedPromotionCode})` : ''}</span>
						<strong>−{formatPrice(cart.discountAmount)}</strong>
					</div>
				{/if}
				<div class="cart-summary-row cart-summary-row--total">
					<span>{sf(t.cart.total, lang)}</span>
					<strong>{formatPrice(cart.total)}</strong>
				</div>

				<div class="cart-promo">
					<Input placeholder={sf(t.cart.promoCode, lang)} bind:value={promoCodeInput} />
					<Button size="sm" color="secondary" disabled={promoBusy || !promoCodeInput.trim()} onClick={() => void applyPromotion()}>
						{sf(t.cart.apply, lang)}
					</Button>
				</div>

				<Button color="success" disabled={!cart.items.length} onClick={goCheckout}>
					{sf(t.cart.checkout, lang)}
				</Button>
			</aside>
		</div>
	{/if}
</section>

<style lang="scss">
	.cart-page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.cart-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.cart-title {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 700;
	}

	.cart-state {
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
	}

	.cart-body {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
		gap: 1.5rem;
		align-items: start;

		@media (max-width: 820px) {
			grid-template-columns: 1fr;
		}
	}

	.cart-items {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 0.75rem;
		background: var(--card, #fff);
		overflow: hidden;
	}

	.cart-item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto auto;
		gap: 0.75rem;
		align-items: center;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid var(--border, #eee);

		&:last-child {
			border-bottom: none;
		}

		&--busy {
			opacity: 0.6;
		}

		@media (max-width: 640px) {
			grid-template-columns: 1fr auto;
			grid-auto-flow: row;
		}
	}

	.cart-item-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.cart-item-name {
		font-weight: 600;
		font-size: 0.95rem;
		overflow-wrap: anywhere;
	}

	.cart-item-price {
		font-size: 0.85rem;
		color: var(--muted-foreground, #666);
	}

	.cart-item-qty {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.cart-item-qty-value {
		min-width: 2ch;
		text-align: center;
		font-weight: 600;
	}

	.cart-item-total {
		font-weight: 700;
		white-space: nowrap;
	}

	.cart-summary {
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 0.75rem;
		background: var(--card, #fff);
		padding: 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.cart-summary-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.95rem;

		&--discount strong {
			color: var(--success, #2e7d32);
		}

		&--total {
			font-size: 1.05rem;
			border-top: 1px solid var(--border, #e5e5e5);
			padding-top: 0.65rem;
		}
	}

	.cart-promo {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
	}
</style>
