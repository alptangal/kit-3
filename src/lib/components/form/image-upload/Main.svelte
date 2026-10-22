<!-- src/lib/components/form/image-upload/Main.svelte -->
<!-- ImageUpload — chọn file ảnh + upload thẳng lên hosting ngoài qua
     POST /api/admin/upload (multipart, fetch thường KHÔNG mã hoá) + preview + xoá.
     bind:value = URL ảnh (lưu vào field DB hiện có — products.imageUrl, posts.coverImageUrl).
     Mặc định ẨN URL (showUrl=false): hover/tap thumb hiện overlay actions —
     copy URL / xem ảnh (tab mới) / đổi ảnh; remove giữ nút riêng dưới thumb.
     MODE MULTIPLE (suppliers): truyền `images` ($bindable string[]) → grid
     thumbs + overlay per-thumb (copy / xem / đổi / set avatar / xoá) +
     nút "+ Thêm ảnh" row riêng; `avatarUrl` = con trỏ URL đang làm đại diện
     (trỏ vào 1 URL trong images). Không truyền `images` → hành vi đơn cũ.
     MODE DEFER (batch 3 — suppliers create): truyền `defer` → KHÔNG upload
     ngay khi chọn file; giữ File local + preview objectURL; cha gọi
     uploadPending() qua bind:this khi submit (trả URLs theo index đã gán vào
     images/avatarUrl). Hủy form = không tốn băng thông hosting. -->
<script lang="ts" module>
	export interface ImageUploadProps {
		/** URL ảnh hiện tại (2 chiều — parent bind:value) */
		value?: string;
		/** Nhãn hiển thị */
		label?: string;
		/** Vô hiệu hoá (vd đang submitting form cha) */
		disabled?: boolean;
		/** Hiện URL đầy đủ dưới thumb (mặc định ẩn — hành vi cũ) */
		showUrl?: boolean;
		/** MODE MULTIPLE — mảng URL (2 chiều). Truyền prop này → grid thumbs. */
		images?: string[];
		/** MODE MULTIPLE — URL đang làm đại diện (con trỏ vào images). */
		avatarUrl?: string;
		/** MODE DEFER — giữ file local, chỉ upload khi cha gọi uploadPending(). */
		defer?: boolean;
		/** Callback lỗi đã xử lý xong (đã toast nội bộ — hook để cha tự xử lý thêm) */
		onerror?: (message: string) => void;
	}
</script>

