<script lang="ts">
	// src\routes\(unauthorized)\verify-email\+page.svelte
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { Button } from '$components/element';
	import { AuthLayout } from '$components/layout';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { pageContents } from '.';
	import type { VerifyEmailRequestBody } from './_interface';

	let loading = $state(true);
	let success = $state(false);
	let invalid = $state(false);
	let encryptionKeys = $state<{ publicKey: CryptoKey; privateKey: CryptoKey } | undefined>(undefined);

	const lang = $derived(client.browser?.language ?? 'en');
	const currentLang = $derived(lang === 'vi' ? 'vi' : 'en');
	const verifyToken = $derived(page.url.searchParams.get('token') ?? '');

	onMount(() => {
		if (!client.browser) client.browser = {};
		encryption.generateRSAKeyPair().then(async ({ privateKey, publicKey }) => {
			encryptionKeys = { privateKey, publicKey };
			// Token gate 32 ký tự (token thật luôn 64-hex) — chặn link rác sớm, giống reset-password
			if (!verifyToken || verifyToken.length < 32) {
				invalid = true;
				loading = false;
				return;
			}
			try {
				const requestBody: VerifyEmailRequestBody = {
					token: verifyToken,
					publicKeyB64: await encryption.exportKeyToBase64(publicKey, 'spki')
				};
				const response = await encryption.fetchSecure(
					'/api/verify-email',
					{ method: 'POST', body: requestBody },
					{ privateKey, publicKey }
				);
				success = !!response?.ok;
				invalid = !response?.ok;
				if (response?.ok) {
					client.browser?.toasts?.create({
						title: pageContents.successTitle[currentLang] ?? '',
						description: '',
						color: 'success'
					});
				}
			} catch {
				invalid = true;
			} finally {
				loading = false;
			}
		});
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang] ?? 'Verify Email'}</title>
	<meta name="description" content={pageContents.subtitle[lang] ?? ''} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<AuthLayout
	cardSize="md"
	title={pageContents.title[lang] ?? ''}
	subtitle={loading
		? pageContents.verifying[lang] ?? ''
		: success
			? pageContents.successTitle[lang] ?? ''
			: pageContents.invalidTitle[lang] ?? ''}
>
	{#if loading}
		<div class="verify-state">
			<div class="spinner" aria-label={pageContents.verifying[currentLang] ?? ''}></div>
		</div>
	{:else if success}
		<div class="verify-state">
			<p class="verify-desc">{pageContents.successDesc[lang] ?? ''}</p>
			<div class="auth-actions">
				<Button class="auth-btn-submit" color="success" to="/login">
					{pageContents.backToLogin[lang] ?? ''}
				</Button>
			</div>
		</div>
	{:else}
		<div class="verify-state">
			<p class="verify-desc">{pageContents.invalidDesc[lang] ?? ''}</p>
			<div class="auth-actions">
				<Button class="auth-btn-submit" color="primary" variant="outline" to="/login">
					{pageContents.backToLogin[lang] ?? ''}
				</Button>
			</div>
		</div>
	{/if}
</AuthLayout>

<style lang="scss">
	.verify-state {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: center;
		animation: fadeIn 0.3s ease;

		@keyframes fadeIn {
			from {
				opacity: 0;
				transform: translateY(4px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
	}
	.verify-desc {
		text-align: center;
	}
	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--color-border, #ccc);
		border-top-color: var(--color-primary, #4f46e5);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
