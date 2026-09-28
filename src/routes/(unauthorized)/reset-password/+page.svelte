<script lang="ts">
	// src\routes\(unauthorized)\reset-password\+page.svelte
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { Button } from '$components/element';
	import { Description, FieldMessages, Form, Input, Label, TextField } from '$components/form';
	import { AuthLayout } from '$components/layout';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { pageContents } from '.';
	import type { ResetPasswordRequestBody } from './_interface';

	// ── Form State ──
	let formData = $state({ password: '', confirmPassword: '' });
	let loading = $state(false);
	let formError = $state<string | undefined>(undefined);
	let success = $state(false);

	// Honeypot — hidden from real users, bots fill it
	let honeypot = $state('');

	/** Cặp khoá RSA tạm thời cho phiên đặt lại mật khẩu */
	let encryptionKeys = $state<
		| undefined
		| {
				publicKey: CryptoKey;
				privateKey: CryptoKey;
		  }
	>(undefined);

	const lang = $derived(client.browser?.language ?? 'en');
	const currentLang = $derived(lang === 'vi' ? 'vi' : 'en');

	// Token từ URL — không có hoặc quá ngắn → invalid state ngay lập tức
	const resetToken = $derived(page.url.searchParams.get('token') ?? '');
	const tokenInvalid = $derived(resetToken.length < 32);

	// Trạng thái disabled nút submit
	const status = $derived.by(() => {
		const hasRequired =
			!!formData.password?.trim() && formData.password.length >= 8 && !!formData.confirmPassword?.trim();
		const hasLetter = /[a-zA-Z]/.test(formData.password ?? '');
		const hasNumber = /[0-9]/.test(formData.password ?? '');
		const matches = formData.password === formData.confirmPassword;
		return { disabled: loading || !hasRequired || !hasLetter || !hasNumber || !matches };
	});

	// ── Xử lý Đặt lại mật khẩu ──
	async function handleResetPassword() {
		// Honeypot bot check — silently reject
		if (honeypot.trim() !== '') return;
		if (status.disabled || !encryptionKeys || loading) return;

		formError = undefined;
		loading = true;

		try {
			const requestBody: ResetPasswordRequestBody = {
				token: resetToken,
				password: formData.password,
				publicKeyB64: await encryption.exportKeyToBase64(encryptionKeys.publicKey, 'spki')
			};

			const response = await encryption.fetchSecure(
				'/api/reset-password',
				{
					method: 'POST',
					body: requestBody
				},
				encryptionKeys
			);

			loading = false;

			if (response.ok) {
				success = true;

				client.browser?.toasts?.create({
					title: pageContents.responseOk[currentLang] ?? '',
					description: '',
					color: 'success'
				});
			} else {
				formError =
					(response.message ? response.message[lang] ?? response.message.en : undefined) ??
					pageContents.responseFail[currentLang] ??
					'';
			}
		} catch (err) {
			loading = false;
			formError =
				err instanceof Error
					? err.message
					: pageContents.responseFail[currentLang] ?? '';
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};

		// Khởi tạo cặp khoá RSA tạm thời
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang] ?? 'Reset password'}</title>
	<meta name="description" content={pageContents.subtitle[lang] ?? 'Create a new password for your account'} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{#if tokenInvalid}
	<!-- Invalid link state — token thiếu/quá ngắn -->
	<AuthLayout
		cardSize="md"
		title={pageContents.invalidLinkTitle[lang] ?? 'Invalid link'}
		subtitle={pageContents.subtitle[lang] ?? ''}
		formError={pageContents.invalidLinkDesc[lang] ?? ''}
	>
		<div class="invalid-state">
			<div class="auth-actions" style="justify-content: center;">
				<Button
					class="auth-btn-submit"
					color="primary"
					variant="outline"
					onClick={() => goto('/forgot-password')}
				>
					{pageContents.requestNew[lang] ?? 'Request a new link'}
				</Button>
				<Button
					class="auth-btn-reset"
					color="error"
					variant="ghost"
					onClick={() => goto('/login')}
				>
					{pageContents.backToLogin[lang] ?? 'Back to login'}
				</Button>
			</div>
		</div>
	</AuthLayout>
{:else if success}
	<!-- Success State -->
	<AuthLayout
		cardSize="md"
		title={pageContents.title[lang] ?? 'Reset password'}
		subtitle={pageContents.subtitle[lang] ?? ''}
	>
		<div class="success-state">
			<div class="success-hint">{pageContents.responseOk[lang] ?? ''}</div>
			<div class="auth-actions" style="justify-content: center;">
				<Button
					class="auth-btn-submit"
					color="success"
					onClick={() => goto('/login')}
				>
					{pageContents.backToLogin[lang] ?? 'Back to login'}
				</Button>
			</div>
		</div>
	</AuthLayout>
{:else}
	<!-- Reset Password Form -->
	<AuthLayout
		cardSize="md"
		title={pageContents.title[lang] ?? 'Reset password'}
		subtitle={pageContents.subtitle[lang] ?? ''}
		{formError}
	>
		<Form onSubmit={handleResetPassword}>
			<!-- Honeypot — bots fill this, humans never see it -->
			<div class="hp-field" aria-hidden="true">
				<label for="hp_website">Website</label>
				<input
					id="hp_website"
					name="website"
					type="text"
					bind:value={honeypot}
					autocomplete="off"
					tabindex="-1"
					aria-hidden="true"
					disabled={loading}
				/>
			</div>

			<!-- New password field -->
			<TextField name="password" required>
				<Label>{pageContents.password[lang] ?? 'New password'}</Label>
				<div class="auth-input-wrapper">
					<Input
						type="password"
						bind:value={formData.password}
						autocomplete="new-password"
						disabled={loading}
						actionButtons={{ showPassword: { display: true } }}
					/>
				</div>
				<Description persistent={true} class="form-hint">
					{lang === 'vi' ? 'Ít nhất 8 ký tự, gồm chữ và số' : 'At least 8 characters with letters and numbers'}
				</Description>
				<FieldMessages />
			</TextField>

			<!-- Confirm password field -->
			<TextField name="confirmPassword" required>
				<Label>{pageContents.confirmPassword[lang] ?? 'Confirm password'}</Label>
				<div class="auth-input-wrapper">
					<Input
						type="password"
						bind:value={formData.confirmPassword}
						autocomplete="new-password"
						disabled={loading}
						color={formData.confirmPassword && formData.confirmPassword !== formData.password ? 'error' : undefined}
						actionButtons={{ showPassword: { display: true } }}
					/>
				</div>
				{#if formData.confirmPassword && formData.confirmPassword !== formData.password}
					<Description persistent={true} color="error" class="form-hint error-hint">
						{pageContents.mismatchHint[lang] ?? 'Passwords do not match.'}
					</Description>
				{/if}
				<FieldMessages />
			</TextField>

			<!-- Action Buttons -->
			<div class="auth-actions">
				<Button
					class="auth-btn-submit"
					color="success"
					type="submit"
					{loading}
					disabled={status.disabled}
				>
					{pageContents.submit[lang] ?? 'Reset password'}
				</Button>

				<Button
					class="auth-btn-reset"
					color="error"
					type="reset"
					variant="ghost"
					disabled={loading}
				>
					{pageContents.reset[lang] ?? 'Reset'}
				</Button>
			</div>
		</Form>

		{#snippet footer()}
			<!-- Divider -->
			<div class="auth-divider">
				<span>{lang === 'vi' ? 'Nhớ mật khẩu?' : 'Remember password?'}</span>
			</div>

			<!-- Switch to Login -->
			<div class="auth-switch-link">
				<Button variant="link" color="primary" class="auth-switch-btn" to="/login">
					<span>{pageContents.backToLogin[lang] ?? 'Back to login'}</span>
					<svg class="link-arrow" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M2 8a.75.75 0 01.75-.75h8.69L8.22 4.03a.75.75 0 011.06-1.06l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06-1.06l3.22-3.22H2.75A.75.75 0 012 8z"
							clip-rule="evenodd"
						/>
					</svg>
				</Button>
			</div>
		{/snippet}
	</AuthLayout>
{/if}

<style lang="scss">
	/* ═══════════════════════════════════════════════
	   RESET PASSWORD SPECIFIC STYLES
	   ═══════════════════════════════════════════════ */

	/* Honeypot — off-screen */
	.hp-field {
		position: absolute !important;
		left: -5000px !important;
		top: auto !important;
		width: 1px !important;
		height: 1px !important;
		overflow: hidden !important;
		opacity: 0 !important;
		pointer-events: none !important;
		white-space: nowrap !important;

		label {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
		}

		input {
			position: absolute;
			left: -5000px;
		}
	}

	:global(.form-hint) {
		font-size: 0.75rem !important;
		color: var(--foreground-400, #71717a) !important;
		margin-top: 0.25rem !important;
	}

	:global(.error-hint) {
		color: var(--error, #ef4444) !important;
	}

	.invalid-state,
	.success-state {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		animation: fadeIn 0.4s ease-out;

		@keyframes fadeIn {
			from {
				opacity: 0;
				transform: translateY(10px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
	}

	.success-hint {
		text-align: center;
		color: var(--success, #10b981);
		font-size: 0.9rem;
		font-weight: 500;
		padding: 0.75rem 1rem;
	}
</style>
