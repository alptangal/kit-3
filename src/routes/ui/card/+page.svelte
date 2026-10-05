<!-- src/routes/ui/card/+page.svelte -->
<script lang="ts">
	import { Button, Card } from '$components/element';

	// Placeholder ảnh sản phẩm: inline SVG data-URI (không phụ thuộc network).
	// Escape %23 cho dấu # trong URL (màu stroke).
	const productArt = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'><rect width='640' height='360' fill='none'/><circle cx='520' cy='80' r='46' fill='%23ffffff' opacity='0.55'/><path d='M0 268 L140 160 L260 240 L400 120 L560 230 L640 190 L640 360 L0 360 Z' fill='%23ffffff' opacity='0.4'/><path d='M0 300 L180 210 L340 280 L520 180 L640 250 L640 360 L0 360 Z' fill='%23ffffff' opacity='0.5'/></svg>`;
</script>

<div class="page" data-test="card-demo">
	<h1 class="page-title">Card · composite surface</h1>

	<!-- (a) Product card -->
	<section class="demo">
		<h2>Product card</h2>
		<p class="demo-hint">Ảnh 16:9 (bg --content2 + SVG placeholder) + title + description + 2 nút footer + action ⋮.</p>
		<Card class="card-demo-card" data-test="cd-product">
			<figure class="product-image" aria-hidden="true">
				<img src={productArt} alt="" loading="lazy" decoding="async" />
			</figure>
			<Card.Header>
				<div class="heading-text">
					<Card.Title>Sản phẩm A</Card.Title>
					<Card.Description>
						Mô tả ngắn gọn cho sản phẩm — dùng để thể hiện thông tin phụ bên dưới title.
					</Card.Description>
				</div>
				<Card.Action>
					<Button variant="ghost" size="xs" rounded="full" aria-label="Hành động thêm">
						<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
							<circle cx="12" cy="5" r="1.9" />
							<circle cx="12" cy="12" r="1.9" />
							<circle cx="12" cy="19" r="1.9" />
						</svg>
					</Button>
				</Card.Action>
			</Card.Header>
			<Card.Content>
				<p class="product-meta">SKU: PROD-A-001 · Tồn kho: 24</p>
				<p class="product-price">2.450.000₫</p>
			</Card.Content>
			<Card.Footer>
				<Button variant="solid" size="sm" color="primary">Thêm vào giỏ</Button>
				<Button variant="outline" size="sm">Xem chi tiết</Button>
			</Card.Footer>
		</Card>
	</section>

	<!-- (b) Settings card -->
	<section class="demo">
		<h2>Settings card</h2>
		<p class="demo-hint">Header + content danh sách 3 dòng + footer button.</p>
		<Card data-test="cd-settings">
			<Card.Header>
				<div class="heading-text">
					<Card.Title>Cài đặt thông báo</Card.Title>
					<Card.Description>Quản lý kênh và tần suất thông báo.</Card.Description>
				</div>
			</Card.Header>
			<Card.Content>
				<ul class="settings-list">
					<li>
						<span class="settings-label">Email hàng tuần</span>
						<span class="settings-value">Bật</span>
					</li>
					<li>
						<span class="settings-label">Bản tin sản phẩm</span>
						<span class="settings-value">Tắt</span>
					</li>
					<li>
						<span class="settings-label">Nhắc deadline</span>
						<span class="settings-value">Mỗi ngày</span>
					</li>
				</ul>
			</Card.Content>
			<Card.Footer>
				<Button variant="outline" size="sm">Lưu thay đổi</Button>
			</Card.Footer>
		</Card>
	</section>

	<!-- (c) Raised + as=section + aria-label -->
	<section class="demo">
		<h2>Elevation raised + as="section"</h2>
		<p class="demo-hint">Card nổi (border + box-shadow token), tag &lt;section&gt; có aria-label cho screen reader.</p>
		<Card elevation="raised" as="section" aria-label="Tóm tắt doanh thu" data-test="cd-raised">
			<Card.Header>
				<div class="heading-text">
					<Card.Title>Doanh thu tháng</Card.Title>
					<Card.Description>Cập nhật 5 phút trước</Card.Description>
				</div>
			</Card.Header>
			<Card.Content>
				<p class="metric">128.500.000₫</p>
				<p class="metric-delta up">+12% so với tháng trước</p>
			</Card.Content>
		</Card>
	</section>

	<!-- (d) Minimal -->
	<section class="demo">
		<h2>Card minimal (elevation="none")</h2>
		<p class="demo-hint">Chỉ title + content, elevation none — trong suốt không border.</p>
		<Card elevation="none" data-test="cd-minimal">
			<Card.Header>
				<Card.Title>Ghi chú nhanh</Card.Title>
			</Card.Header>
			<Card.Content>
				<p class="note-text">Không footer, không action — card tối giản nhất.</p>
			</Card.Content>
		</Card>
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
		margin: 0;
	}

	.product-image {
		width: 100%;
		aspect-ratio: 16 / 9;
		margin: 0;
		padding: 0;
		background-color: var(--content2, hsl(240 4.76% 95.88%));
		overflow: hidden;

		// bo góc trên theo card (content p-0, ảnh chạm mép)
		border-radius: var(--border-radius-lg, 0.5rem) var(--border-radius-lg, 0.5rem) 0 0;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
			display: block;
		}
	}

	.heading-text {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		// Natural width + shrink (không stretch) → .card-action (margin-inline-start auto)
		// thực sự bị đẩy ra mép phải cùng hàng. min-width 0 cho phép text dài wrap nội bộ.
		flex: 0 1 auto;
		min-width: 0;
	}

	.product-meta {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
		margin: 0 0 0.375rem;
	}

	.product-price {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--foreground);
		margin: 0;
	}

	.settings-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;

		li {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1rem;
			padding: 0.625rem 0;
			font-size: 0.875rem;
			color: var(--foreground);

			& + li {
				border-top: 1px solid var(--content3, hsl(240 5.88% 90%));
			}
		}

		.settings-value {
			color: var(--muted, var(--foreground));
			font-size: 0.8125rem;
		}
	}

	.metric {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--foreground);
		margin: 0;
	}

	.metric-delta {
		font-size: 0.875rem;
		margin: 0.25rem 0 0;

		&.up {
			color: var(--success, var(--muted));
		}
	}

	.note-text {
		font-size: 0.875rem;
		color: var(--foreground);
		margin: 0;
	}

	@media (prefers-color-scheme: dark) {
		.settings-list li + li {
			border-top-color: hsl(240 5.88% 20%);
		}
	}
</style>
