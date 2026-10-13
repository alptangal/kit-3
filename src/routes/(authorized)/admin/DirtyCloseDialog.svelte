<script lang="ts">
	// DirtyCloseDialog.svelte — dialog xác nhận "bỏ thay đổi?" dùng chung cho
	// các modal form admin (P3 confirm-dirty). Dùng AlertDialog component của
	// hệ thống; `open` là $bindable để trang bind:open. Nút "Bỏ thay đổi" (Action)
	// gọi onDiscard (trang tự đóng modal + reset form); "Tiếp tục chỉnh sửa"
	// (Cancel) chỉ đóng dialog. Theo API AlertDialog hệ thống, Action = nút
	// chính (bên phải, màu primary), Cancel = nút phụ (bên trái).
	import {
		AlertDialog
	} from '$lib/components/element/alert-dialog';
	import type { TranslateContent } from '$interfaces/basic';

	let {
		open = $bindable(),
		title,
		description,
		discardLabel,
		continueLabel,
		onDiscard
	}: {
		open: boolean;
		title: TranslateContent | string;
		description?: TranslateContent | string;
		discardLabel: string;
		continueLabel: string;
		onDiscard: () => void;
	} = $props();

	// Bọc onclick của Action: Action tự gọi ctx.close() sau onClick — bind:open
	// xử lý đồng bộ open=false về trang. onDiscard do trang cung cấp (đóng
	// modal + reset form, gọi từ closeGuard.confirmDiscard).
	function handleDiscard() {
		onDiscard();
	}
</script>

<AlertDialog bind:open>
	<AlertDialog.Content>
		<AlertDialog.Header variant="info">
			<AlertDialog.Title>{title}</AlertDialog.Title>
			<AlertDialog.Description>{description}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{continueLabel}</AlertDialog.Cancel>
			<AlertDialog.Action color="primary" onclick={handleDiscard}>{discardLabel}</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog>