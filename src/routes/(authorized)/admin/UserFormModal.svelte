<!-- src/routes/(authorized)/admin/UserFormModal.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { Description, FieldMessages, Form, Input, Label, TextField } from '$components/form';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { pageContents } from './_interface';
	import {
		getRowDocumentKey,
		resolveServerMessage,
		type AdminFormMode,
		type AdminUserFormData,
		type AdminUserRow,
		type RoleOption
	} from './_interface';

	let {
		display = $bindable(),
		mode,
		user = undefined,
		roles = [],
		onCreated,
		onUpdated
	}: {
		display?: boolean;
		mode: AdminFormMode;
		user?: AdminUserRow | null;
		roles?: RoleOption[];
		onCreated?: () => void;
		onUpdated?: () => void;
	} = $props();

	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : (client.browser?.language ?? 'en'));

	// ── Form State ──
	let formData = $state<AdminUserFormData>({
		firstname: '',
		midname: '',
		lastname: '',
		username: '',
		email: '',
		phone: '',
		password: '',
		description: '',
		roleId: '',
		branchId: ''
	});

	let loading = $state(false);
	let formError = $state<string | undefined>(undefined);
	let tempPassword = $state<string | undefined>(undefined);

	/** Cặp khoá RSA tạm thời cho phiên làm việc của modal */
	let encryptionKeys = $state<
		| undefined
		| {
				publicKey: CryptoKey;
				privateKey: CryptoKey;
		  }
	>(undefined);

	const isCreate = $derived(mode === 'create');

	// Khởi tạo form mỗi khi mở modal hoặc đổi user
	$effect(() => {
		if (!display) return;
		if (isCreate) {
			formData = {
				firstname: '',
				midname: '',
				lastname: '',
				username: '',
				email: '',
				phone: '',
				password: '',
				description: '',
				roleId: roles[0]?.id ?? '',
				branchId: ''
			};
		} else if (user) {
			formData = {
				firstname: user.firstname ?? '',
				midname: user.midname ?? '',
				lastname: user.lastname ?? '',
				username: '',
				email: '',
				phone: '',
				password: '',
				description: user.description ?? '',
				roleId: user.roleId ?? '',
				branchId: user.branchId ?? ''
			};
		}
		formError = undefined;
		tempPassword = undefined;
	});

	function validateForm(): string | undefined {
		if (!formData.firstname.trim() || !formData.lastname.trim()) {
			return lang === 'vi' ? 'Vui lòng nhập đầy đủ Họ và Tên' : 'Please enter both first and last name';
		}
		if (isCreate) {
			if (!formData.username.trim()) {
				return lang === 'vi' ? 'Vui lòng nhập tên đăng nhập' : 'Please enter a username';
			}
			if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(formData.username.trim())) {
				return lang === 'vi'
					? 'Tên đăng nhập từ 3-30 ký tự (chữ cái, số, gạch dưới, gạch ngang)'
					: 'Username must be 3-30 characters (letters, numbers, underscores, dashes)';
			}
			if (!formData.email.trim()) {
				return lang === 'vi' ? 'Vui lòng nhập địa chỉ email' : 'Please enter an email address';
			}
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
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
		}
		return undefined;
	}

	async function handleSubmit() {
		if (loading || !encryptionKeys) return;

		const validationError = validateForm();
		if (validationError) {
			formError = validationError;
			return;
		}

		formError = undefined;
		loading = true;

		try {
			const response = isCreate
				? await encryption.fetchSecure(
						'/api/admin/users/create',
						{
							method: 'POST',
							body: {
								firstname: formData.firstname.trim(),
								midname: formData.midname.trim() || undefined,
								lastname: formData.lastname.trim(),
								username: formData.username.trim(),
								email: formData.email.trim(),
								phone: formData.phone.trim() || undefined,
								password: formData.password,
								description: formData.description.trim() || undefined,
								roleId: formData.roleId || undefined,
								branchId: formData.branchId.trim() || undefined
							}
						},
						encryptionKeys
					)
				: await encryption.fetchSecure(
						'/api/admin/users/update',
						{
							method: 'POST',
							body: {
								documentKey: getRowDocumentKey(user),
								firstname: formData.firstname.trim(),
								midname: formData.midname.trim(),
								lastname: formData.lastname.trim(),
								description: formData.description.trim(),
								branchId: formData.branchId.trim() || undefined
							}
						},
						encryptionKeys
					);

			loading = false;

			if (response.ok) {
				client.browser?.toasts?.create({
					title: response.message
						? resolveServerMessage(response.message, lang, {
								vi: isCreate ? 'Đã tạo người dùng' : 'Đã cập nhật người dùng',
								en: isCreate ? 'User created' : 'User updated'
							})
						: lang === 'vi'
							? isCreate
								? 'Đã tạo người dùng'
								: 'Đã cập nhật người dùng'
							: isCreate
								? 'User created'
								: 'User updated',
					color: 'success'
				});

				// Create có thể trả về tempPassword (server sinh mật khẩu tạm nếu UI không nhập)
				const createdTemp = response.data?.user?.tempPassword ?? response.data?.tempPassword;
				if (isCreate && typeof createdTemp === 'string' && createdTemp) {
					tempPassword = createdTemp;
					onCreated?.();
					return; // giữ modal mở để hiển thị temp password
				}

				display = false;
				if (isCreate) onCreated?.();
				else onUpdated?.();
			} else {
				formError = resolveServerMessage(response.message, lang, {
					vi: isCreate ? 'Tạo người dùng không thành công' : 'Cập nhật không thành công',
					en: isCreate ? 'Failed to create user' : 'Update failed'
				});
			}
		} catch (err) {
			loading = false;
			formError = resolveServerMessage(undefined, lang, {
				vi: 'Đã xảy ra lỗi không xác định',
				en: 'Unexpected error occurred'
			});
			if (import.meta.env.DEV) console.error('[admin/UserFormModal] submit failed:', err);
		}
	}

	async function handleCopyTempPassword() {
		if (!tempPassword) return;
		try {
			await navigator.clipboard.writeText(tempPassword);
			client.browser?.toasts?.create({
				title: pageContents.modals.copied[lang],
				color: 'success'
			});
		} catch {
			// Clipboard API bị chặn — bỏ qua, người dùng copy thủ công
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
	});
