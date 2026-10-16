<!-- src/lib/components/form/image-upload/Main.svelte -->
<!-- ImageUpload — chọn file ảnh + upload thẳng lên hosting ngoài qua
     POST /api/admin/upload (multipart, fetch thường KHÔNG mã hoá) + preview + xoá.
     bind:value = URL ảnh (lưu vào field DB hiện có — products.imageUrl, posts.coverImageUrl). -->
<script lang="ts" module>
	export interface ImageUploadProps {
		/** URL ảnh hiện tại (2 chiều — parent bind:value) */
		value?: string;
		/** Nhãn hiển thị */
		label?: string;
		/** Vô hiệu hoá (vd đang submitting form cha) */
		disabled?: boolean;
		/** Callback lỗi đã xử lý xong (đã toast nội bộ — hook để cha tự xử lý thêm) */
		onerror?: (message: string) => void;
	}
</script>

<script lang="ts">
	import { Button, Icon, Image as ImageEl, Spinner } from '$components/element';
	import { client } from '$store/basic.svelte';

	let { value = $bindable(''), label = '', disabled = false, onerror }: ImageUploadProps = $props();

	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : 'en');

	const MAX_SIZE = 5 * 1024 * 1024; // 5MB — khớp route /api/admin/upload
	const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

	let uploading = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();

	const t = {
		label: { vi: 'Ảnh', en: 'Image' },
		choose: { vi: 'Chọn ảnh', en: 'Choose image' },
		change: { vi: 'Đổi ảnh', en: 'Change' },
		remove: { vi: 'Xoá ảnh', en: 'Remove image' },
		uploading: { vi: 'Đang tải lên...', en: 'Uploading...' },
		empty: { vi: 'Chưa có ảnh', en: 'No image yet' },
		hint: { vi: 'JPEG/PNG/WebP/GIF, tối đa 5MB', en: 'JPEG/PNG/WebP/GIF, max 5MB' },
		errType: { vi: 'Chỉ chấp nhận ảnh JPEG/PNG/WebP/GIF', en: 'Only JPEG/PNG/WebP/GIF images are allowed' },
		errSize: { vi: 'Ảnh vượt quá 5MB', en: 'Image exceeds 5MB' },
		errUpload: { vi: 'Tải ảnh lên thất bại', en: 'Image upload failed' },
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
				value = url;
			} else if (res.status === 503) {
				toastErr(message || tr('notConfigured'));
			} else {
				toastErr(message || `HTTP ${res.status}`);
			}
		} catch (err) {
			toastErr(err instanceof Error ? err.message : String(err));
		} finally {
			uploading = false;
		}
	}

	function clearValue() {
		if (disabled || uploading) return;
		value = '';
	}
</script>

<div class="image-upload" class:image-upload--disabled={disabled}>
	{#if label || tr('label')}
		<span class="image-upload__label">{label || tr('label')}</span>
	{/if}

	<div class="image-upload__body">
		{#if uploading}
			<div class="image-upload__preview image-upload__preview--loading">
				<Spinner size="md" />
			</div>
		{:else if value}
			<div class="image-upload__preview">
				<ImageEl src={value} alt={label || 'image'} width="9.5rem" height="7rem" objectFit="cover" rounded="md" />
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

	<span class="image-upload__hint">{tr('hint')}</span>
	<span class="image-upload__url" title={value}>{value}</span>

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

		&--loading {
			width: 9.5rem;
			height: 7rem;
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--background-100, var(--background));
		}
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
</style>
