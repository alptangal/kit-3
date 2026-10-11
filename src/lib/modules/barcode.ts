//$lib/modules/barcode.ts
// Helpers barcode/QR cho Input type='barcode' (Wave 11):
// - ensureBarcodeDetector(): ưu tiên native BarcodeDetector (Chrome/Android —
//   nhanh hơn WASM), không có → dynamic import @undecaf/barcode-detector-polyfill
//   (WebAssembly zbar, 21 format trừ aztec/data_matrix/pdf417).
//   Dynamic import BẮT BUỘC (KHÔNG static): polyfill dist import zbar-wasm từ
//   CDN (https://cdn.jsdelivr.net) → static import bị Node SSR resolve URL https
//   → lỗi server. Chunk lazy chỉ load client khi user mở camera scan.
// - playBeep(kind): âm thanh detect — WebAudio oscillator (KHÔNG file .mp3).
//   Single: 1 nốt 880Hz 90ms. Multiple: 2 nốt 880→1320Hz (cấp cao hơn — phân
//   biệt khi quét nhiều mã). AudioContext singleton + resume() (autoplay policy).

export type BarcodeDetectorResult = {
	format: string;
	rawValue: string;
	boundingBox: DOMRectReadOnly;
	cornerPoints: { x: number; y: number }[];
};

export type BarcodeDetectorLike = {
	detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>;
	getSupportedFormats?(): Promise<string[]>;
};

let detectorPromise: Promise<BarcodeDetectorLike> | undefined;

/**
 * Lấy BarcodeDetector (native nếu có, else polyfill WASM). undefined khi SSR.
 * Singleton promise — detect() qua video frame loop gọi liên tục không re-init.
 */
export async function ensureBarcodeDetector(): Promise<BarcodeDetectorLike | undefined> {
	if (typeof window === 'undefined') return undefined;
	if (!detectorPromise) {
		detectorPromise = (async () => {
			const w = window as Window & {
				BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
			};
			try {
				if (typeof w.BarcodeDetector === 'function') {
					const native = new w.BarcodeDetector();
					// Native có class nhưng engine có thể chưa bật (flag off) — probe
					// getSupportedFormats 1 lần; fail → rơi xuống polyfill WASM.
					if (native.getSupportedFormats) await native.getSupportedFormats();
					return native;
				}
			} catch {
				// Native không dùng được → polyfill
			}
			const mod = await import('@undecaf/barcode-detector-polyfill');
			return new mod.BarcodeDetectorPolyfill() as unknown as BarcodeDetectorLike;
		})();
	}
	return detectorPromise;
}

let audioCtx: AudioContext | undefined;

function getAudioCtxCtor(): typeof AudioContext | undefined {
	const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
	return w.AudioContext ?? w.webkitAudioContext;
}

/**
 * Tạo + resume AudioContext trong user gesture (click nút scan) — beep sau
 * (detect loop, KHÔNG gesture) dùng context đã resume mới kêu được. Autoplay
 * policy: AudioContext tạo ngoài gesture bị suspended → oscillator im lặng.
 * iOS Safari 15.4: resume() promise có thể chưa resolve trong gesture →
 * playBeep sau đó phát TRƯỚC khi engine bật → im lặng. Fix: phát 1 silent
 * buffer NGAY trong gesture (unlock) — iOS cần ≥1 buffer được "chơi" trong
 * gesture thì mọi oscillator sau kêu được, kể cả khi resume chậm.
 */
export function primeAudio() {
	if (typeof window === 'undefined') return;
	try {
		const Ctx = getAudioCtxCtor();
		if (!Ctx) return;
		if (!audioCtx) audioCtx = new Ctx();
		const ctx = audioCtx;
		if (ctx.state === 'suspended') void ctx.resume();
		// iOS unlock: silent buffer 1 sample — bắt buộc trong GESTURE (đây là
		// nơi gọi). Kỹ thuật chuẩn iOS (silent-unlock); Chrome/desktop vô hại.
		const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
		const src = ctx.createBufferSource();
		src.buffer = buf;
		src.connect(ctx.destination);
		if (src.start) src.start(0);
	} catch {
		// WebAudio không dùng được → im lặng
	}
}

/**
 * Beep detect thành công qua WebAudio oscillator (không cần file):
 * - 'single': 1 nốt 880Hz 90ms (1 mã thêm vào list).
 * - 'multiple': 2 nốt 880→1320Hz (cấp cao hơn — phát hiện nhiều mã trong frame,
 *   beep NGAY khi freeze frame để báo hiệu cần chọn).
 * Guard: SSR + AudioContext không tồn tại + autoplay policy → im lặng, KHÔNG crash.
 */
export function playBeep(kind: 'single' | 'multiple') {
	if (typeof window === 'undefined') return;
	try {
		const Ctx = getAudioCtxCtor();
		if (!Ctx) return;
		if (!audioCtx) audioCtx = new Ctx();
		const ctx = audioCtx;
		// iOS Safari 15.4: state 'interrupted' (riêng của iOS — KHÔNG phải
		// 'suspended') sau khi luồng audio bị ngắt (khóa màn hình/cuộc gọi) —
		// resume() thường đủ nhưng kèm 'suspended' cho an toàn mọi engine.
		if (ctx.state !== 'running') void ctx.resume();
		const now = ctx.currentTime;
		const beep = (startAt: number, freq: number, duration: number) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = 'sine';
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(0.0001, startAt);
			gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.012);
			gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(startAt);
			osc.stop(startAt + duration + 0.02);
		};
		if (kind === 'single') {
			beep(now, 880, 0.09);
		} else {
			beep(now, 880, 0.08);
			beep(now + 0.11, 1320, 0.1);
		}
	} catch {
		// WebAudio không dùng được → im lặng
	}
}
