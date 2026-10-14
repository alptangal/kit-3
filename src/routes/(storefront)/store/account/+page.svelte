// src/routes/(storefront)/store/account/+page.svelte
// Trang tài khoản khách: thông tin user + danh sách đơn hàng của chính mình
// (POST /api/storefront/orders/my — userId từ actor, mới nhất trước).
<script lang="ts">
	import { onMount } from 'svelte';
	import { page as pageStore } from '$app/state';
	import { client } from '$store/basic.svelte';
	import { encryption } from '$modules/encryption';
	import { Button } from '$components/element';
	import { STOREFRONT_CONTENTS, sf, resolveServerMessage } from '../../_interface';

	const lang: 'vi' | 'en' = $derived(
		client.browser?.language === 'vi' ? 'vi' : 'en'
	);
	const t = STOREFRONT_CONTENTS;

	interface OrderItem {
		variantId: string;
		quantity: number;
		price: number;
	}
	interface MyOrder {
		orderId: string;
		orderCode?: string;
		status?: string;
		items?: OrderItem[];
		totalAmount?: number;
		createdAt?: string;
	}

	let encryptionKeys = $state<undefined | { publicKey: CryptoKey; privateKey: CryptoKey }>(undefined);
	let orders = $state<MyOrder[]>([]);
	let total = $state(0);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let expandedOrderId = $state<string | undefined>(undefined);

	const user = $derived(pageStore.data?.user as
		| { userId?: string; username?: string; email?: string; phone?: string; firstName?: string; lastName?: string }
		| null
		| undefined);
	const isLoggedIn = $derived(!!user?.userId);

	const STATUS_STYLES: Record<string, string> = {
		pending: 'order-status--pending',
		confirmed: 'order-status--confirmed',
		shipped: 'order-status--shipped',
		delivered: 'order-status--delivered',
		cancelled: 'order-status--cancelled'
	};

	function statusLabel(status: string | undefined): string {
		const map: Record<string, { vi: string; en: string }> = {
			pending: { vi: 'Chờ xác nhận', en: 'Pending' },
			confirmed: { vi: 'Đã xác nhận', en: 'Confirmed' },
			shipped: { vi: 'Đang giao', en: 'Shipped' },
			delivered: { vi: 'Đã giao', en: 'Delivered' },
			cancelled: { vi: 'Đã huỷ', en: 'Cancelled' }
		};
		if (!status) return '—';
		return map[status] ? sf(map[status], lang) : status;
	}

	function formatDate(iso: string | undefined): string {
		if (!iso) return '—';
		try {
			return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				dateStyle: 'medium',
				timeStyle: 'short'
			}).format(new Date(iso));
		} catch {
			return iso;
		}
	}

	function formatPrice(value: number | undefined | null): string {
		if (typeof value !== 'number') return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
			style: 'currency',
			currency: 'VND',
			maximumFractionDigits: 0
		}).format(value);
	}

	function itemCount(order: MyOrder): number {
		return (order.items ?? []).reduce((sum, it) => sum + (it.quantity ?? 0), 0);
	}

	async function fetchOrders() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/storefront/orders/my',
				{ method: 'POST', body: { page: 1, pageSize: 20 } },
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as { orders?: MyOrder[]; total?: number } | undefined;
				orders = data?.orders ?? [];
				if (typeof data?.total === 'number') total = data.total;
			} else {
				loadError = resolveServerMessage(response.message, lang, sf(t.account.loadFailed, lang));
			}
		} catch (err) {
			loading = false;
			loadError = err instanceof Error ? err.message : String(err);
		}
	}

	function toggleOrder(orderId: string) {
		expandedOrderId = expandedOrderId === orderId ? undefined : orderId;
	}

	onMount(async () => {
		if (!isLoggedIn) return; // hiện loginRequired
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await fetchOrders();
	});
</script>

<svelte:head>
	<title>{sf(t.account.title, lang)}</title>
</svelte:head>

