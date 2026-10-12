<!-- src/routes/ui/pagination/+page.svelte -->
<script lang="ts">
	import { Pagination } from '$components/element';
	import { iconify } from '$assets/icons/iconify';

	// ── State (probe locate qua data-test; mỗi instance 1 binding riêng) ──
	let page1 = $state(1);
	let page5 = $state(5);
	let page7 = $state(7);
	let page10 = $state(10);
	let siblingPage = $state(5);
	let smallPage = $state(2);
	let sizePage = $state(1);
	let itemsPage = $state(3);
	let compactPage = $state(1);
	let activePage = $state(5);
	let singlePageCompact = $state(1);
	let singlePageDefault = $state(1);
</script>

<div class="page" data-test="pagination-demo">
	<h1 class="page-title">Pagination · light atom (shadcn usePagination)</h1>

	<!-- Basic: 10 pages, 4 instance bind page = 1/5/7/10 -->
	<section class="demo" data-test="pg-basic">
		<h2>Basic (10 pages · page 1 / 5 / 7 / 10)</h2>
		<dl class="pg-grid">
			<div>
				<dt>page = 1 (click 3 → aria-current + binding đổi)</dt>
				<dd>
					<Pagination
						totalPages={10}
						bind:page={page1}
						prevLabel="‹"
						nextLabel="›"
						aria-label="Phân trang demo"
					/>
					<p class="demo-hint">Trang hiện tại: <code data-test="pg-basic-current">{page1}</code></p>
				</dd>
			</div>
			<div>
				<dt>page = 5 (siblingCount=1: 1 … 4 5 6 … 10)</dt>
				<dd>
					<Pagination
						totalPages={10}
						bind:page={page5}
						prevLabel="‹"
						nextLabel="›"
						aria-label="Phân trang page 5"
					/>
					<p class="demo-hint">Trang hiện tại: <code>{page5}</code></p>
				</dd>
			</div>
			<div>
				<dt>page = 7</dt>
				<dd>
					<Pagination
						totalPages={10}
						bind:page={page7}
						prevLabel="‹"
						nextLabel="›"
						aria-label="Phân trang page 7"
					/>
					<p class="demo-hint">Trang hiện tại: <code>{page7}</code></p>
				</dd>
			</div>
			<div>
				<dt>page = 10 (nút ‹ next disabled)</dt>
				<dd>
					<Pagination
						totalPages={10}
						bind:page={page10}
						prevLabel="‹"
						nextLabel="›"
						aria-label="Phân trang page 10"
					/>
					<p class="demo-hint">Trang hiện tại: <code>{page10}</code></p>
				</dd>
			</div>
		</dl>
	</section>

	<!-- Sibling + boundary count -->
	<section class="demo" data-test="pg-sibling">
		<h2>Sibling count = 2 + boundary count = 2 (page 5/10)</h2>
		<Pagination
			totalPages={10}
			bind:page={siblingPage}
			siblingCount={2}
			boundaryCount={2}
			prevLabel="‹"
			nextLabel="›"
			aria-label="Phân trang sibling"
		/>
		<p class="demo-hint">
			boundary=2 → 2 trang biên mỗi đầu; sibling=2 → 2 trang hai bên active.
			Trang hiện tại: <code>{siblingPage}</code>
		</p>
	</section>

	<!-- Small (không ellipsis) -->
	<section class="demo" data-test="pg-small">
		<h2>Small (3 pages — không ellipsis)</h2>
		<Pagination
			totalPages={3}
			bind:page={smallPage}
			prevLabel="‹"
			nextLabel="›"
			aria-label="Phân trang nhỏ"
		/>
		<p class="demo-hint">Trang hiện tại: <code>{smallPage}</code></p>
	</section>

	<!-- Sizes -->
	<section class="demo" data-test="pg-size">
		<h2>Sizes (sm / md / lg)</h2>
		<div class="pg-sizes">
			<Pagination size="sm" totalPages={6} bind:page={sizePage} prevLabel="‹" nextLabel="›" aria-label="Size sm" />
			<Pagination size="md" totalPages={6} prevLabel="‹" nextLabel="›" aria-label="Size md" page={2} />
			<Pagination size="lg" totalPages={6} prevLabel="‹" nextLabel="›" aria-label="Size lg" page={3} />
		</div>
	</section>

	<!-- Total items (totalPages suy ra từ totalItems / pageSize) -->
	<section class="demo" data-test="pg-items">
		<h2>Total items (95 items / 10 per page → 10 pages)</h2>
		<Pagination
			totalItems={95}
			pageSize={10}
			bind:page={itemsPage}
			prevLabel="‹"
			nextLabel="›"
			aria-label="Phân trang items"
		/>
		<p class="demo-hint">
			Trang hiện tại: <code>{itemsPage}</code> / 10 — totalPages tự suy ra (ceil(95/10)).
		</p>
	</section>

	<!-- Compact: chỉ prev + counter (jump-to input) + next -->
	<section class="demo" data-test="pg-compact">
		<h2>Compact (chỉ prev + counter + next · jump-to input)</h2>
		<Pagination variant="compact" totalPages={42} bind:page={compactPage} aria-label="Phân trang compact" />
		<p class="demo-hint">
			Click counter để nhập số trang: Enter = jump, Escape = hủy, ↑/↓ = ±1, blur = commit.
			Trang hiện tại: <code data-test="pg-compact-current">{compactPage}</code>
		</p>
	</section>

	<!-- Loading (đang đồng bộ data) -->
	<section class="demo" data-test="pg-loading">
		<h2>Loading (đang đồng bộ data — mọi item vô hiệu)</h2>
		<Pagination variant="compact" totalPages={42} loading page={7} aria-label="Phân trang loading" />
		<p class="demo-hint">nav aria-busy="true", mọi item disabled + mờ + cursor not-allowed.</p>
	</section>

	<!-- Icons prev/next (iconify) -->
	<section class="demo" data-test="pg-icons">
		<h2>Prev/Next icons (iconify)</h2>
		<Pagination prevIcon={iconify['arrow-left-rounded']} nextIcon={iconify['arrow-right-rounded']} totalPages={8} aria-label="Phân trang icons" />
		<p class="demo-hint">Icon render trước label (gap 0.25em); kích thước theo font-size của nút.</p>
	</section>

	<!-- Active cursor (not-allowed trên trang active) -->
	<section class="demo" data-test="pg-active">
		<h2>Active cursor (trang active = không hành động tiếp → not-allowed)</h2>
		<Pagination totalPages={5} bind:page={activePage} aria-label="Phân trang active" />
		<p class="demo-hint">Trang 5 đang active — con trỏ trên đó phải là not-allowed (PC).</p>
	</section>

	<!-- Icon-only prev/next (aspect-square) -->
	<section class="demo" data-test="pg-icon-only">
		<h2>Icon-only prev/next (aspect-square — label rỗng)</h2>
		<Pagination prevIcon={iconify['arrow-left-rounded']} nextIcon={iconify['arrow-right-rounded']} prevLabel="" nextLabel="" totalPages={3} aria-label="Phân trang icon-only" />
		<p class="demo-hint">Label rỗng + có icon → nút aspect-square (width = min-height).</p>
	</section>

	<!-- Single page (totalPages = 1 — mọi hành động đổi trang vô nghĩa) -->
	<section class="demo" data-test="pg-single">
		<h2>Single page (totalPages = 1 — prev/next/counter/page disabled)</h2>
		<div class="pg-sizes">
			<Pagination variant="compact" totalPages={1} bind:page={singlePageCompact} aria-label="Phân trang 1 trang compact" />
			<Pagination totalPages={1} bind:page={singlePageDefault} prevLabel="‹" nextLabel="›" aria-label="Phân trang 1 trang default" />
		</div>
		<p class="demo-hint">
			Chỉ 1 trang → counter không vào edit, nút số trang disabled (active giữ), prev/next disabled.
			Compact: <code data-test="pg-single-compact-current">{singlePageCompact}</code> ·
			Default: <code data-test="pg-single-default-current">{singlePageDefault}</code>
		</p>
	</section>
</div>

<style lang="scss">
	.page {
		max-width: 720px;
		margin: 0 auto;
		padding: 2rem 1.5rem 6rem;
		color: var(--foreground);
	}
	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 1.5rem;
	}
	.demo {
		margin-bottom: 2.5rem;
		h2 {
			font-size: 1rem;
			font-weight: 600;
			margin-bottom: 0.75rem;
			opacity: 0.8;
		}
	}
	.demo-hint {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		opacity: 0.7;
	}
	.pg-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin: 0;
		> div {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}
		dt {
			font-size: 0.75rem;
			opacity: 0.6;
		}
		dd {
			margin: 0;
		}
	}
	.pg-sizes {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: flex-start;
	}
</style>
