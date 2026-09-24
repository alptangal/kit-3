<script lang="ts">
	// src\routes\(unauthorized)\forgot-password\+page.svelte
	import { goto } from '$app/navigation';
	import { Button } from '$components/element';
	import {
		Description,
		FieldMessages,
		Form,
		Input,
		Label,
		TextField
	} from '$components/form';
	import { AuthLayout } from '$components/layout';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { pageContents } from '.';
	import type { ForgotPasswordRequestBody } from './_interface';

	// ── Form State ──
	let formData = $state({
		email: ''
	});

	let loading = $state(false);
	let formError = $state<string | undefined>(undefined);
	let success = $state(false);

	// Honeypot — hidden from real users, bots fill it
	let honeypot = $state('');

	/** Cặp khoá RSA tạm thời cho phiên quên mật khẩu */
	let encryptionKeys = $state<
		| undefined
		| {
				publicKey: CryptoKey;
				privateKey: CryptoKey;
		  }
	>(undefined);

	const lang = $derived(client.browser?.language ?? 'en');
	const currentLang = $derived(lang === 'vi' ? 'vi' : 'en');

	// ── Realtime Check State for Email ──
	let emailStatus = $state<{
		checking: boolean;
		checked: boolean;
		taken: boolean;
		available: boolean;
		message?: { vi: string; en: string };
	}>({
		checking: false,
		checked: false,
		taken: false,
		available: false
	});

	let emailTimeoutId: ReturnType<typeof setTimeout> | undefined;
	let emailSeq = 0;

	function resetEmailStatus() {
		emailStatus.checking = false;
		emailStatus.checked = false;
		emailStatus.taken = false;
		emailStatus.available = false;
		emailStatus.message = undefined;
	}

	$effect(() => {
		const keysReady = !!encryptionKeys;
		const raw = formData.email?.trim() ?? '';

		if (!keysReady) {
			if (emailTimeoutId) {
				clearTimeout(emailTimeoutId);
				emailTimeoutId = undefined;
			}
			if (emailStatus.checking) emailStatus.checking = false;
			return;
		}

		if (!raw) {
			if (emailTimeoutId) {
				clearTimeout(emailTimeoutId);
				emailTimeoutId = undefined;
			}
			resetEmailStatus();
			return;
		}

		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
			if (emailTimeoutId) {
				clearTimeout(emailTimeoutId);
				emailTimeoutId = undefined;
			}
			resetEmailStatus();
			return;
		}

		if (emailTimeoutId) clearTimeout(emailTimeoutId);
		emailStatus.checking = true;

		const seq = ++emailSeq;
		const snapshot = raw;

		emailTimeoutId = setTimeout(async () => {
			if (!encryptionKeys) {
				if (seq === emailSeq) emailStatus.checking = false;
				return;
			}
			const current = formData.email?.trim() ?? '';
			if (current !== snapshot || seq !== emailSeq) {
				if (seq === emailSeq) emailStatus.checking = false;
				return;
			}
			try {
				const data = (await encryption.fetchSecure(
					'/api/register/check',
					{
						method: 'POST',
						body: { email: snapshot }
					},
					encryptionKeys
				)) as any;
				if (seq !== emailSeq) return;
				if (formData.email?.trim() !== snapshot) return;

				if (data.ok && data.email && data.email.valid) {
					emailStatus.checked = true;
					emailStatus.taken = !!data.email.taken;
					emailStatus.available = !!data.email.available;
					emailStatus.message = data.email.message;
				} else {
					resetEmailStatus();
				}
			} catch (e) {
				console.error('Error checking email:', e);
				if (seq === emailSeq) {
					emailStatus.checked = false;
				}
			} finally {
				if (seq === emailSeq) emailStatus.checking = false;
			}
		}, 400);
	});

	// Trạng thái disabled nút submit
	const status = $derived.by(() => {
		const hasRequired = !!formData.email?.trim() && formData.email.length >= 3;
		const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email?.trim() ?? '');
		const emailAvailable = emailStatus.checked && emailStatus.taken; // Email must exist to reset
		const notChecking = !emailStatus.checking;

		return {
			disabled: loading || !hasRequired || !isValidEmail || !emailAvailable || !notChecking
		};
	});

	// ── Validation trước khi gửi ──
	function validateForm(): string | undefined {
		if (honeypot.trim() !== '') {
			return lang === 'vi' ? 'Yêu cầu bị từ chối' : 'Request rejected';
		}
		if (!formData.email?.trim()) {
			return lang === 'vi' ? 'Vui lòng nhập địa chỉ email' : 'Please enter your email';
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email?.trim() ?? '')) {
			return lang === 'vi' ? 'Định dạng email không hợp lệ' : 'Invalid email format';
		}
		if (emailStatus.checked && !emailStatus.taken) {
			return lang === 'vi' ? 'Email này chưa được đăng ký' : 'This email is not registered';
		}
		return undefined;
	}

	// ── Xử lý Quên mật khẩu ──
	async function handleForgotPassword() {
		// Honeypot bot check — silently reject
		if (honeypot.trim() !== '') {
			formError = lang === 'vi' ? 'Yêu cầu bị từ chối' : 'Request rejected';
			return;
		}
		if (status.disabled || !encryptionKeys || loading) return;

		const validationError = validateForm();
		if (validationError) {
			formError = validationError;
			return;
		}

		formError = undefined;
		loading = true;

		try {
			const requestBody: ForgotPasswordRequestBody = {
				email: formData.email?.trim() ?? '',
				publicKeyB64: await encryption.exportKeyToBase64(encryptionKeys.publicKey, 'spki')
			};

			const response = await encryption.fetchSecure(
				'/api/forgot-password',
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
					title: lang === 'vi' ? 'Thành công!' : 'Success!',
					description:
						(response.message ? response.message[lang] ?? response.message.en : undefined) ??
						(lang === 'vi'
							? 'Liên kết đặt lại mật khẩu đã được gửi đến email của bạn.'
							: 'Password reset link has been sent to your email.'),
					color: 'success'
				});
			} else {
				formError =
					(response.message ? response.message[lang] ?? response.message.en : undefined) ??
					(lang === 'vi' ? 'Gửi liên kết không thành công' : 'Failed to send reset link');
			}
		} catch (err) {
			loading = false;
			formError =
				err instanceof Error
					? err.message
					: lang === 'vi'
						? 'Đã xảy ra lỗi không xác định'
						: 'Unexpected error occurred';
		}
	}

	// ── Reset Form ──
	function handleReset() {
		formData.email = '';
		honeypot = '';
		formError = undefined;
		success = false;
		if (emailTimeoutId) {
			clearTimeout(emailTimeoutId);
			emailTimeoutId = undefined;
		}
		emailSeq++;
		emailStatus = {
			checking: false,
			checked: false,
			taken: false,
			available: false
		};
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};

		// Khởi tạo cặp khoá RSA tạm thời
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
	});

	onDestroy(() => {
		if (emailTimeoutId) {
			clearTimeout(emailTimeoutId);
			emailTimeoutId = undefined;
		}
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang] ?? 'Forgot password'}</title>
	<meta name="description" content={pageContents.subtitle[lang] ?? 'Enter your email to receive a password reset link'} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<AuthLayout
	cardSize="md"
	title={pageContents.title[lang] ?? 'Forgot password'}
	subtitle={pageContents.subtitle[lang] ?? 'Enter your email to receive a password reset link'}
	headline={lang === 'vi' ? 'Đặt lại mật khẩu' : 'Reset your password'}
	description={lang === 'vi'
		? 'Nhập địa chỉ email đã đăng ký để nhận liên kết đặt lại mật khẩu.'
		: 'Enter your registered email address to receive a password reset link.'}
	features={[
		lang === 'vi' ? 'Liên kết an toàn, hết hạn sau 1 giờ' : 'Secure link, expires in 1 hour',
		lang === 'vi' ? 'Không tiết lộ thông tin tài khoản' : 'No account information disclosed',
		lang === 'vi' ? 'Hỗ trợ 24/7 qua email' : '24/7 email support'
	]}
	{formError}
