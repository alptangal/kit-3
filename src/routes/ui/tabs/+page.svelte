<!-- src/routes/ui/tabs/+page.svelte -->
<script lang="ts">
	// Demo Tabs (element composite — shadcn tabs):
	// (a) type default (pill) + 3 tab (tab B disabled) + badge · (b) underline + 4 tab
	// (indicator trượt) · (c) vertical · (d) activation manual · (e) controlled
	// (bind:value + button ngoài đổi value).
	import { Tabs } from '$components/element';

	let ctrlValue = $state('a');
</script>

<div class="page" data-test="tabs-demo">
	<h1 class="page-title">Tabs · composite</h1>
	<p class="page-desc">
		Root giữ <code>value</code> (bindable) + Symbol context; <code>role="tablist"</code> roving focus
		(Arrow/Home/End, skip disabled, wrap); trigger <code>role="tab"</code> (aria-selected/controls),
		content <code>role="tabpanel"</code> (<code>hidden</code>).
	</p>

	<section class="demo" data-test="tb-default">
		<h2>(a) Type default (pill) — tab B disabled + badge</h2>
		<p class="demo-hint">Trigger active có nền soft + shadow; tab khóa (disabled) không chọn được, arrow skip.</p>
		<Tabs defaultValue="A" type="default">
			<Tabs.List>
				<Tabs.Trigger value="A" icon="lucide:house">Tổng quan</Tabs.Trigger>
				<Tabs.Trigger value="B" disabled>Khóa</Tabs.Trigger>
				<Tabs.Trigger value="C">
					Báo cáo
					<span class="badge" aria-hidden="true">12</span>
				</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="A">Nội dung tab Tổng quan — nhãn hiệu năng tháng này.</Tabs.Content>
			<Tabs.Content value="B">Nội dung tab Khóa (không bao giờ mở được).</Tabs.Content>
			<Tabs.Content value="C">Nội dung tab Báo cáo — 12 mục chưa xem.</Tabs.Content>
		</Tabs>
	</section>

	<section class="demo" data-test="tb-underline">
		<h2>(b) Type underline — 4 tab + indicator trượt</h2>
		<p class="demo-hint">Indicator line 2px (màu primary) trượt dưới trigger active (transition 300ms).</p>
		<Tabs defaultValue="u1" type="underline">
			<Tabs.List>
				<Tabs.Trigger value="u1">Tab 1</Tabs.Trigger>
				<Tabs.Trigger value="u2">Tab 2</Tabs.Trigger>
				<Tabs.Trigger value="u3">Tab 3</Tabs.Trigger>
				<Tabs.Trigger value="u4">Tab 4</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="u1">Nội dung Tab 1.</Tabs.Content>
			<Tabs.Content value="u2">Nội dung Tab 2.</Tabs.Content>
			<Tabs.Content value="u3">Nội dung Tab 3.</Tabs.Content>
			<Tabs.Content value="u4">Nội dung Tab 4.</Tabs.Content>
		</Tabs>
	</section>

	<section class="demo" data-test="tb-vertical">
		<h2>(c) Vertical — list trái, content phải</h2>
		<p class="demo-hint">ArrowUp/ArrowDown di chuyển (skip disabled), Home/End đầu/cuối.</p>
		<div class="vertical-wrap">
			<Tabs defaultValue="v1" orientation="vertical">
				<Tabs.List>
					<Tabs.Trigger value="v1"> Hồ sơ </Tabs.Trigger>
					<Tabs.Trigger value="v2" disabled> Thanh toán </Tabs.Trigger>
					<Tabs.Trigger value="v3"> Thông báo </Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="v1">Hồ sơ cá nhân: tên, email, ngày tham gia.</Tabs.Content>
				<Tabs.Content value="v2">Thanh toán: thẻ đang liên kết.</Tabs.Content>
				<Tabs.Content value="v3">Thông báo: 3 mục mới.</Tabs.Content>
			</Tabs>
		</div>
	</section>

	<section class="demo" data-test="tb-manual">
		<h2>(d) Activation manual</h2>
		<p class="demo-hint">
			Focus không tự chọn — di ArrowRight/Left chỉ di focus; bấm <strong>Enter/Space</strong> (hoặc click)
			mới đổi tab.
		</p>
		<Tabs defaultValue="m1" activation="manual">
			<Tabs.List>
				<Tabs.Trigger value="m1">Bước 1</Tabs.Trigger>
				<Tabs.Trigger value="m2">Bước 2</Tabs.Trigger>
				<Tabs.Trigger value="m3">Bước 3</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="m1">Nội dung bước 1.</Tabs.Content>
			<Tabs.Content value="m2">Nội dung bước 2.</Tabs.Content>
			<Tabs.Content value="m3">Nội dung bước 3.</Tabs.Content>
		</Tabs>
	</section>

	<section class="demo" data-test="tb-controlled">
		<h2>(e) Controlled (bind:value)</h2>
		<p class="demo-hint">Button ngoài đổi value → tab + panel theo (reactive).</p>
		<div class="row">
			<Tabs bind:value={ctrlValue}>
				<Tabs.List>
					<Tabs.Trigger value="a">Alpha</Tabs.Trigger>
					<Tabs.Trigger value="b">Beta</Tabs.Trigger>
					<Tabs.Trigger value="c">Gamma</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="a">Panel Alpha.</Tabs.Content>
				<Tabs.Content value="b">Panel Beta.</Tabs.Content>
				<Tabs.Content value="c">Panel Gamma.</Tabs.Content>
			</Tabs>
		</div>
		<div class="row">
			<button class="demo-btn" data-test="tb-controlled-set-b" onclick={() => (ctrlValue = 'b')}>
				Đặt Beta
			</button>
			<button class="demo-btn" data-test="tb-controlled-set-c" onclick={() => (ctrlValue = 'c')}>
				Đặt Gamma
			</button>
			<span class="picked" data-test="tb-controlled-value">value = {ctrlValue}</span>
		</div>
	</section>
</div>

<style lang="scss">
	.page {
		max-width: 44rem;
		margin: 0 auto;
		padding: 2.5rem 1.5rem 4rem;
		min-height: 100dvh;
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--foreground);
		margin: 0 0 0.5rem;
	}

	.page-desc {
		color: var(--muted, var(--foreground));
		font-size: 0.875rem;
		line-height: 1.6;
		margin: 0 0 1.5rem;
	}

	.demo {
		margin-bottom: 2.5rem;

		h2 {
			font-size: 1rem;
			font-weight: 600;
			color: var(--foreground);
			margin: 0 0 0.375rem;
		}
	}

	.demo-hint {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
		margin: 0 0 0.75rem;
		line-height: 1.5;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.375rem;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--background);
		background-color: var(--primary);
		border-radius: var(--border-radius-full, 999px);
	}

	.vertical-wrap {
		min-height: 7.5rem;
		border: 1px dashed var(--border);
		border-radius: var(--border-radius-lg, 0.75rem);
		padding: 1rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}

	.demo-btn {
		display: inline-flex;
		align-items: center;
		min-height: 2.25rem;
		padding: 0 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--foreground);
		background: var(--content2, hsl(240 4.8% 96%));
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: 0.375rem;
		cursor: pointer;

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: 2px;
		}
	}

	.picked {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
	}

	code {
		font-size: 0.8125rem;
		background: var(--content2, hsl(240 4.76% 95.88%));
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}

	@media (prefers-color-scheme: dark) {
		.demo-btn {
			border-color: hsl(240 5.9% 20%);
		}
	}
</style>