<section class="account-page" data-test="store-account">
	<header class="account-header">
		<h1 class="account-title">{sf(t.account.title, lang)}</h1>
	</header>

	{#if !isLoggedIn}
		<div class="account-state">
			<p>{sf(t.account.loginRequired, lang)}</p>
			<Button color="primary" to="/login?redirect=/store/account">
				{sf(t.account.login, lang)}
			</Button>
		</div>
	{:else}
		<div class="account-body">
			<aside class="account-info">
				<h2 class="account-info-title">{sf(t.account.infoTitle, lang)}</h2>
				<p class="account-greeting">
					{sf(t.account.greeting, lang)}
					<strong>{user?.firstName ?? ''} {user?.lastName ?? ''.trim()}</strong>
				</p>
				<dl class="account-info-list">
					<div class="account-info-row">
						<dt>{sf(t.account.username, lang)}</dt>
						<dd>{user?.username ?? '—'}</dd>
					</div>
					<div class="account-info-row">
						<dt>{sf(t.account.email, lang)}</dt>
						<dd>{user?.email ?? sf(t.account.notProvided, lang)}</dd>
					</div>
					<div class="account-info-row">
						<dt>{sf(t.account.phone, lang)}</dt>
						<dd>{user?.phone ?? sf(t.account.notProvided, lang)}</dd>
					</div>
				</dl>
				<div class="account-actions">
					<Button size="sm" variant="outline" color="primary" to="/store/products">
						{sf(t.account.continueShopping, lang)}
					</Button>
				</div>
			</aside>

			<div class="account-orders">
				<h2 class="account-orders-title">
					{sf(t.account.ordersTitle, lang)}
					{#if total > 0}<span class="account-orders-count">({total})</span>{/if}
				</h2>

				{#if loadError}
					<div class="account-state account-state--error">{loadError}</div>
				{:else if loading}
					<div class="account-state">…</div>
				{:else if !orders.length}
					<div class="account-state" data-test="account-empty">
						<p>{sf(t.account.ordersEmpty, lang)}</p>
						<Button color="primary" to="/store/products">
							{sf(t.account.continueShopping, lang)}
						</Button>
					</div>
				{:else}
					<div class="orders-list" data-test="account-orders">
						{#each orders as order (order.orderId)}
							<article class="order-card">
								<button
									type="button"
									class="order-card-head"
									onclick={() => toggleOrder(order.orderId)}
								>
									<div class="order-card-main">
										<span class="order-code">{order.orderCode ?? order.orderId}</span>
										<span class="order-date">{formatDate(order.createdAt)}</span>
									</div>
									<div class="order-card-side">
										<span class="order-status {STATUS_STYLES[order.status ?? ''] ?? ''}">
											{statusLabel(order.status)}
										</span>
										<span class="order-total">{formatPrice(order.totalAmount)}</span>
										<span class="order-toggle">{expandedOrderId === order.orderId ? sf(t.account.hideDetails, lang) : sf(t.account.viewDetails, lang)}</span>
									</div>
								</button>
								{#if expandedOrderId === order.orderId}
									<div class="order-card-detail">
										<div class="order-detail-row order-detail-row--head">
											<span>{sf(t.account.orderItems, lang)} ({itemCount(order)})</span>
											<span>{sf(t.account.orderTotal, lang)}</span>
										</div>
										{#each order.items ?? [] as item, idx (idx)}
											<div class="order-detail-row">
												<span class="order-detail-variant">{item.variantId}</span>
												<span class="order-detail-qty">×{item.quantity}</span>
												<span class="order-detail-price">{formatPrice(item.price)}</span>
											</div>
										{/each}
									</div>
								{/if}
							</article>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</section>

<style lang="scss">
	.account-page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.account-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.account-title {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 700;
	}

	.account-state {
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

	.account-body {
		display: grid;
		grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
		gap: 1.5rem;
		align-items: start;

		@media (max-width: 820px) {
			grid-template-columns: 1fr;
		}
	}

	.account-info {
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 0.75rem;
		background: var(--card, #fff);
		padding: 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.account-info-title,
	.account-orders-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
	}

	.account-orders-count {
		color: var(--muted-foreground, #888);
		font-weight: 500;
		font-size: 0.9rem;
		margin-left: 0.25rem;
	}

	.account-greeting {
		margin: 0;
		color: var(--muted-foreground, #555);
		font-size: 0.92rem;
	}

	.account-info-list {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.account-info-row {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;

		dt {
			font-size: 0.78rem;
			color: var(--muted-foreground, #888);
		}

		dd {
			margin: 0;
			font-size: 0.92rem;
			overflow-wrap: anywhere;
		}
	}

	.account-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.account-orders {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		min-width: 0;
	}

	.orders-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.order-card {
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 0.75rem;
		background: var(--card, #fff);
		overflow: hidden;
	}

	.order-card-head {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: inherit;
		flex-wrap: wrap;

		&:hover {
			background: var(--muted, #f7f7f7);
		}
	}

	.order-card-main {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.order-code {
		font-weight: 700;
		font-size: 0.95rem;
		overflow-wrap: anywhere;
	}

	.order-date {
		font-size: 0.8rem;
		color: var(--muted-foreground, #777);
	}

	.order-card-side {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.order-status {
		font-size: 0.78rem;
		font-weight: 600;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		background: var(--muted, #eee);
		color: var(--muted-foreground, #555);

		&--pending {
			background: color-mix(in srgb, var(--warning, #f0a020) 18%, transparent);
			color: var(--warning, #b26a00);
		}

		&--confirmed {
			background: color-mix(in srgb, var(--info, #2196f3) 15%, transparent);
			color: var(--info, #1565c0);
		}

		&--shipped {
			background: color-mix(in srgb, var(--primary, #7c3aed) 14%, transparent);
			color: var(--primary, #6d28d9);
		}

		&--delivered {
			background: color-mix(in srgb, var(--success, #2e7d32) 15%, transparent);
			color: var(--success, #2e7d32);
		}

		&--cancelled {
			background: color-mix(in srgb, var(--error, #b3261e) 12%, transparent);
			color: var(--error, #b3261e);
		}
	}

	.order-total {
		font-weight: 700;
		white-space: nowrap;
	}

	.order-toggle {
		font-size: 0.8rem;
		color: var(--primary, #7c3aed);
		text-decoration: underline;
		white-space: nowrap;
	}

	.order-card-detail {
		border-top: 1px solid var(--border, #eee);
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.order-detail-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.88rem;
		overflow-wrap: anywhere;

		&--head {
			font-weight: 600;
			color: var(--muted-foreground, #666);
			justify-content: space-between;
		}
	}

	.order-detail-variant {
		flex: 1;
		min-width: 0;
	}

	.order-detail-qty {
		color: var(--muted-foreground, #777);
		white-space: nowrap;
	}

	.order-detail-price {
		font-weight: 600;
		white-space: nowrap;
	}
</style>
