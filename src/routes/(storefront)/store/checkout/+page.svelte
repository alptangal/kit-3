// src/routes/(storefront)/store/checkout/+page.svelte
// #34 Thanh toán 3 bước: (1) địa chỉ + SĐT, (2) phương thức thanh toán
// (cash|bank_transfer|momo|zalopay|cod), (3) review + đặt hàng — POST
// /api/storefront/checkout/initiate → redirect trang cảm ơn với orderCode.
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
		displayName?: string;
	}
	interface CartData {
		cartId?: string;
		items: CartItem[];
		subtotal: number;
		discountAmount: number;
		appliedPromotionCode?: string | null;
		total: number;
	}

	interface AddressForm {
		street: string;
		ward: string;
		district: string;
		province: string;
		postalCode: string;
		phoneNumber: string;
		recipientName: string;
	}

	// 5 phương thức UI exposes (schema có 7 — bank_pos/loyalty_points dùng nội bộ).
	const PAYMENT_METHODS = ['cash', 'bank_transfer', 'momo', 'zalopay', 'cod'] as const;
	type PaymentMethod = (typeof PAYMENT_METHODS)[number];

	let encryptionKeys = $state<undefined | { publicKey: CryptoKey; privateKey: CryptoKey }>(undefined);
	let cart = $state<CartData | undefined>(undefined);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);

	let step = $state<1 | 2 | 3>(1);
	let address = $state<AddressForm>({
		street: '',
		ward: '',
		district: '',
		province: '',
		postalCode: '',
		phoneNumber: '',
		recipientName: ''
	});
	let paymentMethod = $state<PaymentMethod>('cod');
	let notes = $state('');
	let addressError = $state<string | undefined>(undefined);
	let placing = $state(false);
	let placeError = $state<string | undefined>(undefined);

	const isLoggedIn = $derived(!!pageStore.data?.user);

	function formatPrice(value: number | undefined | null): string {
		if (typeof value !== 'number') return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
			style: 'currency',
			currency: 'VND',
			maximumFractionDigits: 0
		}).format(value);
	}

	function paymentLabel(m: PaymentMethod): string {
		const map: Record<PaymentMethod, { vi: string; en: string }> = {
			cash: t.checkout.paymentCash,
			bank_transfer: t.checkout.paymentBankTransfer,
			momo: t.checkout.paymentMomo,
			zalopay: t.checkout.paymentZalopay,
			cod: t.checkout.paymentCod
		};
		return sf(map[m], lang);
	}

	function validateAddress(): boolean {
		const required: (keyof AddressForm)[] = ['street', 'ward', 'district', 'province', 'phoneNumber', 'recipientName'];
		for (const key of required) {
			if (!address[key].trim()) return false;
		}
		return true;
	}

	function goStep2() {
		if (!validateAddress()) {
			addressError = sf(t.checkout.invalidShippingAddress, lang);
			return;
		}
		addressError = undefined;
		step = 2;
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
				loadError = resolveServerMessage(response.message, lang, sf(t.checkout.loadFailed, lang));
			}
		} catch (err) {
			loading = false;
			loadError = err instanceof Error ? err.message : String(err);
		}
	}

	async function placeOrder() {
		if (!encryptionKeys || !cart?.cartId) return;
		placing = true;
		placeError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/storefront/checkout/initiate',
				{
					method: 'POST',
					body: {
						cartId: cart.cartId,
						shippingAddress: { ...address },
						paymentMethod,
						notes: notes.trim() || undefined
					}
				},
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as
					| { orderCode?: string; paymentCode?: string; qr?: { payload: string; dataUrl: string } }
					| undefined;
				const params = new URLSearchParams();
				if (data?.orderCode) params.set('order', data.orderCode);
				// QR payment: payload text được render lại client-side ở thanks page
				// (dataUrl base64 quá dài cho URL).
				if (data?.paymentCode) params.set('pay', data.paymentCode);
				if (data?.qr?.payload) params.set('qr', data.qr.payload);
				goto(`/store/checkout/thanks?${params.toString()}`);
			} else {
				placeError = resolveServerMessage(response.message, lang, sf(t.checkout.placeFailed, lang));
			}
		} catch (err) {
			placeError = err instanceof Error ? err.message : String(err);
		} finally {
			placing = false;
		}
	}

	onMount(async () => {
		if (!isLoggedIn) return;
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await fetchCart();
	});
