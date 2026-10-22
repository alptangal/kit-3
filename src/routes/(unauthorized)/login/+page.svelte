<script lang="ts">
	// src\routes\(unauthorized)\login\+page.svelte
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$components/element';
	import {
		Checkbox,
		Description,
		FieldMessages,
		Form,
		Input,
		Label,
		TextField
	} from '$components/form';
	import { getFormContext } from '$components/form/form';
	import { AuthLayout } from '$components/layout';
	import { encryption } from '$modules/encryption';
	import { getDpopPublicJwk } from '$lib/dpop/keypair';
	import {
		browserSupportsWebAuthn,
		platformAuthenticatorIsAvailable,
		startAuthentication
	} from '@simplewebauthn/browser';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { pageContents } from '.';
	import type { LoginConfigs, LoginRequestBody } from './_interface';
	import { isEqual } from 'es-toolkit';

	// Constants
	const REMEMBER_STORAGE_KEY = 'app:rememberedUsername';

	// ===== State =====
	// Use $state with nested reactive objects for proper binding
	let usernameObj = $state({ value: '' });
	let passwordObj = $state({ value: '' });
	let rememberObj = $state({ checked: false });

	let configs: LoginConfigs = $state({
		username: usernameObj,
		password: passwordObj,
		remember: rememberObj
	});
	let loading = $state(false);

// Get form context for validation state - must be inside component context
let formContext = $state<ReturnType<typeof getFormContext> | undefined>(undefined);

