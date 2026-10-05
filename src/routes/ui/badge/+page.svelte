<script lang="ts">
	// src/routes/ui/badge/+page.svelte
	// Demo Badge — matrix variant × color, dot, icon, size, as="a"/"button", default.
	import { Badge } from '$components/element';

	const variants: ('soft' | 'solid' | 'outline' | 'ghost')[] = ['soft', 'solid', 'outline', 'ghost'];
	const colors: ('default' | 'success' | 'warning' | 'primary')[] = ['default', 'success', 'warning', 'primary'];
</script>

<div class="page" data-test="badge-demo">
	<h1 class="page-title">Badge · pill/chip cho trạng thái, phân loại, số lượng</h1>

	<section class="demo" data-test="bd-variant">
		<h2>Variant × Color (mỗi hàng 1 variant)</h2>
		<p class="demo-hint">4 variant × 4 màu — soft / solid / outline / ghost</p>
		{#each variants as variant}
			<div class="row">
				<span class="row-label">{variant}</span>
				{#each colors as color}
					<Badge {variant} {color} label={color} />
				{/each}
			</div>
		{/each}
	</section>

	<section class="demo" data-test="bd-dot">
		<h2>Dot + Icon</h2>
		<p class="demo-hint">dot tròn bám màu --color; icon iconify đứng trước label</p>
		<div class="row">
			<Badge dot label="Đang hoạt động" color="success" />
			<Badge dot label="Lỗi" color="error" />
			<Badge dot label="Chờ duyệt" color="warning" />
			<Badge icon="ph:star-fill" label="Yêu thích" />
			<Badge icon="ph:bell" label="Thông báo" color="info" />
		</div>
	</section>

	<section class="demo" data-test="bd-size">
		<h2>Size (xs / sm / md)</h2>
		<p class="demo-hint">badge bám token size-* (font/padding/radius)</p>
		<div class="row">
			<Badge size="xs" label="xs" />
			<Badge size="sm" label="sm" />
			<Badge size="md" label="md" />
		</div>
	</section>

	<section class="demo" data-test="bd-link">
		<h2>as="a" / as="button"</h2>
		<p class="demo-hint">a kèm href; button render type="button"</p>
		<div class="row">
			<Badge as="a" href="#" label="Xem tài liệu" />
			<Badge as="button" label="Xóa bộ lọc" color="default" />
			<Badge as="a" href="#" dot label="Cấp mới" color="success" />
		</div>
	</section>

	<section class="demo" data-test="bd-default">
		<h2>Default + Disabled + Inline</h2>
		<p class="demo-hint">default = soft / primary / sm; badge inline trong câu</p>
		<div class="row">
			<Badge label="Default" />
			<Badge disabled label="Disabled" />
			<Badge class="bd-custom" label="Class riêng" color="info" data-test="bd-class" />
		</div>
		<p class="inline-demo">
			Hôm nay có
			<Badge color="warning" label="3 ticket" />
			đang chờ xử lý trong bảng việc.
		</p>
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

		h2 {
			font-size: 1rem;
			font-weight: 600;
		}
	}

	.demo-hint {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
	}

	.row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.625rem;
		padding: 0.5rem 0;
	}

	.row-label {
		width: 4.5rem;
		font-size: 0.75rem;
		color: var(--muted, var(--foreground));
	}

	.inline-demo {
		font-size: 0.9375rem;
	}
</style>