<script lang="ts">
	import { Button, Icon, Image as ImageEl, Spinner } from '$components/element';
	import { iconify } from '$lib/assets/icons/iconify';
	import { client } from '$store/basic.svelte';

	let {
		value = $bindable(''),
		label = '',
		disabled = false,
		showUrl = false,
		images = $bindable(undefined as string[] | undefined),
		avatarUrl = $bindable(''),
		defer = false,
		onerror
	}: ImageUploadProps = $props();

	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : 'en');

	// Mode multiple chỉ khi cha TRUYỀN images (undefined = mode đơn cũ)
	const multiple = $derived(images !== undefined);

	const MAX_SIZE = 5 * 1024 * 1024; // 5MB — khớp route /api/admin/upload
	const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

	let uploading = $state(false);
	// upload đang gán vào thumb nào (mode multiple) — undefined = thumb add mới
	let uploadTarget: number | undefined = $state();
	let copied = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();

	// ── DEFER mode ──
	// Bản ghi hiển thị thống nhất (URL đã upload | File chờ upload). Multiple
	// defer: mảng preview riêng KHÔNG trộn vào images (URL); uploadPending()
	// upload từng File rồi gán URL vào images/avatarUrl. Entry URL cũ (edit
	// mode) đồng bộ 2 chiều với images qua $effect. Hủy form = không tốn băng
	// thông hosting (yêu cầu batch 3: chỉ upload khi submit).
	interface DeferEntry {
		preview: string; // objectURL (file mới) hoặc URL (ảnh cũ)
		file?: File; // có = chờ upload
		existing?: string; // URL cũ (edit mode) — remove khỏi images khi bỏ
		/** File pending được đánh dấu "đặt làm đại diện" — áp khi upload xong */
		wantAvatar?: boolean;
		/** Key ổn định cho each (objectURL không hash được) */
		key: number;
	}
	let deferEntries = $state<DeferEntry[]>([]);
	let deferKey = 0; // key tăng dần cho each

	const t = {
		label: { vi: 'Ảnh', en: 'Image' },
		choose: { vi: 'Chọn ảnh', en: 'Choose image' },
		add: { vi: 'Thêm ảnh', en: 'Add image' },
		change: { vi: 'Đổi ảnh', en: 'Change' },
		remove: { vi: 'Xoá ảnh', en: 'Remove image' },
		setAvatar: { vi: 'Đặt làm đại diện', en: 'Set as avatar' },
		avatar: { vi: 'Đại diện', en: 'Avatar' },
		uploading: { vi: 'Đang tải lên...', en: 'Uploading...' },
		empty: { vi: 'Chưa có ảnh', en: 'No image yet' },
		hint: { vi: 'JPEG/PNG/WebP/GIF, tối đa 5MB', en: 'JPEG/PNG/WebP/GIF, max 5MB' },
		copy: { vi: 'Copy URL', en: 'Copy URL' },
		copied: { vi: 'Đã copy', en: 'Copied' },
		view: { vi: 'Xem ảnh', en: 'View image' },
		errType: { vi: 'Chỉ chấp nhận ảnh JPEG/PNG/WebP/GIF', en: 'Only JPEG/PNG/WebP/GIF images are allowed' },
		errSize: { vi: 'Ảnh vượt quá 5MB', en: 'Image exceeds 5MB' },
		errUpload: { vi: 'Tải ảnh lên thất bại', en: 'Image upload failed' },
		errCopy: { vi: 'Không copy được URL', en: 'Failed to copy URL' },
		notConfigured: {
			vi: 'Chưa cấu hình token dịch vụ lưu ảnh (IMAGE_HOST_TOKEN trong .env)',
			en: 'Image hosting token not configured (IMAGE_HOST_TOKEN in .env)'
		}
	} as const;

	function tr(key: keyof typeof t): string {
		return t[key][lang] ?? t[key].en;
	}

	function toastErr(message: string) {
		client.browser?.toasts?.create({ title: tr('errUpload'), description: message, color: 'error' });
		onerror?.(message);
	}

	function pick() {
		if (disabled || uploading) return;
		inputEl?.click();
	}

	// Mode multiple: mở picker — gán vào thumb có sẵn (đổi) hoặc thêm mới
	function pickAt(index: number | undefined) {
		if (disabled || uploading) return;
		uploadTarget = index;
		inputEl?.click();
	}

	async function copyUrl() {
		const url = multiple ? (avatarUrl || images?.[0]) : value;
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			client.browser?.toasts?.create({ title: tr('errCopy'), color: 'error' });
		}
	}

	async function copyUrlAt(index: number) {
		const url = images?.[index];
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			client.browser?.toasts?.create({ title: tr('errCopy'), color: 'error' });
		}
	}

	function viewImage() {
		const url = multiple ? (avatarUrl || images?.[0]) : value;
		if (!url) return;
		window.open(url, '_blank', 'noopener');
	}

	function viewImageAt(index: number) {
		const url = images?.[index];
		if (!url) return;
		window.open(url, '_blank', 'noopener');
	}

	function setAvatarAt(index: number) {
		const url = images?.[index];
		if (!url) return;
		avatarUrl = url;
	}

	// ── DEFER helpers ──
	/** Có file chờ upload nào không (badge "chưa tải lên" / guard submit). */
	const hasPending = $derived(deferEntries.some((en) => !!en.file));

	/** Seed entries từ images (edit mode — open modal). Cha gọi qua bind:this. */
	function seedFromImages(urls: string[]) {
		// Revoke blob cũ + dựng entry URL từ images hiện có
		for (const en of deferEntries) {
			if (en.preview.startsWith('blob:')) URL.revokeObjectURL(en.preview);
		}
		deferEntries = urls.map((url) => ({ preview: url, existing: url, key: deferKey++ }));
	}

	/** Entry đang là avatar (defer): wantAvatar, hoặc preview khớp avatarUrl. */
	function isDeferAvatar(entry: DeferEntry): boolean {
		if (entry.file) return !!entry.wantAvatar;
		return avatarUrl === (entry.existing ?? entry.preview);
	}

	/** Xoá entry defer — revoke objectURL nếu là blob. */
	function removeDeferEntry(entry: DeferEntry) {
		if (entry.preview.startsWith('blob:')) URL.revokeObjectURL(entry.preview);
		deferEntries = deferEntries.filter((en) => en !== entry);
	}

	/** Chọn file (defer) — preview ngay, upload sau. target = index entry đổi thay. */
	function handleDeferFile(file: File, target?: number) {
		const preview = URL.createObjectURL(file);
		if (target !== undefined) {
			// Đổi entry có sẵn: revoke blob cũ nếu có, giữ existing + key
			const old = deferEntries[target];
			if (old) {
				if (old.preview.startsWith('blob:')) URL.revokeObjectURL(old.preview);
				deferEntries[target] = { ...old, preview, file };
			} else {
				deferEntries = [...deferEntries, { preview, file, key: deferKey++ }];
			}
		} else {
			// File đầu (chưa có avatar URL) tự đánh dấu avatar
			const wantAvatar = !deferEntries.some((en) => isDeferAvatar(en));
			deferEntries = [...deferEntries, { preview, file, wantAvatar, key: deferKey++ }];
		}
	}

	/**
	 * Upload tất cả file pending (defer mode) — gọi khi cha SUBMIT.
	 * Không có file → resolve ngay (trả trạng thái hiện có). Lỗi 1 file →
	 * abort + toast, trả undefined (cha giữ modal mở). Thành công: gán URL
	 * vào images (theo existing cũ nếu là thay thế) / avatarUrl, sync value
	 * (single). Trả mảng URLs đầy đủ (multiple) hoặc string (single).
	 */
	async function uploadPending(): Promise<string[] | string | undefined> {
		const pending = deferEntries.filter((en) => en.file);
		if (!pending.length) {
			if (multiple) return images ?? [];
			return value;
		}
		uploading = true;
		try {
			for (const entry of pending) {
				const file = entry.file!;
				const fd = new FormData();
				fd.append('name', file.name);
				fd.append('file', file, file.name);
				const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
				let url: string | undefined;
				let message: string | undefined;
				try {
					const body = (await res.json()) as { ok?: boolean; data?: { url?: string }; message?: { vi?: string; en?: string } };
					url = body.data?.url;
					const m = body.message;
					message = typeof m === 'string' ? m : m?.[lang] ?? m?.en;
				} catch {
					message = `HTTP ${res.status}`;
				}
				if (!res.ok || !url) {
					toastErr(message || `HTTP ${res.status}`);
					return undefined;
				}
				// Thay thế: URL mới chiếm chỗ existing cũ trong images (giữ vị trí);
				// Thêm mới: push cuối.
				const replacing = entry.existing;
				URL.revokeObjectURL(entry.preview);
				entry.preview = url;
				entry.file = undefined;
				entry.existing = url;
				if (multiple && images !== undefined) {
					const next = [...images];
					if (replacing && next.includes(replacing)) {
						next[next.indexOf(replacing)] = url;
					} else {
						next.push(url);
					}
					images = next;
				} else {
					value = url;
				}
				// Avatar: entry muốn avatar → set; hoặc file đầu tiên chưa có avatar
				if (entry.wantAvatar || (!avatarUrl && !replacing)) avatarUrl = url;
				entry.wantAvatar = false;
			}
			if (multiple) return images ?? [];
			return value;
		} catch (err) {
			toastErr(err instanceof Error ? err.message : String(err));
			return undefined;
		} finally {
			uploading = false;
			uploadTarget = undefined;
		}
	}

	// Dọn objectURL khi unmount (tránh leak blob)
	$effect(() => {
		return () => {
			for (const en of deferEntries) {
				if (en.preview.startsWith('blob:')) URL.revokeObjectURL(en.preview);
			}
		};
	});

	async function handleFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // cho phép chọn lại cùng 1 file
		if (!file || uploading) return;

		if (!ALLOWED.includes(file.type)) {
			toastErr(tr('errType'));
			return;
		}
		if (file.size > MAX_SIZE) {
			toastErr(tr('errSize'));
			return;
		}

		// DEFER: preview local, upload khi submit (uploadPending từ cha)
		if (defer) {
			handleDeferFile(file, uploadTarget);
			uploadTarget = undefined;
			return;
		}

		uploading = true;
		try {
			const fd = new FormData();
			fd.append('name', file.name);
			fd.append('file', file, file.name);
			const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
			let url: string | undefined;
			let message: string | undefined;
			try {
				const body = (await res.json()) as { ok?: boolean; data?: { url?: string }; message?: { vi?: string; en?: string } };
				url = body.data?.url;
				const m = body.message;
				message = typeof m === 'string' ? m : m?.[lang] ?? m?.en;
			} catch {
				message = `HTTP ${res.status}`;
			}
			if (res.ok && url) {
				if (multiple && images !== undefined) {
					const next = [...images];
					if (uploadTarget === undefined) {
						// thumb mới — avatar đầu tiên tự làm đại diện
						next.push(url);
						if (!avatarUrl) avatarUrl = url;
					} else {
						// đổi ảnh thumb có sẵn — giữ avatar nếu URL cũ là avatar
						if (avatarUrl === next[uploadTarget]) avatarUrl = url;
						next[uploadTarget] = url;
					}
					images = next;
				} else {
					value = url;
				}
			} else if (res.status === 503) {
				toastErr(message || tr('notConfigured'));
			} else {
				toastErr(message || `HTTP ${res.status}`);
			}
		} catch (err) {
			toastErr(err instanceof Error ? err.message : String(err));
		} finally {
			uploading = false;
			uploadTarget = undefined;
		}
	}

	function clearValue() {
		if (disabled || uploading) return;
		if (defer) {
			// defer: xoá toàn bộ entries + đồng bộ images/avatarUrl về rỗng
			for (const en of deferEntries) {
				if (en.preview.startsWith('blob:')) URL.revokeObjectURL(en.preview);
			}
			deferEntries = [];
			if (multiple) {
				images = [];
				avatarUrl = '';
			} else {
				value = '';
			}
			return;
		}
		if (multiple && images !== undefined) {
			const idx = images.indexOf(avatarUrl);
			images = images.filter((u) => u !== avatarUrl);
			if (idx >= 0) avatarUrl = images[Math.max(0, idx - 1)] ?? '';
		} else {
			value = '';
		}
	}

	function removeAt(index: number) {
		if (disabled || uploading || images === undefined) return;
		const url = images[index];
		const next = images.filter((_, i) => i !== index);
		images = next;
		if (avatarUrl === url) avatarUrl = next[0] ?? '';
	}

	// Xoá entry defer theo key (grid defer)
	function removeDeferAt(key: number) {
		if (disabled || uploading) return;
		const entry = deferEntries.find((en) => en.key === key);
		if (!entry) return;
		// Entry URL cũ → remove khỏi images (edit mode)
		if (entry.existing && images !== undefined) {
			const next = images.filter((u) => u !== entry.existing);
			images = next;
			if (avatarUrl === entry.existing) avatarUrl = next[0] ?? '';
		}
		removeDeferEntry(entry);
	}

	// Set avatar entry defer — file pending: đánh dấu wantAvatar (áp khi upload
	// xong trong uploadPending); entry URL: set avatarUrl ngay.
	function setDeferAvatar(key: number) {
		if (disabled) return;
		const entry = deferEntries.find((en) => en.key === key);
		if (!entry) return;
		if (entry.file) {
			// Chỉ 1 entry wantAvatar tại 1 thời điểm
			for (const en of deferEntries) en.wantAvatar = en === entry;
		} else if (entry.existing) {
			avatarUrl = entry.existing;
		}
	}

	// Expose cho cha (bind:this): seed entries khi mở modal + upload khi submit
	export {
		uploadPending,
		seedFromImages,
		/** Có file chờ upload (cảnh báo "chưa tải lên") */
		hasPending as hasDeferPending
	};
