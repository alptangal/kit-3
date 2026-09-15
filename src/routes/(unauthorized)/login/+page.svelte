<script lang="ts">
	// src\routes\(unauthorized)\login\+page.svelte
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$components/element';
	import {
		Checkbox,
		FieldMessages,
		Form,
		Input,
		Label,
		TextField
	} from '$components/form';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { pageContents } from '.';
	import type { LoginConfigs, LoginRequestBody } from './_interface';
	import { isEqual } from 'es-toolkit';

	// ===== State =====
	let configs: LoginConfigs = $state({
		username: {},
		password: {},
		remember: {}
	});
	let loading = $state(false);

	/** Lưu lần submit trước để ngăn submit trùng lặp */
	let previousSubmited: undefined | { username: string; password: string; remember?: boolean } =
		undefined;

	/** Thông báo lỗi hiển thị trực tiếp trên form */
	let formError = $state<string | undefined>(undefined);

	/** Thông báo thành công khi vừa đăng ký xong (từ ?registered=1) */
	let registeredSuccess = $state(false);

	/** Trạng thái mount để trigger entrance animation */
	let mounted = $state(false);

	/** Cặp khoá RSA tạm thời để mã hoá body khi gửi lên server */
	let encryptionKeys:
		| undefined
		| {
				public: CryptoKey;
				private: CryptoKey;
		  };

	// Trạng thái disabled nút submit
	const status = $derived.by(() => {
		const currentSubmit = {
			username: configs.username.value,
			password: configs.password.value,
			remember: configs.remember.checked
		};
		return {
			disabled:
				loading ||
				isEqual(currentSubmit, previousSubmited) ||
				!configs.username.value ||
				!configs.password.value
		};
	});

	// Ngôn ngữ hiện tại
	const lang = $derived(client.browser?.language ?? 'en');

	// ===== Hàm đăng nhập =====
	async function handleLogin() {
		if (!configs.username.value || !configs.password.value || !encryptionKeys || loading) return;

		// Xoá lỗi cũ
		formError = undefined;
		loading = true;

		const requestBody: LoginRequestBody = {
			username: configs.username.value,
			password: configs.password.value,
			remember: configs.remember.checked,
			publicKeyB64: await encryption.exportKeyToBase64(encryptionKeys.public, 'spki')
		};

		try {
			const response = await encryption.fetchSecure(
				'/api/login',
				{
					method: 'post',
					body: requestBody
				},
				{ privateKey: encryptionKeys.private, publicKey: encryptionKeys.public }
			);

			loading = false;

			if (response.ok) {
				// Lưu lại thông tin submit lần này để ngăn submit lại
				previousSubmited = {
					username: requestBody.username,
					password: requestBody.password,
					remember: requestBody.remember
				};

				// Hiển thị toast thành công
				client.browser?.toasts?.create({
					title: pageContents.responseOk[lang] ?? 'Login success',
					description: response.message ? response.message[lang] : undefined,
					color: 'success'
				});

				// Lấy redirect URL nếu có (ví dụ /login?redirect=/dashboard)
				const redirectTo = page.url.searchParams.get('redirect') ?? '/';
				await goto(redirectTo);
			} else {
				// Hiển thị lỗi inline trên form
				formError =
					(response.message ? response.message[lang] : undefined) ??
					pageContents.responseFail[lang] ??
					'Login failed';
			}
		} catch (e) {
			loading = false;
			formError = e instanceof Error ? e.message : String(e);
		}
	}

	// ===== Hàm reset form =====
	function handleReset() {
		configs.username.value = '';
		configs.password.value = '';
		configs.remember.checked = false;
		formError = undefined;
	}

	// ===== Mount: tạo khoá RSA + kiểm tra query param =====
	onMount(async () => {
		// Tạo cặp khoá RSA tạm thời cho phiên đăng nhập này
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { private: privateKey, public: publicKey };

		// Kiểm tra nếu vừa đăng ký thành công (redirect từ /register)
		if (page.url.searchParams.get('registered') === '1') {
			registeredSuccess = true;
		}

		// Trigger entrance animation
		requestAnimationFrame(() => {
			mounted = true;
		});
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang] ?? 'Sign In'}</title>
	<meta name="description" content={pageContents.subtitle[lang] ?? 'Sign in to your account'} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="login-page" class:mounted>
	<!-- ════ Left Panel: Decorative ════ -->
	<div class="login-panel-left" aria-hidden="true">
		<div class="orb orb-1"></div>
		<div class="orb orb-2"></div>
		<div class="orb orb-3"></div>
		<div class="grid-overlay"></div>

		<div class="panel-content">
			<div class="brand-logo">
				<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="28" cy="28" r="26" fill="url(#logo-grad)" />
					<path
						d="M20 28c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8"
						stroke="#fff"
						stroke-width="3"
						stroke-linecap="round"
					/>
					<circle cx="28" cy="28" r="3.5" fill="#fff" />
					<defs>
						<linearGradient id="logo-grad" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
							<stop stop-color="#818cf8" />
							<stop offset="1" stop-color="#a78bfa" />
						</linearGradient>
					</defs>
				</svg>
			</div>

			<div class="panel-text">
				<h2 class="panel-headline">
					{lang === 'vi' ? 'Chào mừng trở lại!' : 'Welcome back!'}
				</h2>
				<p class="panel-desc">
					{lang === 'vi'
						? 'Đăng nhập để tiếp tục trải nghiệm dịch vụ của chúng tôi.'
						: 'Sign in to continue your seamless experience.'}
				</p>
			</div>

			<ul class="panel-features">
				<li>
					<span class="feature-icon">✦</span>
					<span>{lang === 'vi' ? 'Bảo mật đầu cuối' : 'End-to-end encryption'}</span>
				</li>
				<li>
					<span class="feature-icon">✦</span>
					<span>{lang === 'vi' ? 'Đăng nhập nhanh chóng' : 'Lightning fast sign-in'}</span>
				</li>
				<li>
					<span class="feature-icon">✦</span>
					<span>{lang === 'vi' ? 'Bảo vệ tài khoản 24/7' : '24/7 account protection'}</span>
				</li>
			</ul>
		</div>
	</div>

	<!-- ════ Right Panel: Form ════ -->
	<div class="login-panel-right">
		<div class="login-card">
			<!-- Card Header -->
			<div class="login-header">
				<div class="login-logo-sm">
					<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						<circle cx="20" cy="20" r="18" fill="url(#sm-lg)" />
						<path
							d="M14 20c0-3.314 2.686-6 6-6s6 2.686 6 6-2.686 6-6 6"
							stroke="#fff"
							stroke-width="2.5"
							stroke-linecap="round"
						/>
						<circle cx="20" cy="20" r="2.5" fill="#fff" />
						<defs>
							<linearGradient id="sm-lg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
								<stop stop-color="#6366f1" />
								<stop offset="1" stop-color="#8b5cf6" />
							</linearGradient>
						</defs>
					</svg>
				</div>
				<h1 class="login-title">{pageContents.title[lang] ?? 'Welcome back'}</h1>
				<p class="login-subtitle">{pageContents.subtitle[lang] ?? 'Sign in to your account'}</p>
			</div>

			<!-- Thông báo đăng ký thành công -->
			{#if registeredSuccess}
				<div class="login-alert login-alert--success" role="alert">
					<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="alert-icon">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
							clip-rule="evenodd"
						/>
					</svg>
					<span>{pageContents.registeredSuccess[lang] ?? 'Registration successful! Please sign in.'}</span>
				</div>
			{/if}

			<!-- Form đăng nhập -->
			<Form onSubmit={handleLogin}>
				<TextField name="username" required>
					<Label>{pageContents.username[lang] ?? 'Username / Email'}</Label>
					<div class="input-wrapper">
						<svg class="input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
						</svg>
						<Input
							bind:value={configs.username.value}
							placeholder={{ vi: 'Nhập tên đăng nhập hoặc email', en: 'Enter username or email' }}
							class="login-input"
						/>
					</div>
					<FieldMessages />
				</TextField>

				<TextField name="password" required>
					<Label>{pageContents.password[lang] ?? 'Password'}</Label>
					<div class="input-wrapper">
						<svg class="input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path
								fill-rule="evenodd"
								d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
								clip-rule="evenodd"
							/>
						</svg>
						<Input
							type="password"
							bind:value={configs.password.value}
							placeholder={{ vi: 'Nhập mật khẩu', en: 'Enter your password' }}
							class="login-input"
						/>
					</div>
					<FieldMessages />
				</TextField>

				<!-- Hàng Remember me + Forgot password -->
				<div class="login-options">
					<Checkbox bind:checked={configs.remember.checked}>
						<Label>{pageContents.remember[lang] ?? 'Remember me'}</Label>
					</Checkbox>
					<Button variant="link" color="default" class="login-forgot-link" to="/forgot-password">
						{pageContents.forgotPassword[lang] ?? 'Forgot password?'}
					</Button>
				</div>

				<!-- Thông báo lỗi inline -->
				{#if formError}
					<div class="login-alert login-alert--error" role="alert">
						<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="alert-icon">
							<path
								fill-rule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
								clip-rule="evenodd"
							/>
						</svg>
						<span>{formError}</span>
					</div>
				{/if}

				<!-- Nút hành động -->
				<div class="login-actions">
					<Button
						class="login-btn-submit"
						color="success"
						type="submit"
						{loading}
						disabled={status.disabled}
						onClick={handleLogin}
					>
						{pageContents.login[lang] ?? 'Sign in'}
					</Button>

					<Button
						class="login-btn-reset"
						color="error"
						type="reset"
						variant="ghost"
						onClick={handleReset}
					>
						{pageContents.reset[lang] ?? 'Reset'}
					</Button>
				</div>
			</Form>

			<!-- Divider -->
			<div class="login-divider">
				<span>{pageContents.noAccount[lang] ?? "Don't have an account?"}</span>
			</div>

			<!-- Link sang trang đăng ký -->
			<div class="login-register-link">
				<Button variant="link" color="primary" class="register-link-btn" to="/register">
					{pageContents.register[lang] ?? 'Create account'}
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
	</div>
</div>

<style lang="scss">
	/* ═══════════════════════════════════════════════
	   LOGIN PAGE — PREMIUM REDESIGN
	   ═══════════════════════════════════════════════ */

	.login-page {
		display: flex;
		min-height: 100dvh;
		width: 100%;
		font-family: 'Inter', system-ui, sans-serif;
		overflow: hidden;
	}

	/* ══ Left Decorative Panel ══ */
	.login-panel-left {
		position: relative;
		flex: 0 0 45%;
		display: none;
		overflow: hidden;
		background: linear-gradient(135deg, #0f0c29 0%, #1a1040 40%, #24243e 100%);

		@media (min-width: 900px) {
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
		}
	}

	/* Animated gradient orbs */
	.orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.5;
		animation: float 8s ease-in-out infinite;
	}
	.orb-1 {
		width: 420px;
		height: 420px;
		background: radial-gradient(circle, #6366f1 0%, transparent 70%);
		top: -80px;
		left: -100px;
		animation-delay: 0s;
	}
	.orb-2 {
		width: 350px;
		height: 350px;
		background: radial-gradient(circle, #8b5cf6 0%, transparent 70%);
		bottom: -60px;
		right: -60px;
		animation-delay: -3s;
	}
	.orb-3 {
		width: 250px;
		height: 250px;
		background: radial-gradient(circle, #06b6d4 0%, transparent 70%);
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		opacity: 0.25;
		animation-delay: -6s;
	}

	@keyframes float {
		0%, 100% { transform: translate(0, 0) scale(1); }
		33% { transform: translate(20px, -30px) scale(1.04); }
		66% { transform: translate(-15px, 20px) scale(0.96); }
	}

	/* Dot grid overlay */
	.grid-overlay {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(circle, rgba(255 255 255 / 0.07) 1px, transparent 1px);
		background-size: 28px 28px;
		pointer-events: none;
	}

	/* Panel content */
	.panel-content {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 2rem;
		padding: 3rem 3.5rem;
		max-width: 480px;
	}

	.brand-logo svg {
		width: 56px;
		height: 56px;
		filter: drop-shadow(0 8px 24px rgb(99 102 241 / 0.5));
	}

	.panel-headline {
		font-size: 2.5rem;
		font-weight: 700;
		line-height: 1.15;
		color: #fff;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.panel-desc {
		font-size: 1rem;
		color: rgb(255 255 255 / 0.65);
		line-height: 1.6;
		margin: 0.4rem 0 0;
	}

	.panel-text {
		display: flex;
		flex-direction: column;
	}

	.panel-features {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;

		li {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			color: rgb(255 255 255 / 0.8);
			font-size: 0.9rem;
		}
	}

	.feature-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		border-radius: 6px;
		font-size: 0.6rem;
		flex-shrink: 0;
		box-shadow: 0 2px 8px rgb(99 102 241 / 0.4);
	}

	/* ══ Right Form Panel ══ */
	.login-panel-right {
		flex: 1 1 55%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.5rem;
		background: var(--background, #09090b);
		position: relative;

		&::before {
			content: '';
			position: absolute;
			inset: 0;
			background-image:
				radial-gradient(circle at 20% 80%, rgb(99 102 241 / 0.06) 0%, transparent 50%),
				radial-gradient(circle at 80% 20%, rgb(139 92 246 / 0.05) 0%, transparent 50%);
			pointer-events: none;
		}
	}

	/* ══ Card ══ */
	.login-card {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;

		/* Entrance animation */
		opacity: 0;
		transform: translateY(20px);
		transition: opacity 0.5s ease, transform 0.5s ease;
	}

	.login-page.mounted .login-card {
		opacity: 1;
		transform: translateY(0);
	}

	/* ══ Card Header ══ */
	.login-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		text-align: center;
	}

	.login-logo-sm svg {
		width: 44px;
		height: 44px;
		filter: drop-shadow(0 4px 16px rgb(99 102 241 / 0.4));
		margin-bottom: 0.5rem;
	}

	.login-title {
		font-size: 1.75rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--foreground, #f4f4f5);
		margin: 0;
	}

	.login-subtitle {
		font-size: 0.875rem;
		color: var(--foreground-400, #71717a);
		margin: 0;
	}

	/* ══ Alert banners ══ */
	.login-alert {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		line-height: 1.5;

		.alert-icon {
			flex-shrink: 0;
			margin-top: 0.1rem;
			width: 1.1rem;
			height: 1.1rem;
		}

		&--success {
			background: rgb(34 197 94 / 0.1);
			color: #4ade80;
			border: 1px solid rgb(34 197 94 / 0.2);
		}
		&--error {
			background: rgb(239 68 68 / 0.08);
			color: #f87171;
			border: 1px solid rgb(239 68 68 / 0.2);
			animation: shake 0.4s ease-in-out;
		}
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		20%, 60% { transform: translateX(-5px); }
		40%, 80% { transform: translateX(5px); }
	}

	/* ══ Input wrapper with icon ══ */
	.input-wrapper {
		position: relative;

		.input-icon {
			position: absolute;
			left: 0.875rem;
			top: 50%;
			transform: translateY(-50%);
			width: 1rem;
			height: 1rem;
			color: var(--foreground-400, #71717a);
			pointer-events: none;
			z-index: 1;
		}
	}

	:global(.login-input) {
		padding-left: 2.5rem !important;
		transition: border-color 0.2s, box-shadow 0.2s !important;
	}

	/* ══ Options row ══ */
	.login-options {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	:global(.login-forgot-link) {
		font-size: 0.8125rem !important;
		color: var(--foreground-400, #71717a) !important;
		transition: color 0.15s !important;

		&:hover {
			color: hsl(var(--primary)) !important;
		}
	}

	/* ══ Actions ══ */
	.login-actions {
		display: flex;
		gap: 0.625rem;
		margin-top: 0.25rem;
	}

	:global(.login-btn-submit) {
		flex: 1 !important;
		font-weight: 600 !important;
		letter-spacing: 0.01em;
	}

	/* ══ Divider ══ */
	.login-divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.75rem;
		color: var(--foreground-400, #52525b);
		margin-top: 0.25rem;

		&::before,
		&::after {
			content: '';
			flex: 1;
			height: 1px;
			background: var(--default-200, rgb(255 255 255 / 0.08));
		}

		span {
			white-space: nowrap;
		}
	}

	/* ══ Register link ══ */
	.login-register-link {
		display: flex;
		justify-content: center;
	}

	:global(.register-link-btn) {
		font-size: 0.875rem !important;
		font-weight: 500 !important;
		display: inline-flex !important;
		align-items: center !important;
		gap: 0.375rem !important;
		transition: gap 0.2s ease !important;

		&:hover {
			gap: 0.625rem !important;
		}
	}

	.link-arrow {
		width: 14px;
		height: 14px;
		transition: transform 0.2s ease;
	}

	:global(.register-link-btn:hover) .link-arrow {
		transform: translateX(3px);
	}

	/* ══ Responsive ══ */
	@media (max-width: 900px) {
		.login-panel-right {
			padding: 2.5rem 1.25rem;
		}
	}

	@media (max-width: 480px) {
		.login-card {
			max-width: 100%;
		}
		.login-title {
			font-size: 1.5rem;
		}
	}
</style>
