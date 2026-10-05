<!-- src/routes/ui/breadcrumb/+page.svelte -->
<script lang="ts">
	import { Breadcrumb } from '$components/navigation';
	import { Icon, Separator } from '$components/element';
</script>

<div class="page" data-test="breadcrumb-demo">
	<h1 class="page-title">Breadcrumb · điều hướng hạng</h1>

	<section class="demo">
		<h2>Tự derive từ URL (<code>$app/state</code> page.url)</h2>
		<p class="demo-hint">
			Trang này là <code>/ui/breadcrumb</code> → breadcrumb sinh: Trang chủ › UI › Breadcrumb.
			Item cuối (<strong>Breadcrumb</strong>) là <code>aria-current="page"</code>, không link.
			<em>Fix P2:</em> separator giờ render TRƯỚC cả item current.
		</p>
		<Breadcrumb />
	</section>

	<Separator />

	<section class="demo" data-test="bc-custom">
		<h2>Custom items (i18n + external link)</h2>
		<Breadcrumb
			items={[
				{ label: { en: 'Home', vi: 'Trang chủ' }, href: '/' },
				{ label: 'Tài liệu', href: '/docs' },
				{ label: 'API', href: 'https://example.com/api' },
				{ label: 'Tổng quan' }
			]}
		/>
		<p class="demo-hint">
			Item <em>API</em> là external (https) → mở tab mới (<code>target="_blank" rel="noopener"</code>).
		</p>
	</section>

	<Separator />

	<section class="demo" data-test="bc-icon">
		<h2>Icon + description (Tooltip)</h2>
		<Breadcrumb
			items={[
				{ label: 'Trang chủ', href: '/', icon: 'lucide:home' },
				{
					label: 'Dự án',
					href: '/projects',
					icon: 'lucide:briefcase',
					description: 'Quản lý danh mục dự án'
				},
				{ label: 'Nhiệm vụ', href: '/projects/tasks', icon: 'lucide:check-square' },
				{ label: 'TASK-42', icon: 'lucide:flag', description: 'Mô tả hiện trong Tooltip khi hover' }
			]}
		/>
		<p class="demo-hint">
			Mỗi item có <code>icon</code> (iconify) + <code>description</code> — description hiện
			Tooltip khi hover. Hover item "Dự án" hoặc "TASK-42" để thấy.
		</p>
	</section>

	<Separator />

	<section class="demo" data-test="bc-separator">
		<h2>Tùy biến separator (string + Snippet)</h2>
		<p class="demo-hint">Global separator là chuỗi <code>/</code>:</p>
		<Breadcrumb
			separator="/"
			items={[
				{ label: 'Trang chủ', href: '/' },
				{ label: 'Hồ sơ', href: '/profile' },
				{ label: 'Thiết lập' }
			]}
		/>
		<p class="demo-hint">Separator per-item (item 2 dùng chevron icon, ghi đè global):</p>
		{#snippet chevronSep()}
			<Icon icon="lucide:chevron-right" class="bc-cust-sep" />
		{/snippet}
		<Breadcrumb
			separator="→"
			items={[
				{ label: 'Trang chủ', href: '/' },
				{ label: 'Hồ sơ', href: '/profile', separator: chevronSep },
				{ label: 'Thiết lập' }
			]}
		/>
	</section>

	<Separator />

	<section class="demo" data-test="bc-disabled">
		<h2>Disabled (whole nav)</h2>
		<p class="demo-hint">
			Root <code>disabled</code> → khóa toàn nav: opacity giảm,
			<code>cursor: var(--cursor-disabled)</code> (probe P0),
			<code>pointer-events: none</code> giữ nguyên.
		</p>
		<Breadcrumb
			disabled
			items={[
				{ label: 'Trang chủ', href: '/' },
				{ label: 'UI', href: '/ui' },
				{ label: 'Breadcrumb' }
			]}
		/>
	</section>

	<Separator />

	<section class="demo" data-test="bc-ellipsis">
		<h2>Ellipsis (maxItems) — thu gọn hạng giữa</h2>
		<p class="demo-hint">
			7 hạng nhưng <code>maxItems={3}</code> → giữ hạng đầu + hạng cuối, gộp 4 hạng giữa
			thành nút <code>…</code>. Bấm <code>…</code> để mở menu chọn hạng trung gian.
		</p>
		<Breadcrumb
			maxItems={3}
			items={[
				{ label: 'Trang chủ', href: '/', icon: 'lucide:home' },
				{ label: 'Khu vực', href: '/region' },
				{ label: 'Tổ chức', href: '/region/org' },
				{ label: 'Nhóm', href: '/region/org/team' },
				{ label: 'Dự án', href: '/region/org/team/project' },
				{ label: 'Lượt chạy', href: '/region/org/team/project/run' },
				{ label: 'build-1287' }
			]}
		/>
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
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--foreground);
		margin: 0;
	}

	.demo {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.demo h2 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}

	.demo-hint {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
		line-height: 1.5;
		margin: 0;
	}

	/* Icon trong separator per-item — render trong component Icon (hash riêng) → :global */
	:global(.bc-cust-sep) {
		display: inline-flex;
		width: 0.875rem;
		height: 0.875rem;
	}

	code {
		font-size: 0.8125rem;
		background: var(--content2, hsl(240 4.76% 95.88%));
		padding: 0.125rem 0.375rem;
		border-radius: var(--border-radius-sm, 0.25rem);
	}

	@media (prefers-color-scheme: dark) {
		.demo-hint {
			color: hsl(240 5.03% 64.9%);
		}
	}
</style>
