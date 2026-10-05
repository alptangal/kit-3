<script lang="ts">
	// src/routes/ui/alert/+page.svelte
	// Demo Alert — inline notification element: semantic color, icon default/custom,
	// title + description, description-only, rich content qua snippet children.
	import { Alert } from '$components/element';
	import type { TranslateContent } from '$interfaces/basic';

	const t = (en: string, vi: string): TranslateContent => ({ en, vi });
</script>

<div class="page" data-test="alert-demo">
	<h1 class="page-title">Alert · thông báo inline (info / cảnh báo / lỗi / thành công)</h1>

	<section class="demo" data-test="al-variants">
		<h2>Color (default / primary / success / warning / error)</h2>
		<p class="demo-hint">Mỗi màu 1 semantic — title + description + icon default theo màu</p>

		<div data-test="al-default">
			<Alert color="default" title={t('Note', 'Ghi chú')} description={t('This is a neutral note.', 'Đây là ghi chú trung tính.')} />
		</div>
		<div data-test="al-primary">
			<Alert color="primary" title={t('Announcement', 'Thông báo')} description={t('A new feature is available.', 'Tính năng mới đã có sẵn.')} />
		</div>
		<div data-test="al-success">
			<Alert color="success" title={t('Saved', 'Đã lưu')} description={t('Your changes were saved.', 'Thay đổi của bạn đã được lưu.')} />
		</div>
		<div data-test="al-warning">
			<Alert color="warning" title={t('Heads up', 'Cảnh báo')} description={t('Your trial expires in 3 days.', 'Gói dùng thử của bạn hết hạn sau 3 ngày.')} />
		</div>
		<div data-test="al-error">
			<Alert color="error" title={t('Failed', 'Thất bại')} description={t('Something went wrong. Try again.', 'Có lỗi xảy ra. Hãy thử lại.')} />
		</div>
	</section>

	<section class="demo" data-test="al-custom">
		<h2>Icon custom + description-only + children</h2>
		<p class="demo-hint">icon iconify tùy chọn; description-only (không title); rich content qua snippet</p>

		<div data-test="al-icon">
			<Alert color="info" icon="lucide:rocket" title={t('Ship it', 'Phóng tên lửa')} description={t('Deployed to production.', 'Đã triển khai lên production.')} />
		</div>
		<div data-test="al-description-only">
			<Alert color="default" description={t('Only a description, no title.', 'Chỉ có mô tả, không có tiêu đề.')} />
		</div>
		<div data-test="al-children">
			<Alert color="success" title={t('Upgrade complete', 'Nâng cấp hoàn tất')}>
				<span class="alert-children-text" data-test="al-children-text">Extra rich content via children snippet.</span>
			</Alert>
		</div>
	</section>

	<section class="demo" data-test="al-states">
		<h2>Size + Disabled</h2>
		<p class="demo-hint">token size-* (sm / md / lg) + disabled (opacity token)</p>
		<div data-test="al-size">
			<Alert size="sm" color="info" title={t('Small', 'Nhỏ')} />
			<Alert size="md" color="info" title={t('Medium', 'Vừa')} />
			<Alert size="lg" color="info" title={t('Large', 'Lớn')} />
		</div>
		<div data-test="al-disabled">
			<Alert
				color="default"
				disabled
				title={t('Disabled', 'Không hoạt động')}
				description={t('Muted state via --disabled-opacity.', 'Trạng thái mờ qua --disabled-opacity.')}
			/>
		</div>
	</section>
</div>

<style lang="scss">
	.page {
		max-width: 42rem;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.page-title {
		font-size: 1.375rem;
		font-weight: 700;
	}

	.demo {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		> [data-test] {
			display: flex;
			flex-direction: column;
			gap: 0.625rem;
		}
	}

	.demo-hint {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
	}

	h2 {
		font-size: 1rem;
		font-weight: 600;
	}

	.alert-children-text {
		font-size: 0.875em;
	}
</style>
