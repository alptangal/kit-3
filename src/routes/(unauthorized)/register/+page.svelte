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
	import { AuthLayout } from '$components/layout';
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
		phone: '',
		password: '',
		confirmPassword: ''
	});

	let agreeTerms = $state(false);
	let loading = $state(false);
	let formError = $state<string | undefined>(undefined);
	let showTermsModal = $state(false);

	// Honeypot — hidden from real users, bots fill it
	let honeypot = $state('');

	// Caps Lock warning (P2 UX) — hiển thị khi user gõ password trong lúc Caps
	// Lock bật. Gắn keydown/focusout lên wrapper `display:contents` quanh password
	// field (event BUBBLE từ input → wrapper). getModifierState('CapsLock')
	// Safari 13+ → an toàn cho target es2020/safari15.
	let capsLockOn = $state(false);
	function handleCapsKeydown(e: KeyboardEvent) {
		capsLockOn = typeof e.getModifierState === 'function' ? e.getModifierState('CapsLock') : false;
	}
	function handleCapsFocusout() {
		capsLockOn = false;
	}

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
				phone: string;
				password: string;
		} = undefined;

	const lang = $derived(client.browser?.language ?? 'en');
	const currentLang = $derived(lang === 'vi' ? 'vi' : 'en');

	// ── Realtime Check State for Username, Email & Phone ──
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

	let phoneStatus = $state<{
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
	let phoneTimeoutId: ReturnType<typeof setTimeout> | undefined;
	// Sequence to discard stale fetch results
	let usernameSeq = 0;
	let emailSeq = 0;
	let phoneSeq = 0;

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
	function resetPhoneStatus() {
		phoneStatus.checking = false;
		phoneStatus.checked = false;
		phoneStatus.taken = false;
		phoneStatus.available = false;
		phoneStatus.message = undefined;
	}

	$effect(() => {
		const keysReady = !!encryptionKeys;
		const raw = formData.username?.trim() ?? '';

		if (!keysReady) {
			if (usernameTimeoutId) {
				clearTimeout(usernameTimeoutId);
				usernameTimeoutId = undefined;
			}
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
			if (!encryptionKeys) {
				if (seq === usernameSeq) usernameStatus.checking = false;
				return;
			}
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
				if (seq !== usernameSeq) return;
				if (formData.username?.trim() !== snapshot) return;

				if (data.ok && data.username && data.username.valid) {
					usernameStatus.checked = true;
					usernameStatus.taken = !!data.username.taken;
					usernameStatus.available = !!data.username.available;
					usernameStatus.message = data.username.message;
				} else {
					resetUsernameStatus();
				}
			} catch (e) {
				console.error('Error checking username:', e);
				if (seq === usernameSeq) {
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

	$effect(() => {
		const keysReady = !!encryptionKeys;
		const raw = formData.phone?.trim() ?? '';

		if (!keysReady) {
			if (phoneTimeoutId) {
				clearTimeout(phoneTimeoutId);
				phoneTimeoutId = undefined;
			}
			if (phoneStatus.checking) phoneStatus.checking = false;
			return;
		}

		if (!raw) {
			if (phoneTimeoutId) {
				clearTimeout(phoneTimeoutId);
				phoneTimeoutId = undefined;
			}
			resetPhoneStatus();
			return;
		}

		if (!/^\+?[0-9][0-9\s-]{6,19}$/.test(raw)) {
			if (phoneTimeoutId) {
				clearTimeout(phoneTimeoutId);
				phoneTimeoutId = undefined;
			}
			resetPhoneStatus();
			return;
		}

		if (phoneTimeoutId) clearTimeout(phoneTimeoutId);
		phoneStatus.checking = true;

		const seq = ++phoneSeq;
		const snapshot = raw;

		phoneTimeoutId = setTimeout(async () => {
			if (!encryptionKeys) {
				if (seq === phoneSeq) phoneStatus.checking = false;
				return;
			}
			const current = formData.phone?.trim() ?? '';
			if (current !== snapshot || seq !== phoneSeq) {
				if (seq === phoneSeq) phoneStatus.checking = false;
				return;
			}
			try {
				const data = (await encryption.fetchSecure(
					'/api/register/check',
					{
						method: 'POST',
						body: { phone: snapshot }
					},
					encryptionKeys
				)) as any;
				if (seq !== phoneSeq) return;
				if (formData.phone?.trim() !== snapshot) return;

				if (data.ok && data.phone && data.phone.valid) {
					phoneStatus.checked = true;
					phoneStatus.taken = !!data.phone.taken;
					phoneStatus.available = !!data.phone.available;
					phoneStatus.message = data.phone.message;
				} else {
					resetPhoneStatus();
				}
			} catch (e) {
				console.error('Error checking phone:', e);
				if (seq === phoneSeq) phoneStatus.checked = false;
			} finally {
				if (seq === phoneSeq) phoneStatus.checking = false;
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
		const weakResult = {
			score: 1,
			label: pageContents.passwordStrength.weak[lang] ?? 'Weak',
			percent: 25,
			color: 'var(--error)'
		};
		if (len < 8) return weakResult;

		let rawScore = 0;

		if (len >= 8) rawScore += 1;
		if (len >= 12) rawScore += 1;
		if (len >= 16) rawScore += 1;

		let varieties = 0;
		if (/[a-z]/.test(pwd)) varieties++;
		if (/[A-Z]/.test(pwd)) varieties++;
		if (/\d/.test(pwd)) varieties++;
		if (/[^A-Za-z0-9\s]/.test(pwd)) varieties++;
		if (varieties >= 2) rawScore += 1;
		if (varieties >= 3) rawScore += 1;
		if (varieties >= 4) rawScore += 1;

		const lower = pwd.toLowerCase();
		const commonList = [
			'password', '123456', '12345678', '123456789', 'qwerty', 'abc123',
			'letmein', 'admin', 'welcome', 'iloveyou', 'monkey', 'dragon',
			'111111', '123123', 'qwerty123', 'password1', '1234', '000000',
			'sunshine', 'princess', 'football', '654321', 'starwars'
		];
		const isCommon = commonList.some((c) => lower === c || lower.includes(c));
		if (isCommon) rawScore -= 2;

		const sequentialRe =
			/(?:012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|qwe|wer|ert|rty|tyu|yui|uio|asd|sdf|dfg|fgh|ghj|hjk|jkl|zxc|xcv|cvb|vbn|bnm)/i;
		if (sequentialRe.test(pwd)) rawScore -= 1;

		if (/(.)\1{2,}/.test(pwd)) rawScore -= 1;

		if (/(?:qwerty|asdf|zxcv|qaz|wsx|edc|qazwsx|1qaz|zaq1)/i.test(pwd)) rawScore -= 1;

		if (username && username.length >= 3 && lower.includes(username.toLowerCase())) rawScore -= 1;
		if (email) {
			const local = email.split('@')[0]?.toLowerCase();
			if (local && local.length >= 3 && lower.includes(local)) rawScore -= 1;
		}

		rawScore = Math.max(0, Math.min(rawScore, 6));

		if (rawScore <= 1) {
			return {
				score: 1,
				label: pageContents.passwordStrength.weak[lang] ?? 'Weak',
				percent: 25,
				color: 'var(--error)'
			};
		} else if (rawScore === 2) {
			return {
				score: 2,
				label: pageContents.passwordStrength.fair[lang] ?? 'Fair',
				percent: 50,
				color: 'var(--warning)'
			};
		} else if (rawScore <= 4) {
			return {
				score: 3,
				label: pageContents.passwordStrength.good[lang] ?? 'Good',
				percent: 75,
				color: 'var(--primary)'
			};
		} else {
			return {
				score: 4,
				label: pageContents.passwordStrength.strong[lang] ?? 'Strong',
				percent: 100,
				color: 'var(--success)'
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

	const confirmMatch = $derived.by(() => {
		if (!formData.confirmPassword) return null;
		return formData.confirmPassword === formData.password;
	});

	const status = $derived.by(() => {
		const current = {
			firstname: formData.firstname?.trim() ?? '',
			midname: formData.midname?.trim() || undefined,
			lastname: formData.lastname?.trim() ?? '',
			username: formData.username?.trim() ?? '',
			email: formData.email?.trim() ?? '',
			phone: formData.phone?.trim() ?? '',
			password: formData.password ?? ''
		};

		const hasRequired =
			!!current.firstname &&
			!!current.lastname &&
			!!current.username &&
			!!current.email &&
			!!current.phone &&
			!!current.password &&
			formData.password.length >= 8 &&
			formData.password === formData.confirmPassword &&
			!usernameStatus.taken &&
			!emailStatus.taken &&
			!phoneStatus.taken &&
			!usernameStatus.checking &&
			!emailStatus.checking &&
			!phoneStatus.checking &&
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
		if (!formData.phone?.trim()) {
			return lang === 'vi' ? 'Vui lòng nhập số điện thoại' : 'Please enter your phone number';
		}
		if (!/^\+?[0-9][0-9\s\-]{5,20}$/.test(formData.phone?.trim() ?? '')) {
			return lang === 'vi' ? 'Số điện thoại không hợp lệ' : 'Invalid phone number';
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

	async function handleRegister() {
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
				phone: formData.phone?.trim() ?? '',
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
					phone: requestBody.phone ?? '',
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

	function handleReset() {
		formData.firstname = '';
		formData.midname = '';
		formData.lastname = '';
		formData.username = '';
		formData.email = '';
		formData.phone = '';
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
		if (phoneTimeoutId) {
			clearTimeout(phoneTimeoutId);
			phoneTimeoutId = undefined;
		}
		usernameSeq++;
		emailSeq++;
		phoneSeq++;
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
		phoneStatus = {
			checking: false,
			checked: false,
			taken: false,
			available: false
		};
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
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
		if (phoneTimeoutId) {
			clearTimeout(phoneTimeoutId);
			phoneTimeoutId = undefined;
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

<AuthLayout
	cardSize="lg"
	title={pageContents.title[lang] ?? 'Create an account'}
	subtitle={pageContents.subtitle[lang] ?? 'Sign up quickly with advanced end-to-end encryption'}
	headline={pageContents.welcomeHeadline[lang] ?? 'Join us today!'}
	description={pageContents.welcomeDesc[lang] ??
		'Start your journey with a professional, securely encrypted management platform.'}
	features={pageContents.features.map((feat) => feat[lang] ?? feat.en)}
	{formError}
>
	<!-- Register Form -->
	<Form onSubmit={handleRegister} onReset={handleReset}>
		<!-- Honeypot — visually hidden for humans, bots fill it -->
		<div class="visually-hidden" aria-hidden="true">
			<label for="hp_website">Website</label>
			<input
				id="hp_website"
				name="website"
				type="text"
				bind:value={honeypot}
				autocomplete="off"
				tabindex="-1"
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
						class="name-input name-input-full"
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
						class="name-input name-input-full"
						disabled={loading}
					/>
					<FieldMessages />
				</TextField>
			</div>
		</fieldset>

		<!-- Username field -->
		<TextField name="username" required>
			<Label>{pageContents.textFields.username[lang] ?? 'Username'}</Label>
			<Input
				bind:value={formData.username}
				placeholder={{ vi: 'Nhập tên đăng nhập', en: 'Enter username' }}
				autocomplete="username"
				loading={usernameStatus.checking}
				disabled={loading}
				color={usernameStatus.checked ? (usernameStatus.taken ? 'error' : 'success') : undefined}
			>
				{#snippet leading()}
					<svg class="auth-input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
							clip-rule="evenodd"
						/>
					</svg>
				{/snippet}
			</Input>
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
			<Input
				type="email"
				inputmode="email"
				bind:value={formData.email}
				placeholder={{ vi: 'Nhập địa chỉ email', en: 'Enter your email' }}
				autocomplete="email"
				loading={emailStatus.checking}
				disabled={loading}
				color={emailStatus.checked ? (emailStatus.taken ? 'error' : 'success') : undefined}
			>
				{#snippet leading()}
					<svg class="auth-input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
						<path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
					</svg>
				{/snippet}
			</Input>
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

		<!-- Phone field -->
		<TextField name="phone" required>
			<Label>{pageContents.textFields.phone[lang] ?? 'Phone number'}</Label>
			<Input
				type="phone"
				inputmode="tel"
				bind:value={formData.phone}
				placeholder={{ vi: 'Nhập số điện thoại', en: 'Enter phone number' }}
				autocomplete="tel"
				loading={phoneStatus.checking}
				disabled={loading}
				color={phoneStatus.checked ? (phoneStatus.taken ? 'error' : 'success') : undefined}
				phoneSuggest={true}
			>
				{#snippet leading()}
					<svg class="auth-input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
					</svg>
				{/snippet}
			</Input>
			{#if phoneStatus.checked && phoneStatus.taken}
				<Description persistent={true} color="error" class="form-hint error-hint">
					{phoneStatus.message?.[currentLang] ?? 'Phone number is already taken'}
				</Description>
			{:else if phoneStatus.checked && phoneStatus.available}
				<Description persistent={true} color="success" class="form-hint success-hint">
					{phoneStatus.message?.[currentLang] ?? 'Phone number is available'}
				</Description>
			{:else}
				<Description class="form-hint">{pageContents.hints.phoneHint[lang]}</Description>
				<FieldMessages />
			{/if}
		</TextField>

		<!-- Password field -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="caps-scope" onkeydown={handleCapsKeydown} onfocusout={handleCapsFocusout}>
		<TextField name="password" required>
			<Label>{pageContents.textFields.password[lang] ?? 'Password'}</Label>
			<Input
				type="password"
				bind:value={formData.password}
				placeholder={{ vi: 'Nhập mật khẩu', en: 'Enter your password' }}
				autocomplete="new-password"
				disabled={loading}
				actionButtons={{ showPassword: { display: true } }}
			>
				{#snippet leading()}
					<svg class="auth-input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
							clip-rule="evenodd"
						/>
					</svg>
				{/snippet}
			</Input>
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

			<!-- Modern Password Strength Indicator — Single Progress Bar -->
			{#if formData.password}
				<div class="strength-meter" aria-label={passwordStrength.label} aria-live="polite">
					<div class="strength-bar-container">
						<div
							class="strength-bar-fill"
							style:width="{passwordStrength.percent}%"
							style:background-color={passwordStrength.color}
						></div>
					</div>
					<span class="strength-label" style:color={passwordStrength.color}>
						{passwordStrength.label}
					</span>
				</div>
			{/if}
			<Description class="form-hint">{pageContents.hints.passwordHint[lang]}</Description>
			<FieldMessages />
		</TextField>
		</div>

		<!-- Confirm Password field -->
		<TextField name="confirmPassword" required>
			<Label>{pageContents.textFields.confirmPassword[lang] ?? 'Confirm password'}</Label>
			<Input
				type="password"
				bind:value={formData.confirmPassword}
				placeholder={{ vi: 'Nhập lại mật khẩu', en: 'Confirm your password' }}
				autocomplete="new-password"
				disabled={loading}
				color={confirmMatch === false ? 'error' : confirmMatch === true ? 'success' : undefined}
				actionButtons={{ showPassword: { display: true } }}
			>
				{#snippet leading()}
					<svg class="auth-input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
							clip-rule="evenodd"
						/>
					</svg>
				{/snippet}
			</Input>
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
				<Label class="terms-label">
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
				</Label>
			</Checkbox>
		</div>

		<!-- Action Buttons -->
		<div class="auth-actions">
			<Button
				class="auth-btn-submit"
				color="success"
				type="submit"
				{loading}
				disabled={status.disabled}
				size="sm"
			>
				{pageContents.buttons.confirm[lang] ?? 'Create account'}
			</Button>

			<Button
				class="auth-btn-reset"
				color="error"
				type="reset"
				variant="ghost"
				disabled={loading}
				size="sm"
			>
				{pageContents.buttons.reset[lang] ?? 'Reset'}
			</Button>
		</div>
	</Form>

	{#snippet footer()}
		<!-- Divider -->
		<div class="auth-divider">
			<span>{pageContents.hasAccount[lang] ?? 'Already have an account?'}</span>
		</div>

		<!-- Switch to Login -->
		<div class="auth-switch-link">
			<Button variant="ghost" color="primary" class="auth-switch-btn" to="/login">
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
	{/snippet}
</AuthLayout>

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
	   REGISTER SPECIFIC STYLES
	   ═══════════════════════════════════════════════ */

	/* Wrapper để bắt keydown/focusout cho Caps Lock hint. display:contents →
	   không phá flex layout của .form-root (TextField vẫn là con trực tiếp). */
	.caps-scope {
		display: contents;
	}

	.caps-hint {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.7875rem;
		line-height: 1.4;
		color: #b45309;
		background: rgb(245 158 11 / 0.1);
		border: 1px solid rgb(245 158 11 / 0.28);
		border-radius: 0.5rem;
		padding: 0.375rem 0.625rem;
		margin-top: 0.125rem;

		.caps-hint-icon {
			flex-shrink: 0;
			width: 0.9rem;
			height: 0.9rem;
		}

		@media (prefers-color-scheme: dark) {
			color: #fbbf24;
			background: rgb(245 158 11 / 0.12);
			border-color: rgb(245 158 11 / 0.3);
		}
	}

	/* Visually hidden pattern for Honeypot */
	.visually-hidden {
		position: absolute !important;
		width: 1px !important;
		height: 1px !important;
		padding: 0 !important;
		margin: -1px !important;
		overflow: hidden !important;
		clip: rect(0, 0, 0, 0) !important;
		white-space: nowrap !important;
		border-style: solid !important;
		border-width: 0 !important;
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
		grid-template-columns: 1fr 1fr 1fr;
	}

	@media (max-width: 680px) {
		.name-grid {
			grid-template-columns: 1fr 1fr;
			gap: 0.625rem;

			:global(.name-input-full) {
				grid-column: 1 / -1;
			}
		}
	}

	@media (max-width: 420px) {
		.name-grid {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}
	}

	:global(.name-input) {
		transition: border-color 0.2s, box-shadow 0.2s !important;
	}

	/* Transition and effect for TextField on focus — KHÔNG dùng transform vì
	   transform tạo stacking context khiến suggestion popup (email/phone) bị
	   các TextField sau vẽ đè (popup không thể thắng z-index giữa 2 context) */
	:global(.textField-root) {
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	/* Modernized Form Hints */
	:global(.form-hint) {
		font-size: 0.75rem !important;
		color: var(--foreground-400, #71717a) !important;
		margin-top: 0.25rem !important;
		transition: all 0.3s ease;
		opacity: 0.8;
	}

	:global(.error-hint) {
		color: var(--error, #ef4444) !important;
		opacity: 1;
		animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
	}

	:global(.success-hint) {
		color: var(--success, #10b981) !important;
		opacity: 1;
	}

	@keyframes shake {
		10%, 90% { transform: translate3d(-1px, 0, 0); }
		20%, 80% { transform: translate3d(2px, 0, 0); }
		30%, 70% { transform: translate3d(-4px, 0, 0); }
		40%, 60% { transform: translate3d(4px, 0, 0); }
	}

	/* ══ Password Strength — Single Modern Progress Bar ══ */
	.strength-meter {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		margin-top: 0.5rem;
	}

	.strength-bar-container {
		flex: 1;
		height: 6px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 9999px;
		overflow: hidden;
	}

	.strength-bar-fill {
		height: 100%;
		border-radius: 9999px;
		transition: width 0.4s ease-out, background-color 0.3s ease;
		box-shadow: 0 0 8px currentColor;
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
		display: flex;
		align-items: center;
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.terms-text {
		font-size: 0.8125rem;
		color: var(--foreground-400, #a1a1aa);
	}

	.terms-label {
		/* Ensure label uses proper size-sm line-height */
		line-height: var(--line-height-sm);
	}

	.terms-link-btn {
		background: none;
		border: none;
		padding: 0;
		color: var(--primary, #818cf8);
		text-decoration: underline;
		font-size: 0.8125rem;
		cursor: pointer;
		display: inline;
		margin-left: 0.2rem;
		transition: color 0.15s ease;

		&:hover {
			color: var(--primary-400, #a78bfa);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
			pointer-events: none;
		}
	}

	/* ══ Terms Modal - Glassmorphism ══ */
	:global(.terms-modal-box) {
		background: rgba(24, 24, 27, 0.8) !important;
		backdrop-filter: blur(12px) saturate(180%) !important;
		-webkit-backdrop-filter: blur(12px) saturate(180%) !important;
		border: 1px solid rgba(255, 255, 255, 0.1) !important;
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
		color: var(--foreground-50, #f4f4f5) !important;
		padding-bottom: 0.85rem !important;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
		flex-shrink: 0 !important;
	}

	:global(.terms-modal-body) {
		color: var(--foreground-400, #a1a1aa) !important;
		font-size: 0.875rem !important;
		line-height: 1.6 !important;
		overflow-y: auto !important;
		padding: 1rem 0.25rem !important;
		max-height: calc(100dvh - 13rem) !important;
	}

	.modal-intro {
		margin-bottom: 0.85rem;
		font-weight: 500;
		color: var(--foreground-100, #e4e4e7);
	}

	.modal-clauses {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;

		.clause-item {
			padding: 0.75rem 0.95rem;
			background: rgba(255, 255, 255, 0.04);
			border-radius: 0.6rem;
			border-left: 3px solid var(--primary, #6366f1);

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

	.auth-input-icon {
		width: 1.25rem;
		height: 1.25rem;
		color: var(--foreground-400);
	}

	:global(.auth-switch-btn) {
		.link-arrow {
			width: 1.25rem;
			height: 1.25rem;
			flex-shrink: 0;
		}
	}
</style>
