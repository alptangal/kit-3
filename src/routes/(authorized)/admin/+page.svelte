<!-- src/routes/(authorized)/admin/+page.svelte -->
<script lang="ts">
	import { Button, DataTable, Pagination } from '$components/element';
	import { Checkbox } from '$components/form';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import UserFormModal from './UserFormModal.svelte';
	import { pageContents } from './_interface';
	import {
		getRowDocumentKey,
		normalizeRole,
		normalizeStatus,
		resolveServerMessage,
		type AdminUserRow,
		type RoleOption,
		type StatusOption
	} from './_interface';
	import type { DataTableColumn } from '$components/element/datatable';

	// ── Ngôn ngữ ──
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : (client.browser?.language ?? 'en'));

	// ── Cặp khoá RSA cho mọi fetchSecure trên trang ──
	let encryptionKeys = $state<
		| undefined
		| {
				publicKey: CryptoKey;
				privateKey: CryptoKey;
		  }
	>(undefined);

	// ── Trạng thái danh sách ──
	let users = $state<AdminUserRow[]>([]);
	let total = $state(0);
	let page = $state(1);
	let pageSize = $state(20);
	let includeDeleted = $state(false);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);

	// ── Catalog roles/statuses ──
	let roles = $state<RoleOption[]>([]);
	let statuses = $state<StatusOption[]>([]);
	let catalogLoaded = $state(false);

	// ── Modal tạo/sửa ──
	let formModalDisplay = $state(false);
	let formModalMode = $state<'create' | 'edit'>('create');
	let formModalUser = $state<AdminUserRow | null>(null);

	// ── Modal đổi vai trò ──
	let roleModalDisplay = $state(false);
	let roleModalUser = $state<AdminUserRow | null>(null);
	let roleModalValue = $state('');
	let roleModalBusy = $state(false);

	// ── Modal đổi trạng thái ──
	let statusModalDisplay = $state(false);
	let statusModalUser = $state<AdminUserRow | null>(null);
	let statusModalValue = $state('');
	let statusModalBusy = $state(false);

	// ── Modal đặt lại mật khẩu ──
	let resetModalDisplay = $state(false);
	let resetModalUser = $state<AdminUserRow | null>(null);
	let resetModalBusy = $state(false);
	let resetTempPassword = $state<string | undefined>(undefined);

	// ── Modal xoá ──
	let deleteModalDisplay = $state(false);
	let deleteModalUser = $state<AdminUserRow | null>(null);
	let deleteModalBusy = $state(false);

	// ── Derived ──
	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const pageInfoText = $derived(
		pageContents.pagination.pageInfo[lang].replace('{page}', String(page)).replace('{total}', String(totalPages))
	);
	const totalCountText = $derived(
		pageContents.pagination.totalCount[lang].replace('{total}', String(total))
	);

	function getRowName(row: AdminUserRow | null | undefined): string {
		if (!row) return '—';
		return [row.lastname, row.midname, row.firstname].filter(Boolean).join(' ') || '—';
	}

	function getRoleLabel(roleId?: string | null): string {
		if (!roleId) return '—';
		const role = roles.find((r) => r.id === roleId);
		return role?.label ?? role?.name ?? roleId;
	}

	function getStatusLabel(statusId?: string | null): string {
		if (!statusId) return '—';
		const status = statuses.find((s) => s.id === statusId);
		return status?.label ?? status?.name ?? statusId;
	}

	/** Map statusId → màu badge (khớp seed user_status; B6.2 DataTable map 'error'→'danger') */
	function getStatusColor(
		statusId?: string | null
	): 'success' | 'warning' | 'error' | 'default' {
		switch (statusId) {
			case 'status-active':
				return 'success';
			case 'status-pending_verification':
				return 'warning';
			case 'status-suspended':
				return 'warning';
			case 'status-banned':
				return 'error';
			default:
				return 'default';
		}
	}

	function isRowDeleted(row: AdminUserRow): boolean {
		return Boolean(row.deletedAt);
	}

	// ── B6.2: DataTable columns (data-driven, status pill qua col.status) ──
	// Server-side pagination: users[] là 1 trang của server → DataTable paging
	// TẮT (showPagination=false, pageSize = pageSize state), Pagination element
	// riêng bên dưới điều khiển server (bind:page + goToPage).
	const usersAny = $derived(users as unknown as Record<string, unknown>[]);
	const columns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'name',
			label: pageContents.table.name[lang],
			accessor: (row) => getRowName(row as unknown as AdminUserRow),
			sortable: false
		},
		{
			id: 'role',
			label: pageContents.table.role[lang],
			accessor: (row) => getRoleLabel((row as unknown as AdminUserRow).roleId)
		},
		{
			id: 'status',
			label: pageContents.table.status[lang],
			accessor: (row) => getStatusLabel((row as unknown as AdminUserRow).statusId),
			status: (_value, row) => {
				// Map statusId → DataTableStatus ('error' của badge cũ → 'danger').
				const color = getStatusColor((row as unknown as AdminUserRow).statusId);
				const mapped = color === 'error' ? 'danger' : color;
				return mapped as 'default' | 'success' | 'warning' | 'danger';
			}
		},
		{
			id: 'created',
			label: pageContents.table.created[lang],
			accessor: (row) => formatCreated(row as unknown as AdminUserRow),
			noHighlight: true
		}
	]);

	function formatCreated(row: AdminUserRow): string {
		const raw = row.createdAt;
		if (!raw) return '—';
		try {
			const date = typeof raw === 'string' ? new Date(raw) : raw;
			return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				year: 'numeric',
				month: 'short',
				day: '2-digit'
			}).format(date);
		} catch {
			return '—';
		}
	}

	// ── Gọi API ──
	async function loadRolesCatalog() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/roles',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as
					| { roles?: Record<string, any>[]; statuses?: Record<string, any>[] }
					| undefined;
				roles = (data?.roles ?? []).map(normalizeRole).filter((r) => r.id);
				statuses = (data?.statuses ?? []).map(normalizeStatus).filter((s) => s.id);
				catalogLoaded = true;
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin] roles catalog failed:', err);
		}
	}

	async function loadUsers() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/users/list',
				{
					method: 'POST',
					body: { page, pageSize, includeDeleted }
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| {
							users?: AdminUserRow[];
							items?: AdminUserRow[];
							total?: number;
							page?: number;
							pageSize?: number;
					  }
					| undefined;
				users = data?.users ?? data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number' && data.page !== page) {
					// response gán lại page (vd server clamp) — chặn effect refetch
					pendingPageApply = true;
					page = data.page;
				}
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, {
					vi: 'Không tải được danh sách người dùng',
					en: 'Failed to load user list'
				});
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, {
				vi: 'Không tải được danh sách người dùng',
				en: 'Failed to load user list'
			});
			if (import.meta.env.DEV) console.error('[admin] load users failed:', err);
		}
	}

	async function refresh() {
		await loadUsers();
	}

	/** Gọi 1 thao tác hàng loạt (set-role, set-status, reset-password, delete, restore) */
	async function runRowAction(
		url: string,
		body: Record<string, unknown>,
		successKey: string
	): Promise<boolean> {
		if (!encryptionKeys) return false;
		try {
			const response = await encryption.fetchSecure(url, { method: 'POST', body }, encryptionKeys);
			if (response.ok) {
				client.browser?.toasts?.create({
					title: response.message
						? resolveServerMessage(response.message, lang, {
								vi: pageContents.toasts[successKey].vi,
								en: pageContents.toasts[successKey].en
							})
						: pageContents.toasts[successKey][lang],
					color: 'success'
				});
				return true;
			}
			client.browser?.toasts?.create({
				title: resolveServerMessage(response.message, lang, {
					vi: pageContents.toasts.actionFailed.vi,
					en: pageContents.toasts.actionFailed.en
				}),
				color: 'error'
			});
			return false;
		} catch (err) {
			if (import.meta.env.DEV) console.error(`[admin] ${url} failed:`, err);
			client.browser?.toasts?.create({
				title: pageContents.toasts.requestFailed[lang],
				color: 'error'
			});
			return false;
		}
	}

	// ── Handlers mở modal ──
	function openCreateModal() {
		formModalMode = 'create';
		formModalUser = null;
		formModalDisplay = true;
	}

	function openEditModal(row: AdminUserRow) {
		formModalMode = 'edit';
		formModalUser = row;
		formModalDisplay = true;
	}

	function openRoleModal(row: AdminUserRow) {
		roleModalUser = row;
		roleModalValue = String(row.roleId ?? '');
		roleModalDisplay = true;
	}

	function openStatusModal(row: AdminUserRow) {
		statusModalUser = row;
		statusModalValue = String(row.statusId ?? '');
		statusModalDisplay = true;
	}

	function openResetModal(row: AdminUserRow) {
		resetModalUser = row;
		resetTempPassword = undefined;
		resetModalDisplay = true;
	}

	function openDeleteModal(row: AdminUserRow) {
		deleteModalUser = row;
		deleteModalDisplay = true;
	}

	// ── Handlers xác nhận trong modal ──
	async function confirmChangeRole() {
		if (!roleModalUser || roleModalBusy) return;
		roleModalBusy = true;
		const ok = await runRowAction(
			'/api/admin/users/set-role',
			{ documentKey: getRowDocumentKey(roleModalUser), roleId: roleModalValue },
			'roleChanged'
		);
		roleModalBusy = false;
		if (ok) {
			roleModalDisplay = false;
			await refresh();
		}
	}

	async function confirmChangeStatus() {
		if (!statusModalUser || statusModalBusy) return;
		statusModalBusy = true;
		const ok = await runRowAction(
			'/api/admin/users/set-status',
			{ documentKey: getRowDocumentKey(statusModalUser), statusId: statusModalValue },
			'statusChanged'
		);
		statusModalBusy = false;
		if (ok) {
			statusModalDisplay = false;
			await refresh();
		}
	}

	async function confirmResetPassword() {
		if (!resetModalUser || resetModalBusy) return;
		if (resetTempPassword) {
			// Đã reset — nút bây giờ đóng modal sau khi user ghi lại
			resetModalDisplay = false;
			return;
		}
		resetModalBusy = true;
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/users/reset-password',
				{ method: 'POST', body: { documentKey: getRowDocumentKey(resetModalUser) } },
				encryptionKeys
			);
			resetModalBusy = false;
			if (response.ok) {
				const temp = response.data?.tempPassword;
				if (typeof temp === 'string' && temp) {
					resetTempPassword = temp;
				} else {
					client.browser?.toasts?.create({
						title: pageContents.toasts.passwordReset[lang],
						color: 'success'
					});
					resetModalDisplay = false;
				}
			} else {
				client.browser?.toasts?.create({
					title: resolveServerMessage(response.message, lang, {
						vi: pageContents.toasts.actionFailed.vi,
						en: pageContents.toasts.actionFailed.en
					}),
					color: 'error'
				});
			}
		} catch (err) {
			resetModalBusy = false;
			if (import.meta.env.DEV) console.error('[admin] reset password failed:', err);
			client.browser?.toasts?.create({
				title: pageContents.toasts.requestFailed[lang],
				color: 'error'
			});
		}
	}

	async function confirmDelete() {
		if (!deleteModalUser || deleteModalBusy) return;
		deleteModalBusy = true;
		const ok = await runRowAction(
			'/api/admin/users/delete',
			{ documentKey: getRowDocumentKey(deleteModalUser) },
			'userDeleted'
		);
		deleteModalBusy = false;
		if (ok) {
			deleteModalDisplay = false;
			await refresh();
		}
	}

	async function handleRestore(row: AdminUserRow) {
		const ok = await runRowAction(
			'/api/admin/users/restore',
			{ documentKey: getRowDocumentKey(row) },
			'userRestored'
		);
		if (ok) await refresh();
	}

	async function handleCopyResetTempPassword() {
		if (!resetTempPassword) return;
		try {
			await navigator.clipboard.writeText(resetTempPassword);
			client.browser?.toasts?.create({
				title: pageContents.modals.copied[lang],
				color: 'success'
			});
		} catch {
			// Clipboard bị chặn — bỏ qua
		}
	}

	// ── Phân trang / filter ──
	// Pagination element chỉ có bindable page (không callback) — theo dõi
	// page + pageSize để refetch server khi user bấm next/prev hoặc đổi page
	// size. Chỉ chạy SAU lần đầu (tránh refetch trùng onMount); pendingPageApply
	// bỏ qua lần đổi page do chính response gán lại (chống vòng lặp fetch).
	let paginationArmed = false;
	let pendingPageApply = false;
	$effect(() => {
		void page;
		void pageSize;
		if (!paginationArmed) {
			paginationArmed = true;
			return;
		}
		if (pendingPageApply) {
			pendingPageApply = false;
			return;
		}
		void loadUsers();
	});

	function changePageSize(newSize: number) {
		if (newSize === pageSize) return;
		pageSize = newSize;
		page = 1;
		// effect theo dõi pageSize tự fetch (kể cả khi page không đổi)
	}

	// Checkbox không có callback — theo dõi includeDeleted bằng $effect.
	// Chỉ chạy sau lần chạy đầu (tránh gọi trùng với onMount).
	let deletedToggleArmed = false;
	let lastIncludeDeleted = false;
	$effect(() => {
		const current = includeDeleted;
		if (!deletedToggleArmed) {
			deletedToggleArmed = true;
			lastIncludeDeleted = current;
			return;
		}
		if (current === lastIncludeDeleted) return;
		lastIncludeDeleted = current;
		page = 1;
		void loadUsers();
	});

	function fillTemplate(text: string, name: string): string {
		return text.replace('{name}', name);
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadRolesCatalog(), loadUsers()]);
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<section class="admin-page">
	<header class="admin-header">
		<div class="admin-header-text">
			<h1 class="admin-title">{pageContents.title[lang]}</h1>
			<p class="admin-subtitle">{pageContents.subtitle[lang]}</p>
		</div>
		<div class="admin-header-actions">
			<!-- Checkbox toggle: mousedown đổi `checked`, $effect theo dõi để reload danh sách -->
			<Checkbox bind:checked={includeDeleted} disabled={loading}>
				{pageContents.showDeleted[lang]}
			</Checkbox>
			<Button color="primary" onClick={openCreateModal} disabled={!catalogLoaded}>
				{pageContents.createUser[lang]}
			</Button>
		</div>
	</header>

	<!-- ── Trạng thái loading ── -->
	{#if loading && !loadedOnce}
		<div class="admin-state" role="status">
			<p>{pageContents.states.loading[lang]}</p>
		</div>
	{:else if loadError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="primary" variant="outline" onClick={refresh}>
				{pageContents.states.retry[lang]}
			</Button>
		</div>
	{:else if users.length === 0}
		<div class="admin-state">
			<p>{includeDeleted ? pageContents.states.emptyDeleted[lang] : pageContents.states.empty[lang]}</p>
		</div>
	{:else}
		<!-- ── B6.2: bảng người dùng — DataTable (component có sẵn) ──
		     Server-side paging: data = 1 trang server, paging trong DataTable TẮT,
		     Pagination element bên dưới bind:page + loading điều khiển server. -->
		<div class="admin-table-wrap">
			<DataTable
				data={usersAny}
				{columns}
				pageSize={pageSize}
				showPagination={false}
				loading={loading}
				visual={{ striped: true, hoverable: true }}
				emptyLabel={pageContents.states.empty[lang]}
				loadingLabel={pageContents.states.loading[lang]}
				caption={{ vi: 'Danh sách người dùng', en: 'User list' }}
				data-test="users-datatable"
			>
				{#snippet actionsContent(row)}
					{@const user = row as unknown as AdminUserRow}
					<div class="row-actions">
						{#if includeDeleted && isRowDeleted(user)}
							<Button
								color="success"
								variant="outline"
								size="sm"
								onClick={() => handleRestore(user)}
								data-test="user-action-restore"
							>
								{pageContents.actions.restore[lang]}
							</Button>
						{:else}
							<Button
								color="default"
								variant="ghost"
								size="sm"
								onClick={() => openEditModal(user)}
								data-test="user-action-edit"
							>
								{pageContents.actions.edit[lang]}
							</Button>
							<Button
								color="default"
								variant="ghost"
								size="sm"
								onClick={() => openRoleModal(user)}
								data-test="user-action-role"
							>
								{pageContents.actions.changeRole[lang]}
							</Button>
							<Button
								color="default"
								variant="ghost"
								size="sm"
								onClick={() => openStatusModal(user)}
								data-test="user-action-status"
							>
								{pageContents.actions.changeStatus[lang]}
							</Button>
							<Button
								color="default"
								variant="ghost"
								size="sm"
								onClick={() => openResetModal(user)}
								data-test="user-action-reset"
							>
								{pageContents.actions.resetPassword[lang]}
							</Button>
							<Button
								color="error"
								variant="ghost"
								size="sm"
								onClick={() => openDeleteModal(user)}
								data-test="user-action-delete"
							>
								{pageContents.actions.delete[lang]}
							</Button>
						{/if}
					</div>
				{/snippet}
			</DataTable>
		</div>

		<!-- ── Phân trang (server-side) ── -->
		<footer class="admin-pagination">
			<span class="total-count">{totalCountText}</span>
			<div class="page-controls">
				<Pagination
					bind:page
					totalPages={totalPages}
					loading={loading}
					variant="compact"
					prevLabel={pageContents.pagination.prev[lang]}
					nextLabel={pageContents.pagination.next[lang]}
					aria-label={pageContents.title[lang]}
				/>
				<span class="page-info">{pageInfoText}</span>
				<label class="page-size">
					<span class="page-size-label">{pageContents.pagination.pageSizeLabel[lang]}</span>
					<select
						class="admin-select"
						value={pageSize}
						onchange={(e) => changePageSize(Number((e.currentTarget as HTMLSelectElement).value))}
					>
						{#each [10, 20, 50, 100] as size (size)}
							<option value={size}>{size}</option>
						{/each}
					</select>
				</label>
			</div>
		</footer>
	{/if}
</section>

<!-- ── Modal tạo/sửa user ── -->
<UserFormModal
	bind:display={formModalDisplay}
	mode={formModalMode}
	user={formModalUser}
	{roles}
	onCreated={refresh}
	onUpdated={refresh}
/>

<!-- ── Modal đổi vai trò ── -->
{#if roleModalDisplay}
	<Modal bind:display={roleModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.modals.roleTitle[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				<p class="modal-intro">
					{fillTemplate(pageContents.modals.roleIntro[lang], getRowName(roleModalUser))}
				</p>
				<select class="admin-select" bind:value={roleModalValue} disabled={roleModalBusy}>
					{#each roles as role (role.id)}
						<option value={role.id}>{role.label ?? role.name ?? role.id}</option>
					{/each}
				</select>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button color="primary" onClick={confirmChangeRole} loading={roleModalBusy} disabled={!roleModalValue}>
					{pageContents.modals.confirm[lang]}
				</Button>
				<Button color="default" variant="ghost" onClick={() => {
									roleModalDisplay = false;
								}}>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal đổi trạng thái ── -->
{#if statusModalDisplay}
	<Modal bind:display={statusModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.modals.statusTitle[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				<p class="modal-intro">
					{fillTemplate(pageContents.modals.statusIntro[lang], getRowName(statusModalUser))}
				</p>
				<select class="admin-select" bind:value={statusModalValue} disabled={statusModalBusy}>
					{#each statuses as status (status.id)}
						<option value={status.id}>{status.label ?? status.name ?? status.id}</option>
					{/each}
				</select>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button color="primary" onClick={confirmChangeStatus} loading={statusModalBusy} disabled={!statusModalValue}>
					{pageContents.modals.confirm[lang]}
				</Button>
				<Button color="default" variant="ghost" onClick={() => {
									statusModalDisplay = false;
								}}>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal đặt lại mật khẩu ── -->
{#if resetModalDisplay}
	<Modal bind:display={resetModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.modals.resetTitle[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if resetTempPassword}
					<div class="temp-password-box" role="alert">
						<p class="temp-password-title">{pageContents.modals.tempPasswordTitle[lang]}</p>
						<p class="temp-password-note">{pageContents.modals.tempPasswordNote[lang]}</p>
						<div class="temp-password-row">
							<code class="temp-password-value">{resetTempPassword}</code>
							<Button color="info" variant="outline" size="sm" onClick={handleCopyResetTempPassword}>
								{pageContents.modals.copy[lang]}
							</Button>
						</div>
					</div>
				{:else}
					<p class="modal-intro">
						{fillTemplate(pageContents.modals.resetIntro[lang], getRowName(resetModalUser))}
					</p>
				{/if}
			</Modal.Container.Body>
			<Modal.Container.Footer>
				{#if resetTempPassword}
					<Button color="success" onClick={() => {
									resetModalDisplay = false;
								}}>
						{pageContents.modals.closeTempPassword[lang]}
					</Button>
				{:else}
					<Button color="warning" onClick={confirmResetPassword} loading={resetModalBusy}>
						{pageContents.modals.confirm[lang]}
					</Button>
					<Button color="default" variant="ghost" onClick={() => {
									resetModalDisplay = false;
								}}>
						{pageContents.modals.cancel[lang]}
					</Button>
				{/if}
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal xoá ── -->
{#if deleteModalDisplay}
	<Modal bind:display={deleteModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.modals.deleteTitle[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				<p class="modal-intro">
					{fillTemplate(pageContents.modals.deleteIntro[lang], getRowName(deleteModalUser))}
				</p>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button color="error" onClick={confirmDelete} loading={deleteModalBusy}>
					{pageContents.actions.delete[lang]}
				</Button>
				<Button color="default" variant="ghost" onClick={() => {
									deleteModalDisplay = false;
								}}>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<style lang="scss">
	.admin-page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.5rem;
		max-width: 1280px;
		margin: 0 auto;
		width: 100%;
	}

	.admin-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.admin-title {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--foreground);
		margin: 0;
	}

	.admin-subtitle {
		font-size: 0.9rem;
		color: var(--foreground-500);
		margin: 0.25rem 0 0;
	}

	.admin-header-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.admin-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 3rem 1rem;
		color: var(--foreground-500);
		text-align: center;

		&.error {
			color: var(--error);
		}

		.state-title {
			font-weight: 600;
			color: var(--foreground);
			margin: 0;
		}

		.state-detail {
			font-size: 0.85rem;
			margin: 0;
		}
	}

	.admin-table-wrap {
		overflow-x: auto;
		border-radius: 0.75rem;
		border: 1px solid var(--default-300);
		background: var(--background);
	}

	/* B6.2: nút action trong cột actions DataTable (snippet actionsContent). */
	.row-actions {
		display: flex;
		gap: 0.25rem;
		justify-content: flex-end;
	}

	.admin-pagination {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.total-count {
		font-size: 0.85rem;
		color: var(--foreground-500);
	}

	.page-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.page-info {
		font-size: 0.85rem;
		color: var(--foreground);
		min-width: 6rem;
		text-align: center;
	}

	.page-size {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.page-size-label {
		font-size: 0.8rem;
		color: var(--foreground-500);
	}

	.admin-select {
		height: 2.25rem;
		padding: 0 0.5rem;
		border-radius: 0.5rem;
		border: 1px solid var(--default-300);
		background: var(--default-50, transparent);
		color: var(--foreground);
		font-size: 0.85rem;
		cursor: pointer;

		option {
			background: var(--default-200);
			color: var(--foreground);
		}
	}

	.modal-intro {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
		color: var(--foreground);
		line-height: 1.5;
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
			color: var(--foreground-500);
			margin: 0;
		}

		.temp-password-row {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			flex-wrap: wrap;

			.temp-password-value {
				flex: 1;
				min-width: 0;
				font-family: monospace;
				color: var(--primary);
				padding: 0.5rem 0.75rem;
				background: var(--default-50, transparent);
				border: 1px dashed var(--default-400);
				border-radius: 0.5rem;
				overflow-wrap: anywhere;
				user-select: all;
			}
		}
	}

	@media (max-width: 720px) {
		.admin-page {
			padding: 1rem;
		}

		.admin-title {
			font-size: 1.4rem;
		}
	}
</style>
