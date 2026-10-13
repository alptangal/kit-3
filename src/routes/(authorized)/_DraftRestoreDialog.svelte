<!-- src/routes/(authorized)/_DraftRestoreDialog.svelte -->
<!-- Dialog khôi phục bản nháp dùng chung cho mọi form autosave draft. -->
<!-- AlertDialog controlled: click nền KHÔNG đóng (tránh Bỏ qua vô tình), -->
<!-- Escape đóng nhưng GIỮ draft (hỏi lại lần sau khi mở form). -->
<script lang="ts">
	import { AlertDialog } from '$components/element';
	import { flushAllDrafts } from '$modules/draft-store';
	import { onMount } from 'svelte';

	let {
		display = $bindable(false),
		/** Gọi khi user chọn Khôi phục (draft data do caller tự đọc). */
		onRestore,
		/** Gọi khi user chọn Bỏ qua — caller clearDraft vĩnh viễn. */
		onDiscard,
		/** Ngôn ngữ hiển thị (mặc định vi). */
		lang = 'vi'
	}: {
		display?: boolean;
		onRestore: () => void;
		onDiscard: () => void;
		lang?: 'vi' | 'en';
	} = $props();

	const contents = {
		title: { vi: 'Phát hiện bản nháp', en: 'Draft found' },
		description: {
			vi: 'Form này có bản nháp chưa lưu từ lần trước. Khôi phục để tiếp tục chỉnh sửa?',
			en: 'This form has an unsaved draft from a previous session. Restore it?'
		},
		restore: { vi: 'Khôi phục', en: 'Restore' },
		discard: { vi: 'Bỏ qua', en: 'Discard' }
	};

	// Flush timer debounce còn treo trước khi rời trang (draft tail 500ms).
	onMount(() => {
		const handler = () => flushAllDrafts();
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	});

	function handleRestore() {
		display = false;
		onRestore();
	}

	function handleDiscard() {
		display = false;
		onDiscard();
	}
</script>

<AlertDialog bind:open={display} data-test="draft-restore-dialog">
	<AlertDialog.Content>
		<AlertDialog.Header variant="info">
			<AlertDialog.Title>{contents.title[lang]}</AlertDialog.Title>
			<AlertDialog.Description>{contents.description[lang]}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel data-test="draft-restore-discard" onclick={handleDiscard}>
				{contents.discard[lang]}
			</AlertDialog.Cancel>
			<AlertDialog.Action data-test="draft-restore-restore" color="primary" onselect={handleRestore}>
				{contents.restore[lang]}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog>
