<!-- src/routes/ui/modal/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { Modal } from '$components/modal';

	let showMain = $state(false);
	let showInner = $state(false);
	let showInnerInner = $state(false);
	// Thang size "nghịch" (dưới to → trên bé: xl → lg → md) để khi lồng 3 lớp,
	// panel trên cùng (scale=1, bé + sắc nét) KHÔNG che mất 2 layer phía dưới
	// (lg × 0.92, xl × 0.84) → "vành" của từng lớp lộ ra, user nhận ra có bao
	// nhiêu layer xếp chồng (iOS). Cùng size / trên to hơn dưới sẽ khiến panel
	// trên che khuất hoàn toàn các layer phía sau (không lộ vành).
	// Rendered size (base × scale) giảm đều từ dưới lên:
	//   lớp 1 (xl) 48rem×0.84 ≈ 645px
	//   lớp 2 (lg) 40rem×0.92 ≈ 589px
	//   lớp 3 (md) 32rem×1.00 = 512px   → 3 vành đều thấy.
	// 2 layer trên (md, lg) dùng variant="transparent": backdrop trong suốt để
	// không làm tối/che layer phía dưới (nền chính vẫn giữ "blur").
	let showBottom = $state(false);
	let showLocked = $state(false);
	let showSticky = $state(false);
	let showBare = $state(false);
	let showFull = $state(false);
	// Đếm lần onClose gọi + theo dõi reason (probe kiểm tra events:
	// onClose(reason) + onCloseByEscape/Backdrop/Button/Programmatic).
	// Lưu ý: components KHÔNG spread `data-test` lên DOM → probe locate trigger bằng text
	// hoặc class nội bộ (`.modal-root`, `.button-root`); `data-test` chỉ đặt trên element thô.
	let closeCount = $state(0);
	let lastReason = $state('');
	let escapeCount = $state(0);
	let backdropCount = $state(0);
	let buttonCount = $state(0);
	let programmaticCount = $state(0);

	function handleMainClose(reason: string) {
		closeCount++;
		lastReason = reason;
	}
</script>