</script>

<div class="image-upload" class:image-upload--disabled={disabled}>
	{#if label}
		<span class="image-upload__label">{label}</span>
	{/if}

	<!-- MODE DEFER (grid preview — file local chờ upload + URL cũ edit mode) -->
	{#if defer}
		<div class="image-upload__grid">
			{#each deferEntries as entry (entry.key)}
				<div class="image-upload__preview" class:image-upload__preview--pending={!!entry.file}>
					<ImageEl src={entry.preview} alt={label || 'image'} width="9.5rem" height="7rem" objectFit="cover" rounded="md" />
					<div class="image-upload__overlay" data-no-tap>
						{#if !entry.file}
							<!-- URL cũ: đủ actions copy/view/đổi -->
							<button
								type="button"
								class="image-upload__ovbtn"
								onclick={async () => {
									const idx = images?.indexOf(entry.preview) ?? -1;
									if (idx >= 0) await copyUrlAt(idx);
								}}
								disabled={disabled}
								title={tr('copy')}
								aria-label={tr('copy')}
							>
								<Icon icon={iconify['content-copy-outline-rounded']} size="sm" />
							</button>
							<button
								type="button"
								class="image-upload__ovbtn"
								onclick={() => window.open(entry.preview, '_blank', 'noopener')}
								disabled={disabled}
								title={tr('view')}
								aria-label={tr('view')}
							>
								<Icon icon={iconify['visibility-outline-rounded']} size="sm" />
							</button>
						{/if}
						<button
							type="button"
							class="image-upload__ovbtn"
							onclick={() => {
								uploadTarget = deferEntries.indexOf(entry);
								inputEl?.click();
							}}
							disabled={disabled}
							title={tr('change')}
							aria-label={tr('change')}
						>
							<Icon icon={iconify['image-outline-rounded']} size="sm" />
						</button>
						<button
							type="button"
							class="image-upload__ovbtn image-upload__ovbtn--avatar"
							class:image-upload__ovbtn--active={isDeferAvatar(entry)}
							onclick={() => setDeferAvatar(entry.key)}
							disabled={disabled}
							title={tr('setAvatar')}
							aria-label={tr('setAvatar')}
						>
							<Icon icon={iconify['person-outline-rounded']} size="sm" />
						</button>
						<button
							type="button"
							class="image-upload__ovbtn image-upload__ovbtn--remove"
							onclick={() => removeDeferAt(entry.key)}
							disabled={disabled}
							title={tr('remove')}
							aria-label={tr('remove')}
						>
							<Icon icon={iconify['close-rounded']} size="sm" />
						</button>
					</div>
					{#if isDeferAvatar(entry)}
						<span class="image-upload__avatar-badge">{tr('avatar')}</span>
					{/if}
					{#if entry.file}
						<span class="image-upload__pending-badge">{lang === 'vi' ? 'Chưa tải lên' : 'Pending'}</span>
					{/if}
				</div>
			{/each}
		</div>
		<div class="image-upload__actions">
			<Button type="button" variant="ghost" color="primary" size="sm" disabled={disabled} onclick={() => pickAt(undefined)}>
				+ {tr('add')}
			</Button>
		</div>
		{#if copied}
			<span class="image-upload__copied image-upload__copied--float">{tr('copied')}</span>
		{/if}
	{:else if multiple}
		<div class="image-upload__grid">
			{#each images ?? [] as url, index (url + index)}
				<div class="image-upload__preview">
					<ImageEl src={url} alt={label || 'image'} width="9.5rem" height="7rem" objectFit="cover" rounded="md" />
					<!-- overlay actions: hiện khi hover (PC) hoặc luôn mờ nhẹ (touch) -->
					<div class="image-upload__overlay" data-no-tap>
						<button
							type="button"
							class="image-upload__ovbtn"
							onclick={() => copyUrlAt(index)}
							disabled={disabled}
							title={tr('copy')}
							aria-label={tr('copy')}
						>
							<Icon icon={iconify['content-copy-outline-rounded']} size="sm" />
						</button>
						<button
							type="button"
							class="image-upload__ovbtn"
							onclick={() => viewImageAt(index)}
							disabled={disabled}
							title={tr('view')}
							aria-label={tr('view')}
						>
							<Icon icon={iconify['visibility-outline-rounded']} size="sm" />
						</button>
						<button
							type="button"
							class="image-upload__ovbtn"
							onclick={() => pickAt(index)}
							disabled={disabled}
							title={tr('change')}
							aria-label={tr('change')}
						>
							<Icon icon={iconify['image-outline-rounded']} size="sm" />
						</button>
						<button
							type="button"
							class="image-upload__ovbtn image-upload__ovbtn--avatar"
							class:image-upload__ovbtn--active={avatarUrl === url}
							onclick={() => setAvatarAt(index)}
							disabled={disabled}
							title={tr('setAvatar')}
							aria-label={tr('setAvatar')}
						>
							<Icon icon={iconify['person-outline-rounded']} size="sm" />
						</button>
						<button
							type="button"
							class="image-upload__ovbtn image-upload__ovbtn--remove"
							onclick={() => removeAt(index)}
							disabled={disabled}
							title={tr('remove')}
							aria-label={tr('remove')}
						>
							<Icon icon={iconify['close-rounded']} size="sm" />
						</button>
					</div>
					{#if avatarUrl === url}
						<span class="image-upload__avatar-badge">{tr('avatar')}</span>
					{/if}
					{#if uploading && uploadTarget === index}
						<div class="image-upload__overlay image-upload__overlay--busy"><Spinner size="md" /></div>
					{/if}
				</div>
			{/each}
		</div>
		<!-- Nút thêm ảnh ở ROW RIÊNG (yêu cầu user) -->
		<div class="image-upload__actions">
			<Button type="button" variant="ghost" color="primary" size="sm" disabled={disabled || uploading} onclick={() => pickAt(undefined)}>
				{uploading && uploadTarget === undefined ? tr('uploading') : `+ ${tr('add')}`}
			</Button>
		</div>
		{#if copied}
			<span class="image-upload__copied image-upload__copied--float">{tr('copied')}</span>
		{/if}
	{:else}
	<div class="image-upload__body">
		{#if uploading}
			<div class="image-upload__preview image-upload__preview--loading">
				<Spinner size="md" />
			</div>
		{:else if value}
			<div class="image-upload__preview">
				<ImageEl src={value} alt={label || 'image'} width="9.5rem" height="7rem" objectFit="cover" rounded="md" />
				<!-- overlay actions: hiện khi hover (PC) hoặc luôn mờ nhẹ (touch) -->
				<div class="image-upload__overlay" data-no-tap>
					<button
						type="button"
						class="image-upload__ovbtn"
						onclick={copyUrl}
						disabled={disabled}
						title={tr('copy')}
						aria-label={tr('copy')}
					>
						<Icon icon={iconify['content-copy-outline-rounded']} size="sm" />
					</button>
					<button
						type="button"
						class="image-upload__ovbtn"
						onclick={viewImage}
						disabled={disabled}
						title={tr('view')}
						aria-label={tr('view')}
					>
						<Icon icon={iconify['visibility-outline-rounded']} size="sm" />
					</button>
					<button
						type="button"
						class="image-upload__ovbtn"
						onclick={pick}
						disabled={disabled}
						title={tr('change')}
						aria-label={tr('change')}
					>
						<Icon icon={iconify['image-outline-rounded']} size="sm" />
					</button>
				</div>
				{#if copied}
					<span class="image-upload__copied">{tr('copied')}</span>
				{/if}
			</div>
		{:else}
			<button
				type="button"
				class="image-upload__empty"
				onclick={pick}
				disabled={disabled || uploading}
				aria-label={tr('choose')}
			>
				<Icon icon="lucide:image-plus" size="lg" />
				<span>{tr('empty')}</span>
			</button>
		{/if}

		<div class="image-upload__actions">
			<Button type="button" variant="ghost" color="primary" size="sm" disabled={disabled || uploading} onclick={pick}>
				{#if uploading}
					{tr('uploading')}
				{:else if value}
					{tr('change')}
				{:else}
					{tr('choose')}
				{/if}
			</Button>
			{#if value && !uploading}
				<Button type="button" variant="ghost" color="error" size="sm" disabled={disabled} onclick={clearValue}>
					{tr('remove')}
				</Button>
			{/if}
		</div>
	</div>
	{/if}

	<span class="image-upload__hint">{tr('hint')}</span>
	{#if showUrl}
		<span class="image-upload__url" title={value}>{value}</span>
	{/if}

	<input
		bind:this={inputEl}
		class="image-upload__input"
		type="file"
		accept={ALLOWED.join(',')}
		onchange={handleFile}
		aria-hidden="true"
		tabindex={-1}
	/>
</div>

<style lang="scss">
	.image-upload {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;

		&--disabled {
			opacity: 0.6;
			pointer-events: none;
		}
	}

	.image-upload__label {
		font-size: 0.85rem;
		color: var(--foreground-500);
	}

	.image-upload__body {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.image-upload__preview {
		flex-shrink: 0;
		border: 1px solid var(--default-200);
		border-radius: 0.5rem;
		overflow: hidden;
		position: relative;

		&--loading {
			width: 9.5rem;
			height: 7rem;
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--background-100, var(--background));
		}

		&:hover .image-upload__overlay {
			opacity: 1;
		}
	}

	.image-upload__overlay {
		position: absolute;
		inset: 0;
		z-index: 2; // img (Avatar.Image) z-index:1 absolute — overlay phải nằm trên img mới hover hiện được
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		background: rgb(0 0 0 / 0.45);
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	/* Touch không có hover: overlay mờ nhẹ luôn hiện để vẫn bấm được */
	@media (hover: none) {
		.image-upload__overlay {
			opacity: 1;
			background: linear-gradient(to top, rgb(0 0 0 / 0.35), transparent);
		}
	}

	.image-upload__ovbtn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.9rem;
		height: 1.9rem;
		border: none;
		border-radius: 0.4rem;
		background: rgb(255 255 255 / 0.92);
		color: var(--foreground-700, #27272a);
		cursor: pointer;
		transition: background 0.12s ease, transform 0.12s ease;

		&:hover:not(:disabled) {
			background: #fff;
			transform: scale(1.08);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	.image-upload__copied {
		position: absolute;
		left: 50%;
		bottom: 0.35rem;
		transform: translateX(-50%);
		font-size: 0.68rem;
		padding: 0.1rem 0.45rem;
		border-radius: 0.3rem;
		background: var(--primary-600, #16a34a);
		color: #fff;
		pointer-events: none;
	}

	.image-upload__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		width: 9.5rem;
		height: 7rem;
		border: 1px dashed var(--default-300);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--foreground-500);
		font-size: 0.8rem;
		cursor: pointer;

		&:hover:not(:disabled) {
			border-color: var(--primary-400);
			color: var(--primary-600);
		}
	}

	.image-upload__actions {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.25rem;
	}

	.image-upload__hint {
		font-size: 0.72rem;
		color: var(--foreground-500);
	}

	.image-upload__url {
		font-size: 0.7rem;
		color: var(--foreground-500);
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.image-upload__input {
		/* visually hidden — input file thật để trigger từ nút */
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	/* ── MODE MULTIPLE ── */
	.image-upload__grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.image-upload__ovbtn--remove {
		&:hover:not(:disabled) {
			background: var(--error);
			color: #fff;
		}
	}

	.image-upload__ovbtn--avatar {
		&:hover:not(:disabled) {
			background: var(--primary);
			color: #fff;
		}
	}

	.image-upload__ovbtn--active {
		background: var(--primary);
		color: #fff;
	}

	.image-upload__avatar-badge {
		position: absolute;
		left: 0.35rem;
		top: 0.35rem;
		font-size: 0.65rem;
		padding: 0.08rem 0.4rem;
		border-radius: 9999px;
		background: var(--primary);
		color: #fff;
		pointer-events: none;
	}

	/* DEFER: badge file chờ upload — góc phải dưới, nền warning nổi trên ảnh */
	.image-upload__pending-badge {
		position: absolute;
		right: 0.35rem;
		bottom: 0.35rem;
		font-size: 0.65rem;
		padding: 0.08rem 0.4rem;
		border-radius: 9999px;
		background: var(--warning, #f59e0b);
		color: #fff;
		pointer-events: none;
	}

	/* DEFER: viền amber nét đứt cho thumb chưa upload — phân biệt với ảnh cũ */
	.image-upload__preview--pending {
		outline: 1.5px dashed var(--warning, #f59e0b);
		outline-offset: -1.5px;
	}

	.image-upload__overlay--busy {
		opacity: 1;
		background: rgb(0 0 0 / 0.35);
	}

	.image-upload__copied--float {
		position: static;
		transform: none;
		align-self: flex-start;
	}
</style>
