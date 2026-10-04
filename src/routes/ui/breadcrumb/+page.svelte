<!-- src/routes/ui/breadcrumb/+page.svelte -->
<script lang="ts">
	import { Breadcrumb } from '$components/navigation';
	import { Separator } from '$components/element';
</script>

<div class="page" data-test="breadcrumb-demo">
	<h1 class="page-title">Breadcrumb · điều hướng hạng</h1>

	<section class="demo">
		<h2>Tự derive từ URL (<code>$app/state</code> page.url)</h2>
		<p class="demo-hint">
			Trang này là <code>/ui/breadcrumb</code> → breadcrumb sinh: Trang chủ › UI › Breadcrumb.
			Item cuối (<strong>Breadcrumb</strong>) là <code>aria-current="page"</code>, không link.
		</p>
		<Breadcrumb />
	</section>

	<Separator />

	<section class="demo">
		<h2>Custom items (i18n label + external link)</h2>
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

	<section class="demo">
		<h2>Độ sâu 4 hạng</h2>
		<Breadcrumb
			items={[
				{ label: { en: 'Home', vi: 'Trang chủ' }, href: '/' },
				{ label: 'Cấu hình', href: '/config' },
				{ label: 'Bảo mật', href: '/config/security' },
				{ label: 'Mật khẩu' }
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