$effect(() => {
	formContext = getFormContext();
});

	/** Lưu lần submit trước để ngăn submit trùng lặp */
	let previousSubmited: undefined | { username: string; password: string; remember?: boolean } =
		undefined;

	/** Thông báo lỗi hiển thị trực tiếp trên form */
	let formError = $state<string | undefined>(undefined);

	/** Thông báo thành công khi vừa đăng ký xong (từ ?registered=1) */
	let registeredSuccess = $state(false);

	/** Cặp khoá RSA tạm thời để mã hoá body khi gửi lên server */
	let encryptionKeys: undefined | { public: CryptoKey; private: CryptoKey } = $state(undefined);

	// ── Passkey (WebAuthn) state ──
	/** Browser hỗ trợ WebAuthn? — check ở onMount (SSR-safe) */
	let passkeySupported = $state(false);
	/** Thiết bị có platform authenticator (false → nút disabled + hint bật Windows Hello) */
	let passkeyAuthenticator = $state(false);
	let passkeyLoading = $state(false);	// Ngôn ngữ hiện tại
	const lang = $derived(client.browser?.language ?? 'en');
	const currentLang = $derived(lang === 'vi' ? 'vi' : 'en');

	// Derived: input validity for disabled parity
	const isUsernamePresent = $derived(!!configs.username.value?.trim());
	const isPasswordPresent = $derived(!!configs.password.value);

	// Trạng thái disabled nút submit — consistent with register: loading + duplicate guard + required
	const status = $derived.by(() => {
		const currentSubmit = {
			username: configs.username.value?.trim() ?? '',
			password: configs.password.value ?? '',
			remember: configs.remember.checked
		};
		const hasRequired = !!currentSubmit.username && !!currentSubmit.password;
		// Also check form validation via formContext
		const formValid = formContext?.validation?.isValid ?? hasRequired;
		return {
			disabled: loading || !hasRequired || !formValid || isEqual(currentSubmit, previousSubmited)
		};
	});

	// Clear formError on new input (but not immediately after validation failure)
	let formSubmitted = $state(false);

	// Chỉ xóa formError khi username/password THAY ĐỔI sau khi submit thất bại.
	// (Nếu phụ thuộc trực tiếp formSubmitted/formError, effect sẽ tự chạy và xóa
	// error ngay khi handleLogin vừa set nó → alert không bao giờ hiển thị được)
	let _prevUsername: string | undefined;
	let _prevPassword: string | undefined;
	$effect(() => {
		const u = configs.username.value;
		const p = configs.password.value;
		const changed = u !== _prevUsername || p !== _prevPassword;
		_prevUsername = u;
		_prevPassword = p;
		if (formSubmitted && formError !== undefined && changed) {
			formError = undefined;
		}
	});

	// Remember me persistence: sync to localStorage when toggled / typed
	$effect(() => {
		const doRemember = configs.remember.checked;
		const uname = configs.username.value?.trim() ?? '';
		if (typeof localStorage === 'undefined') return;
		try {
			if (!doRemember) {
				localStorage.removeItem(REMEMBER_STORAGE_KEY);
			} else if (uname) {
				localStorage.setItem(REMEMBER_STORAGE_KEY, uname);
			}
		} catch {
			// ignore quota / privacy mode errors
		}
	});

	// Caps Lock warning (P2 UX) — hiển thị khi user gõ password trong lúc Caps Lock bật.
	// Gắn listener keydown/focusout lên một wrapper `display:contents` quanh password
	// field (event keydown/focusout BUBBLE từ input → wrapper, không cần component
	// forward event). getModifierState('CapsLock') được hỗ trợ Safari 13+ (an toàn
	// cho target es2020/safari15).
	let capsLockOn = $state(false);
	function handleCapsKeydown(e: KeyboardEvent) {
		capsLockOn = typeof e.getModifierState === 'function' ? e.getModifierState('CapsLock') : false;
	}
	function handleCapsFocusout() {
		capsLockOn = false;
	}

	// Custom validation cho field "Username or email" (type="text" — KHÔNG dùng
	// type="email" vì Input tự gắn validator isEmail mặc định, làm hỏng nghiệp vụ
	// đăng nhập bằng username). 2 validator dưới chạy operator 'and' trên blur:
	// chỉ validator FAIL mới hiện message (FieldMessages ưu tiên invalid); giá trị
	// có '@' → phải là email hợp lệ, không '@' → phải là username 3-30 ký tự.
	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;
	const usernameOrEmailValidation = {
		blur: {
			operator: 'and' as const,
			handles: [
				{
					isValid: (v?: string | boolean | string[] | File[]) => {
						const raw = (typeof v === 'string' ? v : '').trim();
						if (!raw.includes('@')) return true;
						return EMAIL_RE.test(raw);
					},
					message: {
						invalid: {
							vi: 'Định dạng email không hợp lệ',
							en: 'Invalid email format'
						}
					}
				},
				{
					isValid: (v?: string | boolean | string[] | File[]) => {
						const raw = (typeof v === 'string' ? v : '').trim();
						if (raw.includes('@')) return true;
						return USERNAME_RE.test(raw);
					},
					message: {
						invalid: {
							vi: 'Tên đăng nhập từ 3-30 ký tự (chữ cái, số, gạch dưới, gạch ngang, dấu chấm)',
							en: 'Username must be 3-30 characters (letters, numbers, _, ., -)'
						}
					}
				}
			]
		}
	};

	// Validation
	function validateForm(): string | undefined {
		const raw = configs.username.value?.trim() ?? '';
		if (!raw) {
			return lang === 'vi' ? 'Vui lòng nhập tên đăng nhập hoặc email' : 'Please enter username or email';
		}
		if (raw.includes('@')) {
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
				return lang === 'vi' ? 'Định dạng email không hợp lệ' : 'Invalid email format';
			}
		} else {
			if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(raw)) {
				return lang === 'vi'
					? 'Tên đăng nhập từ 3-30 ký tự (chữ cái, số, gạch dưới, gạch ngang, dấu chấm)'
					: 'Username must be 3-30 characters (letters, numbers, _, ., -)';
			}
		}
		if (!configs.password.value) {
			return lang === 'vi' ? 'Vui lòng nhập mật khẩu' : 'Please enter password';
		}
		if (configs.password.value.length < 8) {
			return lang === 'vi'
				? 'Mật khẩu phải chứa ít nhất 8 ký tự'
				: 'Password must be at least 8 characters';
		}
		return undefined;
	}

	// ===== Hàm đăng nhập =====
	async function handleLogin() {
		const validationError = validateForm();
		if (validationError) {
			formError = validationError;
			formSubmitted = true; // Mark that we attempted submission so error persists until user types
			return;
		}

		if (!encryptionKeys || loading) return;

		loading = true;

		const requestBody: LoginRequestBody = {
			// validateForm đã return sớm khi username/password rỗng hoặc sai format
			// → non-null assertion an toàn tại đây (giá trị chắc chắn có).
			username: configs.username.value!.trim(),
			password: configs.password.value!,
			remember: configs.remember.checked,
			publicKeyB64: await encryption.exportKeyToBase64(encryptionKeys.public, 'spki'),
			// Keypair DPoP bền (ES256) — server bind refresh token qua jkt; sau này
			// /api/auth/refresh yêu cầu proof ký đúng khoá này mới cấp token mới.
			dpopJwk: await getDpopPublicJwk()
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

			if (response.ok) {
				previousSubmited = {
					username: requestBody.username,
					password: requestBody.password,
					remember: requestBody.remember
				};

				try {
					if (requestBody.remember && typeof localStorage !== 'undefined') {
						localStorage.setItem(REMEMBER_STORAGE_KEY, requestBody.username);
					} else if (typeof localStorage !== 'undefined') {
						localStorage.removeItem(REMEMBER_STORAGE_KEY);
					}
				} catch {}

				client.browser?.toasts?.create({
					title: pageContents.responseOk[lang] ?? (lang === 'vi' ? 'Đăng nhập thành công' : 'Login successful'),
					description: response.message ? (response.message[lang] ?? response.message.en) : undefined,
					color: 'success'
				});

				const redirectTo = page.url.searchParams.get('redirect') ?? '/';
				await goto(redirectTo);
			} else {
				formError =
					(response.message ? (response.message[lang] ?? response.message.en) : undefined) ??
					pageContents.responseFail[lang] ??
					(lang === 'vi' ? 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin!' : 'Login failed. Please check your credentials!');
				formSubmitted = true; // Mark that we attempted submission so error persists
			}
		} catch (e) {
			formError = e instanceof Error ? e.message : String(e);
			formSubmitted = true; // Mark that we attempted submission so error persists
		} finally {
			loading = false;
		}
	}

	// ===== Hàm reset form =====
	function handleReset() {
		usernameObj.value = '';
		passwordObj.value = '';
		rememberObj.checked = false;
		formError = undefined;
		previousSubmited = undefined;
		formSubmitted = false; // Reset submitted flag
		try {
			if (typeof localStorage !== 'undefined') localStorage.removeItem(REMEMBER_STORAGE_KEY);
		} catch {}
	}

	// ===== Đăng nhập bằng Passkey (WebAuthn) =====
	// Username field (nếu có) được gửi kèm để server ràng buộc allowCredentials —
	// trống → discoverable credential (authenticator tự chọn).
	// Nhóm 3: KHÔNG nuốt lỗi im lặng — phân loại rõ (chưa đăng ký / huỷ / origin).
	async function handlePasskeyLogin() {
		if (passkeyLoading) return;
		if (!encryptionKeys) {
			// vault chưa init xong (keypair RSA đang sinh) — báo trạng thái thay vì bỏ click
			formError = pageContents.passkeyInitializing[lang];
			return;
		}
		passkeyLoading = true;
		formError = undefined;
		try {
			// 1. Lấy options từ server (public endpoint, rate-limit 10 req/min)
			const username = configs.username.value?.trim() || undefined;
			const optRes = await encryption.fetchSecure('/api/auth/webauthn/auth/options', {
				method: 'post',
				body: { username }
			});
			if (!optRes.ok || !optRes.data?.options) {
				formError = optRes.message?.[lang] ?? optRes.message?.en ?? 'WebAuthn options failed';
				return;
			}

			// 2. Gọi authenticator (Touch ID / Face ID / Windows Hello / vân tay)
			const assertion = await startAuthentication({ optionsJSON: optRes.data.options });

			// 3. Verify + tạo session (server set cookie giống /api/login)
			const verRes = await encryption.fetchSecure('/api/auth/webauthn/auth/verify', {
				method: 'post',
				body: { response: assertion, dpopJwk: await getDpopPublicJwk() }
			});
			if (!verRes.ok) {
				formError = verRes.message?.[lang] ?? verRes.message?.en ?? 'Passkey login failed';
				return;
			}

			client.browser?.toasts?.create({
				title: pageContents.responseOk[lang] ?? 'Login successful',
				color: 'success'
			});

			const redirectTo = page.url.searchParams.get('redirect') ?? '/';
			await goto(redirectTo);
		} catch (e) {
			const em = e instanceof Error ? e.message : String(e);
			const ename = e instanceof DOMException ? e.name : /Error/.test(em) ? em.split(':')[0].trim() : '';
			// Phân loại lỗi WebAuthn — mỗi nhóm một thông điệp rõ (không swallow):
			if (/NotAllowed/i.test(ename) && /timed out|user|aborted|cancel/i.test(em)) {
				// user tự huỷ prompt hoặc timeout — thông báo nhẹ, không phải lỗi hệ thống
				formError = pageContents.passkeyCancelled[lang];
			} else if (/NotAllowed|InvalidState/i.test(ename)) {
				// không có credential nào đăng ký trên thiết bị này / đã đăng ký rồi
				formError = pageContents.passkeyNoCredential[lang];
			} else if (/SecurityError/i.test(ename)) {
				// rpId/origin mismatch — truy cập bằng IP/localhost thay vì domain HTTPS đúng
				formError = pageContents.passkeyOriginMismatch[lang];
			} else {
				formError = em;
			}
		} finally {
			passkeyLoading = false;
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};

		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { private: privateKey, public: publicKey };

		// WebAuthn support check (SSR-safe — chỉ chạy client).
		// passkeySupported: WebAuthn API sẵn sàng (hiện nút, có thể disabled).
		// passkeyAuthenticator: thiết bị CÓ platform authenticator (Touch ID /
		// Face ID / Windows Hello / vân tay Android).
		// BẪY Safari iOS 15.1: platformAuthenticatorIsAvailable() (IUPAA) có thể
		// REJECT (NotSupportedError/AbortError WebKit cũ) → catch cũ tắt CẢ nút
		// vĩnh viễn không log. Optimistic: lỗi/false gate → vẫn hiển thị nút
		// (user bấm sẽ thấy lỗi thật từ startRegistration nếu không có).
		passkeySupported = false;
		passkeyAuthenticator = false;
		try {
			if (
				typeof window !== 'undefined' &&
				typeof (window as { PublicKeyCredential?: unknown }).PublicKeyCredential !== 'undefined' &&
				browserSupportsWebAuthn()
			) {
				passkeySupported = true;
				try {
					passkeyAuthenticator = await platformAuthenticatorIsAvailable();
				} catch {
					passkeyAuthenticator = true;
				}
				if (!passkeyAuthenticator) passkeyAuthenticator = true;
			}
		} catch {
			passkeySupported = false;
			passkeyAuthenticator = false;
		}

		try {
			if (typeof localStorage !== 'undefined') {
				const saved = localStorage.getItem(REMEMBER_STORAGE_KEY);
				if (saved) {
					usernameObj.value = saved;
					rememberObj.checked = true;
				}
			}
		} catch {}

		if (page.url.searchParams.get('registered') === '1') {
			registeredSuccess = true;
		}
	});

	onDestroy(() => {});

	// Auto-focus field đầu tiên khi route THAY ĐỔI (afterNavigate — precedent
	// Pagination "focus qua rAF — KHÔNG dùng autofocus"): requestAnimationFrame
	// đợi DOM ổn định rồi focus input USERNAME — field đầu form. Touch device
	// bỏ qua (bàn phím ảo tự bật làm giật viewport).
	afterNavigate(() => {
		if (typeof window === 'undefined') return;
		if (client.browser?.isMobile) return;
		requestAnimationFrame(() => {
			const el = document.querySelector<HTMLInputElement>('.form-root .auth-input-wrapper input');
			if (el && document.activeElement !== el) el.focus();
		});
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang] ?? 'Sign In'}</title>
	<meta name="description" content={pageContents.subtitle[lang] ?? 'Sign in to your account'} />
	<!-- Inter do AuthLayout load chung cho cả họ auth -->