</script>

<Modal bind:display size="lg" isDimissable>
	<Modal.Container class="user-form-modal">
		<Modal.Container.Header class="user-form-modal-header">
			{isCreate ? pageContents.createUser[lang] : pageContents.actions.edit[lang]}
		</Modal.Container.Header>
		<Modal.Container.Body class="user-form-modal-body">
			{#if tempPassword}
				<!-- ── Hộp mật khẩu tạm thời (chỉ hiển thị 1 lần, có nút copy + đóng) ── -->
				<div class="temp-password-box" role="alert">
					<p class="temp-password-title">{pageContents.modals.tempPasswordTitle[lang]}</p>
					<p class="temp-password-note">{pageContents.modals.tempPasswordNote[lang]}</p>
					<div class="temp-password-row">
						<code class="temp-password-value">{tempPassword}</code>
						<div class="temp-password-actions">
							<Button color="info" variant="outline" size="sm" onClick={handleCopyTempPassword}>
								{pageContents.modals.copy[lang]}
							</Button>
							<Button
								color="success"
								variant="ghost"
								size="sm"
								onClick={() => {
									tempPassword = undefined;
									display = false;
								}}
							>
								{pageContents.modals.closeTempPassword[lang]}
							</Button>
						</div>
					</div>
				</div>
			{:else}
				<Form onSubmit={handleSubmit} onReset={() => (formError = undefined)}>
					{#if formError}
						<div class="form-error-banner" role="alert">{formError}</div>
					{/if}

					<!-- Name fieldset: Lastname, Midname, Firstname -->
					<fieldset class="name-fieldset" aria-label={lang === 'vi' ? 'Họ và tên' : 'Full name'}>
						<div class="name-grid">
							<TextField name="lastname" required>
								<Label>{lang === 'vi' ? 'Họ' : 'Last name'}</Label>
								<Input
									bind:value={formData.lastname}
									placeholder={{ vi: 'Nguyễn', en: 'Doe' }}
									autocomplete="family-name"
									disabled={loading}
								/>
								<FieldMessages />
							</TextField>
							<TextField name="midname">
								<Label>{lang === 'vi' ? 'Tên đệm' : 'Middle name'}</Label>
								<Input
									bind:value={formData.midname}
									placeholder={{ vi: 'Văn', en: 'Middle' }}
									autocomplete="additional-name"
									disabled={loading}
								/>
								<FieldMessages />
							</TextField>
							<TextField name="firstname" required>
								<Label>{lang === 'vi' ? 'Tên' : 'First name'}</Label>
								<Input
									bind:value={formData.firstname}
									placeholder={{ vi: 'An', en: 'John' }}
									autocomplete="given-name"
									disabled={loading}
								/>
								<FieldMessages />
							</TextField>
						</div>
					</fieldset>

					{#if isCreate}
						<!-- Username (chỉ xuất hiện khi tạo — kiến trúc blind-index không cho đọc lại) -->
						<TextField name="username" required>
							<Label>{lang === 'vi' ? 'Tên đăng nhập' : 'Username'}</Label>
							<Input
								bind:value={formData.username}
								placeholder={{ vi: 'Nhập tên đăng nhập', en: 'Enter username' }}
								autocomplete="username"
								disabled={loading}
							/>
							<Description persistent={true}>
								{lang === 'vi'
									? '3-30 ký tự (chữ cái, số, gạch dưới, gạch ngang)'
									: '3-30 characters (alphanumeric, -, _)'}
							</Description>
							<FieldMessages />
						</TextField>

						<!-- Email -->
						<TextField name="email" required>
							<Label>{lang === 'vi' ? 'Địa chỉ Email' : 'Email address'}</Label>
							<Input
								type="email"
								inputmode="email"
								bind:value={formData.email}
								placeholder={{ vi: 'Nhập địa chỉ email', en: 'Enter email address' }}
								autocomplete="email"
								disabled={loading}
							/>
							<FieldMessages />
						</TextField>

						<!-- Phone -->
						<TextField name="phone">
							<Label>{lang === 'vi' ? 'Số điện thoại' : 'Phone number'}</Label>
							<Input
								type="phone"
								inputmode="tel"
								bind:value={formData.phone}
								placeholder={{ vi: 'Nhập số điện thoại', en: 'Enter phone number' }}
								autocomplete="tel"
								phoneSuggest={true}
								disabled={loading}
							/>
							<FieldMessages />
						</TextField>

						<!-- Password -->
						<TextField name="password" required>
							<Label>{lang === 'vi' ? 'Mật khẩu' : 'Password'}</Label>
							<Input
								type="password"
								bind:value={formData.password}
								placeholder={{ vi: 'Nhập mật khẩu', en: 'Enter password' }}
								autocomplete="new-password"
								disabled={loading}
								actionButtons={{ showPassword: { display: true } }}
							/>
							<Description persistent={true}>
								{lang === 'vi'
									? 'Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt'
									: 'Min 8 chars, uppercase, lowercase, number & special char'}
							</Description>
							<FieldMessages />
						</TextField>
					{:else}
						<!-- Chế độ edit: username/email/password không thể sửa (blind-index + vault) -->
						<div class="readonly-note">
							{lang === 'vi'
								? 'Tên đăng nhập, email và mật khẩu không thể sửa từ đây. Dùng "Đặt lại mật khẩu" trên dòng tương ứng.'
								: 'Username, email and password cannot be edited here. Use "Reset password" on the row.'}
						</div>
					{/if}

					<!-- Description -->
					<TextField name="description">
						<Label>{lang === 'vi' ? 'Mô tả' : 'Description'}</Label>
						<Input
							bind:value={formData.description}
							placeholder={{ vi: 'Ghi chú về người dùng', en: 'Notes about this user' }}
							disabled={loading}
						/>
						<FieldMessages />
					</TextField>

					{#if isCreate}
						<!-- Role — chỉ chọn lúc tạo; sau này đổi qua "Đổi vai trò" -->
						<TextField name="roleId">
							<Label>{pageContents.table.role[lang]}</Label>
							<select class="admin-select" bind:value={formData.roleId} disabled={loading}>
								{#each roles as role (role.id)}
									<option value={role.id}>{role.label ?? role.name ?? role.id}</option>
								{/each}
							</select>
							<Description persistent={true}>
								{lang === 'vi'
									? 'Vai trò có thể đổi sau qua thao tác "Đổi vai trò".'
									: 'The role can be changed later via "Change role".'}
							</Description>
						</TextField>
					{/if}

					<!-- Branch -->
					<TextField name="branchId">
						<Label>{lang === 'vi' ? 'Chi nhánh' : 'Branch'}</Label>
						<Input
							bind:value={formData.branchId}
							placeholder={{ vi: 'Mã chi nhánh (bỏ trống = mặc định)', en: 'Branch id (empty = default)' }}
							disabled={loading}
						/>
						<FieldMessages />
					</TextField>

					<!-- Action buttons -->
					<div class="modal-actions">
						<Button color="success" type="submit" {loading} disabled={loading || !encryptionKeys}>
							{isCreate ? pageContents.createUser[lang] : pageContents.actions.edit[lang]}
						</Button>
						<Button
							color="default"
							variant="ghost"
							disabled={loading}
							onClick={() => {
								display = false;
							}}
						>
							{pageContents.modals.cancel[lang]}
						</Button>
					</div>
				</Form>
			{/if}
		</Modal.Container.Body>
	</Modal.Container>
</Modal>

<style lang="scss">
	.name-fieldset {
		border: none;
		padding: 0;
		margin: 0;
		min-width: 0;
	}

	.name-grid {
		display: grid;
		gap: 0.625rem;
		grid-template-columns: 1fr 1fr 1fr;

		@media (max-width: 680px) {
			grid-template-columns: 1fr;
		}
	}

	.form-error-banner {
		background: var(--danger-soft, hsl(358, 62.5%, 90.6%));
		color: var(--error);
		border-left: 3px solid var(--error);
		border-radius: 0.5rem;
		padding: 0.6rem 0.85rem;
		font-size: 0.85rem;
		margin-bottom: 0.75rem;
	}

	.readonly-note {
		background: var(--default-200);
		color: var(--foreground-500, var(--foreground-400));
		border-left: 3px solid var(--warning);
		border-radius: 0.5rem;
		padding: 0.6rem 0.85rem;
		font-size: 0.8rem;
		line-height: 1.5;
	}

	.admin-select {
		width: 100%;
		height: 2.5rem;
		padding: 0 0.75rem;
		border-radius: var(--field-radius, 0.75rem);
		border: 1px solid var(--default-300);
		background: var(--default-50, transparent);
		color: var(--foreground);
		font-size: 0.9rem;
		cursor: pointer;

		&:disabled {
			opacity: var(--disabled-opacity, 0.5);
			cursor: not-allowed;
		}

		option {
			background: var(--default-200);
			color: var(--foreground);
		}
	}

	.modal-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		margin-top: 0.75rem;
	}

	.temp-password-box {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		background: var(--default-200);
		border: 1px solid var(--success-300);
		border-left: 4px solid var(--success);
		border-radius: 0.75rem;
		padding: 1rem;

		.temp-password-title {
			font-weight: 700;
			font-size: 1rem;
			color: var(--foreground);
			margin: 0;
		}

		.temp-password-note {
			font-size: 0.8rem;
			color: var(--foreground-400, var(--foreground-500));
			margin: 0;
		}

		.temp-password-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.75rem;
			flex-wrap: wrap;

			.temp-password-value {
				flex: 1;
				min-width: 0;
				font-family: monospace;
				font-size: 1rem;
				padding: 0.5rem 0.75rem;
				background: var(--default-50, transparent);
				border-radius: 0.5rem;
				border: 1px dashed var(--default-400);
				color: var(--primary);
				overflow-wrap: anywhere;
				user-select: all;
			}

			.temp-password-actions {
				display: flex;
				gap: 0.5rem;
			}
		}
	}
</style>
