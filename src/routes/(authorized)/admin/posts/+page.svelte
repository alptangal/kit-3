<!-- src/routes/(authorized)/admin/posts/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { Modal } from '$components/modal';
	import { AlertDialog } from '$lib/components/element/alert-dialog';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';

	interface PostRow {
		_id?: string;
		postId?: string;
		slug?: string;
		title?: string;
		excerpt?: string;
		content?: string;
		coverImageUrl?: string;
		authorName?: string;
		categoryId?: string;
		tags?: string[];
		status?: string;
		publishedAt?: string | null;
		viewCount?: number;
		seoTitle?: string;
		seoDescription?: string;
		language?: string;
		createdAt?: string | null;
	}

	interface CategoryRow {
		_id?: string;
		categoryId?: string;
		name?: string;
		status?: string;
	}

	// ── Ngôn ngữ ──
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : (client.browser?.language ?? 'en'));

	// ── Cặp khoá RSA ──
	let encryptionKeys = $state<
		| undefined
		| {
				publicKey: CryptoKey;
				privateKey: CryptoKey;
		  }
	>(undefined);

	// ── Nội dung song ngữ ──
	const pageContents: { [k: string]: any } = {
		title: { vi: 'Bài viết', en: 'Posts' },
		subtitle: {
			vi: 'Quản lý bài viết blog/tin tức: soạn thảo, xuất bản, lưu trữ',
			en: 'Manage blog/news posts: draft, publish, archive'
		},
		filters: {
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' },
			allCategories: { vi: 'Tất cả danh mục', en: 'All categories' },
			search: { vi: 'Tìm theo tiêu đề…', en: 'Search by title…' }
		},
		table: {
			title: { vi: 'Tiêu đề', en: 'Title' },
			category: { vi: 'Danh mục', en: 'Category' },
			tags: { vi: 'Thẻ', en: 'Tags' },
			status: { vi: 'Trạng thái', en: 'Status' },
			views: { vi: 'Lượt xem', en: 'Views' },
			publishedAt: { vi: 'Xuất bản', en: 'Published' }
		},
		statuses: {
			draft: { vi: 'Nháp', en: 'Draft' },
			published: { vi: 'Đã xuất bản', en: 'Published' },
			archived: { vi: 'Đã lưu trữ', en: 'Archived' }
		},
		actions: {
			create: { vi: 'Tạo bài viết', en: 'Create post' },
			edit: { vi: 'Sửa', en: 'Edit' },
			publish: { vi: 'Xuất bản', en: 'Publish' },
			archive: { vi: 'Lưu trữ', en: 'Archive' },
			"delete": { vi: 'Xoá', en: 'Delete' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitle: { vi: 'Không tải được bài viết', en: 'Failed to load posts' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có bài viết nào', en: 'No posts yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			pageInfo: { vi: 'Trang {page}/{total}', en: 'Page {page}/{total}' },
			totalCount: { vi: '{total} bài viết', en: '{total} posts' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		editModal: {
			createTitle: { vi: 'Tạo bài viết', en: 'Create post' },
			editTitle: { vi: 'Sửa bài viết', en: 'Edit post' },
			title: { vi: 'Tiêu đề', en: 'Title' },
			slug: { vi: 'Đường dẫn (slug)', en: 'Slug' },
			slugHint: { vi: 'Để trống sẽ tự sinh từ tiêu đề', en: 'Leave empty to auto-generate from title' },
			category: { vi: 'Danh mục', en: 'Category' },
			noneCategory: { vi: '— Không danh mục —', en: '— No category —' },
			tags: { vi: 'Thẻ (phân cách bởi dấu phẩy)', en: 'Tags (comma separated)' },
			coverImage: { vi: 'Ảnh bìa (URL)', en: 'Cover image (URL)' },
			excerpt: { vi: 'Tóm tắt', en: 'Excerpt' },
			content: { vi: 'Nội dung', en: 'Content' },
			seoTitle: { vi: 'SEO title', en: 'SEO title' },
			seoDescription: { vi: 'SEO description', en: 'SEO description' },
			language: { vi: 'Ngôn ngữ', en: 'Language' },
			submitCreate: { vi: 'Tạo', en: 'Create' },
			submitSave: { vi: 'Lưu', en: 'Save' }
		},
		deleteDialog: {
			title: { vi: 'Xoá bài viết?', en: 'Delete post?' },
			description: { vi: 'Bài viết sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn tác.', en: 'The post will be permanently deleted. This action cannot be undone.' },
			confirm: { vi: 'Xoá', en: 'Delete' },
			cancel: { vi: 'Huỷ', en: 'Cancel' }
		},
		toasts: {
			created: { vi: 'Đã tạo bài viết', en: 'Post created' },
			updated: { vi: 'Đã cập nhật bài viết', en: 'Post updated' },
			published: { vi: 'Đã xuất bản bài viết', en: 'Post published' },
			archived: { vi: 'Đã lưu trữ bài viết', en: 'Post archived' },
			deleted: { vi: 'Đã xoá bài viết', en: 'Post deleted' },
			failed: { vi: 'Thao tác không thành công', en: 'Action failed' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		form: {
			requireTitle: { vi: 'Vui lòng nhập tiêu đề', en: 'Please enter a title' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	const POST_STATUSES = ['draft', 'published', 'archived'] as const;

	function statusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.statuses;
		const label = pageContents.statuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function statusColor(status?: string): string {
		switch (status) {
			case 'published':
				return 'success';
			case 'draft':
				return 'warning';
			case 'archived':
				return 'default';
			default:
				return 'default';
		}
	}

	// ── Danh sách ──
	let posts = $state<PostRow[]>([]);
	let categories = $state<CategoryRow[]>([]);
	let total = $state(0);
	let pageNo = $state(1);
	let pageSize = $state(20);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let statusFilter = $state('');
	let categoryFilter = $state('');
	let searchInput = $state('');
	let searchDebounce: ReturnType<typeof setTimeout> | undefined;

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	function categoryName(categoryId?: string): string {
		if (!categoryId) return '—';
		return categories.find((c) => c.categoryId === categoryId)?.name ?? '—';
	}

	function formatDateTime(raw?: string | null): string {
		if (!raw) return '—';
		try {
			const date = new Date(raw);
			return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				year: 'numeric',
				month: 'short',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			}).format(date);
		} catch {
			return '—';
		}
	}

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	// ── Gọi API ──
	async function loadPosts() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/posts/list',
				{
					method: 'POST',
					body: {
						page: pageNo,
						pageSize,
						status: statusFilter || undefined,
						categoryId: categoryFilter || undefined,
						search: searchInput.trim() || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: PostRow[]; total?: number; page?: number }
					| undefined;
				posts = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number') pageNo = data.page;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/posts] load failed:', err);
		}
	}

	async function loadCategories() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/posts/categories/list',
				{ method: 'POST', body: { pageSize: 100 } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { items?: CategoryRow[] } | undefined;
				categories = data?.items ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/posts] load categories failed:', err);
		}
	}

	// ── Phân trang / filter ──
	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === pageNo || loading) return;
		pageNo = target;
		await loadPosts();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize || loading) return;
		pageSize = newSize;
		pageNo = 1;
		await loadPosts();
	}

	async function onFilterChange() {
		if (loading) return;
		pageNo = 1;
		await loadPosts();
	}

	function onSearchInput() {
		if (searchDebounce) clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			void onFilterChange();
		}, 300);
	}

	// ── Modal tạo/sửa ──
	let editModalDisplay = $state(false);
	let editingPostId = $state<string | undefined>(undefined);
	let submitting = $state(false);
	let formError = $state<string | undefined>(undefined);
	let form = $state({
		title: '',
		slug: '',
		categoryId: '',
		tags: '',
		coverImageUrl: '',
		excerpt: '',
		content: '',
		seoTitle: '',
		seoDescription: '',
		language: 'vi'
	});

	function openCreateModal() {
		editingPostId = undefined;
		form = {
			title: '',
			slug: '',
			categoryId: '',
			tags: '',
			coverImageUrl: '',
			excerpt: '',
			content: '',
			seoTitle: '',
			seoDescription: '',
			language: 'vi'
		};
		formError = undefined;
		editModalDisplay = true;
	}

	async function openEditModal(row: PostRow) {
		const postId = row.postId;
		if (!postId || !encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/posts/get',
				{ method: 'POST', body: { postId } },
				encryptionKeys
			);
			if (!response.ok) {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.failed), 'error');
				return;
			}
			const data = (response.data ?? {}) as PostRow;
			editingPostId = postId;
			form = {
				title: data.title ?? '',
				slug: data.slug ?? '',
				categoryId: data.categoryId ?? '',
				tags: Array.isArray(data.tags) ? data.tags.join(', ') : '',
				coverImageUrl: data.coverImageUrl ?? '',
				excerpt: data.excerpt ?? '',
				content: data.content ?? '',
				seoTitle: data.seoTitle ?? '',
				seoDescription: data.seoDescription ?? '',
				language: data.language ?? 'vi'
			};
			formError = undefined;
			editModalDisplay = true;
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/posts] get failed:', err);
			showToast(pageContents.toasts.requestFailed[lang], 'error');
		}
	}

	function validateForm(): string | undefined {
		if (!form.title.trim()) return pageContents.form.requireTitle[lang];
		return undefined;
	}

	async function submitPost() {
		if (submitting || !encryptionKeys) return;
		const validationError = validateForm();
		if (validationError) {
			formError = validationError;
			return;
		}
		formError = undefined;
		submitting = true;
		const tags = form.tags
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		try {
			const isEdit = Boolean(editingPostId);
			const response = await encryption.fetchSecure(
				isEdit ? '/api/admin/posts/update' : '/api/admin/posts/create',
				{
					method: 'POST',
					body: isEdit
						? {
								postId: editingPostId,
								title: form.title.trim(),
								slug: form.slug.trim() || undefined,
								categoryId: form.categoryId || '',
								tags,
								coverImageUrl: form.coverImageUrl.trim(),
								excerpt: form.excerpt,
								content: form.content,
								seoTitle: form.seoTitle,
								seoDescription: form.seoDescription
							}
						: {
								title: form.title.trim(),
								slug: form.slug.trim() || undefined,
								categoryId: form.categoryId || undefined,
								tags,
								coverImageUrl: form.coverImageUrl.trim(),
								excerpt: form.excerpt,
								content: form.content,
								seoTitle: form.seoTitle,
								seoDescription: form.seoDescription,
								language: form.language
							}
				},
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				showToast(
					resolveServerMessage(response.message, lang, isEdit ? pageContents.toasts.updated : pageContents.toasts.created),
					'success'
				);
				editModalDisplay = false;
				await loadPosts();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/posts] submit failed:', err);
		}
	}

	// ── Publish / Archive / Delete ──
	async function publishPost(row: PostRow) {
		if (!row.postId || !encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/posts/publish',
				{ method: 'POST', body: { postId: row.postId } },
				encryptionKeys
			);
			if (response.ok) {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.published), 'success');
				await loadPosts();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.failed), 'error');
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/posts] publish failed:', err);
			showToast(pageContents.toasts.requestFailed[lang], 'error');
		}
	}

	async function archivePost(row: PostRow) {
		if (!row.postId || !encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/posts/archive',
				{ method: 'POST', body: { postId: row.postId } },
				encryptionKeys
			);
			if (response.ok) {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.archived), 'success');
				await loadPosts();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.failed), 'error');
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/posts] archive failed:', err);
			showToast(pageContents.toasts.requestFailed[lang], 'error');
		}
	}

	let deleteDialogOpen = $state(false);
	let deletingPost = $state<PostRow | undefined>(undefined);
	let deleteBusy = $state(false);

	function askDeletePost(row: PostRow) {
		deletingPost = row;
		deleteDialogOpen = true;
	}

	async function confirmDeletePost() {
		const row = deletingPost;
		if (!row?.postId || !encryptionKeys || deleteBusy) return;
		deleteBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/posts/delete',
				{ method: 'POST', body: { postId: row.postId } },
				encryptionKeys
			);
			deleteBusy = false;
			if (response.ok) {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.deleted), 'success');
				deleteDialogOpen = false;
				deletingPost = undefined;
				await loadPosts();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.failed), 'error');
			}
		} catch (err) {
			deleteBusy = false;
			if (import.meta.env.DEV) console.error('[admin/posts] delete failed:', err);
			showToast(pageContents.toasts.requestFailed[lang], 'error');
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadPosts(), loadCategories()]);
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
			<!-- Quy ước màu nút: create = success -->
			<Button color="success" onClick={openCreateModal}>{pageContents.actions.create[lang]}</Button>
		</div>
	</header>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<select class="admin-select" bind:value={statusFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allStatuses[lang]}</option>
			{#each POST_STATUSES as status (status)}
				<option value={status}>{statusLabel(status)}</option>
			{/each}
		</select>
		<select class="admin-select" bind:value={categoryFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allCategories[lang]}</option>
			{#each categories as category (category.categoryId)}
				<option value={category.categoryId}>{category.name}</option>
			{/each}
		</select>
		<input
			class="admin-input search-input"
			type="text"
			bind:value={searchInput}
			oninput={onSearchInput}
			placeholder={pageContents.filters.search[lang]}
		/>
		<Button color="default" variant="outline" size="sm" onClick={loadPosts}>
			{pageContents.states.retry[lang]}
		</Button>
	</div>

	{#if loading && !loadedOnce}
		<div class="admin-state" role="status">
			<p>{pageContents.states.loading[lang]}</p>
		</div>
	{:else if loadError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="primary" variant="outline" onClick={loadPosts}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else if posts.length === 0}
		<div class="admin-state">
			<p>{pageContents.states.empty[lang]}</p>
		</div>
	{:else}
		<div class="admin-table-wrap">
			<table class="admin-table">
				<thead>
					<tr>
						<th scope="col">{pageContents.table.title[lang]}</th>
						<th scope="col">{pageContents.table.category[lang]}</th>
						<th scope="col">{pageContents.table.tags[lang]}</th>
						<th scope="col">{pageContents.table.status[lang]}</th>
						<th scope="col">{pageContents.table.views[lang]}</th>
						<th scope="col">{pageContents.table.publishedAt[lang]}</th>
						<th scope="col" class="col-actions"><span class="visually-hidden">actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each posts as row (row._id ?? row.postId)}
						<tr>
							<td class="col-title">
								<span class="post-title">{row.title ?? '—'}</span>
								<span class="post-slug">/{row.slug ?? ''}</span>
							</td>
							<td>{categoryName(row.categoryId)}</td>
							<td class="col-tags">
								{#if row.tags?.length}
									{#each row.tags as tag (tag)}
										<span class="tag-badge">{tag}</span>
									{/each}
								{:else}
									—
								{/if}
							</td>
							<td class="col-status">
								<span class="status-badge status-{statusColor(row.status)}">{statusLabel(row.status)}</span>
							</td>
							<td class="col-num">{row.viewCount ?? 0}</td>
							<td>{formatDateTime(row.publishedAt)}</td>
							<td class="col-actions">
								<div class="row-actions">
									<!-- Quy ước: edit = primary -->
									<Button color="primary" variant="ghost" size="sm" onClick={() => openEditModal(row)}>
										{pageContents.actions.edit[lang]}
									</Button>
									{#if row.status !== 'published'}
										<!-- publish = secondary (outline) -->
										<Button color="default" variant="outline" size="sm" onClick={() => publishPost(row)}>
											{pageContents.actions.publish[lang]}
										</Button>
									{/if}
									{#if row.status !== 'archived'}
										<Button color="default" variant="outline" size="sm" onClick={() => archivePost(row)}>
											{pageContents.actions.archive[lang]}
										</Button>
									{/if}
									<!-- delete = error -->
									<Button color="error" variant="ghost" size="sm" onClick={() => askDeletePost(row)}>
										{pageContents.actions.delete[lang]}
									</Button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- ── Phân trang ── -->
	<footer class="admin-pagination">
		<span class="total-count">{pageContents.pagination.totalCount[lang].replace('{total}', String(total))}</span>
		<div class="page-controls">
			<Button
				color="default"
				variant="outline"
				size="sm"
				disabled={pageNo <= 1}
				onClick={() => goToPage(pageNo - 1)}
			>
				{pageContents.pagination.prev[lang]}
			</Button>
			<span class="page-info">
				{pageContents.pagination.pageInfo[lang]
					.replace('{page}', String(pageNo))
					.replace('{total}', String(totalPages))}
			</span>
			<Button
				color="default"
				variant="outline"
				size="sm"
				disabled={pageNo >= totalPages}
				onClick={() => goToPage(pageNo + 1)}
			>
				{pageContents.pagination.next[lang]}
			</Button>
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
</section>

<!-- ── Modal tạo/sửa bài viết ── -->
{#if editModalDisplay}
	<Modal bind:display={editModalDisplay} size="lg" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				{editingPostId ? pageContents.editModal.editTitle[lang] : pageContents.editModal.createTitle[lang]}
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<div class="form-grid">
					<label class="form-field">
						<span class="form-label">{pageContents.editModal.title[lang]}</span>
						<input class="admin-input" type="text" bind:value={form.title} disabled={submitting} />
					</label>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.editModal.slug[lang]}</span>
							<input class="admin-input" type="text" bind:value={form.slug} disabled={submitting} />
							<span class="form-hint">{pageContents.editModal.slugHint[lang]}</span>
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.editModal.language[lang]}</span>
							<select class="admin-select" bind:value={form.language} disabled={submitting || Boolean(editingPostId)}>
								<option value="vi">Tiếng Việt (vi)</option>
								<option value="en">English (en)</option>
							</select>
						</label>
					</div>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.editModal.category[lang]}</span>
							<select class="admin-select" bind:value={form.categoryId} disabled={submitting}>
								<option value="">{pageContents.editModal.noneCategory[lang]}</option>
								{#each categories as category (category.categoryId)}
									<option value={category.categoryId}>{category.name}</option>
								{/each}
							</select>
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.editModal.tags[lang]}</span>
							<input class="admin-input" type="text" bind:value={form.tags} disabled={submitting} />
						</label>
					</div>
					<label class="form-field">
						<span class="form-label">{pageContents.editModal.coverImage[lang]}</span>
						<input class="admin-input" type="text" bind:value={form.coverImageUrl} disabled={submitting} />
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.editModal.excerpt[lang]}</span>
						<textarea class="admin-input admin-textarea" rows="2" bind:value={form.excerpt} disabled={submitting}></textarea>
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.editModal.content[lang]}</span>
						<textarea class="admin-input admin-textarea" rows="10" bind:value={form.content} disabled={submitting}></textarea>
					</label>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.editModal.seoTitle[lang]}</span>
							<input class="admin-input" type="text" bind:value={form.seoTitle} disabled={submitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.editModal.seoDescription[lang]}</span>
							<input class="admin-input" type="text" bind:value={form.seoDescription} disabled={submitting} />
						</label>
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create/save = success -->
				<Button color="success" onClick={submitPost} loading={submitting} disabled={submitting}>
					{editingPostId ? pageContents.editModal.submitSave[lang] : pageContents.editModal.submitCreate[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={submitting}
					onClick={() => {
						editModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── AlertDialog xoá bài viết ── -->
<AlertDialog bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header variant="danger">
			<AlertDialog.Title>{pageContents.deleteDialog.title[lang]}</AlertDialog.Title>
			<AlertDialog.Description>{pageContents.deleteDialog.description[lang]}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{pageContents.deleteDialog.cancel[lang]}</AlertDialog.Cancel>
			<AlertDialog.Action color="danger" onclick={confirmDeletePost}>
				{pageContents.deleteDialog.confirm[lang]}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog>

<style lang="scss">
	.admin-page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.5rem;
		max-width: 1280px;
		margin: 0 auto;
		width: 100%;

		@media (max-width: 720px) {
			padding: 1rem;
		}
	}

	.admin-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.admin-header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
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

	.admin-filters {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.search-input {
		flex: 1 1 14rem;
		max-width: 22rem;
		height: 2.25rem;
		padding: 0 0.75rem;
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

		&:disabled {
			opacity: var(--disabled-opacity, 0.5);
			cursor: not-allowed;
		}

		option {
			background: var(--default-200);
			color: var(--foreground);
		}
	}

	.admin-input {
		height: 2.5rem;
		padding: 0 0.75rem;
		border-radius: var(--field-radius, 0.75rem);
		border: 1px solid var(--default-300);
		background: var(--default-50, transparent);
		color: var(--foreground);
		font-size: 0.9rem;
		width: 100%;

		&:disabled {
			opacity: var(--disabled-opacity, 0.5);
		}
	}

	.admin-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 3rem 1rem;
		color: var(--foreground-500);

		&.error {
			color: var(--error);
		}

		.state-title {
			font-weight: 600;
			margin: 0;
		}

		.state-detail {
			font-size: 0.85rem;
			margin: 0;
		}

		p {
			margin: 0;
		}
	}

	.admin-table-wrap {
		overflow-x: auto;
		border-radius: 0.75rem;
		border: 1px solid var(--default-300);
		background: var(--background);
	}

	.admin-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;

		th,
		td {
			padding: 0.75rem 1rem;
			border-bottom: 1px solid var(--default-200);
			text-align: left;
			white-space: nowrap;
		}

		th {
			font-size: 0.8rem;
			text-transform: uppercase;
			font-weight: 600;
			background: var(--default-100);
			color: var(--foreground-500);
		}

		tbody tr:hover {
			background: var(--default-50);
		}
	}

	.col-title {
		white-space: normal;
		min-width: 14rem;

		.post-title {
			display: block;
			font-weight: 600;
			color: var(--foreground);
		}

		.post-slug {
			display: block;
			font-size: 0.75rem;
			color: var(--foreground-500);
		}
	}

	.col-tags {
		white-space: normal;
		max-width: 14rem;

		.tag-badge {
			display: inline-block;
			padding: 0.1rem 0.5rem;
			margin: 0.1rem 0.2rem 0.1rem 0;
			border-radius: 999px;
			font-size: 0.7rem;
			background: var(--default-200);
			color: var(--foreground-600);
		}
	}

	.col-num {
		font-variant-numeric: tabular-nums;
	}

	.col-status {
		white-space: nowrap;
	}

	.col-actions {
		text-align: right;

		.visually-hidden {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}
	}

	.row-actions {
		display: inline-flex;
		gap: 0.25rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.status-badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;

		&.status-success {
			background: var(--success-100, var(--default-200));
			color: var(--success-700, var(--success));
		}

		&.status-warning {
			background: var(--warning-100, var(--default-200));
			color: var(--warning-700, var(--foreground-600));
		}

		&.status-default {
			background: var(--default-200);
			color: var(--foreground-600);
		}
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

	.form-error-banner {
		background: var(--danger-soft, hsl(358, 62.5%, 90.6%));
		color: var(--error);
		border-left: 3px solid var(--error);
		border-radius: 0.5rem;
		padding: 0.6rem 0.85rem;
		font-size: 0.85rem;
		margin-bottom: 0.75rem;
	}

	.form-grid {
		display: grid;
		gap: 0.75rem;
	}

	.form-grid-2 {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: 1fr 1fr;

		@media (max-width: 680px) {
			grid-template-columns: 1fr;
		}
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.form-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--foreground);
	}

	.form-hint {
		font-size: 0.75rem;
		color: var(--foreground-500);
	}

	.admin-textarea {
		height: auto;
		min-height: 2.5rem;
		padding: 0.5rem 0.75rem;
		resize: vertical;
		font-family: inherit;
		line-height: 1.5;
	}
</style>