</script>

<svelte:head>
	<title>{sf(t.checkout.title, lang)}</title>
</svelte:head>

<section class="checkout-page">
	<header class="checkout-header">
		<h1 class="checkout-title">{sf(t.checkout.title, lang)}</h1>
		<ol class="checkout-steps">
			<li class:active={step === 1} class:done={step > 1}>{sf(t.checkout.stepAddress, lang)}</li>
			<li class:active={step === 2} class:done={step > 2}>{sf(t.checkout.stepPayment, lang)}</li>
			<li class:active={step === 3}>{sf(t.checkout.stepReview, lang)}</li>
		</ol>
	</header>

	{#if !isLoggedIn}
		<div class="checkout-state">
			<p>{sf(t.checkout.loginRequired, lang)}</p>
			<Button color="primary" to="/login?redirect=/store/checkout">
				{sf(t.checkout.login, lang)}
			</Button>
		</div>
	{:else if loadError}
		<div class="checkout-state checkout-state--error">{loadError}</div>
	{:else if loading || !cart}
		<div class="checkout-state">…</div>
	{:else if !cart.items?.length}
		<div class="checkout-state">
			<p>{sf(t.cart.empty, lang)}</p>
			<Button color="primary" to="/store/products">
				{sf(t.cart.continueShopping, lang)}
			</Button>
		</div>
	{:else}
		<div class="checkout-inner">
		{#if step === 1}
			<div class="checkout-form">
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<div class="checkout-field">
					<label>{sf(t.checkout.recipientName, lang)}</label>
					<Input bind:value={address.recipientName} />
				</div>
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<div class="checkout-field">
					<label>{sf(t.checkout.phoneNumber, lang)}</label>
					<Input bind:value={address.phoneNumber} inputmode="tel" />
				</div>
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<div class="checkout-field">
					<label>{sf(t.checkout.street, lang)}</label>
					<Input bind:value={address.street} />
				</div>
				<div class="checkout-grid">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<div class="checkout-field">
						<label>{sf(t.checkout.ward, lang)}</label>
						<Input bind:value={address.ward} />
					</div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<div class="checkout-field">
						<label>{sf(t.checkout.district, lang)}</label>
						<Input bind:value={address.district} />
					</div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<div class="checkout-field">
						<label>{sf(t.checkout.province, lang)}</label>
						<Input bind:value={address.province} />
					</div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<div class="checkout-field">
						<label>{sf(t.checkout.postalCode, lang)}</label>
						<Input bind:value={address.postalCode} />
					</div>
				</div>
				{#if addressError}
					<p class="checkout-error">{addressError}</p>
				{/if}
				<div class="checkout-actions">
					<span></span>
					<Button color="primary" onClick={goStep2}>{sf(t.checkout.next, lang)}</Button>
				</div>
			</div>
		{:else if step === 2}
			<div class="checkout-form">
				<div class="checkout-payment-list">
					{#each PAYMENT_METHODS as m (m)}
						<button
							type="button"
							class="checkout-payment-option"
							class:active={paymentMethod === m}
							onclick={() => (paymentMethod = m)}
						>
							<span class="checkout-payment-name">{paymentLabel(m)}</span>
							{#if paymentMethod === m}<span class="checkout-payment-check">✓</span>{/if}
						</button>
					{/each}
				</div>
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<div class="checkout-field">
					<label>{sf(t.checkout.notesLabel, lang)}</label>
					<Input bind:value={notes} />
				</div>
				<div class="checkout-actions">
					<Button variant="outline" onClick={() => { step = 1; }}>{sf(t.checkout.back, lang)}</Button>
					<Button color="primary" onClick={() => { step = 3; }}>{sf(t.checkout.next, lang)}</Button>
				</div>
			</div>
		{:else}
			<div class="checkout-form">
				<h3 class="checkout-section-title">{sf(t.checkout.orderSummary, lang)}</h3>
				<div class="checkout-items">
					{#each cart.items as item (item.variantId)}
						<div class="checkout-item">
							<span class="checkout-item-name">{item.displayName ?? item.variantId} × {item.quantity}</span>
							<strong>{formatPrice(item.price * item.quantity)}</strong>
						</div>
					{/each}
					<div class="checkout-item checkout-item--total">
						<span>{sf(t.cart.total, lang)}</span>
						<strong>{formatPrice(cart.total)}</strong>
					</div>
				</div>

				<h3 class="checkout-section-title">{sf(t.checkout.shippingTo, lang)}</h3>
				<p class="checkout-address">
					{address.recipientName} — {address.phoneNumber}<br />
					{address.street}, {address.ward}, {address.district}, {address.province}{address.postalCode ? `, ${address.postalCode}` : ''}
				</p>

				<h3 class="checkout-section-title">{sf(t.checkout.payWith, lang)}</h3>
				<p class="checkout-address">{paymentLabel(paymentMethod)}</p>

				{#if placeError}
					<p class="checkout-error">{placeError}</p>
				{/if}

				<div class="checkout-actions">
					<Button variant="outline" onClick={() => { step = 2; }}>{sf(t.checkout.back, lang)}</Button>
					<Button color="success" disabled={placing} onClick={() => void placeOrder()}>
						{sf(t.checkout.placeOrder, lang)}
					</Button>
				</div>
			</div>
		{/if}
		</div>
	{/if}
</section>

<style lang="scss">
	.checkout-inner {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.checkout-page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 760px;
		margin: 0 auto;
		width: 100%;
	}

	.checkout-header {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.checkout-title {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 700;
	}

	.checkout-steps {
		display: flex;
		gap: 0.5rem;
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 0.85rem;

		li {
			color: var(--muted-foreground, #888);
			padding: 0.25rem 0.6rem;
			border-radius: 999px;
			border: 1px solid var(--border, #e5e5e5);

			&.active {
				color: var(--foreground, #111);
				border-color: var(--primary, #111);
				font-weight: 600;
			}

			&.done {
				color: var(--success, #2e7d32);
				border-color: var(--success, #2e7d32);
			}
		}
	}

	.checkout-state {
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

	.checkout-form {
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 0.75rem;
		background: var(--card, #fff);
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.checkout-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.875rem;

		@media (max-width: 640px) {
			grid-template-columns: 1fr;
		}
	}

	.checkout-field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;

		label {
			font-size: 0.85rem;
			font-weight: 600;
			color: var(--muted-foreground, #555);
		}
	}

	.checkout-error {
		margin: 0;
		color: var(--error, #b3261e);
		font-size: 0.9rem;
	}

	.checkout-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
	}

	.checkout-payment-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.checkout-payment-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 0.5rem;
		background: transparent;
		cursor: pointer;
		text-align: left;
		font-size: 0.95rem;

		&.active {
			border-color: var(--primary, #111);
			font-weight: 600;
		}
	}

	.checkout-payment-check {
		color: var(--success, #2e7d32);
		font-weight: 700;
	}

	.checkout-section-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
	}

	.checkout-items {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.checkout-item {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.92rem;

		&--total {
			border-top: 1px solid var(--border, #e5e5e5);
			padding-top: 0.5rem;
			font-size: 1rem;
		}
	}

	.checkout-item-name {
		overflow-wrap: anywhere;
	}

	.checkout-address {
		margin: 0;
		font-size: 0.92rem;
		color: var(--muted-foreground, #444);
	}
</style>
