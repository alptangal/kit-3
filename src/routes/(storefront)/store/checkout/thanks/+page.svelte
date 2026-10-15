// src/routes/(storefront)/store/checkout/thanks/+page.svelte
// Trang cảm ơn sau khi đặt hàng — nhận orderCode qua query ?order=.
<script lang="ts">
	import { onMount } from 'svelte';
	import { page as pageStore } from '$app/state';
	import { client } from '$store/basic.svelte';
	import { Button } from '$components/element';
	import { STOREFRONT_CONTENTS, sf } from '../../../_interface';

	const lang: 'vi' | 'en' = $derived(
		client.browser?.language === 'vi' ? 'vi' : 'en'
	);
	const t = STOREFRONT_CONTENTS;

	const orderCode = $derived((pageStore.url.searchParams.get('order') ?? '').trim());
	// QR thanh toán (momo/zalopay/bank_transfer): truyền qua query — dataUrl quá dài
	// cho URL nên chỉ truyền paymentCode; QR render lại từ payload chuẩn hoá ở server
	// (endpoint qr-data) hoặc hiển thị payload text. Đơn giản: nhận qr payload ngắn qua
	// query ?qr= (payload text) + render QR client-side bằng lib qrcode.
	const qrPayload = $derived((pageStore.url.searchParams.get('qr') ?? '').trim());
	const paymentCode = $derived((pageStore.url.searchParams.get('pay') ?? '').trim());

	let qrDataUrl = $state('');
	onMount(async () => {
		if (!qrPayload) return;
		try {
			const { default: QRCode } = await import('qrcode');
			qrDataUrl = await QRCode.toDataURL(qrPayload, { errorCorrectionLevel: 'M', margin: 1, width: 220 });
		} catch {
			qrDataUrl = '';
		}
	});
</script>

<svelte:head>
	<title>{sf(t.success.title, lang)}</title>
</svelte:head>

<section class="thanks">
	<h1 class="thanks-title">{sf(t.success.title, lang)}</h1>
	<p class="thanks-subtitle">{sf(t.success.subtitle, lang)}</p>
	{#if orderCode}
		<div class="thanks-order">
			<span class="thanks-order-label">{sf(t.success.orderCode, lang)}:</span>
			<strong class="thanks-order-code">{orderCode}</strong>
		</div>
	{/if}
	{#if qrDataUrl}
		<!-- QR thanh toán cho phương thức momo/zalopay/bank_transfer -->
		<div class="thanks-qr" data-test="thanks-qr-payment">
			<img class="thanks-qr-img" src={qrDataUrl} alt="QR {paymentCode}" />
			{#if paymentCode}
				<p class="thanks-qr-code">#{paymentCode}</p>
			{/if}
			<p class="thanks-qr-hint">{sf(t.success.qrHint, lang)}</p>
		</div>
	{/if}
	<Button color="primary" to="/store/products">
		{sf(t.success.continueShopping, lang)}
	</Button>
</section>

<style lang="scss">
	.thanks {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		text-align: center;
		padding: 3rem 1rem;
	}

	.thanks-title {
		margin: 0;
		font-size: 1.9rem;
		font-weight: 800;
		color: var(--success, #2e7d32);
	}

	.thanks-subtitle {
		margin: 0;
		color: var(--muted-foreground, #555);
	}

	.thanks-order {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px dashed var(--border, #ccc);
		border-radius: 0.5rem;
		padding: 0.6rem 1rem;
		background: var(--card, #fff);
	}

	.thanks-order-label {
		color: var(--muted-foreground, #666);
		font-size: 0.9rem;
	}

	.thanks-order-code {
		font-size: 1.05rem;
		letter-spacing: 0.04em;
	}

	/* QR thanh toán (momo/zalopay/bank_transfer) — khách quét để chuyển khoản */
	.thanks-qr {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 1rem;
		border: 1px dashed var(--border, #ccc);
		border-radius: 0.75rem;
		background: var(--card, #fff);
	}
	.thanks-qr-img {
		width: 220px;
		height: 220px;
		object-fit: contain;
		background: #fff;
	}
	.thanks-qr-code {
		margin: 0;
		font-size: 0.9rem;
		color: var(--muted-foreground, #555);
		overflow-wrap: anywhere;
	}
	.thanks-qr-hint {
		margin: 0;
		font-size: 0.8rem;
		color: var(--muted-foreground, #666);
		max-width: 260px;
	}
</style>