<div class="page" data-test="modal-demo">
	<h1 class="page-title">Modal component</h1>

	<!-- 1. Modal chính: size xl, variant blur, dismissable (default) -->
	<section class="demo">
		<h2>Modal cơ bản (dismissable)</h2>
		<Button variant="outline" color="info" onClick={() => { showMain = true; }}>Mở Modal</Button>
		<p class="demo-hint">
			onClose chạy <code data-test="close-count">{closeCount}</code> lần · reason:
			<code data-test="last-reason">{lastReason || '—'}</code> · ESC ×
			<code data-test="escape-count">{escapeCount}</code> · nền ×
			<code data-test="backdrop-count">{backdropCount}</code> · nút × ×
			<code data-test="button-count">{buttonCount}</code> · code ×
			<code data-test="programmatic-count">{programmaticCount}</code>
			(scroll lock body tự áp dụng khi modal mở).
		</p>

		<Modal
			bind:display={showMain}
			size="xl"
			variant="blur"
			placement="center"
			onClose={handleMainClose}
			onCloseByEscape={() => { escapeCount++; }}
			onCloseByBackdrop={() => { backdropCount++; }}
			onCloseByButton={() => { buttonCount++; }}
			onCloseByProgrammatic={() => { programmaticCount++; }}
		>
			<Modal.Container>
				<Modal.Container.Header>Nội dung Modal</Modal.Container.Header>
				<Modal.Container.Body class="modal-demo-body">
					<p class="layer-badge">Lớp 1 · xl · ×0.84 · blur 3px (khi có 3 lớp)</p>
					<p>Modal đang mở · body scroll bị khóa.</p>
					<div class="layer-fill">
						<p>ESC / bấm nền / nút × để đóng (default dismissable).</p>
					</div>
					<!-- Modal lồng nhau (nested) — kiểm tra scroll lock giải phóng khi cả 2 đóng -->
					<Button variant="ghost" color="default" onClick={() => { showInner = true; }}>Mở Modal lồng</Button>
						<!-- Nút "đóng bằng code" (probe E4): set display=false →
						     reason 'programmatic' — phân biệt ESC/backdrop/nút ×. -->
						<Button variant="ghost" color="default" onClick={() => { showMain = false; }}>
							Đóng (code)
						</Button>
				</Modal.Container.Body>
			</Modal.Container>
		</Modal>

		<!-- Modal lồng (lớp 2, giữa): size lg, khi có 3 lớp → scale 0.92 + blur 1.5px.
		     Có thể lồng thêm modal thứ ba để thấy 3-layer. Backdrop transparent
		     (giữa: lộ vành layer 1 phía sau). Body cao (~340px) để "vành" giữa các
		     lớp lộ rõ theo cả chiều dọc (panel quá ngắn → vành chỉ 4-9px cao, khó nhìn). -->
		<Modal bind:display={showInner} size="lg" variant="transparent">
			<Modal.Container>
				<Modal.Container.Header>Modal lồng (lớp 2)</Modal.Container.Header>
				<Modal.Container.Body class="modal-demo-body">
					<p class="layer-badge">Lớp 2 · lg · ×0.92 · blur 1.5px</p>
					<p>Đây là modal thứ hai · layer phía dưới (lớp 1) co + mờ dần.</p>
					<div class="layer-fill">
						<p>Hiệu ứng multi-layer (iOS): mỗi modal mở mới là 1 lớp trên
							cùng (scale=1, sắc nét); các lớp phía dưới co dần
							(×0.92, ×0.84…) + mờ dần (blur, opacity giảm).</p>
						<p>Panel to hơn + cao hơn → "vành" của từng lớp lộ ra rõ ở
							mọi hướng quanh panel trên cùng.</p>
					</div>
					<Button variant="ghost" color="default" onClick={() => { showInnerInner = true; }}>
						Mở Modal lồng sâu hơn (lớp 3)
					</Button>
				</Modal.Container.Body>
			</Modal.Container>
		</Modal>

		<!-- Modal lồng sâu (lớp 3, trên cùng): size md (bé nhất), scale=1, không blur.
		     Panel trên cùng bé hơn 2 layer phía dưới (lg × 0.92, xl × 0.84) nên "vành"
		     mỗi layer lộ ra → nhận ra 3 lớp xếp chồng (iOS). Backdrop transparent:
		     không làm tối/che layer phía dưới. -->
		<Modal bind:display={showInnerInner} size="md" variant="transparent">
			<Modal.Container>
				<Modal.Container.Header>Modal lồng sâu (lớp 3)</Modal.Container.Header>
				<Modal.Container.Body class="modal-demo-body">
					<p class="layer-badge">Lớp 3 · md · ×1.00 · sắc nét</p>
					<div class="layer-fill">
						<p>Lớp trên cùng (scale=1, sắc nét nhất) · 2 layer phía dưới
							co + mờ dần (iOS).</p>
						<p>Chú ý vành sáng: lớp 2 (lg, mờ nhẹ) lộ ra quanh panel này,
							lớp 1 (xl, mờ hơn) lộ ra ngoài cùng.</p>
					</div>
				</Modal.Container.Body>
			</Modal.Container>
		</Modal>
	</section>

	<!-- 2.5. Modal "đóng cứng" — preventOutsideClose: click nền KHÔNG đóng -->
	<section class="demo">
		<h2>Modal · preventOutsideClose (đóng cứng)</h2>
		<Button variant="outline" color="warning" onClick={() => { showLocked = true; }}>Mở Modal đóng cứng</Button>
		<p class="demo-hint">
			Click nền <b>không</b> đóng · chỉ ESC hoặc nút × đóng được. (Chứng minh <code>preventOutsideClose</code>.)
		</p>

		<Modal bind:display={showLocked} size="md" variant="blur" preventOutsideClose>
			<Modal.Container>
				<Modal.Container.Header>Modal đóng cứng</Modal.Container.Header>
				<Modal.Container.Body class="modal-demo-body">
					<p>Click ra ngoài (nền) không đóng modal này.</p>
					<p>Thử click nền để kiểm tra · ESC / nút × vẫn hoạt động.</p>
				</Modal.Container.Body>
			</Modal.Container>
		</Modal>
	</section>

	<!-- 3. Body scroll — header/footer đứng yên (flex column). Body đủ dài để scroll.
	     Prop `sticky` giờ là no-op (flex layout đã ghim header/footer tự nhiên). -->
	<section class="demo">
		<h2>Modal · body scroll (scrollbar đúng chiều body)</h2>
		<Button variant="outline" color="success" onClick={() => { showSticky = true; }}>Mở Modal scroll</Button>
		<p class="demo-hint">
			Header (đỉnh) + footer (đáy) đứng yên · chỉ <b>body</b> scroll được (scrollbar cao đúng
			vùng body — cạnh dưới header tới cạnh trên footer). Container là flex column
			(max-height = 100dvh − 2.5rem).
		</p>

		<Modal bind:display={showSticky} size="md" variant="blur" placement="center">
			<Modal.Container>
				<Modal.Container.Header sticky>Modal sticky · scroll body</Modal.Container.Header>
				<Modal.Container.Body class="modal-demo-body" data-test="sticky-body">
					{#each Array(24) as _, i}
						<p>
							Dòng nội dung {i + 1} — body dài hơn chiều cao tối đa của modal nên cuộn dọc.
							Header + footer giữ nguyên khi cuộn.
						</p>
					{/each}
				</Modal.Container.Body>
				<Modal.Container.Footer sticky>
					<Button variant="ghost" color="default">Hủy</Button>
					<Button variant="outline" color="primary" onClick={() => { showSticky = false; }}>
						Lưu
					</Button>
				</Modal.Container.Footer>
			</Modal.Container>
		</Modal>
	</section>

	<!-- 4. Modal trần — không Header, không Footer: padding block của container
	     GIỮ NGUYÊN (không flush) → nội dung chạm đều 4 phía. -->
	<section class="demo">
		<h2>Modal trần (không header/footer)</h2>
		<Button variant="outline" color="default" onClick={() => { showBare = true; }}>Mở Modal trần</Button>
		<p class="demo-hint">
			Thiếu <b>cả</b> Header lẫn Footer → padding top/bottom của container được giữ
			(chỉ bỏ khi có component đó — chúng tự có padding nội tại).
		</p>

		<Modal bind:display={showBare} size="sm" variant="blur">
			<Modal.Container>
				<Modal.Container.Body class="modal-demo-body">
					<p>Modal không có header/footer.</p>
					<p>Padding block (trên/dưới) của container vẫn hiện hữu vì không có
						component nào tự có padding để thay thế.</p>
				</Modal.Container.Body>
			</Modal.Container>
		</Modal>
	</section>

	<!-- 2. Bottom-sheet (mobile) — placement bottom -->
	<section class="demo">
		<h2>Modal · placement bottom (bottom-sheet mobile)</h2>
		<Button variant="outline" color="info" onClick={() => { showBottom = true; }}>Mở Modal bottom</Button>

		<Modal bind:display={showBottom} size="md" variant="opaque" placement="bottom">
			<Modal.Container>
				<Modal.Container.Header>Bottom sheet</Modal.Container.Header>
				<Modal.Container.Body>
					<p>Trên thiết bị có cảm ứng (mobile) modal này thành bottom-sheet ở đáy màn hình.</p>
				</Modal.Container.Body>
			</Modal.Container>
		</Modal>
	</section>

	<!-- 7. Size full — panel chiếm toàn bộ viewport (margin 1rem của .modal-root
	     vẫn giữ → panel rộng = 100vw − 2rem), bo tròn = 0. Production dùng ở
	     Select fullscreen; demo này để probe assert width/border-radius. -->
	<section class="demo">
		<h2>Modal · size full (chiếm trọn viewport)</h2>
		<Button variant="outline" color="default" onClick={() => { showFull = true; }}>Mở Modal full</Button>
		<p class="demo-hint">
			<code>size="full"</code> → panel 100% kích thước viewport (trừ padding 1rem của backdrop),
			bo tròn = 0 · như mode fullscreen của Select.
		</p>

		<Modal bind:display={showFull} size="full" variant="blur">
			<Modal.Container>
				<Modal.Container.Header>Modal size full</Modal.Container.Header>
				<Modal.Container.Body class="modal-demo-body">
					<p>Panel chiếm toàn bộ vùng nội dung của viewport.</p>
					<p>ESC / bấm nền / nút × để đóng.</p>
				</Modal.Container.Body>
			</Modal.Container>
		</Modal>
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
	.modal-demo-body {
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	/* Badge "lớp N · size · scale · blur" — giúp nhận diện từng layer trong
	   ảnh 3-modal lồng nhau (probe/ui-checker check nhãn + vành đồng tâm). */
	.layer-badge {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: var(--primary, #2563eb);
	}
	/* Filler cao để panel cao ~340px → "vành" giữa các lớp lộ rõ theo chiều dọc
	   (panel ~135px cao chỉ cho vành 4-9px, gần như không thấy). */
	.layer-fill {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 220px;
		font-size: 0.85rem;
		opacity: 0.75;
	}
</style>