>
	{#if !success}
		<!-- Forgot Password Form -->
		<Form onSubmit={handleForgotPassword} onReset={handleReset}>
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

			<!-- Email field -->
			<TextField name="email" required>
				<Label>{pageContents.email[lang] ?? 'Email'}</Label>
				<div class="auth-input-wrapper">
					<svg class="auth-input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
						<path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
					</svg>
					<Input
						type="email"
						inputmode="email"
						bind:value={formData.email}
						placeholder={{ vi: 'Nhập địa chỉ email', en: 'Enter your email' }}
						autocomplete="email"
						loading={emailStatus.checking}
						disabled={loading}
						color={emailStatus.checked ? (emailStatus.taken ? 'success' : 'error') : undefined}
						class="auth-input {emailStatus.checked ? (emailStatus.taken ? 'confirm-match' : 'confirm-mismatch') : ''}"
						actionButtons={{ showPassword: { display: false } }}
					/>
				</div>
				{#if emailStatus.checked && emailStatus.taken}
					<Description persistent={true} color="success" class="form-hint success-hint">
						{emailStatus.message?.[currentLang] ?? 'Email is registered'}
					</Description>
				{:else if emailStatus.checked && emailStatus.available}
					<Description persistent={true} color="error" class="form-hint error-hint">
						{emailStatus.message?.[currentLang] ?? 'Email is not registered'}
					</Description>
				{:else}
					<Description class="form-hint">{lang === 'vi' ? 'Nhập email đã đăng ký để nhận liên kết đặt lại' : 'Enter your registered email to receive reset link'}</Description>
					<FieldMessages />
				{/if}
			</TextField>

			<!-- Action Buttons -->
			<div class="auth-actions">
				<Button
					class="auth-btn-submit"
					color="success"
					type="submit"
					{loading}
					disabled={status.disabled}
					onClick={handleForgotPassword}
				>
					{pageContents.submit[lang] ?? 'Send reset link'}
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
	{/if}

	{#if success}
		<!-- Success State -->
		<div class="success-state" style="text-align: center; padding: 2rem 0;">
			<div class="success-icon" style="width: 64px; height: 64px; margin: 0 auto 1.5rem; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 32px; height: 32px;">
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			</div>
			<h2 class="success-title" style="font-size: 1.5rem; font-weight: 700; color: var(--foreground, #f4f4f5); margin: 0 0 0.75rem;">
				{pageContents.successTitle[lang] ?? 'Check your email'}
			</h2>
			<p class="success-desc" style="color: var(--foreground-400, #71717a); line-height: 1.6; margin: 0 0 2rem;">
				{pageContents.successDesc[lang] ?? 'We have sent a password reset link to your email address. Please check your inbox (and spam folder).'}
			</p>
			<div class="auth-actions" style="justify-content: center;">
				<Button
					variant="link"
					color="primary"
					class="auth-switch-btn"
					onClick={() => goto('/login')}
				>
					{pageContents.backToLogin[lang] ?? 'Back to login'}
					<svg class="link-arrow" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M2 8a.75.75 0 01.75-.75h8.69L8.22 4.03a.75.75 0 011.06-1.06l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06-1.06l3.22-3.22H2.75A.75.75 0 012 8z"
							clip-rule="evenodd"
						/>
					</svg>
				</Button>
			</div>
		</div>
	{/if}

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

<style lang="scss">
	/* ═══════════════════════════════════════════════
	   FORGOT PASSWORD SPECIFIC STYLES
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

	:global(.success-hint) {
		color: var(--success, #10b981) !important;
	}

	:global(.confirm-mismatch) {
		--color: var(--error) !important;
		--background: var(--error-100) !important;
		--border-color: var(--error) !important;
		border-color: var(--error) !important;
		box-shadow: 0 0 0 2px rgb(239 68 68 / 0.12) !important;
	}

	@media (prefers-color-scheme: dark) {
		:global(.confirm-mismatch) {
			--background: var(--error-600) !important;
		}
	}

	:global(.confirm-match) {
		--color: var(--success) !important;
		--background: var(--success-100) !important;
		--border-color: var(--success) !important;
		border-color: var(--success) !important;
		box-shadow: 0 0 0 2px rgb(16 185 129 / 0.1) !important;
	}

	@media (prefers-color-scheme: dark) {
		:global(.confirm-match) {
			--background: var(--success-800) !important;
		}
	}

	.success-state {
		animation: fadeIn 0.4s ease-out;

		@keyframes fadeIn {
			from { opacity: 0; transform: translateY(10px); }
			to { opacity: 1; transform: translateY(0); }
		}
	}
</style>