</svelte:head>

<AuthLayout
	title={pageContents.title[lang] ?? 'Welcome back'}
	subtitle={pageContents.subtitle[lang] ?? 'Sign in to your account'}
	headline={lang === 'vi' ? 'Chào mừng trở lại!' : 'Welcome back!'}
	description={lang === 'vi'
		? 'Đăng nhập để tiếp tục trải nghiệm dịch vụ của chúng tôi.'
		: 'Sign in to continue your seamless experience.'}
	features={[
		lang === 'vi' ? 'Bảo mật đầu cuối' : 'End-to-end encryption',
		lang === 'vi' ? 'Đăng nhập nhanh chóng' : 'Lightning fast sign-in',
		lang === 'vi' ? 'Bảo vệ tài khoản 24/7' : '24/7 account protection'
	]}
	successMessage={registeredSuccess
		? (pageContents.registeredSuccess[lang] ?? 'Registration successful! Please sign in.')
		: undefined}
	{formError}
>
	<Form onSubmit={handleLogin} onReset={handleReset}>
		<TextField name="username" required>
			<Label>{pageContents.username[lang] ?? 'Username / Email'}</Label>
			<div class="auth-input-wrapper">
				<Input
					type="text"
					bind:value={configs.username.value}
					placeholder={{ vi: 'Nhập tên đăng nhập hoặc email', en: 'Enter username or email' }}
					autocomplete="username"
					inputmode="email"
					class="auth-input"
					emailSuggest={true}
					validation={usernameOrEmailValidation}
				/>
				<!-- Icon đứng SAU <Input> trong DOM: để AuthLayout dùng
				     general-sibling `~` (không cần `:has()`, Safari 15-safe)
				     cho icon đổi màu theo validation state. position:absolute
				     → vị trí hiển thị không đổi. -->
				<svg class="auth-input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
						clip-rule="evenodd"
					/>
				</svg>
			</div>
			<FieldMessages />
		</TextField>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="caps-scope" onkeydown={handleCapsKeydown} onfocusout={handleCapsFocusout}>
			<TextField name="password" required>
				<Label>{pageContents.password[lang] ?? 'Password'}</Label>
				<div class="auth-input-wrapper">
					<Input
						type="password"
						bind:value={configs.password.value}
						placeholder={{ vi: 'Nhập mật khẩu', en: 'Enter your password' }}
						autocomplete="current-password"
						class="auth-input"
						actionButtons={{ showPassword: { display: true } }}
					/>
					<svg class="auth-input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 002-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				{#if capsLockOn}
					<div class="caps-hint" role="alert">
						<svg class="caps-hint-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path
								fill-rule="evenodd"
								d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
								clip-rule="evenodd"
							/>
						</svg>
						<span>{lang === 'vi' ? 'Caps Lock đang bật' : 'Caps Lock is on'}</span>
					</div>
				{/if}
				<FieldMessages />
			</TextField>
		</div>

		<!-- Hàng Remember me + Forgot password -->
		<div class="login-options">
			<Checkbox bind:checked={configs.remember.checked}>
				<Label>{pageContents.remember[lang] ?? 'Remember me'}</Label>
			</Checkbox>
			<Button variant="link" color="default" class="login-forgot-link" to="/forgot-password">
				{pageContents.forgotPassword[lang] ?? 'Forgot password?'}
			</Button>
		</div>

		{#if passkeySupported}
			<!-- Đăng nhập bằng Passkey (Touch ID / Face ID / Windows Hello / vân tay Android).
			     Hàng riêng PHÍA TRÊN nút Sign in theo yêu cầu. Nhóm 3: không có
			     authenticator → nút disabled + hint (thay vì ẩn hoàn toàn). -->
			<div class="passkey-section">
				<Button
					class="auth-btn-passkey"
					color="primary"
					variant="ghost"
					icon="lucide:fingerprint"
					loading={passkeyLoading}
					onclick={handlePasskeyLogin}
				>
					{pageContents.passkeyLogin[lang] ?? (lang === 'vi' ? 'Đăng nhập bằng sinh trắc học' : 'Sign in with biometrics')}
				</Button>
				<div class="passkey-divider">
					<span>{pageContents.passkeyOr[lang] ?? (lang === 'vi' ? 'hoặc' : 'or')}</span>
				</div>
				<a class="passkey-guide-link" href="/docs/biometric-login.html" target="_blank" rel="noopener" data-test="passkey-guide-link">
					{pageContents.passkeyGuide[lang]}
				</a>
			</div>
		{/if}

		<!-- Nút hành động -->
		<div class="auth-actions">
			<Button
				class="auth-btn-submit"
				color="success"
				type="submit"
				{loading}
				disabled={status.disabled}
			>
				{#if loading}
					<span class="spinner"></span>
					<span>{lang === 'vi' ? 'Đang đăng nhập...' : 'Signing in...'}</span>
				{:else}
					<span>{pageContents.login[lang] ?? 'Sign in'}</span>
				{/if}
			</Button>

			<Button
				class="auth-btn-reset"
				color="default"
				type="reset"
				variant="ghost"
				size="md"
			>
				{pageContents.reset[lang] ?? 'Reset'}
			</Button>
		</div>
	</Form>

	{#snippet footer()}
		<!-- Divider -->
		<div class="auth-divider">
			<span>{pageContents.noAccount[lang] ?? "Don't have an account?"}</span>
		</div>

		<!-- Link sang trang đăng ký -->
		<div class="auth-switch-link">
			<Button variant="ghost" color="primary" class="auth-switch-btn" to="/register" >
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
	{/snippet}
</AuthLayout>

<style lang="scss">
	/* Login Specific Styles (Layout & Common tokens provided by AuthLayout) */
	/* Wrapper để bắt keydown/focusout cho Caps Lock hint. display:contents →
	   không phá flex layout của .form-root (TextField vẫn là con trực tiếp). */
	.caps-scope {
		display: contents;
	}

	/* Token tự đảo theo data-theme (variables.scss): warning-500 gần
	   #b45309 light / #fbbf24 dark; warning-50 nền nhạt; warning-200 viền. */
	.caps-hint {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.7875rem;
		line-height: 1.4;
		color: var(--warning-500);
		background: var(--warning-50);
		border: 1px solid var(--warning-200);
		border-radius: 0.5rem;
		padding: 0.375rem 0.625rem;
		margin-top: 0.125rem;

		.caps-hint-icon {
			flex-shrink: 0;
			width: 0.9rem;
			height: 0.9rem;
		}
	}

	.login-options {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;

		:global(.checkbox-root) {
			white-space: nowrap;
		}

		/* Mobile: stack vertically */
		@media (max-width: 480px) {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;

			:global(.checkbox-root) {
				white-space: normal;
			}
		}
	}


	/* Loading spinner animation — nền nút success (đậm cả 2 theme) →
	   vạch sáng dùng --solid (gần trắng), rãnh dùng cùng màu alpha. */
	.spinner {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		border: 2px solid rgb(255 255 255 / 0.3);
		border-top-color: var(--solid);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin-right: 0.5rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	:global(.auth-btn-submit) {
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		gap: 0.5rem !important;

		.spinner {
			margin-right: 0;
		}
	}

	:global(.auth-switch-btn) {
		.link-arrow {
			width: 1.25rem;
			height: 1.25rem;
			flex-shrink: 0;
		}
	}

	/* Passkey: hàng riêng PHÍA TRÊN nút Sign in (nút + divider "hoặc") */
	.passkey-section {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.5rem;
	}

	.passkey-divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		color: var(--foreground-500);
		font-size: 0.8rem;

		&::before,
		&::after {
			content: '';
			flex: 1;
			height: 1px;
			background: var(--default-300);
		}
	}

	:global(.auth-btn-passkey) {
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		gap: 0.5rem !important;
		width: 100%;
		/* Ghi đè --min-height của size-sm/md (2.5rem). KHÔNG khoá height:
		   nhãn vi 'Đăng nhập bằng sinh trắc học' (~276px @ 14px) ở viewport
		   320px cần được wrap xuống dòng thứ 2 thay vì tràn/ép co chữ. */
		--min-height: 2.75rem !important;
		min-height: 2.75rem !important;
	}

	/* Nhóm 3: link hướng dẫn khi thiếu authenticator */
	.passkey-guide-link {
		margin-top: 0.15rem;
		/* ≥ 0.8125rem (13px): tap target chữ trên mobile — 0.78rem quá nhỏ */
		font-size: 0.8125rem;
		color: var(--primary-600);
		text-decoration: none;

		&:hover {
			text-decoration: underline;
		}
	}
</style>
