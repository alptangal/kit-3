<script lang="ts">
	// $components/element/error/Main.svelte
	// Error page — matrix rain nền (DOM grid ký tự 0/1 + katakana, interval nhẹ
	// 200ms đổi ngẫu nhiên một ít cells) + mã lỗi ghép hình ảnh micro-pixel đè
	// (bitmap 5×7, cell "on" mang màu theo nhóm status) + mô tả lỗi + nút Home/Back.
	// Reduced-motion: cells tĩnh + entrance tức thì + pixel hiện không stagger.
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { Button } from '$components/element';
	import { digitCells } from './_pixel-font';
	import type { ErrorPageConfigs, ErrorPageProps } from './_interface';

	let { ...props }: ErrorPageProps = $props();

	// Map mã lỗi → mô tả vi/en (row dưới)
	const STATUS_MESSAGES: Record<string, { en: string; vi: string }> = {
		'400': { en: 'Bad request — the server could not understand the request.', vi: 'Yêu cầu không hợp lệ — máy chủ không hiểu được yêu cầu.' },
		'401': { en: 'Unauthorized — authentication is required.', vi: 'Chưa xác thực — bạn cần đăng nhập để tiếp tục.' },
		'403': { en: 'Forbidden — you do not have permission to access this resource.', vi: 'Không có quyền truy cập — bạn không được phép xem tài nguyên này.' },
		'404': { en: 'Not found — the page you are looking for does not exist.', vi: 'Không tìm thấy trang — trang bạn cần không tồn tại hoặc đã bị di chuyển.' },
		'408': { en: 'Request timeout — the server timed out waiting for the request.', vi: 'Hết thời gian chờ — máy chủ chờ yêu cầu quá lâu.' },
		'429': { en: 'Too many requests — please slow down and try again later.', vi: 'Quá nhiều yêu cầu — vui lòng chậm lại và thử lại sau.' },
		'500': { en: 'Internal server error — something went wrong on our end.', vi: 'Lỗi máy chủ — đã có sự cố xảy ra phía hệ thống.' },
		'502': { en: 'Bad gateway — the server received an invalid response.', vi: 'Cổng kết nối lỗi — máy chủ nhận được phản hồi không hợp lệ.' },
		'503': { en: 'Service unavailable — the server is temporarily overloading.', vi: 'Dịch vụ tạm thời không khả dụng — máy chủ đang quá tải.' },
		'504': { en: 'Gateway timeout — the upstream server timed out.', vi: 'Hết thời gian chờ cổng — máy chủ upstream phản hồi quá lâu.' }
	};

	// Tập ký tự matrix: 0/1 + katakana (chuẩn matrix rain)
	const MATRIX_CHARS = [
		'0', '1', '0', '1',
		'ア', 'イ', 'ウ', 'エ', 'オ',
		'カ', 'キ', 'ク', 'ケ', 'コ',
		'サ', 'シ', 'ス', 'セ', 'ソ'
	];

	let configs: ErrorPageConfigs = $state({
		get status() {
			return props.status != null ? String(props.status) : '404';
		},
		get message() {
			return props.message ?? '';
		},
		get matrixCols() {
			const n = Number(props.matrixCols);
			return Number.isFinite(n) && n > 0 ? Math.floor(n) : 40;
		},
		get matrixRows() {
			const n = Number(props.matrixRows);
			return Number.isFinite(n) && n > 0 ? Math.floor(n) : 14;
		},
		get staticMatrix() {
			return props.staticMatrix ?? false;
		},
		get displayStatus() {
			return this.status;
		},
		get displayMessage() {
			if (this.message) return this.message;
			return STATUS_MESSAGES[this.status]?.vi ?? STATUS_MESSAGES['404'].vi;
		},
		get statusColor() {
			const s = this.status;
			if (s.startsWith('5')) return 'danger';
			if (s.startsWith('4')) return 'warning';
			return 'foreground';
		},
		get matrixChars() {
			return MATRIX_CHARS;
		},
		// Mã lỗi dạng pixel: chỉ khi status gồm đủ 3 digit 0-9 (vd 404/500);
		// khác → undefined → fallback .error-status text
		get pixelStatus() {
			const s = this.status;
			return /^[0-9]{3}$/.test(s) ? s : undefined;
		},
		// Danh sách cell "on" cho hình pixel: các digit đặt cạnh nhau giữa matrix
		// (offset căn giữa theo cols/rows). Deterministic — seeded, không Math.random().
		get pixelCells() {
			const ps = this.pixelStatus;
			if (!ps) return [];
			const cols = this.matrixCols;
			const rows = this.matrixRows;
			const digits = ps.split('');
			const gap = 1;
			const width = digits.length * 5 + (digits.length - 1) * gap;
			const offsetRow = Math.max(0, Math.floor((rows - 7) / 2));
			const offsetCol = Math.max(0, Math.floor((cols - width) / 2));
			const all: { col: number; row: number }[] = [];
			digits.forEach((d, i) => {
				all.push(...digitCells(d, cols, rows, offsetCol + i * (5 + gap), offsetRow));
			});
			return all;
		},
		// Key tập hợp pixel (đổi theo status + kích thước matrix → each key đổi đúng)
		get pixelKey() {
			return `${this.pixelStatus ?? 'none'}-${this.matrixCols}x${this.matrixRows}`;
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'error-root',
				`status-${this.statusColor}`,
				this.staticMatrix ? 'is-static' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get event() {
			return props.events;
		},
		ref: undefined as HTMLElement | undefined
	});

	// Grid cells: cols × rows (mỗi cell 1 ký tự — init random qua seeded pseudo-random
	// để SSR/CLIENT khớp, tránh hydration mismatch)
	function seededRandom(seed: number): number {
		const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
		return x - Math.floor(x);
	}
	const cells: { char: string; col: number; row: number }[] = [];
	for (let r = 0; r < configs.matrixRows; r++) {
		for (let c = 0; c < configs.matrixCols; c++) {
			const idx = r * configs.matrixCols + c;
			cells.push({
				char: MATRIX_CHARS[Math.floor(seededRandom(idx + 1) * MATRIX_CHARS.length)],
				col: c,
				row: r
			});
		}
	}

	// Interval nhẹ 200ms: đổi ngẫu nhiên ~12 cells/lần (chỉ client + không staticMatrix).
	// Random ĐỔI TEXT nền — nhảy qua cells "on" (giữ hình pixel nguyên vẹn).
	const onSet = new Set<string>();
	$effect(() => {
		// Set CSS vars --error-cols/--error-rows từ JS theo matrixCols/matrixRows
		// (fix latent bug: grid CSS trước đây luôn 40 cột dù prop đổi) + đồng bộ
		// tập onSet theo pixelCells hiện tại (key "row-col").
		const root = configs.ref?.parentElement;
		if (root) {
			root.style.setProperty('--error-cols', String(configs.matrixCols));
			root.style.setProperty('--error-rows', String(configs.matrixRows));
		}
		onSet.clear();
		for (const pc of configs.pixelCells) onSet.add(`${pc.row}-${pc.col}`);
	});
	let timeId: NodeJS.Timeout | undefined;
	onMount(() => {
		if (configs.staticMatrix) return;
		timeId = setInterval(() => {
			for (let i = 0; i < 12; i++) {
				const idx = Math.floor(Math.random() * cells.length);
				const cell = cells[idx];
				if (!cell) continue;
				const key = `${cell.row}-${cell.col}`;
				// Nhảy qua cells "on" — hình pixel không bị rain xóa
				if (onSet.has(key)) continue;
				const el = configs.ref?.querySelector<HTMLElement>(`[data-cell="${key}"]`);
				if (el) el.textContent = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
			}
		}, 200);
	});
	onDestroy(() => {
		if (timeId) clearInterval(timeId);
	});
</script>

<div
	class={configs.style}
	data-test="error-root"
	{@attach handleEvents(configs.event)}
>
	<!-- Matrix rain nền: grid ký tự (aria-hidden — decorative) -->
	<div class="error-matrix" aria-hidden="true" bind:this={configs.ref}>
		{#each cells as cell, i}
			<span
				class="error-matrix-cell"
				style:--cell-col={cell.col}
				style:--cell-row={cell.row}
				style:--cell-delay="{(i % 17) * 0.15}s"
				data-cell="{cell.row}-{cell.col}"
			>{cell.char}</span>
		{/each}
	</div>

	<!-- Hình ảnh mã lỗi micro-pixel: layer RIÊNG absolute inset:0 cùng grid (KHÔNG
		nằm trong .error-matrix opacity 0.08 — pixel sẽ bị nhân mờ quá). Cell khớp
		bitmap nhận class cell-on, đè rain nền. Key đổi theo status/matrix →
		re-mount → materialize lại. -->
	<div class="error-pixel" aria-hidden="true">
		{#each configs.pixelCells as pc, i (configs.pixelKey + '-' + i)}
			<span
				class="error-matrix-cell error-matrix-cell-on"
				style:--cell-col={pc.col}
				style:--cell-row={pc.row}
				style:--cell-delay="{(pc.row % 7) * 0.06 + (pc.col % 5) * 0.04}s"
				data-cell-on="{pc.row}-{pc.col}"
			></span>
		{/each}
	</div>

	<!-- Nội dung đè: eyebrow + pixel-digit lớn (thay error-status) + mô tả + nút -->
	<div class="error-content">
		<p class="error-eyebrow">Error · Lỗi</p>
		{#if configs.pixelStatus}
			<div class="error-pixel-caption" data-test="error-status">{configs.pixelStatus}</div>
		{:else}
			<h1 class="error-status" data-test="error-status">{configs.displayStatus}</h1>
		{/if}
		<p class="error-message" data-test="error-message">{configs.displayMessage}</p>
		<div class="error-actions">
			<Button to="/" icon="lucide:home" variant="soft" data-test="error-home">Home</Button>
			{#if browser}
				<Button
					variant="soft"
					icon="lucide:arrow-left"
					data-test="error-back"
					onClick={() => history.back()}
				>Back</Button>
			{/if}
		</div>
	</div>
</div>

<style lang="scss">
	@use '_styles.scss';
</style>
