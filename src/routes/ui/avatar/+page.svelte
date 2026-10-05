<!-- src/routes/ui/avatar/+page.svelte -->
<script lang="ts">
	import { Avatar } from '$components/element';

	// Ảnh thật (không phụ thuộc network): inline SVG data-URI — gradient + chữ "A".
	// Escape %23 cho dấu # trong URL (gradient stops).
	const avatarArt = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%236366f1'/><stop offset='1' stop-color='%2306b6d4'/></linearGradient></defs><rect width='96' height='96' fill='url(%23g)'/><text x='48' y='56' text-anchor='middle' dominant-baseline='middle' font-family='Arial, sans-serif' font-size='44' font-weight='700' fill='white'>A</text></svg>`;
</script>

<div class="page" data-test="avatar-demo">
	<h1 class="page-title">Avatar · composite (Image + Fallback)</h1>

	<!-- (a) Loaded — ảnh data-URI thật -->
	<section class="demo">
		<h2>Ảnh loaded (data-URI SVG)</h2>
		<p class="demo-hint">
			Avatar.Image với src hợp lệ → onload → class is-loaded, fallback fade out.
		</p>
		<div class="row" data-test="av-loaded">
			<Avatar alt="ACME Inc" aria-label="Công ty ACME Inc">
				<Avatar.Image src={avatarArt} />
				<Avatar.Fallback>AI</Avatar.Fallback>
			</Avatar>
		</div>
	</section>

	<!-- (b) Error — src hỏng -->
	<section class="demo">
		<h2>Ảnh lỗi (src invalid)</h2>
		<p class="demo-hint">onerror → state 'error' (class is-error) — fallback hiện initials từ alt.</p>
		<div class="row" data-test="av-error">
			<Avatar alt="Nguyễn Văn A">
				<Avatar.Image src="data:,invalid" />
				<Avatar.Fallback />
			</Avatar>
		</div>
	</section>

	<!-- (c) Không src → initials tự động -->
	<section class="demo">
		<h2>Không src → initials tự động</h2>
		<p class="demo-hint">alt "Nguyễn Văn A" → "NA" (chữ đầu word đầu + word cuối, uppercase).</p>
		<div class="row" data-test="av-initials">
			<Avatar alt="Nguyễn Văn A">
				<Avatar.Image />
				<Avatar.Fallback />
			</Avatar>
		</div>
	</section>

	<!-- (d) Fallback tùy chỉnh (slot) -->
	<section class="demo">
		<h2>Fallback tùy chỉnh (slot)</h2>
		<p class="demo-hint">Avatar.Fallback nhận slot — icon/emoji tự do, không render initials.</p>
		<div class="row" data-test="av-custom">
			<Avatar alt="Trợ lý ảo">
				<Avatar.Image />
				<Avatar.Fallback>
					<span aria-hidden="true">🤖</span>
				</Avatar.Fallback>
			</Avatar>
		</div>
	</section>

	<!-- (e) Size matrix xs → xl -->
	<section class="demo">
		<h2>Size matrix (xs → xl)</h2>
		<p class="demo-hint">--avatar-size: xs 24 / sm 32 / md 40 / lg 48 / xl 64 px.</p>
		<div class="row align-end" data-test="av-size">
			<Avatar size="xs" alt="XS 24">
				<Avatar.Image />
				<Avatar.Fallback />
			</Avatar>
			<Avatar size="sm" alt="SM 32">
				<Avatar.Image />
				<Avatar.Fallback />
			</Avatar>
			<Avatar size="md" alt="MD 40">
				<Avatar.Image />
				<Avatar.Fallback />
			</Avatar>
			<Avatar size="lg" alt="LG 48">
				<Avatar.Image />
				<Avatar.Fallback />
			</Avatar>
			<Avatar size="xl" alt="XL 64">
				<Avatar.Image />
				<Avatar.Fallback />
			</Avatar>
		</div>
	</section>

	<!-- (f) Shape: circle / rounded / square -->
	<section class="demo">
		<h2>Shape (circle / rounded / square)</h2>
		<p class="demo-hint">border-radius: circle 50% / rounded --border-radius-lg / square 0.</p>
		<div class="row align-end" data-test="av-shape">
			<Avatar shape="circle" alt="Circle" aria-label="Avatar hình tròn">
				<Avatar.Image src={avatarArt} />
				<Avatar.Fallback />
			</Avatar>
			<Avatar shape="rounded" alt="Rounded" aria-label="Avatar bo góc">
				<Avatar.Image src={avatarArt} />
				<Avatar.Fallback />
			</Avatar>
			<Avatar shape="square" alt="Square" aria-label="Avatar vuông">
				<Avatar.Image src={avatarArt} />
				<Avatar.Fallback />
			</Avatar>
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

	.row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 0;

		&.align-end {
			align-items: flex-end;
		}
	}
</style>
