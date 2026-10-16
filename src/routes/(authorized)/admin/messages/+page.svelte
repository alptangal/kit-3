<!-- src/routes/(authorized)/admin/messages/+page.svelte -->
<!-- Tin nhắn nội bộ: 2 cột — danh sách thread bên trái (search + phân trang),
     panel hội thoại bên phải; compose modal gửi tin. -->
<script lang="ts">
	import { Button, Pagination } from '$components/element';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDateTime as formatDateTimeShared } from '$modules/i18n';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';

	interface MessageAttachment {
		name: string;
		url: string;
		size?: number;
	}

	interface MessageRow {
		_id?: string;
		messageId?: string;
		threadId?: string;
		senderId?: string;
		senderName?: string;
		recipientIds?: string[];
		subject?: string;
		body?: string;
		attachments?: MessageAttachment[];
		isReadBy?: string[];
		createdAt?: string | null;
	}

	interface ThreadSummary {
		threadId: string;
		lastMessage: MessageRow | undefined;
		lastMessageAt: string | undefined;
		unreadCount: number;
		totalMessages: number;
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
		title: { vi: 'Tin nhắn', en: 'Messages' },
		subtitle: {
			vi: 'Gửi và theo dõi tin nhắn nội bộ giữa các user',
			en: 'Send and track internal messages between users'
		},
		searchPlaceholder: { vi: 'Tìm kiếm chủ đề…', en: 'Search subjects…' },
		composeBtn: { vi: 'Soạn tin', en: 'Compose' },
		threadListTitle: { vi: 'Hội thoại', en: 'Conversations' },
		panel: {
			emptyTitle: { vi: 'Chọn một hội thoại', en: 'Select a conversation' },
			emptyDetail: {
				vi: 'Chọn một hội thoại bên trái để xem nội dung.',
				en: 'Pick a conversation on the left to view messages.'
			},
			markAllRead: { vi: 'Đánh tất cả đã đọc', en: 'Mark all read' },
			noSubject: { vi: 'Không có chủ đề', en: 'No subject' },
			you: { vi: 'Bạn', en: 'You' }
		},
		msg: {
			to: { vi: 'Đến', en: 'To' }
		},
		table: {
			subject: { vi: 'Chủ đề', en: 'Subject' },
			lastMessage: { vi: 'Tin cuối', en: 'Last message' },
			unread: { vi: 'Chưa đọc', en: 'Unread' },
			updatedAt: { vi: 'Cập nhật', en: 'Updated' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitle: { vi: 'Không tải được tin nhắn', en: 'Failed to load messages' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có hội thoại nào', en: 'No conversations yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		composeModal: {
			title: { vi: 'Soạn tin nhắn', en: 'Compose message' },
			recipientsField: {
				vi: 'User nhận (ID, cách nhau bởi dấu phẩy)',
				en: 'Recipients (user IDs, comma-separated)'
			},
			subjectField: { vi: 'Chủ đề (tuỳ chọn)', en: 'Subject (optional)' },
			bodyField: { vi: 'Nội dung', en: 'Body' },
			submit: { vi: 'Gửi', en: 'Send' }
		},
		deleteModal: {
			title: { vi: 'Xoá tin nhắn', en: 'Delete message' },
			body: {
				vi: 'Xoá tin nhắn này khỏi hội thoại? Hành động không thể hoàn tác.',
				en: 'Delete this message from the conversation? This cannot be undone.'
			},
			submit: { vi: 'Xoá', en: 'Delete' }
		},
		toasts: {
			sent: { vi: 'Đã gửi tin nhắn', en: 'Message sent' },
			markedRead: { vi: 'Đã đánh dấu đã đọc', en: 'Marked as read' },
			markedAll: { vi: 'Đã đánh dấu tất cả đã đọc', en: 'Marked all as read' },
			deleted: { vi: 'Đã xoá tin nhắn', en: 'Message deleted' },
			failed: { vi: 'Thao tác không thành công', en: 'Action failed' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		form: {
			requireRecipients: { vi: 'Vui lòng nhập người nhận', en: 'Please enter recipients' },
			requireBody: { vi: 'Vui lòng nhập nội dung', en: 'Please enter a body' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	// ── Danh sách thread ──
	let threads = $state<ThreadSummary[]>([]);
	let total = $state(0);
	let pageNo = $state(1);
	let pageSize = $state(20);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let searchInput = $state('');
	let searchActive = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	// ── Hội thoại đang mở ──
	let selectedThread = $state<string | undefined>(undefined);
	let selectedSubject = $state<string | undefined>(undefined);
	let panelMessages = $state<MessageRow[]>([]);
	let panelLoading = $state(false);
	let panelError = $state<string | undefined>(undefined);

	// ── Client ID (sender tự nhận diện "Bạn") ──
	let currentUserId = $state<string>('');

	// i18n: format qua helper dùng chung ($modules/i18n) — cùng shape trước đây.
	function formatDateTime(raw?: string | null): string {
		return formatDateTimeShared(raw, lang);
	}

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	// ── Gọi API list threads ──
	async function loadThreads() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/messages/threads',
				{
					method: 'POST',
					body: {
						page: pageNo,
						pageSize,
						search: searchActive || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: ThreadSummary[]; total?: number; page?: number }
					| undefined;
				threads = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number') pageNo = data.page;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/messages] threads failed:', err);
		}
	}

	// ── Gọi API list messages trong thread ──
	async function openThread(thread: ThreadSummary) {
		if (panelLoading || !encryptionKeys) return;
		selectedThread = thread.threadId;
		selectedSubject = thread.lastMessage?.subject;
		panelMessages = [];
		panelError = undefined;
		panelLoading = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/messages/list',
				{ method: 'POST', body: { threadId: thread.threadId } },
				encryptionKeys
			);
			panelLoading = false;
			if (response.ok) {
				const data = response.data as { items?: MessageRow[] } | undefined;
				panelMessages = data?.items ?? [];
				// mark tất cả tin chưa đọc của thread này
				const unread = panelMessages.filter((m) => !(m.isReadBy ?? []).includes(currentUserId));
				if (unread.length > 0) await markThreadRead(unread);
			} else {
				panelError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			panelLoading = false;
			panelError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/messages] list failed:', err);
		}
	}

	// ── Đánh đã đọc toàn bộ thread vừa mở ──
	async function markThreadRead(unread: MessageRow[]) {
		if (!encryptionKeys) return;
		try {
			await Promise.all(
				unread.map((m) =>
					encryption.fetchSecure(
						'/api/admin/messages/mark-read',
						{ method: 'POST', body: { messageId: m._id } },
						encryptionKeys!
					)
				)
			);
			await loadThreads();
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/messages] mark-read failed:', err);
		}
	}

	// ── Search debounce ──
	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			searchActive = searchInput.trim();
			pageNo = 1;
			void loadThreads();
		}, 350);
	}

	// ── Phân trang ──
	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === pageNo || loading) return;
		pageNo = target;
		await loadThreads();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize || loading) return;
		pageSize = newSize;
		pageNo = 1;
		await loadThreads();
	}

	// ── Compose modal ──
	let composeModalDisplay = $state(false);
	let composeRecipients = $state('');
	let composeSubject = $state('');
	let composeBody = $state('');
	let submitting = $state(false);
	let formError = $state<string | undefined>(undefined);

	function openComposeModal() {
		composeRecipients = '';
		composeSubject = '';
		composeBody = '';
		formError = undefined;
		composeModalDisplay = true;
	}

	async function submitCompose() {
		if (submitting || !encryptionKeys) return;
		const recipients = composeRecipients
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		if (recipients.length === 0) {
			formError = pageContents.form.requireRecipients[lang];
			return;
		}
		if (!composeBody.trim()) {
			formError = pageContents.form.requireBody[lang];
			return;
		}
		submitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/messages/send',
				{
					method: 'POST',
					body: {
						recipientIds: recipients,
						subject: composeSubject.trim() || undefined,
						body: composeBody.trim()
					}
				},
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				showToast(pageContents.toasts.sent[lang], 'success');
				composeModalDisplay = false;
				await loadThreads();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/messages] send failed:', err);
		}
	}

	// ── Xoá tin nhắn ──
	let deleteModalDisplay = $state(false);
	let deleteTarget = $state<MessageRow | null>(null);
	let deleteSubmitting = $state(false);

	function openDeleteModal(message: MessageRow) {
		deleteTarget = message;
		formError = undefined;
		deleteModalDisplay = true;
	}

	async function submitDelete() {
		if (deleteSubmitting || !deleteTarget?._id || !encryptionKeys) return;
		deleteSubmitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/messages/delete',
				{ method: 'POST', body: { messageId: deleteTarget._id } },
				encryptionKeys
			);
			deleteSubmitting = false;
			if (response.ok) {
				showToast(pageContents.toasts.deleted[lang], 'success');
				deleteModalDisplay = false;
				if (selectedThread) {
					const thread = threads.find((t) => t.threadId === selectedThread);
					if (thread) {
						await openThread(thread);
						return;
					}
				}
				await loadThreads();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			deleteSubmitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/messages] delete failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		// Lấy userId hiện tại từ store client
		currentUserId = client.user?.userId ?? '';
		await loadThreads();
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
			<!-- compose = success -->
			<Button color="success" onClick={openComposeModal}>
				{pageContents.composeBtn[lang]}
			</Button>
		</div>
	</header>

	{#if loading && !loadedOnce}
		<div class="admin-state" role="status">
			<p>{pageContents.states.loading[lang]}</p>
		</div>
	{:else if loadError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="primary" variant="outline" onClick={loadThreads}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else}
		<div class="messages-layout">
			<!-- ── Cột trái: danh sách thread ── -->
			<div class="threads-col">
				<div class="threads-toolbar">
					<input
						class="admin-input"
						type="search"
						placeholder={pageContents.searchPlaceholder[lang]}
						bind:value={searchInput}
						oninput={onSearchInput}
					/>
				</div>
				{#if threads.length === 0}
					<div class="admin-state compact">
						<p>{pageContents.states.empty[lang]}</p>
					</div>
				{:else}
					<ul class="thread-list">
						{#each threads as thread (thread.threadId)}
							<li>
								<button
									type="button"
									class="thread-item"
									class:active={thread.threadId === selectedThread}
									onclick={() => openThread(thread)}
								>
									<span class="thread-subject">
										{thread.lastMessage?.subject || pageContents.panel.noSubject[lang]}
									</span>
									<span class="thread-last">
										{thread.lastMessage?.body?.slice(0, 60) ?? '—'}
									</span>
									<span class="thread-meta">
										<span class="thread-time">{formatDateTime(thread.lastMessageAt)}</span>
										{#if thread.unreadCount > 0}
											<span class="thread-unread">{thread.unreadCount}</span>
										{/if}
									</span>
								</button>
							</li>
						{/each}
					</ul>
					<!-- ── Phân trang (server-side) — Pagination element đồng bộ hệ thống ── -->
					<div class="threads-pagination">
						<Pagination
							bind:page={pageNo}
							totalPages={totalPages}
							loading={loading}
							variant="compact"
							prevLabel={pageContents.pagination.prev[lang]}
							nextLabel={pageContents.pagination.next[lang]}
							aria-label={pageContents.title[lang]}
						/>
					</div>
				{/if}
			</div>

			<!-- ── Cột phải: panel hội thoại ── -->
			<div class="panel-col">
				{#if !selectedThread}
					<div class="admin-state">
						<p class="state-title">{pageContents.panel.emptyTitle[lang]}</p>
						<p class="state-detail">{pageContents.panel.emptyDetail[lang]}</p>
					</div>
				{:else}
					<div class="panel-header">
						<div class="panel-header-text">
							<span class="panel-subject">
								{selectedSubject || pageContents.panel.noSubject[lang]}
							</span>
						</div>
					</div>
					<div class="panel-body">
						{#if panelLoading}
							<div class="admin-state compact">
								<p>{pageContents.states.loading[lang]}</p>
							</div>
						{:else if panelError}
							<div class="admin-state error" role="alert">
								<p class="state-detail">{panelError}</p>
							</div>
						{:else}
							{#each panelMessages as message (message._id)}
								<article
									class="msg-bubble"
									class:mine={message.senderId === currentUserId}
								>
									<header class="msg-head">
										<span class="msg-sender">
											{message.senderId === currentUserId
												? pageContents.panel.you[lang]
												: (message.senderName ?? message.senderId ?? '—')}
										</span>
										<span class="msg-time">{formatDateTime(message.createdAt)}</span>
									</header>
									<p class="msg-body-text">{message.body}</p>
									{#if message.attachments && message.attachments.length > 0}
										<ul class="msg-attachments">
											{#each message.attachments as att, i (i)}
												<li>
													<a href={att.url} target="_blank" rel="noreferrer">{att.name}</a>
													{#if typeof att.size === 'number'}
														<span class="att-size">{(att.size / 1024).toFixed(1)} KB</span>
													{/if}
												</li>
											{/each}
										</ul>
									{/if}
									<footer class="msg-foot">
										<span class="msg-to">
											{pageContents.msg.to[lang]}: {(message.recipientIds ?? []).join(', ')}
										</span>
										<!-- delete = error outline -->
										<Button color="error" variant="outline" size="sm" onClick={() => openDeleteModal(message)}>
											{pageContents.deleteModal.submit[lang]}
										</Button>
									</footer>
								</article>
							{/each}
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</section>

<!-- ── Modal soạn tin ── -->
{#if composeModalDisplay}
	<Modal bind:display={composeModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.composeModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<div class="form-grid">
					<label class="form-field">
						<span class="form-label">{pageContents.composeModal.recipientsField[lang]}</span>
						<input class="admin-input" type="text" bind:value={composeRecipients} disabled={submitting} />
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.composeModal.subjectField[lang]}</span>
						<input class="admin-input" type="text" bind:value={composeSubject} disabled={submitting} />
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.composeModal.bodyField[lang]}</span>
						<textarea class="admin-textarea" rows="5" bind:value={composeBody} disabled={submitting}></textarea>
					</label>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- send = success -->
				<Button color="success" onClick={submitCompose} loading={submitting} disabled={submitting}>
					{pageContents.composeModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={submitting}
					onClick={() => {
						composeModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal xoá tin nhắn ── -->
{#if deleteModalDisplay}
	<Modal bind:display={deleteModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.deleteModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<p class="modal-body-text">{pageContents.deleteModal.body[lang]}</p>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- delete = error -->
				<Button color="error" onClick={submitDelete} loading={deleteSubmitting} disabled={deleteSubmitting}>
					{pageContents.deleteModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={deleteSubmitting}
					onClick={() => {
						deleteModalDisplay = false;
					}}
				>
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
		height: 100%;

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
		gap: 0.5rem;
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

	.admin-textarea {
		padding: 0.6rem 0.75rem;
		border-radius: var(--field-radius, 0.75rem);
		border: 1px solid var(--default-300);
		background: var(--default-50, transparent);
		color: var(--foreground);
		font-size: 0.9rem;
		width: 100%;
		resize: vertical;
		font-family: inherit;

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

		&.compact {
			padding: 1.5rem 1rem;
		}

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

	.messages-layout {
		display: grid;
		grid-template-columns: minmax(16rem, 22rem) 1fr;
		gap: 1rem;
		flex: 1;
		min-height: 0;

		@media (max-width: 900px) {
			grid-template-columns: 1fr;
		}
	}

	.threads-col {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		border: 1px solid var(--default-300);
		border-radius: 0.75rem;
		background: var(--background);
		padding: 0.75rem;
		min-height: 0;
		overflow-y: auto;
	}

	.threads-toolbar {
		display: flex;
		gap: 0.5rem;
	}

	.thread-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.thread-item {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		width: 100%;
		text-align: left;
		padding: 0.6rem 0.7rem;
		border-radius: 0.6rem;
		border: 1px solid transparent;
		background: transparent;
		cursor: pointer;
		color: var(--foreground);

		&:hover {
			background: var(--default-50);
		}

		&.active {
			background: var(--default-100);
			border-color: var(--default-300);
		}
	}

	.thread-subject {
		font-weight: 600;
		font-size: 0.9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.thread-last {
		font-size: 0.8rem;
		color: var(--foreground-500);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.thread-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.thread-time {
		font-size: 0.7rem;
		color: var(--foreground-500);
	}

	.thread-unread {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--primary, hsl(243, 75%, 59%));
		color: white;
		font-size: 0.7rem;
		font-weight: 700;
	}

	.threads-pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		margin-top: auto;
		padding-top: 0.5rem;
	}

	.panel-col {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--default-300);
		border-radius: 0.75rem;
		background: var(--background);
		min-height: 0;
		overflow: hidden;
	}

	.panel-header {
		padding: 0.9rem 1rem;
		border-bottom: 1px solid var(--default-200);
	}

	.panel-subject {
		font-weight: 600;
		font-size: 1rem;
		color: var(--foreground);
	}

	.panel-body {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.msg-bubble {
		max-width: 75%;
		padding: 0.7rem 0.9rem;
		border-radius: 0.85rem;
		border: 1px solid var(--default-200);
		background: var(--default-50);
		align-self: flex-start;

		&.mine {
			align-self: flex-end;
			background: hsl(243, 75%, 95%);
			border-color: hsl(243, 75%, 88%);
		}

		@media (max-width: 720px) {
			max-width: 90%;
		}
	}

	.msg-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.75rem;
		margin-bottom: 0.3rem;
	}

	.msg-sender {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--foreground-600);
	}

	.msg-time {
		font-size: 0.7rem;
		color: var(--foreground-500);
	}

	.msg-body-text {
		font-size: 0.9rem;
		color: var(--foreground);
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.msg-attachments {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;

		a {
			color: var(--primary);
			font-size: 0.8rem;
			word-break: break-all;
		}
	}

	.att-size {
		font-size: 0.7rem;
		color: var(--foreground-500);
		margin-left: 0.4rem;
	}

	.msg-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}

	.msg-to {
		font-size: 0.7rem;
		color: var(--foreground-500);
		word-break: break-all;
	}

	.modal-body-text {
		font-size: 0.9rem;
		color: var(--foreground);
		margin: 0 0 0.75rem;
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
</style>
