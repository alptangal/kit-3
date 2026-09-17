<script lang="ts">
	// src\routes\(unauthorized)\register\+page.svelte
	import { goto } from '$app/navigation';
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
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { isEqual } from 'es-toolkit';
	import { pageContents } from '.';
	import type { RegisterRequestBody } from './_interface';

	// ── Form State ──
	let formData = $state({
		firstname: '',
		midname: '',
		lastname: '',
		username: '',
		email: '',
		password: '',
		confirmPassword: ''
	});

	let agreeTerms = $state(false);
	let loading = $state(false);
	let formError = $state<string | undefined>(undefined);
	let mounted = $state(false);
	let showTermsModal = $state(false);

	// Honeypot — hidden from real users, bots fill it
	let honeypot = $state('');

	/** Cặp khoá RSA tạm thời cho phiên đăng ký */
	let encryptionKeys = $state<
		| undefined
		| {
				publicKey: CryptoKey;
				privateKey: CryptoKey;
		  }
	>(undefined);

	/** Lưu lần submit trước để ngăn submit trùng lặp */
	let previousSubmited:
		| undefined
		| {
				firstname: string;
				midname?: string;
				lastname: string;
				username: string;
				email: string;
				password: string;
		  } = undefined;

	const lang = $derived(client.browser?.language ?? 'en');
	const currentLang = $derived(lang === 'vi' ? 'vi' : 'en');

	// ── Realtime Check State for Username & Email ──
	let usernameStatus = $state<{
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

	let usernameTimeoutId: ReturnType<typeof setTimeout> | undefined;
	let emailTimeoutId: ReturnType<typeof setTimeout> | undefined;
	// Sequence to discard stale fetch results
	let usernameSeq = 0;
	let emailSeq = 0;

	function resetUsernameStatus() {
		usernameStatus.checking = false;
		usernameStatus.checked = false;
		usernameStatus.taken = false;
		usernameStatus.available = false;
		usernameStatus.message = undefined;
	}
	function resetEmailStatus() {
		emailStatus.checking = false;
		emailStatus.checked = false;
		emailStatus.taken = false;
		emailStatus.available = false;
		emailStatus.message = undefined;
	}

	$effect(() => {
		const keysReady = !!encryptionKeys;
		const raw = formData.username?.trim() ?? '';

		if (!keysReady) {
			if (usernameTimeoutId) {
				clearTimeout(usernameTimeoutId);
				usernameTimeoutId = undefined;
			}
			// Do not mark checking when keys not ready; keep status neutral but not loading
			if (usernameStatus.checking) usernameStatus.checking = false;
			return;
		}

		if (!raw) {
			if (usernameTimeoutId) {
				clearTimeout(usernameTimeoutId);
				usernameTimeoutId = undefined;
			}
			resetUsernameStatus();
			return;
		}

		if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(raw)) {
			if (usernameTimeoutId) {
				clearTimeout(usernameTimeoutId);
				usernameTimeoutId = undefined;
			}
			resetUsernameStatus();
			return;
		}

		if (usernameTimeoutId) clearTimeout(usernameTimeoutId);
		usernameStatus.checking = true;

		const seq = ++usernameSeq;
		const snapshot = raw;

		usernameTimeoutId = setTimeout(async () => {
			// Re-check keys at execution time — debounce waits until keys ready, but keys may have been cleared
			if (!encryptionKeys) {
				if (seq === usernameSeq) usernameStatus.checking = false;
				return;
			}
			// Stale snapshot check before request
			const current = formData.username?.trim() ?? '';
			if (current !== snapshot || seq !== usernameSeq) {
				if (seq === usernameSeq) usernameStatus.checking = false;
				return;
			}
			try {
				const data = (await encryption.fetchSecure(
					'/api/register/check',
					{
						method: 'POST',
						body: { username: snapshot }
					},
					encryptionKeys
				)) as any;
				// Discard stale response
				if (seq !== usernameSeq) return;
				if (formData.username?.trim() !== snapshot) return;

				if (data.ok && data.username && data.username.valid) {
					usernameStatus.checked = true;
					usernameStatus.taken = !!data.username.taken;
					usernameStatus.available = !!data.username.available;
					usernameStatus.message = data.username.message;
				} else {
					// valid==false or unexpected payload -> treat as not checked
					resetUsernameStatus();
				}
			} catch (e) {
				console.error('Error checking username:', e);
				if (seq === usernameSeq) {
					// keep checked false so UI doesn't show stale success
					usernameStatus.checked = false;
				}
			} finally {
				if (seq === usernameSeq) usernameStatus.checking = false;
			}
		}, 400);
	});

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
				if (seq === emailSeq) emailStatus.checked = false;
			} finally {
				if (seq === emailSeq) emailStatus.checking = false;
			}
		}, 400);
	});

	// ── Password Strength — sophisticated scoring ──
	function estimatePasswordStrength(
		pwd: string,
		username?: string,
		email?: string
	): { score: number; label: string; percent: number; color: string; feedback?: string } {
		if (!pwd) return { score: 0, label: '', percent: 0, color: 'transparent' };

		const len = pwd.length;
		// Enforce minimum length — short passwords always weak
		const weakResult = {
			score: 1,
			label: pageContents.passwordStrength.weak[lang] ?? 'Weak',
			percent: 25,
			color: '#ef4444'
		};
		if (len < 8) return weakResult;

		let rawScore = 0;

		// Length contribution (0-3)
		if (len >= 8) rawScore += 1;
		if (len >= 12) rawScore += 1;
		if (len >= 16) rawScore += 1;

		// Variety (0-3) — how many character classes present
		let varieties = 0;
		if (/[a-z]/.test(pwd)) varieties++;
		if (/[A-Z]/.test(pwd)) varieties++;
		if (/\d/.test(pwd)) varieties++;
		if (/[^A-Za-z0-9\s]/.test(pwd)) varieties++;
		if (varieties >= 2) rawScore += 1;
		if (varieties >= 3) rawScore += 1;
		if (varieties >= 4) rawScore += 1;

		// Deductions
		const lower = pwd.toLowerCase();
		const commonList = [
			'password',
			'123456',
			'12345678',
			'123456789',
			'qwerty',
			'abc123',
			'letmein',
			'admin',
			'welcome',
			'iloveyou',
			'monkey',
			'dragon',
			'111111',
			'123123',
			'qwerty123',
			'password1',
			'1234',
			'000000',
			'sunshine',
			'princess',
			'football',
			'654321',
			'starwars'
		];
		const isCommon = commonList.some((c) => lower === c || lower.includes(c));
		if (isCommon) rawScore -= 2;

		// Sequential characters (abc, 123, etc.)
		const sequentialRe =
			/(?:012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|qwe|wer|ert|rty|tyu|yui|uio|asd|sdf|dfg|fgh|ghj|hjk|jkl|zxc|xcv|cvb|vbn|bnm)/i;
		if (sequentialRe.test(pwd)) rawScore -= 1;

		// Repeated chars (aaa, 111)
		if (/(.)\1{2,}/.test(pwd)) rawScore -= 1;

		// Keyboard patterns
		if (/(?:qwerty|asdf|zxcv|qaz|wsx|edc|qazwsx|1qaz|zaq1)/i.test(pwd)) rawScore -= 1;

		// Contains username / email local part
		if (username && username.length >= 3 && lower.includes(username.toLowerCase())) rawScore -= 1;
		if (email) {
			const local = email.split('@')[0]?.toLowerCase();
			if (local && local.length >= 3 && lower.includes(local)) rawScore -= 1;
		}

		// Clamp rawScore 0-6
		rawScore = Math.max(0, Math.min(rawScore, 6));

		// Map rawScore 0-6 -> normalized 1-4
		if (rawScore <= 1) {
			return {
				score: 1,
				label: pageContents.passwordStrength.weak[lang] ?? 'Weak',
				percent: 25,
				color: '#ef4444'
			};
		} else if (rawScore === 2) {
			return {
				score: 2,
				label: pageContents.passwordStrength.fair[lang] ?? 'Fair',
				percent: 50,
				color: '#f59e0b'
			};
		} else if (rawScore <= 4) {
			return {
				score: 3,
				label: pageContents.passwordStrength.good[lang] ?? 'Good',
				percent: 75,
				color: '#3b82f6'
			};
		} else {
			return {
				score: 4,
				label: pageContents.passwordStrength.strong[lang] ?? 'Strong',
				percent: 100,
				color: '#10b981'
			};
		}
	}

	const passwordStrength = $derived.by(() => {
		return estimatePasswordStrength(
			formData.password,
			formData.username?.trim(),
			formData.email?.trim()
		);
	});

	/** Trạng thái khớp confirmPassword */
	const confirmMatch = $derived.by(() => {
		if (!formData.confirmPassword) return null; // null = chưa nhập
		return formData.confirmPassword === formData.password;
	});

	// Trạng thái disabled nút submit — ignore midname when undefined/empty for duplicate check
	const status = $derived.by(() => {
		const current = {
			firstname: formData.firstname?.trim() ?? '',
			midname: formData.midname?.trim() || undefined,
			lastname: formData.lastname?.trim() ?? '',
			username: formData.username?.trim() ?? '',
			email: formData.email?.trim() ?? '',
			password: formData.password ?? ''
		};

		const hasRequired =
			!!current.firstname &&
			!!current.lastname &&
			!!current.username &&
			!!current.email &&
			!!current.password &&
			formData.password.length >= 8 &&
			formData.password === formData.confirmPassword &&
			!usernameStatus.taken &&
			!emailStatus.taken &&
			!usernameStatus.checking &&
			!emailStatus.checking &&
			agreeTerms;

		const normalizeForCompare = (obj: typeof current | typeof previousSubmited) => {
			if (!obj) return obj;
			const copy: Record<string, unknown> = { ...obj };
			if (copy['midname'] === undefined || copy['midname'] === '') delete copy['midname'];
			return copy;
		};

		const isDuplicate =
			previousSubmited !== undefined &&
			isEqual(normalizeForCompare(current), normalizeForCompare(previousSubmited));

		return {
			disabled: loading || !hasRequired || isDuplicate
		};
	});

	// ── Validation trước khi gửi ──
	function validateForm(): string | undefined {
		if (honeypot.trim() !== '') {
			return lang === 'vi' ? 'Yêu cầu bị từ chối' : 'Request rejected';
		}
		if (!formData.lastname?.trim() || !formData.firstname?.trim()) {
			return lang === 'vi'
				? 'Vui lòng nhập đầy đủ Họ và Tên'
				: 'Please enter both first and last name';
		}
		if (!formData.username?.trim()) {
			return lang === 'vi' ? 'Vui lòng nhập tên đăng nhập' : 'Please enter a username';
		}
		if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(formData.username?.trim() ?? '')) {
			return lang === 'vi'
				? 'Tên đăng nhập từ 3-30 ký tự (chữ cái, số, gạch dưới, gạch ngang)'
				: 'Username must be 3-30 characters (letters, numbers, underscores, dashes)';
		}
		if (!formData.email?.trim()) {
			return lang === 'vi' ? 'Vui lòng nhập địa chỉ email' : 'Please enter your email';
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email?.trim() ?? '')) {
			return lang === 'vi' ? 'Định dạng email không hợp lệ' : 'Invalid email format';
		}
		if (!formData.password) {
			return lang === 'vi' ? 'Vui lòng nhập mật khẩu' : 'Please enter a password';
		}
		if (formData.password.length < 8) {
			return lang === 'vi'
				? 'Mật khẩu phải chứa ít nhất 8 ký tự'
				: 'Password must be at least 8 characters';
		}
		if (formData.password !== formData.confirmPassword) {
			return lang === 'vi'
				? 'Mật khẩu xác nhận không khớp'
				: 'Confirm password does not match';
		}
		if (!agreeTerms) {
			return lang === 'vi'
				? 'Bạn phải đồng ý với Điều khoản sử dụng'
				: 'You must agree to the Terms of Service';
		}
		return undefined;
	}

	// ── Xử lý Đăng ký ──
	async function handleRegister() {
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
			const requestBody: RegisterRequestBody = {
				firstname: formData.firstname?.trim() ?? '',
				midname: formData.midname?.trim() || undefined,
				lastname: formData.lastname?.trim() ?? '',
				username: formData.username?.trim() ?? '',
				email: formData.email?.trim() ?? '',
				password: formData.password ?? '',
				publicKeyB64: await encryption.exportKeyToBase64(encryptionKeys.publicKey, 'spki')
			};

			const response = await encryption.fetchSecure(
				'/api/register',
				{
					method: 'POST',
					body: requestBody
				},
				encryptionKeys
			);

			loading = false;

			if (response.ok) {
				previousSubmited = {
					firstname: requestBody.firstname,
					midname: requestBody.midname,
					lastname: requestBody.lastname,
					username: requestBody.username,
					email: requestBody.email,
					password: requestBody.password
				};

				client.browser?.toasts?.create({
					title: lang === 'vi' ? 'Đăng ký thành công!' : 'Registration successful!',
					description:
						(response.message ? response.message[lang] ?? response.message.en : undefined) ??
						(lang === 'vi'
							? 'Tài khoản của bạn đã được tạo thành công.'
							: 'Your account has been created successfully.'),
					color: 'success'
				});

				await goto('/login?registered=1');
			} else {
				formError =
					(response.message ? response.message[lang] ?? response.message.en : undefined) ??
					(lang === 'vi' ? 'Đăng ký không thành công' : 'Registration failed');
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
		formData.firstname = '';
		formData.midname = '';
		formData.lastname = '';
		formData.username = '';
		formData.email = '';
		formData.password = '';
		formData.confirmPassword = '';
		honeypot = '';
		agreeTerms = false;
		formError = undefined;
		previousSubmited = undefined;
		if (usernameTimeoutId) {
			clearTimeout(usernameTimeoutId);
			usernameTimeoutId = undefined;
		}
		if (emailTimeoutId) {
			clearTimeout(emailTimeoutId);
			emailTimeoutId = undefined;
		}
		usernameSeq++;
		emailSeq++;
		// Replace objects to ensure reactivity for any watchers that rely on identity
		usernameStatus = {
			checking: false,
			checked: false,
			taken: false,
			available: false
		};
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

		requestAnimationFrame(() => {
			mounted = true;
		});
	});

	onDestroy(() => {
		if (usernameTimeoutId) {
			clearTimeout(usernameTimeoutId);
			usernameTimeoutId = undefined;
		}
		if (emailTimeoutId) {
			clearTimeout(emailTimeoutId);
			emailTimeoutId = undefined;
		}
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang] ?? 'Create an account'}</title>
	<meta
		name="description"
		content={pageContents.subtitle[lang] ?? 'Sign up quickly with advanced end-to-end encryption'}
	/>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="register-page" class:mounted>
	<!-- ════ Left Panel: Brand & Feature Highlights ════ -->
	<div class="register-panel-left" aria-hidden="true">
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
					{pageContents.welcomeHeadline[lang] ?? 'Join us today!'}
				</h2>
				<p class="panel-desc">
					{pageContents.welcomeDesc[lang] ??
						'Start your journey with a professional, securely encrypted management platform.'}
				</p>
			</div>

			<ul class="panel-features">
				{#each pageContents.features as feat}
					<li>
						<span class="feature-icon">✦</span>
						<span>{feat[lang] ?? feat.en}</span>
					</li>
				{/each}
			</ul>
		</div>
	</div>

	<!-- ════ Right Panel: Register Form Card ════ -->
	<div class="register-panel-right">
		<div class="register-card">
			<!-- Header -->
			<div class="register-header">
				<div class="register-logo-sm">
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
				<h1 class="register-title">{pageContents.title[lang] ?? 'Create an account'}</h1>
				<p class="register-subtitle">
					{pageContents.subtitle[lang] ?? 'Sign up quickly with advanced end-to-end encryption'}
				</p>
			</div>

			<!-- Error Alert -->
			{#if formError}
				<div
					class="register-alert register-alert--error"
					role="alert"
					aria-live="assertive"
					aria-atomic="true"
				>
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

			<!-- Register Form -->
			<Form onSubmit={handleRegister} onReset={handleReset}>
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

				<!-- Name fieldset: Lastname, Midname, Firstname -->
				<fieldset class="name-fieldset" aria-label={lang === 'vi' ? 'Họ và tên' : 'Full name'}>
					<div class="name-grid">
						<TextField name="lastname" required>
							<Label>{pageContents.textFields.lastname[lang] ?? 'Last name'}</Label>
							<Input
								bind:value={formData.lastname}
								placeholder={{ vi: 'Nguyễn', en: 'Doe' }}
								autocomplete="family-name"
								class="name-input"
								disabled={loading}
							/>
							<FieldMessages />
						</TextField>
						<TextField name="midname">
							<Label>{pageContents.textFields.midname[lang] ?? 'Middle name'}</Label>
							<Input
								bind:value={formData.midname}
								placeholder={{ vi: 'Văn', en: 'Middle' }}
								autocomplete="additional-name"
								class="name-input"
								disabled={loading}
							/>
							<FieldMessages />
						</TextField>
						<TextField name="firstname" required>
							<Label>{pageContents.textFields.firstname[lang] ?? 'First name'}</Label>
							<Input
								bind:value={formData.firstname}
								placeholder={{ vi: 'An', en: 'John' }}
								autocomplete="given-name"
								class="name-input"
								disabled={loading}
							/>
							<FieldMessages />
						</TextField>
					</div>
				</fieldset>

				<!-- Username field -->
				<TextField name="username" required>
					<Label>{pageContents.textFields.username[lang] ?? 'Username'}</Label>
					<div class="input-wrapper">
						<svg class="input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path
								fill-rule="evenodd"
								d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
								clip-rule="evenodd"
							/>
						</svg>
						<Input
							bind:value={formData.username}
							placeholder={{ vi: 'Nhập tên đăng nhập', en: 'Enter username' }}
							autocomplete="username"
							loading={usernameStatus.checking}
							disabled={loading}
							color={usernameStatus.checked ? (usernameStatus.taken ? 'error' : 'success') : undefined}
							class="register-input {usernameStatus.checked ? (usernameStatus.taken ? 'confirm-mismatch' : 'confirm-match') : ''}"
						/>
					</div>
					{#if usernameStatus.checked && usernameStatus.taken}
						<Description persistent={true} color="error" class="form-hint error-hint">
							{usernameStatus.message?.[currentLang] ?? 'Username is already taken'}
						</Description>
					{:else if usernameStatus.checked && usernameStatus.available}
						<Description persistent={true} color="success" class="form-hint success-hint">
							{usernameStatus.message?.[currentLang] ?? 'Username is available'}
						</Description>
					{:else}
						<Description class="form-hint">{pageContents.hints.usernameHint[lang]}</Description>
						<FieldMessages />
					{/if}
				</TextField>

				<!-- Email field -->
				<TextField name="email" required>
					<Label>{pageContents.textFields.email[lang] ?? 'Email'}</Label>
					<div class="input-wrapper">
						<svg class="input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
							color={emailStatus.checked ? (emailStatus.taken ? 'error' : 'success') : undefined}
							class="register-input {emailStatus.checked ? (emailStatus.taken ? 'confirm-mismatch' : 'confirm-match') : ''}"
						/>
					</div>
					{#if emailStatus.checked && emailStatus.taken}
						<Description persistent={true} color="error" class="form-hint error-hint">
							{emailStatus.message?.[currentLang] ?? 'Email is already registered'}
						</Description>
					{:else if emailStatus.checked && emailStatus.available}
						<Description persistent={true} color="success" class="form-hint success-hint">
							{emailStatus.message?.[currentLang] ?? 'Email is available'}
						</Description>
					{:else}
						<FieldMessages />
					{/if}
				</TextField>

				<!-- Password field -->
				<TextField name="password" required>
					<Label>{pageContents.textFields.password[lang] ?? 'Password'}</Label>
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
							bind:value={formData.password}
							placeholder={{ vi: 'Nhập mật khẩu', en: 'Enter your password' }}
							autocomplete="new-password"
							disabled={loading}
							class="register-input"
						/>
					</div>

					<!-- Password Strength Indicator — 4-segment bars -->
					{#if formData.password}
						<div class="strength-meter" aria-label={passwordStrength.label} aria-live="polite">
							<div class="strength-segments" role="progressbar" aria-valuenow={passwordStrength.percent} aria-valuemin="0" aria-valuemax="100">
								{#each [1, 2, 3, 4] as seg}
									<div
										class="strength-seg"
										class:active={passwordStrength.score >= seg}
										style:background-color={passwordStrength.score >= seg
											? passwordStrength.color
											: undefined}
									></div>
								{/each}
							</div>
							<span class="strength-label" style:color={passwordStrength.color}>
								{passwordStrength.label}
							</span>
						</div>
					{/if}
					<Description class="form-hint">{pageContents.hints.passwordHint[lang]}</Description>
					<FieldMessages />
				</TextField>

				<!-- Confirm Password field -->
				<TextField name="confirmPassword" required>
					<Label>{pageContents.textFields.confirmPassword[lang] ?? 'Confirm password'}</Label>
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
							bind:value={formData.confirmPassword}
							placeholder={{ vi: 'Nhập lại mật khẩu', en: 'Confirm your password' }}
							autocomplete="new-password"
							disabled={loading}
							class="register-input {confirmMatch === false ? 'confirm-mismatch' : confirmMatch === true ? 'confirm-match' : ''}"
						/>
					</div>
					{#if confirmMatch === false}
						<Description persistent={true} color="error" class="form-hint error-hint">
							{pageContents.hints.confirmPasswordHint[lang] ?? 'Passwords do not match'}
						</Description>
					{:else if confirmMatch === true}
						<Description persistent={true} color="success" class="form-hint success-hint">
							{lang === 'vi' ? 'Mật khẩu khớp' : 'Passwords match'}
						</Description>
					{:else}
						<FieldMessages />
					{/if}
				</TextField>

				<!-- Terms & Conditions Checkbox -->
				<div class="terms-row">
					<Checkbox bind:checked={agreeTerms} disabled={loading}>
						<span class="terms-text">
							{pageContents.terms.agreeLabel[lang] ?? 'I agree to the'}
							<button
								type="button"
								class="terms-link-btn"
								disabled={loading}
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									if (loading) return;
									showTermsModal = true;
								}}
							>
								{pageContents.terms.linkText[lang] ?? 'Terms of Service'}
							</button>
						</span>
					</Checkbox>
				</div>

				<!-- Action Buttons -->
				<div class="register-actions">
					<Button
						class="register-btn-submit"
						color="success"
						type="submit"
						{loading}
						disabled={status.disabled}
						onClick={handleRegister}
					>
						{pageContents.buttons.confirm[lang] ?? 'Create account'}
					</Button>

					<Button
						class="register-btn-reset"
						color="error"
						type="reset"
						variant="ghost"
						disabled={loading}
					>
						{pageContents.buttons.reset[lang] ?? 'Reset'}
					</Button>
				</div>
			</Form>

			<!-- Divider -->
			<div class="register-divider">
				<span>{pageContents.hasAccount[lang] ?? 'Already have an account?'}</span>
			</div>

			<!-- Switch to Login -->
			<div class="register-login-link">
				<Button variant="link" color="primary" class="login-link-btn" to="/login">
					<span>{pageContents.signIn[lang] ?? 'Sign in now'}</span>
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

<!-- Modal Terms of Service -->
<Modal bind:display={showTermsModal} size="md" isDimissable>
	<Modal.Container class="terms-modal-box">
		<Modal.Container.Header class="terms-modal-header">
			{pageContents.terms.modalTitle[lang] ?? 'Terms of Service'}
		</Modal.Container.Header>
		<Modal.Container.Body class="terms-modal-body">
			<p class="modal-intro">{pageContents.terms.modalIntro[lang]}</p>
			<div class="modal-clauses">
				<div class="clause-item">
					<p>{pageContents.terms.modalP1[lang]}</p>
				</div>
				<div class="clause-item">
					<p>{pageContents.terms.modalP2[lang]}</p>
				</div>
				<div class="clause-item">
					<p>{pageContents.terms.modalP3[lang]}</p>
				</div>
			</div>
		</Modal.Container.Body>
		<Modal.Container.Footer class="terms-modal-footer">
			<Button
				color="success"
				onClick={() => {
					agreeTerms = true;
					showTermsModal = false;
				}}
			>
				{pageContents.terms.acceptBtn[lang] ?? 'I Accept'}
			</Button>
			<Button
				color="default"
				variant="ghost"
				onClick={() => {
					showTermsModal = false;
				}}
			>
				{pageContents.terms.declineBtn[lang] ?? 'Decline'}
			</Button>
		</Modal.Container.Footer>
	</Modal.Container>
</Modal>

<style lang="scss">
	/* ═══════════════════════════════════════════════
	   REGISTER PAGE — CONSISTENT WITH LOGIN REDESIGN
	   ═══════════════════════════════════════════════ */

	.register-page {
		display: flex;
		min-height: 100dvh;
		width: 100%;
		font-family: 'Inter', system-ui, sans-serif;
		overflow: hidden;
	}

	/* Honeypot — off-screen, not display:none so bots still see it but humans & autofill don't */
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

	/* ══ Left Decorative Panel (Identical to Login) ══ */
	.register-panel-left {
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
		padding: 3rem;
		max-width: 420px;
	}

	.brand-logo svg {
		width: 56px;
		height: 56px;
		filter: drop-shadow(0 8px 24px rgba(99, 102, 241, 0.45));
	}

	.panel-headline {
		font-size: 2.25rem;
		font-weight: 700;
		line-height: 1.15;
		color: #ffffff;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.panel-desc {
		font-size: 0.95rem;
		color: rgba(255, 255, 255, 0.65);
		line-height: 1.6;
		margin: 0.5rem 0 0;
	}

	.panel-features {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;

		li {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			color: rgba(255, 255, 255, 0.85);
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
	.register-panel-right {
		flex: 1 1 55%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.5rem;
		background: var(--background, #09090b);
		position: relative;
		overflow-y: auto;
		overflow-x: hidden;
		max-height: 100dvh;

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

	/* ══ Register Card ══ */
	.register-card {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 480px;
		display: flex;
		flex-direction: column;
		gap: 1.25rem; /* đồng nhất với login-card */
		padding: 1rem 0;

		/* Entrance animation */
		opacity: 0;
		transform: translateY(20px);
		transition: opacity 0.5s ease, transform 0.5s ease;
	}

	.register-page.mounted .register-card {
		opacity: 1;
		transform: translateY(0);
	}

	/* ══ Header ══ */
	.register-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		margin-bottom: 0.25rem;
		text-align: center;
	}

	.register-logo-sm svg {
		width: 44px;
		height: 44px;
		filter: drop-shadow(0 4px 16px rgb(99 102 241 / 0.4));
		margin-bottom: 0.25rem;
	}

	.register-title {
		font-size: 1.75rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--foreground, #f4f4f5);
		margin: 0;
	}

	.register-subtitle {
		font-size: 0.85rem;
		color: var(--foreground-400, #71717a);
		margin: 0;
	}

	/* ══ Error Alert ══ */
	.register-alert {
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

	/* ══ Name Fieldset ══ */
	.name-fieldset {
		border: none;
		padding: 0;
		margin: 0;
		min-width: 0;
	}

	/* ══ Name Grid — 3 breakpoints ══ */
	.name-grid {
		display: grid;
		gap: 0.625rem;
		/* Desktop: 3 cột đều */
		grid-template-columns: 1fr 1fr 1fr;
	}

	/* Tablet trung bình: Họ + Tên đệm row 1, Tên row 2 */
	@media (max-width: 680px) {
		.name-grid {
			grid-template-columns: 1fr 1fr;
			gap: 0.625rem;

			/* Firstname (thứ 3) span full width */
			:global(.textField-root:nth-child(3)) {
				grid-column: 1 / -1;
			}
		}
	}

	/* Mobile: 1 cột */
	@media (max-width: 420px) {
		.name-grid {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}
	}

	:global(.name-input) {
		transition: border-color 0.2s, box-shadow 0.2s !important;
	}

	/* ══ Input Wrapper with Icon ══ */
	.input-wrapper {
		position: relative;
		width: 100%;

		.input-icon {
			position: absolute;
			left: 0.875rem;
			top: 50%;
			transform: translateY(-50%);
			width: 1rem;
			height: 1rem;
			color: var(--foreground-400, #71717a);
			pointer-events: none;
			z-index: 2;
		}
	}

	:global(.register-input) {
		padding-left: 2.5rem !important;
		transition: border-color 0.2s, box-shadow 0.2s !important;
	}

	/* Confirm password mismatch — full error style matching color-error */
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

	:global(.confirm-mismatch.focus),
	:global(.confirm-mismatch:hover:not(.disabled)),
	:global(.confirm-mismatch.hover:not(.disabled)) {
		@media (prefers-color-scheme: dark) {
			--background: var(--error-600) !important;
		}
		@media (prefers-color-scheme: light) {
			--background: var(--error-300) !important;
		}
	}
	:global(.confirm-mismatch.focus) {
		--border-color: var(--error-500) !important;
		border-color: var(--error-500) !important;
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

	:global(.confirm-match.focus),
	:global(.confirm-match:hover:not(.disabled)),
	:global(.confirm-match.hover:not(.disabled)) {
		@media (prefers-color-scheme: dark) {
			--background: var(--success-800) !important;
		}
		@media (prefers-color-scheme: light) {
			--background: var(--success-200) !important;
		}
	}
	:global(.confirm-match.focus) {
		--border-color: var(--success-500) !important;
		border-color: var(--success-500) !important;
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

	/* ══ Password Strength — 4-segment bars ══ */
	.strength-meter {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		margin-top: 0.375rem;
	}

	.strength-segments {
		flex: 1;
		display: flex;
		gap: 3px;
	}

	.strength-seg {
		flex: 1;
		height: 4px;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.1);
		transition: background-color 0.3s ease;
	}

	.strength-label {
		font-size: 0.725rem;
		font-weight: 600;
		min-width: 52px;
		text-align: right;
		transition: color 0.3s ease;
	}

	/* ══ Terms row ══ */
	.terms-row {
		margin-top: 0.25rem;
		margin-bottom: 0.25rem;
	}

	.terms-text {
		font-size: 0.8125rem;
		color: var(--foreground-400, #a1a1aa);
	}

	.terms-link-btn {
		background: none;
		border: none;
		padding: 0;
		color: #818cf8;
		text-decoration: underline;
		font-size: 0.8125rem;
		cursor: pointer;
		display: inline;
		margin-left: 0.2rem;
		transition: color 0.15s ease;

		&:hover {
			color: #a78bfa;
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
			pointer-events: none;
		}
	}

	/* ══ Actions ══ */
	.register-actions {
		display: flex;
		gap: 0.625rem;
		margin-top: 0.25rem; /* đồng nhất với login */
	}

	:global(.register-btn-submit) {
		flex: 1 !important;
		font-weight: 600 !important;
		letter-spacing: 0.01em;
	}

	:global(.register-btn-reset) {
		font-weight: 500 !important;
	}

	/* ══ Divider (Identical to Login) ══ */
	.register-divider {
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

	/* ══ Switch to Login Link ══ */
	.register-login-link {
		display: flex;
		justify-content: center;
		margin-top: 0.25rem;
	}

	:global(.login-link-btn) {
		font-size: 0.875rem !important;
		font-weight: 500 !important;
		display: inline-flex !important;
		align-items: center !important;
		gap: 0.375rem !important;
		text-decoration: none !important;
		transition: gap 0.2s ease, color 0.2s ease !important;

		&:hover {
			gap: 0.5rem !important;
			text-decoration: none !important;

			span {
				text-decoration: underline;
				text-underline-offset: 3px;
			}
		}
	}

	.link-arrow {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		display: inline-block;
		vertical-align: middle;
		transition: transform 0.2s ease;
	}

	:global(.login-link-btn:hover) .link-arrow {
		transform: translateX(3px);
	}

	/* ══ Terms Modal ══ */
	/* ══ Terms Modal ══ */
	:global(.terms-modal-box) {
		background: #18181b !important;
		border: 1px solid rgba(255, 255, 255, 0.15) !important;
		border-radius: 1.25rem !important;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
		max-width: min(34rem, calc(100vw - 2rem)) !important;
		max-height: calc(100dvh - 3rem) !important;
		display: flex !important;
		flex-direction: column !important;
		overflow: hidden !important;
		padding: 1.5rem !important;
	}

	:global(.terms-modal-header) {
		font-weight: 700 !important;
		font-size: 1.2rem !important;
		color: #f4f4f5 !important;
		padding-bottom: 0.85rem !important;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
		flex-shrink: 0 !important;
	}

	:global(.terms-modal-body) {
		color: #a1a1aa !important;
		font-size: 0.875rem !important;
		line-height: 1.6 !important;
		overflow-y: auto !important;
		padding: 1rem 0.25rem !important;
		max-height: calc(100dvh - 13rem) !important;
	}

	.modal-intro {
		margin-bottom: 0.85rem;
		font-weight: 500;
		color: #e4e4e7;
	}

	.modal-clauses {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;

		.clause-item {
			padding: 0.75rem 0.95rem;
			background: rgba(255, 255, 255, 0.04);
			border-radius: 0.6rem;
			border-left: 3px solid #6366f1;

			p {
				margin: 0;
			}
		}
	}

	:global(.terms-modal-footer) {
		display: flex !important;
		justify-content: flex-end !important;
		gap: 0.75rem !important;
		padding-top: 0.85rem !important;
		border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
		flex-shrink: 0 !important;
	}

	/* ══ Responsive ══ */
	@media (max-width: 900px) {
		.register-panel-right {
			padding: 2rem 1.25rem;
		}
	}

	@media (max-width: 480px) {
		.register-card {
			max-width: 100%;
		}
		.register-title {
			font-size: 1.5rem;
		}
	}
</style>
