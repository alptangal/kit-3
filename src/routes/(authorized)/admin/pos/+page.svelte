<!-- src/routes/(authorized)/admin/pos/+page.svelte -->
<!-- POS terminal v2: search variants / scan barcode -> cart -> split payments -> receipt print -->
<script lang="ts">
	import { Button, Badge } from '$components/element';
	import { Modal } from '$components/modal';
	import { Keyboard } from '$components/keyboard';
	import { Input } from '$components/form/input';
	import { encryption } from '$modules/encryption';
	import { numberKeyboardState } from '$modules/numberKeyboardState.svelte';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';
	import type { NumberKeyAllowed } from '$components/form/input/_interface';

	interface VariantRow {
		_id: string;
		sku?: string;
		barcode?: string;
		displayName?: string;
		price?: number;
		imageUrl?: string;
		attributes?: Record<string, string | number | undefined>;
		stock?: number;
		productId?: string;
		trackSerial?: boolean;
		/** Số serial 'in_stock' tại branch (chỉ variant trackSerial) — 0 → hết serial. */
		serialStock?: number;
		/** Đơn vị quy đổi (P2): [{ name, factor, price? }] — đơn vị đầu = base. */
		units?: Array<{ name: string; factor: number; price?: number | null }>;
	}

	interface BranchOption {
		_id: string;
		name?: string;
	}

	interface PosSession {
		_id: string;
		deviceId?: string;
		status?: string;
		totalSales?: number;
		totalCash?: number;
	}

	interface CustomerOption {
		_id: string;
		fullName: string;
		loyaltyPoints?: number;
	}

	interface CartLine {
		variantId: string;
		sku: string;
		displayName: string;
		unitPrice: number;
		quantity: number;
		lineDiscount: number;
		stock?: number;
		attributes?: Record<string, string | number | undefined>;
		/** Serial/IMEI đã chọn (variant trackSerial) — số lượng = quantity. */
		serials?: string[];
		/** Đơn vị bán (P2): index trong variant.units — undefined = đơn vị base. */
		unitIndex?: number;
		/** Hệ số quy đổi (1 đơn vị bán = bao nhiêu đơn vị base). */
		unitFactor?: number;
		/** Tên đơn vị hiển thị (vd 'Lốc'). */
		unitName?: string;
	}

	interface PaymentLine {
		method: PosPaymentMethod;
		amount: number;
		cashReceived: number;
		auto: boolean;
	}

	type PosPaymentMethod =
		| 'cash'
		| 'bank_pos'
		| 'momo'
		| 'zalopay'
		| 'bank_transfer'
		| 'cod'
		| 'loyalty_points';

	interface ReceiptSnapshotLine {
		displayName: string;
		sku: string;
		quantity: number;
		unitPrice: number;
		lineDiscount: number;
		serials?: string[];
	}

	interface ReceiptSnapshot {
		orderCode: string;
		datetime: string;
		shopName: string;
		customerName: string;
		items: ReceiptSnapshotLine[];
		subtotal: number;
		discountAmount: number;
		totalAmount: number;
		cashReceived: number;
		change: number;
		payments: { method: string; amount: number }[];
	}

	// ── Ngôn ngữ ──
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : (client.browser?.language ?? 'en'));

	// ── Cặp khoá RSA ──
	let encryptionKeys = $state<
		| undefined
		| {
				publicKey: CryptoKey;
				privateKey: CryptoKey;
		  }
	>(undefined);

	// ── Nội dung song ngữ ──
	const pageContents: { [k: string]: any } = {
		title: { vi: 'Bán hàng trực tiếp', en: 'Point of sale' },
		subtitle: {
			vi: 'Tìm nhanh sản phẩm, quét mã vạch, thanh toán và in hoá đơn tại quầy',
			en: 'Quick product search, scan barcode, checkout and print receipt'
		},
		search: {
			label: { vi: 'Tìm sản phẩm', en: 'Find product' },
			placeholder: { vi: 'Tên, SKU hoặc mã vạch — Enter thêm vào giỏ', en: 'Name, SKU or barcode — Enter adds to cart' },
			hint: { vi: 'Đang tìm…', en: 'Searching…' },
			empty: { vi: 'Không tìm thấy sản phẩm phù hợp.', en: 'No matching product found.' },
			scanLabel: { vi: 'Quét mã vạch', en: 'Scan barcode' },
			stock: { vi: 'Tồn', en: 'Stock' },
			stockUnknown: { vi: 'Tồn: ?', en: 'Stock: ?' },
			sellUnit: { vi: 'Bán theo:', en: 'Sell by:' }
		},
		attrs: { label: { vi: 'Thuộc tính', en: 'Attributes' } },
		cart: {
			title: { vi: 'Giỏ hàng', en: 'Cart' },
			empty: { vi: 'Giỏ hàng đang trống — tìm hoặc quét sản phẩm để thêm.', en: 'Cart is empty — search or scan a product to add.' },
			product: { vi: 'Sản phẩm', en: 'Product' },
			price: { vi: 'Giá', en: 'Price' },
			quantity: { vi: 'SL', en: 'Qty' },
			lineTotal: { vi: 'Thành tiền', en: 'Line total' },
			total: { vi: 'Tổng cộng', en: 'Grand total' },
			clear: { vi: 'Xoá giỏ', en: 'Clear cart' },
			removeLine: { vi: 'Xoá dòng', en: 'Remove line' },
			lineDiscount: { vi: 'Giảm giá dòng', en: 'Line discount' },
			stockWarn: { vi: 'Vượt tồn kho', en: 'Over stock' },
			stockLabel: { vi: 'Tồn', en: 'Stock' },
			serials: { vi: 'Serial/IMEI', en: 'Serial/IMEI' },
			editSerials: { vi: 'Đổi serial', en: 'Change serials' },
			unitSuffix: { vi: '/ {unit}', en: '/ {unit}' }
		},
		payment: {
			title: { vi: 'Thanh toán', en: 'Payment' },
			method: { vi: 'Phương thức', en: 'Method' },
			methods: {
				cash: { vi: 'Tiền mặt', en: 'Cash' },
				bank_pos: { vi: 'Thẻ POS', en: 'POS card' },
				momo: { vi: 'MoMo', en: 'MoMo' },
				zalopay: { vi: 'ZaloPay', en: 'ZaloPay' },
				bank_transfer: { vi: 'Chuyển khoản', en: 'Bank transfer' },
				cod: { vi: 'Thanh toán khi nhận hàng', en: 'Cash on delivery' },
				loyalty_points: { vi: 'Điểm tích luỹ', en: 'Loyalty points' }
			},
			amount: { vi: 'Số tiền', en: 'Amount' },
			cashReceived: { vi: 'Tiền khách đưa', en: 'Cash received' },
			change: { vi: 'Tiền thừa trả khách', en: 'Change to return' },
			confirm: { vi: 'Xác nhận thanh toán', en: 'Confirm payment' },
			discount: { vi: 'Giảm giá khách hàng (%)', en: 'Customer discount (%)' },
			orderDiscount: { vi: 'Giảm giá đơn (VND)', en: 'Order discount (VND)' },
			notes: { vi: 'Ghi chú đơn', en: 'Order notes' },
			notesPlaceholder: { vi: 'Ghi chú nội bộ cho đơn này…', en: 'Internal note for this order…' },
			addMethod: { vi: 'Thêm phương thức', en: 'Add method' },
			removeMethod: { vi: 'Xoá', en: 'Remove' },
			remaining: { vi: 'Còn lại', en: 'Remaining' },
			splitTotalMismatch: {
				vi: 'Tổng các phương thức chưa khớp số tiền cần thu.',
				en: 'Payment methods do not match the payable amount yet.'
			}
		},
		session: {
			label: { vi: 'Ca bán hàng', en: 'Shift session' },
			none: { vi: 'Bán không gắn ca', en: 'Selling without session' },
			linked: { vi: 'Đã gắn ca', en: 'Session linked' },
			open: { vi: 'Mở ca nhanh', en: 'Quick open session' },
			sales: { vi: 'bán', en: 'sales' },
			cash: { vi: 'tiền mặt', en: 'cash' }
		},
		customer: {
			label: { vi: 'Khách hàng', en: 'Customer' },
			walkIn: { vi: 'Khách lẻ', en: 'Walk-in' },
			placeholder: { vi: 'Tìm khách hàng theo tên — bỏ trống là khách lẻ', en: 'Search customer by name — empty means walk-in' },
			empty: { vi: 'Không tìm thấy khách hàng.', en: 'No customer found.' },
			clear: { vi: 'Bỏ chọn khách', en: 'Clear customer' },
			loyalty: { vi: 'điểm', en: 'pts' }
		},
		receipt: {
			title: { vi: 'Hoá đơn', en: 'Receipt' },
			shopLabel: { vi: 'Cửa hàng', en: 'Shop' },
			orderLabel: { vi: 'Mã đơn', en: 'Order' },
			cashierLabel: { vi: 'Thu ngân', en: 'Cashier' },
			customerLabel: { vi: 'Khách hàng', en: 'Customer' },
			item: { vi: 'Mặt hàng', en: 'Item' },
			qty: { vi: 'SL', en: 'Qty' },
			amount: { vi: 'Số tiền', en: 'Amount' },
			subtotal: { vi: 'Tạm tính', en: 'Subtotal' },
			discount: { vi: 'Giảm giá', en: 'Discount' },
			total: { vi: 'Tổng cộng', en: 'Total' },
			cashReceived: { vi: 'Tiền nhận', en: 'Cash received' },
			change: { vi: 'Tiền thối', en: 'Change' },
			thank: { vi: 'Cảm ơn Quý khách, hẹn gặp lại!', en: 'Thank you, see you again!' },
			datetime: { vi: 'Thời gian', en: 'Date' },
			paper58: { vi: 'Khổ 58mm', en: '58mm' },
			paper80: { vi: 'Khổ 80mm', en: '80mm' },
			print: { vi: 'In hoá đơn', en: 'Print receipt' },
			close: { vi: 'Đóng', en: 'Close' }
		},
		result: {
			title: { vi: 'Đặt hàng thành công', en: 'Order completed' },
			orderCode: { vi: 'Mã đơn:', en: 'Order code:' },
			paid: { vi: 'Đã thu:', en: 'Paid:' },
			change: { vi: 'Tiền thừa:', en: 'Change:' },
			newOrder: { vi: 'Đơn mới', en: 'New order' },
			printReceipt: { vi: 'In hoá đơn', en: 'Print receipt' },
			qrTitle: { vi: 'Quét mã để thanh toán', en: 'Scan QR code to pay' },
			qrHint: { vi: 'Đơn sẽ chuyển sang đã thanh toán khi đối tác xác nhận giao dịch.', en: 'The order turns paid once the partner confirms the transaction.' }
		},
		states: {
			loading: { vi: 'Đang tải…', en: 'Loading…' },
			requestFailed: { vi: 'Không tải được dữ liệu!', en: 'Could not load data!' },
			checkoutFailed: { vi: 'Thanh toán thất bại!', en: 'Checkout failed!' },
			added: { vi: 'Đã thêm vào giỏ', en: 'Added to cart' },
			notFound: { vi: 'Không tìm thấy mã vạch', en: 'Barcode not found' },
			stockExceeded: { vi: 'Vượt quá tồn kho!', en: 'Exceeds stock!' },
			serialRequired: { vi: 'Hãy chọn đủ serial/IMEI trước khi thêm vào giỏ', en: 'Select the required serials before adding to cart' },
			serialLoadFailed: { vi: 'Không tải được danh sách serial!', en: 'Could not load serial list!' }
		},
		serial: {
			title: { vi: 'Chọn serial/IMEI', en: 'Select serials / IMEIs' },
			forVariant: { vi: 'Cho sản phẩm', en: 'For product' },
			searchPlaceholder: { vi: 'Tìm theo số serial…', en: 'Search by serial number…' },
			empty: { vi: 'Không còn serial nào đang tồn kho.', en: 'No in-stock serials available.' },
			loadFailed: { vi: 'Không tải được danh sách serial.', en: 'Could not load the serial list.' },
			selected: { vi: 'đã chọn', en: 'selected' },
			need: { vi: 'cần chọn', en: 'need' },
			confirm: { vi: 'Xác nhận', en: 'Confirm' },
			pickExactly: { vi: 'Chọn đúng {n} serial để bán', en: 'Select exactly {n} serials to sell' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	// ── Trạng thái tìm kiếm ──
	let searchKeyword = $state('');
	let searchResults = $state<VariantRow[]>([]);
	let searchBusy = $state(false);
	let searchDone = $state(false);
	let searchInputRef: HTMLInputElement | undefined = $state();
	let searchTimer: ReturnType<typeof setTimeout> | undefined = undefined;

	// ── Trạng thái giỏ hàng ──
	let cart = $state<CartLine[]>([]);
	let selectedLineId = $state<string | undefined>(undefined);

	// ── Chiết khấu + ghi chú ──
	let customerDiscount = $state(0);
	let orderDiscountAmount = $state(0);
	let orderNotes = $state('');

	// ── Khách hàng ──
	let selectedCustomer = $state<CustomerOption | undefined>(undefined);
	let customerSearchKeyword = $state('');
	let customerResults = $state<CustomerOption[]>([]);
	let customerBusy = $state(false);
	let customerTimer: ReturnType<typeof setTimeout> | undefined = undefined;
	let customerDropdownOpen = $state(false);

	// ── Thanh toán ──
	let payDisplay = $state(false);
	let checkoutBusy = $state(false);
	let checkoutError = $state<string | undefined>(undefined);
	let payments = $state<PaymentLine[]>([]);
	let activeNumpadIndex = $state(0);
	let showNumpad = $state(false);
	let cashInputRef: HTMLInputElement | undefined = $state();

	// ── Kết quả + hoá đơn ──
	let resultDisplay = $state(false);
	let receiptDisplay = $state(false);
	let receiptPaper = $state<'58' | '80'>('80');
	let lastOrder = $state<
		| undefined
		| {
				orderCode?: string;
				totalAmount?: number;
				subtotal?: number;
				discountAmount?: number;
				change?: number;
				paymentCode?: string;
				payments?: { paymentCode?: string; method?: string; amount?: number; status?: string }[];
				qr?: { payload?: string; dataUrl?: string };
		  }
	>(undefined);
	let receiptSnapshot = $state<ReceiptSnapshot | undefined>(undefined);

	// ── Ca + chi nhánh + thông tin cửa hàng ──
	let sessionDisplay = $state({ deviceId: 'pos-terminal' });
	let currentSession = $state<PosSession | null>(null);
	let branches = $state<BranchOption[]>([]);
	let branchId = $state<string | undefined>(undefined);
	let shopInfo = $state<{ shopName: string; currency: string; timezone: string } | undefined>(undefined);

	// ── Mã vạch ──
	let scannedCodes = $state<string[]>([]);

	// ── Serial/IMEI picker (variant trackSerial) ──
	interface SerialOption {
		serial: string;
		status?: string;
	}
	let serialPickerDisplay = $state(false);
	let serialPickerVariant = $state<VariantRow | undefined>(undefined);
	let serialPickerOptions = $state<SerialOption[]>([]);
	let serialPickerSelected = $state<string[]>([]);
	let serialPickerBusy = $state(false);
	let serialPickerKeyword = $state('');
	let serialPickerNeed = $state(1);
	let serialPickerError = $state<string | undefined>(undefined);
	// Dòng cart đang sửa serial (khi bấm "Đổi serial") — undefined = đang thêm mới
	let serialPickerEditLine = $state<CartLine | undefined>(undefined);
	const serialPickerFiltered = $derived.by(() => {
		const kw = serialPickerKeyword.trim().toUpperCase();
		if (!kw) return serialPickerOptions;
		return serialPickerOptions.filter((o) => o.serial.includes(kw));
	});

	// ── Suy dẫn tiền ──
	const clampLineDiscount = (line: CartLine) =>
		Math.min(Math.max(0, Math.round(line.lineDiscount || 0)), line.unitPrice * line.quantity);
	const cartTotal = $derived(cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
	const cartSubtotal = $derived(cart.reduce((sum, line) => sum + line.unitPrice * line.quantity - clampLineDiscount(line), 0));
	const totalAmount = $derived(Math.round(cartSubtotal));
	const percentOff = $derived(Math.round((totalAmount * Math.min(Math.max(customerDiscount, 0), 100)) / 100));
	const amountOff = $derived(
		Math.min(Math.max(0, Math.round(orderDiscountAmount || 0)), Math.max(0, totalAmount - percentOff))
	);
	const payable = $derived(Math.max(0, totalAmount - percentOff - amountOff));
	const paymentMethods: PosPaymentMethod[] = ['cash', 'bank_pos', 'momo', 'zalopay', 'bank_transfer', 'cod', 'loyalty_points'];
	const effectivePaymentAmount = (index: number) => {
		const line = payments[index];
		if (!line) return 0;
		if (line.auto) {
			let others = 0;
			for (let i = 0; i < payments.length; i++) if (i !== index) others += Math.max(0, Math.round(payments[i].amount || 0));
			return Math.max(0, payable - others);
		}
		return Math.max(0, Math.round(line.amount || 0));
	};
	const paymentsSum = $derived(payments.reduce((sum, _l, i) => sum + effectivePaymentAmount(i), 0));
	const paymentsRemaining = $derived(Math.max(0, payable - paymentsSum));
	const splitMismatch = $derived(payments.length > 1 && paymentsSum !== payable);
	const changeAmount = $derived(
		payments.reduce((sum, line, i) => {
			if (line.method !== 'cash') return sum;
			const eff = effectivePaymentAmount(i);
			return sum + Math.max(0, (line.cashReceived || 0) - eff);
		}, 0)
	);
	const lastOrderHasQr = $derived(!!lastOrder?.qr?.dataUrl);

	// ── Toast ──
	function showToast(text: string, color: 'success' | 'error' | 'warning' = 'success') {
		client.browser?.toasts?.create({ title: text, color });
	}

	// ── Định dạng tiền ──
	function formatMoney(value: number | null | undefined): string {
		if (value === null || value === undefined) return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(value);
	}

	// ── API ──
	async function loadBranches() {
		if (!encryptionKeys) return;
		const response = await encryption.fetchSecure('/api/admin/inventory/branches', { method: 'POST', body: {} }, encryptionKeys);
		if (response.ok) {
			branches = (response.data as BranchOption[] | undefined) ?? [];
			if (!branchId && branches.length > 0) branchId = branches[0]._id;
		}
	}

	async function loadShopInfo() {
		if (!encryptionKeys) return;
		const response = await encryption.fetchSecure('/api/admin/pos/shop-info', { method: 'POST', body: {} }, encryptionKeys);
		if (response.ok && response.data) {
			shopInfo = response.data as { shopName: string; currency: string; timezone: string };
		}
	}

	async function refreshSession() {
		if (!encryptionKeys) return;
		const response = await encryption.fetchSecure(
			'/api/admin/pos/sessions/current',
			{ method: 'POST', body: { deviceId: sessionDisplay.deviceId } },
			encryptionKeys
		);
		if (response.ok) {
			currentSession = ((response.data as { session?: PosSession })?.session ?? (response.data as PosSession)) ?? null;
		}
	}

	async function quickOpenSession() {
		if (!encryptionKeys) return;
		const response = await encryption.fetchSecure(
			'/api/admin/pos/sessions/open',
			{ method: 'POST', body: { deviceId: sessionDisplay.deviceId, openingBalance: 0 } },
			encryptionKeys
		);
		if (response.ok) {
			showToast(resolveServerMessage(undefined, lang, pageContents.session.open));
			await refreshSession();
		} else {
			showToast(resolveServerMessage(response.message, lang, pageContents.states.requestFailed), 'error');
		}
	}

	// ── Tìm kiếm sản phẩm ──
	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => void runSearch(), 300);
	}

	async function runSearch() {
		const keyword = searchKeyword.trim();
		if (!keyword) {
			searchResults = [];
			searchDone = false;
			return;
		}
		if (!encryptionKeys) {
			setTimeout(() => void runSearch(), 700);
			return;
		}
		searchBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/pos/search',
				{ method: 'POST', body: { search: keyword, limit: 20, branchId: branchId || undefined } },
				encryptionKeys
			);
			if (response.ok) {
				const payload = response.data as { items?: VariantRow[] } | undefined;
				searchResults = payload?.items ?? [];
				searchDone = true;
			} else {
				searchResults = [];
				searchDone = true;
			}
		} finally {
			searchBusy = false;
		}
	}

	// ── Giỏ hàng ──
	function addVariantToCart(row: VariantRow, unitIndex = 0) {
		// Đơn vị quy đổi (P2): đơn vị bán ≠ base → tính giá theo units[unitIndex]
		// (price riêng nếu có, else price base × factor làm tròn đẹp).
		const units = row.units ?? [];
		const unit = units[unitIndex];
		const factor = unit && unitIndex > 0 ? Math.max(1, Math.floor(Number(unit.factor) || 1)) : 1;
		let sellPrice = row.price ?? 0;
		if (unit && unitIndex > 0) {
			sellPrice = unit.price != null ? unit.price : niceRoundPrice((row.price ?? 0) * factor);
		}
		// Variant trackSerial (sim/điện thoại): BẮT BUỘC chọn serial cụ thể trước khi vào giỏ
		if (row.trackSerial) {
			void openSerialPicker(row, 1, undefined);
			return;
		}
		const existing = cart.find((l) => l.variantId === row._id && (l.unitIndex ?? 0) === unitIndex);
		if (existing) {
			existing.quantity += 1;
		} else {
			cart.push({
				variantId: row._id,
				sku: row.sku ?? row._id,
				displayName: unit && unitIndex > 0 ? `${row.displayName ?? row.sku ?? row._id} (${unit.name})` : row.displayName ?? row.sku ?? row._id,
				unitPrice: sellPrice,
				quantity: 1,
				lineDiscount: 0,
				stock: row.stock,
				attributes: row.attributes,
				unitIndex: unitIndex > 0 ? unitIndex : undefined,
				unitFactor: factor,
				unitName: unit && unitIndex > 0 ? unit.name : undefined
			});
		}
		selectedLineId = row._id;
		// Giữ nguyên keyword + results sau khi thêm (hành vi v1): quét liên tiếp
		// nhiều variant từ cùng danh sách, probe cũ P24 dựa vào list còn hiển thị.
		showToast(resolveServerMessage(undefined, lang, pageContents.states.added));
	}

	// Làm tròn giá theo đơn vị lớn: về số đẹp (hàng nghìn gần nhất)
	function niceRoundPrice(v: number): number {
		if (v <= 0) return 0;
		if (v >= 1000) return Math.round(v / 1000) * 1000;
		return Math.round(v);
	}

	// ── Serial/IMEI picker ──
	async function openSerialPicker(row: VariantRow, need: number, editLine: CartLine | undefined) {
		if (!encryptionKeys) {
			showToast(resolveServerMessage(undefined, lang, pageContents.states.requestFailed), 'error');
			return;
		}
		serialPickerVariant = row;
		serialPickerEditLine = editLine;
		serialPickerNeed = need;
		serialPickerKeyword = '';
		serialPickerError = undefined;
		// Khi sửa dòng có sẵn: giữ lại serial đã chọn (placeholder trong danh sách)
		serialPickerSelected = editLine ? [...(editLine.serials ?? [])] : [];
		serialPickerDisplay = true;
		serialPickerBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/serials/in-stock',
				{ method: 'POST', body: { variantId: row._id, branchId: branchId || undefined } },
				encryptionKeys
			);
			if (response.ok) {
				const payload = response.data as { items?: SerialOption[] } | undefined;
				serialPickerOptions = payload?.items ?? [];
				// Serial đã chọn trước đó có thể đã bị bán (out of stock) — vẫn giữ để hiển thị,
				// checkout sẽ chặn nếu thiếu.
				if (editLine) {
					const have = new Set(serialPickerOptions.map((o) => o.serial));
					for (const s of editLine.serials ?? []) {
						if (!have.has(s)) serialPickerOptions = [...serialPickerOptions, { serial: s, status: 'selected' }];
					}
				}
			} else {
				serialPickerOptions = [];
				serialPickerError = resolveServerMessage(undefined, lang, pageContents.serial.loadFailed);
			}
		} finally {
			serialPickerBusy = false;
		}
	}

	function toggleSerialPick(serial: string) {
		const idx = serialPickerSelected.indexOf(serial);
		if (idx >= 0) {
			serialPickerSelected = serialPickerSelected.filter((s) => s !== serial);
			return;
		}
		// Đủ số lượng cần chọn → thay serial cũ nhất (chọn nhanh bằng quét liên tiếp)
		if (serialPickerSelected.length >= serialPickerNeed) {
			serialPickerSelected = [...serialPickerSelected.slice(1), serial];
			return;
		}
		serialPickerSelected = [...serialPickerSelected, serial];
	}

	function confirmSerialPicker() {
		if (!serialPickerVariant) return;
		if (serialPickerSelected.length !== serialPickerNeed) {
			serialPickerError = resolveServerMessage(undefined, lang, {
				vi: `Chọn đúng ${serialPickerNeed} serial để bán`,
				en: `Select exactly ${serialPickerNeed} serials to sell`
			});
			return;
		}
		if (serialPickerEditLine) {
			serialPickerEditLine.serials = [...serialPickerSelected].sort();
			showToast(resolveServerMessage(undefined, lang, pageContents.states.added));
		} else {
			cart.push({
				variantId: serialPickerVariant._id,
				sku: serialPickerVariant.sku ?? serialPickerVariant._id,
				displayName: serialPickerVariant.displayName ?? serialPickerVariant.sku ?? serialPickerVariant._id,
				unitPrice: serialPickerVariant.price ?? 0,
				quantity: serialPickerNeed,
				lineDiscount: 0,
				stock: serialPickerVariant.stock,
				attributes: serialPickerVariant.attributes,
				serials: [...serialPickerSelected].sort()
			});
			selectedLineId = serialPickerVariant._id;
			showToast(resolveServerMessage(undefined, lang, pageContents.states.added));
		}
		serialPickerDisplay = false;
		serialPickerVariant = undefined;
		serialPickerEditLine = undefined;
		serialPickerSelected = [];
		serialPickerOptions = [];
	}

	function closeSerialPicker() {
		serialPickerDisplay = false;
		serialPickerVariant = undefined;
		serialPickerEditLine = undefined;
		serialPickerSelected = [];
		serialPickerOptions = [];
		serialPickerError = undefined;
	}

	function editCartLineSerials(line: CartLine) {
		const row: VariantRow = {
			_id: line.variantId,
			sku: line.sku,
			displayName: line.displayName,
			price: line.unitPrice,
			stock: line.stock,
			attributes: line.attributes,
			trackSerial: true
		};
		void openSerialPicker(row, line.quantity, line);
	}

	function removeCartLine(variantId: string, unitIndex = 0) {
		// P2: xoá đúng dòng theo variant + đơn vị (bán lẻ và bán lốc là 2 dòng riêng)
		cart = cart.filter((l) => !(l.variantId === variantId && (l.unitIndex ?? 0) === unitIndex));
		if (selectedLineId === variantId) selectedLineId = undefined;
	}

	function setCartQuantity(line: CartLine, raw: string) {
		const parsed = Math.max(1, Math.floor(Number(raw) || 1));
		// Line trackSerial: số lượng phải bằng số serial đã chọn — đổi SL → mở lại picker
		if (line.serials && line.serials.length > 0 && parsed !== line.quantity) {
			void editCartLineSerials(line);
			return;
		}
		line.quantity = parsed;
		// P2: so tồn theo quy đổi base (1 lốc = 6 chai → 10 lốc cần 60 chai)
		const needBase = parsed * (line.unitFactor ?? 1);
		if (line.stock !== undefined && needBase > line.stock) {
			showToast(resolveServerMessage(undefined, lang, pageContents.states.stockExceeded), 'warning');
		}
	}

	function changeQuantity(line: CartLine, delta: number) {
		const next = line.quantity + delta;
		if (next < 1) return;
		// Line trackSerial: tăng/giảm SL → mở lại picker để chọn/thu hồi serial tương ứng
		if (line.serials && line.serials.length > 0) {
			void editCartLineSerials(line);
			return;
		}
		line.quantity = next;
		selectedLineId = line.variantId;
		const needBase = next * (line.unitFactor ?? 1);
		if (line.stock !== undefined && needBase > line.stock) {
			showToast(resolveServerMessage(undefined, lang, pageContents.states.stockExceeded), 'warning');
		}
	}

	function attributeText(attrs: Record<string, string | number | undefined> | undefined): string {
		if (!attrs) return '';
		const parts: string[] = [];
		for (const [key, value] of Object.entries(attrs)) {
			if (value === undefined || value === null || value === '') continue;
			parts.push(`${key}: ${String(value)}`);
		}
		return parts.join(', ');
	}

	// ── Mã vạch: thêm tự động khi có mã mới quét ──
	$effect(() => {
		if (scannedCodes.length > 0) void onScannedCodesChange();
	});

	async function onScannedCodesChange() {
		if (!encryptionKeys || scannedCodes.length === 0) return;
		const code = scannedCodes[scannedCodes.length - 1];
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/pos/search',
				{ method: 'POST', body: { search: code, limit: 20, branchId: branchId || undefined } },
				encryptionKeys
			);
			if (response.ok) {
				const items = ((response.data as { items?: VariantRow[] })?.items ?? []) as (VariantRow & { barcode?: string })[];
				const hit = items.find((item) => item.barcode === code) ?? items[0];
				if (hit) addVariantToCart(hit);
				else showToast(resolveServerMessage(undefined, lang, pageContents.states.notFound), 'warning');
			}
		} finally {
			scannedCodes = [];
		}
	}

	// ── Khách hàng ──
	function onCustomerSearchInput() {
		if (customerTimer) clearTimeout(customerTimer);
		customerTimer = setTimeout(() => void runCustomerSearch(), 300);
	}

	async function runCustomerSearch() {
		const keyword = customerSearchKeyword.trim();
		if (!selectedCustomer && !keyword) return;
		if (!encryptionKeys) {
			setTimeout(() => void runCustomerSearch(), 700);
			return;
		}
		customerBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/pos/customers',
				{ method: 'POST', body: { search: keyword, limit: 10 } },
				encryptionKeys
			);
			if (response.ok) {
				customerResults = ((response.data as { items?: CustomerOption[] })?.items ?? []) as CustomerOption[];
				customerDropdownOpen = customerResults.length > 0;
			}
		} finally {
			customerBusy = false;
		}
	}

	function selectCustomer(option: CustomerOption) {
		selectedCustomer = option;
		customerSearchKeyword = option.fullName;
		customerDropdownOpen = false;
	}

	function clearSelectedCustomer() {
		selectedCustomer = undefined;
		customerSearchKeyword = '';
		customerResults = [];
		customerDropdownOpen = false;
	}

	// ── Numpad ──
	function evaluateExpression(text: string): string {
		if (!/^[-+*/().0-9\s]+$/.test(text)) return text;
		try {
			// eslint-disable-next-line no-new-func
			const value = Function(`"use strict"; return (${text})`)() as unknown;
			if (typeof value === 'number' && Number.isFinite(value)) {
				return String(Math.max(0, Math.round(value)));
			}
		} catch {
			// biểu thức lỗi → giữ nguyên
		}
		return text;
	}

	function handleNumpadKey(e: Event) {
		const detail = (e as CustomEvent<string>).detail as NumberKeyAllowed | undefined;
		if (!detail) return;
		e.preventDefault();
		const line = payments[activeNumpadIndex];
		if (!line) return;
		let text = String(line.cashReceived ?? '');
		if (detail === 'ac') {
			text = '';
		} else if (detail === 'del') {
			text = text.slice(0, -1);
		} else if (detail === '=') {
			text = evaluateExpression(text);
		} else if (detail === '.') {
			if (!text.includes('.')) text = text === '' ? '0.' : text + '.';
		} else if (detail === '+' || detail === '-' || detail === 'x' || detail === ':' || detail === '%' || detail === '(' || detail === ')') {
			const symbol = detail === 'x' ? '*' : detail === ':' ? '/' : detail;
			if (/[0-9)]$/.test(text)) text += symbol;
		} else {
			// chữ số 0-9
			text = text === '0' ? detail : text + detail;
		}
		line.cashReceived = text === '' ? 0 : Number(text) || 0;
	}

	function numpadTargetAction(node: HTMLInputElement) {
		node.addEventListener('keydown', handleNumpadKey);
		return {
			destroy() {
				node.removeEventListener('keydown', handleNumpadKey);
			}
		};
	}

	function toggleNumpad(index: number) {
		if (showNumpad && activeNumpadIndex === index) {
			closeNumpad();
			return;
		}
		activeNumpadIndex = index;
		showNumpad = true;
		numberKeyboardState.target = {
			get value() {
				const line = payments[activeNumpadIndex];
				return line && line.cashReceived !== 0 ? String(line.cashReceived) : '';
			},
			set value(v: string) {
				const line = payments[activeNumpadIndex];
				if (line) line.cashReceived = v === undefined || v === '' ? 0 : Number(v) || 0;
			},
			ref: cashInputRef
		};
	}

	function closeNumpad() {
		showNumpad = false;
		numberKeyboardState.target = null;
	}

	$effect(() => {
		if (!payDisplay && showNumpad) closeNumpad();
	});

	// ── Mở modal thanh toán ──
	function openPayModal() {
		if (cart.length === 0) return;
		checkoutError = undefined;
		payments = [{ method: 'cash', amount: payable, cashReceived: 0, auto: true }];
		showNumpad = false;
		activeNumpadIndex = 0;
		payDisplay = true;
	}

	// ── Thêm / xoá / đổi phương thức ──
	function addPaymentLine() {
		if (payments.length >= 4) return;
		// Dòng cuối mới là auto (bổ sung phần còn lại); các dòng trước giữ nguyên
		// amount người dùng đã nhập, trừ khi dòng đó vẫn auto từ init → lúc đó
		// chuyển amount cũ thành 0 để dòng mới nhận đủ phần còn lại và tránh
		// splitMismatch (Σ > payable) ngay khi vừa thêm dòng.
		for (const line of payments) {
			if (line.auto) {
				line.amount = 0;
			}
			line.auto = false;
		}
		payments.push({ method: 'bank_transfer', amount: 0, cashReceived: 0, auto: true });
	}

	function removePaymentLine(index: number) {
		if (payments.length <= 1) return;
		payments.splice(index, 1);
		if (activeNumpadIndex >= payments.length) activeNumpadIndex = 0;
		// Nếu còn nhiều dòng: dòng auto bù phần còn lại; dòng người dùng nhập giữ nguyên.
		// Nếu chỉ còn 1 dòng: auto → amount = payable (Σ luôn khớp).
		const hasAuto = payments.some((l) => l.auto);
		if (!hasAuto) payments[0].auto = true;
	}

	function onPaymentMethodChange(index: number, method: PosPaymentMethod) {
		const line = payments[index];
		if (!line) return;
		line.method = method;
		if (method !== 'cash') line.cashReceived = 0;
	}

	// ── Hoá đơn ──
	function buildReceiptSnapshot(paymentsOut: { method?: string; amount?: number }[] | undefined): ReceiptSnapshot {
		return {
			orderCode: lastOrder?.orderCode ?? '—',
			datetime: new Date().toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US'),
			shopName: shopInfo?.shopName ?? 'Kit Admin',
			customerName: selectedCustomer?.fullName ?? pageContents.customer.walkIn[lang],
			items: cart.map((line) => ({
				displayName: line.displayName,
				sku: line.sku,
				quantity: line.quantity,
				unitPrice: line.unitPrice,
				lineDiscount: clampLineDiscount(line),
				serials: line.serials && line.serials.length > 0 ? [...line.serials] : undefined
			})),
			subtotal: cartTotal,
			discountAmount: totalAmount > payable ? totalAmount - payable : 0,
			totalAmount: payable,
			cashReceived: payments.reduce((sum, line, i) => {
				if (line.method !== 'cash') return sum;
				return sum + (line.cashReceived || effectivePaymentAmount(i));
			}, 0),
			change: lastOrder?.change ?? 0,
			payments: (paymentsOut ?? []).map((p) => ({ method: p.method ?? 'cash', amount: p.amount ?? 0 }))
		};
	}

	function printReceipt() {
		window.print();
	}

	// ── Thanh toán ──
	async function submitCheckout() {
		if (checkoutBusy || !encryptionKeys || cart.length === 0) return;
		if (splitMismatch) {
			checkoutError = resolveServerMessage(undefined, lang, pageContents.payment.splitTotalMismatch);
			return;
		}
		for (let i = 0; i < payments.length; i++) {
			const line = payments[i];
			const eff = effectivePaymentAmount(i);
			// Đơn 0đ (giỏ tặng/đổi trả giá 0): cho phép 1 dòng amount 0 — flow cũ vẫn chạy.
			if (eff < 0 || (eff === 0 && (payable > 0 || payments.length > 1))) {
				checkoutError = resolveServerMessage(undefined, lang, pageContents.payment.splitTotalMismatch);
				return;
			}
			if (line.method === 'cash' && line.cashReceived > 0 && line.cashReceived < eff) {
				checkoutError = resolveServerMessage(undefined, lang, pageContents.payment.splitTotalMismatch);
				return;
			}
		}
		checkoutBusy = true;
		checkoutError = undefined;
		try {
			const body: Record<string, unknown> = {
				items: cart.map((line) => ({
					variantId: line.variantId,
					quantity: line.quantity,
					unitPrice: line.unitPrice,
					lineDiscount: line.lineDiscount > 0 ? clampLineDiscount(line) : undefined,
					serials: line.serials && line.serials.length > 0 ? line.serials : undefined,
					unitIndex: line.unitIndex,
					unitFactor: line.unitFactor
				})),
				payments: payments.map((line, i) => ({
					method: line.method,
					amount: effectivePaymentAmount(i),
					// Không gửi cashReceived khi = 0 (chưa nhập) — backend mặc định
					// tiền nhận = amount, tránh lỗi "cash received less than amount".
					cashReceived: line.method === 'cash' && line.cashReceived > 0 ? line.cashReceived : undefined
				})),
				paymentMethod: payments[0]?.method,
				sessionId: currentSession?._id || undefined,
				branchId: branchId || undefined,
				customerDiscount: customerDiscount > 0 ? customerDiscount : undefined,
				orderDiscountAmount: orderDiscountAmount > 0 ? orderDiscountAmount : undefined,
				customerId: selectedCustomer?._id || undefined,
				notes: orderNotes.trim() ? orderNotes.trim() : undefined
			};
			const response = await encryption.fetchSecure('/api/admin/pos/checkout', { method: 'POST', body }, encryptionKeys);
			if (response.ok) {
				lastOrder = response.data as NonNullable<typeof lastOrder>;
				receiptSnapshot = buildReceiptSnapshot(lastOrder?.payments);
				cart = [];
				selectedLineId = undefined;
				selectedCustomer = undefined;
				customerSearchKeyword = '';
				customerResults = [];
				customerDiscount = 0;
				orderDiscountAmount = 0;
				orderNotes = '';
				payDisplay = false;
				showNumpad = false;
				numberKeyboardState.target = null;
				resultDisplay = true;
				void refreshSession();
			} else {
				checkoutError = resolveServerMessage(response.message, lang, pageContents.states.checkoutFailed);
			}
		} finally {
			checkoutBusy = false;
		}
	}

	// ── Phím tắt ──
	function onPageKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (serialPickerDisplay) {
				closeSerialPicker();
				e.preventDefault();
				return;
			}
			if (receiptDisplay) {
				receiptDisplay = false;
				e.preventDefault();
				return;
			}
			if (payDisplay) {
				payDisplay = false;
				closeNumpad();
				e.preventDefault();
				return;
			}
			if (resultDisplay) {
				resultDisplay = false;
				e.preventDefault();
				return;
			}
			return;
		}
		if (e.key === 'F2') {
			e.preventDefault();
			searchInputRef?.focus();
			searchInputRef?.select();
			return;
		}
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			if (payDisplay) void submitCheckout();
			else openPayModal();
			return;
		}
		if (e.key === 'Enter' && e.target === searchInputRef && searchResults.length > 0) {
			e.preventDefault();
			addVariantToCart(searchResults[0]);
			return;
		}
		if (e.key === 'F3' || e.key === 'F4') {
			if (cart.length === 0) return;
			e.preventDefault();
			let index = cart.findIndex((l) => l.variantId === selectedLineId);
			if (index === -1) index = 0;
			else if (e.key === 'F4') index = (index + 1) % cart.length;
			const line = cart[index];
			if (line) changeQuantity(line, e.key === 'F3' ? 1 : -1);
		}
	}

	// ── Khởi tạo ──
	onMount(() => {
		if (!client.browser) client.browser = {};
		void (async () => {
			const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
			encryptionKeys = { privateKey, publicKey };
			await Promise.all([loadBranches(), refreshSession(), loadShopInfo()]);
		})();
		return () => {
			numberKeyboardState.target = null;
		};
	});
</script>

<svelte:window onkeydown={onPageKeydown} />

<section class="admin-page pos-page">
	<header class="admin-header">
		<div class="admin-header-text">
			<h1 class="admin-title">{pageContents.title[lang]}</h1>
			<p class="admin-subtitle">{pageContents.subtitle[lang]}</p>
		</div>
		<div class="admin-header-actions session-chip">
			{#if currentSession}
				<Badge color="success" data-test="pos-session-badge">
					{pageContents.session.linked[lang]} · {sessionDisplay.deviceId}
					{#if (currentSession.totalSales ?? 0) > 0}
						· {pageContents.session.sales[lang]}: {formatMoney(currentSession.totalSales)}
					{/if}
					{#if currentSession.totalCash !== undefined && (currentSession.totalCash ?? 0) > 0}
						· {pageContents.session.cash[lang]}: {formatMoney(currentSession.totalCash)}
					{/if}
				</Badge>
			{:else}
				<Badge color="warning" data-test="pos-session-badge">{pageContents.session.none[lang]}</Badge>
				<Button color="primary" size="sm" onClick={quickOpenSession} data-test="pos-quick-open-session">
					{pageContents.session.open[lang]}
				</Button>
			{/if}
		</div>
	</header>

	<div class="pos-layout">
		<div class="pos-left">
			<div class="pos-search">
				<label class="form-field">
					<span class="form-label">{pageContents.search.label[lang]} (F2)</span>
					<input
						class="admin-input"
						type="text"
						bind:value={searchKeyword}
						oninput={onSearchInput}
						placeholder={pageContents.search.placeholder[lang]}
						data-test="pos-search-input"
						bind:this={searchInputRef}
					/>
				</label>
				<label class="form-field">
					<span class="form-label">{pageContents.search.scanLabel[lang]}</span>
					<Input
						type="barcode"
						bind:codes={scannedCodes}
						beepOn
						placeholder={pageContents.search.scanLabel[lang]}
						data-test="pos-barcode-input"
					/>
				</label>
			</div>

			{#if searchKeyword.trim()}
				<div class="pos-results" data-test="pos-search-results">
					{#if searchBusy}
						<p class="pos-hint">{pageContents.search.hint[lang]}</p>
					{:else if searchResults.length === 0 && searchDone}
						<p class="pos-hint">{pageContents.search.empty[lang]}</p>
					{:else}
						{#each searchResults as row (row._id)}
							<button class="pos-result-row" data-test="pos-result-row" onclick={() => addVariantToCart(row)}>
								<span class="pos-result-main">
									<span class="pos-result-name">{row.displayName ?? row.sku}</span>
									{#if attributeText(row.attributes)}
										<span class="pos-result-attrs">{attributeText(row.attributes)}</span>
									{/if}
								</span>
								<span class="pos-result-side">
									<span class="pos-result-meta">{row.sku} · {formatMoney(row.price)}</span>
									{#if row.units && row.units.length > 1}
										<!-- P2: bán theo đơn vị — chọn unit (base + quy đổi) ngay trên dòng kết quả -->
										<select
											class="pos-result-unit"
											data-test="pos-result-unit"
											onclick={(e) => e.stopPropagation()}
											onchange={(e) => {
												const idx = Number((e.currentTarget as HTMLSelectElement).value) || 0;
												if (idx > 0) addVariantToCart(row, idx);
												(e.currentTarget as HTMLSelectElement).value = '0';
											}}
										>
											<option value="0">{pageContents.search.sellUnit[lang]}</option>
											{#each row.units as unit, ui (ui)}
												{#if ui > 0}
													<option value={String(ui)}>
														{unit.name} &times; {unit.factor}
														{#if unit.price != null}
															— {formatMoney(unit.price)}
														{:else}
															— {formatMoney(niceRoundPrice((row.price ?? 0) * unit.factor))}
														{/if}
													</option>
												{/if}
											{/each}
										</select>
									{/if}
									<span
										class="pos-result-stock"
										class:pos-result-stock--out={row.stock === 0 || (row.trackSerial && row.serialStock === 0)}
										class:pos-result-stock--unknown={row.stock === undefined}
									>
										{#if row.trackSerial}
											{pageContents.cart.serials[lang]}: {row.serialStock ?? '…'}
										{:else if row.stock === undefined}
											{pageContents.search.stockUnknown[lang]}
										{:else}
											{pageContents.search.stock[lang]}: {row.stock}
										{/if}
									</span>
								</span>
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<div class="pos-right">
			<div class="pos-cart-head">
				<h2 class="pos-cart-title">{pageContents.cart.title[lang]}</h2>
				{#if cart.length > 0}
					<Button color="error" variant="ghost" size="sm" onclick={() => { cart = []; }} data-test="pos-clear-cart">
						{pageContents.cart.clear[lang]}
					</Button>
				{/if}
			</div>

			{#if cart.length === 0}
				<p class="pos-hint" data-test="pos-cart-empty">{pageContents.cart.empty[lang]}</p>
			{:else}
				<div class="pos-cart-list" data-test="pos-cart-list">
					{#each cart as line (line.variantId + ':' + (line.unitIndex ?? 0))}
						<div class="pos-cart-line" class:pos-cart-line--selected={selectedLineId === line.variantId} data-test="pos-cart-line">
							<div class="pos-line-info">
								<span class="pos-line-name">
									{line.displayName}
									{#if line.unitName}
										<span class="pos-line-unit" data-test="pos-line-unit">{line.unitName}</span>
									{/if}
								</span>
								<span class="pos-line-meta">{line.sku} · {formatMoney(line.unitPrice)}</span>
								{#if attributeText(line.attributes)}
									<span class="pos-line-attrs">{attributeText(line.attributes)}</span>
								{/if}
								{#if line.serials && line.serials.length > 0}
									<span class="pos-line-serials" data-test="pos-line-serials">
										<span class="pos-line-serials-label">{pageContents.cart.serials[lang]}:</span>
										{line.serials.join(', ')}
										<button
											class="pos-line-serials-edit"
											onclick={() => editCartLineSerials(line)}
											data-test="pos-edit-serials"
										>
											{pageContents.cart.editSerials[lang]}
										</button>
									</span>
								{/if}
								<span class="pos-line-stock" class:pos-line-stock--warn={line.stock !== undefined && line.quantity > line.stock}>
									{#if line.stock !== undefined}
										{pageContents.cart.stockLabel[lang]}: {line.stock}
										{#if line.quantity > line.stock}
											· <strong class="pos-line-warn">{pageContents.cart.stockWarn[lang]}</strong>
										{/if}
									{/if}
								</span>
								<label class="pos-line-discount">
									<span class="pos-line-discount-label">{pageContents.cart.lineDiscount[lang]}</span>
									<input
										class="admin-input pos-line-discount-input"
										type="text"
										inputmode="numeric"
										value={String(line.lineDiscount || 0)}
										oninput={(e) => {
											line.lineDiscount = Number((e.currentTarget as HTMLInputElement).value.replace(/[^\d]/g, '')) || 0;
										}}
									/>
								</label>
							</div>
							<div class="pos-line-qty">
								<Button variant="outline" size="sm" data-test="pos-qty-minus" onclick={() => changeQuantity(line, -1)}>−</Button>
								<input
									class="admin-input pos-qty-input"
									type="text"
									inputmode="numeric"
									value={String(line.quantity)}
									oninput={(e) => setCartQuantity(line, (e.currentTarget as HTMLInputElement).value)}
									data-test="pos-qty-value"
								/>
								<Button variant="outline" size="sm" data-test="pos-qty-plus" onclick={() => changeQuantity(line, 1)}>+</Button>
							</div>
							<div class="pos-line-side">
								<span class="pos-line-total">{formatMoney(line.unitPrice * line.quantity - clampLineDiscount(line))}</span>
								<Button
									color="error"
									variant="ghost"
									size="sm"
									onClick={() => removeCartLine(line.variantId, line.unitIndex ?? 0)}
									data-test="pos-remove-line"
									aria-label={pageContents.cart.removeLine[lang]}
								>
									✕
								</Button>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<div class="pos-total-row">
				<span>{pageContents.cart.total[lang]}</span>
				<span class="pos-total-value" data-test="pos-cart-total">{formatMoney(cartTotal)}</span>
			</div>
			<Button color="success" size="lg" disabled={cart.length === 0} onClick={openPayModal} data-test="pos-checkout-btn">
				{pageContents.payment.confirm[lang]}
			</Button>
		</div>
	</div>
</section>

{#if payDisplay}
	<Modal bind:display={payDisplay} size="lg" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				<h2 class="pos-modal-title">{pageContents.payment.title[lang]}</h2>
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if checkoutError}
					<div class="form-error-banner" role="alert" data-test="pos-checkout-error">{checkoutError}</div>
				{/if}

				<div class="pos-pay-grid">
					<div class="pos-pay-col">
						<div class="form-field">
							<span class="form-label">{pageContents.customer.label[lang]}</span>
							<div class="pos-customer-picker">
								<input
									class="admin-input"
									type="text"
									bind:value={customerSearchKeyword}
									oninput={onCustomerSearchInput}
									placeholder={pageContents.customer.placeholder[lang]}
									data-test="pos-customer-search"
								/>
								{#if customerDropdownOpen}
									<div class="pos-customer-results" data-test="pos-customer-results">
										{#each customerResults as option (option._id)}
											<button class="pos-customer-result" data-test="pos-customer-result" onclick={() => selectCustomer(option)}>
												<span>{option.fullName}</span>
												<span class="pos-customer-loyalty">{option.loyaltyPoints ?? 0} {pageContents.customer.loyalty[lang]}</span>
											</button>
										{/each}
									</div>
								{/if}
							</div>
							{#if selectedCustomer}
								<div class="pos-customer-chip" data-test="pos-customer-selected">
									<span>{selectedCustomer.fullName}</span>
									<button class="pos-customer-clear" onclick={clearSelectedCustomer} data-test="pos-customer-clear">
										✕
									</button>
								</div>
							{/if}
						</div>

						<div class="form-grid">
							<label class="form-field">
								<span class="form-label">{pageContents.payment.discount[lang]}</span>
								<input class="admin-input" type="number" min="0" max="100" bind:value={customerDiscount} data-test="pos-discount" />
							</label>
							<label class="form-field">
								<span class="form-label">{pageContents.payment.orderDiscount[lang]}</span>
								<input class="admin-input" type="number" min="0" bind:value={orderDiscountAmount} data-test="pos-order-discount" />
							</label>
						</div>

						<label class="form-field">
							<span class="form-label">{pageContents.payment.notes[lang]}</span>
							<textarea class="admin-input pos-notes-input" rows="2" bind:value={orderNotes} placeholder={pageContents.payment.notesPlaceholder[lang]} data-test="pos-order-notes"></textarea>
						</label>

						<div class="pos-total-row pos-pay-total">
							<span>{pageContents.cart.total[lang]}</span>
							<span class="pos-total-value" data-test="pos-payable">{formatMoney(payable)}</span>
						</div>
						<div class="pos-sub-rows">
							{#if totalAmount !== cartTotal}
								<div class="pos-sub-row">
									<span>{pageContents.receipt.subtotal[lang]}</span>
									<span>{formatMoney(cartTotal)}</span>
								</div>
							{/if}
							{#if percentOff > 0 || amountOff > 0}
								<div class="pos-sub-row">
									<span>{pageContents.receipt.discount[lang]}</span>
									<span>−{formatMoney(percentOff + amountOff)}</span>
								</div>
							{/if}
						</div>
					</div>

					<div class="pos-pay-col">
						{#each payments as line, index (index)}
							<div class="pos-payment-line" class:pos-payment-line--active={activeNumpadIndex === index}>
								<div class="form-grid">
									<label class="form-field">
										<span class="form-label">{pageContents.payment.method[lang]}</span>
										<select
											class="admin-select"
											value={line.method}
											onchange={(e) => onPaymentMethodChange(index, (e.currentTarget as HTMLSelectElement).value as PosPaymentMethod)}
											data-test={index === 0 ? 'pos-payment-method' : `pos-payment-method-${index}`}
										>
											{#each paymentMethods as method (method)}
												<option value={method}>{pageContents.payment.methods[method][lang]}</option>
											{/each}
										</select>
									</label>
									<label class="form-field">
										<span class="form-label">{pageContents.payment.amount[lang]}</span>
										<input
											class="admin-input"
											type="text"
											inputmode="decimal"
											value={String(effectivePaymentAmount(index))}
											oninput={(e) => {
												line.auto = false;
												line.amount = Number((e.currentTarget as HTMLInputElement).value.replace(/[^\d]/g, '')) || 0;
											}}
											data-test={index === 0 ? 'pos-payment-amount' : `pos-payment-amount-${index}`}
										/>
									</label>
								</div>
								{#if line.method === 'cash'}
									<div class="form-field">
										<span class="form-label">{pageContents.payment.cashReceived[lang]}</span>
										<div class="pos-cash-row">
											<input
												class="admin-input pos-cash-input"
												type="text"
												inputmode="decimal"
												value={line.cashReceived === 0 ? '' : String(line.cashReceived)}
												oninput={(e) => {
													line.cashReceived = Number((e.currentTarget as HTMLInputElement).value.replace(/[^\d]/g, '')) || 0;
												}}
												use:numpadTargetAction
												bind:this={cashInputRef}
												data-test={index === 0 ? 'pos-cash-received' : `pos-cash-received-${index}`}
											/>
											<Button
												color={activeNumpadIndex === index && showNumpad ? 'primary' : 'default'}
												variant="outline"
												size="sm"
												onClick={() => toggleNumpad(index)}
												data-test={index === 0 ? 'pos-toggle-numpad' : `pos-toggle-numpad-${index}`}
											>
												{activeNumpadIndex === index && showNumpad ? '▼' : '▲'} ⌨
											</Button>
										</div>
									</div>
								{/if}
								{#if payments.length > 1}
									<button class="pos-payment-remove" onclick={() => removePaymentLine(index)} data-test={index === 0 ? 'pos-remove-payment' : `pos-remove-payment-${index}`}>
										{pageContents.payment.removeMethod[lang]}
									</button>
								{/if}
							</div>
						{/each}

						{#if payments.length < 4}
							<Button color="default" variant="outline" size="sm" onClick={addPaymentLine} data-test="pos-add-payment">
								+ {pageContents.payment.addMethod[lang]}
							</Button>
						{/if}

						{#if payments.length > 1}
							<div class="pos-split-row" class:pos-split-row--mismatch={splitMismatch}>
								<span>{pageContents.payment.remaining[lang]}</span>
								<span>{formatMoney(paymentsRemaining)}</span>
							</div>
						{/if}

						{#if payments.some((l) => l.method === 'cash')}
							<div class="pos-change-row">
								<span>{pageContents.payment.change[lang]}</span>
								<span class="pos-change-value" data-test="pos-change">{formatMoney(changeAmount)}</span>
							</div>
						{/if}

						{#if showNumpad}
							<div class="pos-numpad-slot">
								<Keyboard.Number class="pos-numpad-in-modal" />
							</div>
						{/if}
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button
					color="success"
					loading={checkoutBusy}
					disabled={cart.length === 0 || splitMismatch}
					onClick={() => void submitCheckout()}
					data-test="pos-confirm-payment"
				>
					{pageContents.payment.confirm[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={checkoutBusy}
					onClick={() => {
						payDisplay = false;
						showNumpad = false;
						numberKeyboardState.target = null;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

{#if serialPickerDisplay}
	<Modal bind:display={serialPickerDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				<h2 class="pos-modal-title" data-test="pos-serial-picker">
					{pageContents.serial.title[lang]}
					{#if serialPickerVariant?.displayName}
						<span class="pos-serial-variant">· {serialPickerVariant.displayName}</span>
					{/if}
				</h2>
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if serialPickerError}
					<div class="form-error-banner" role="alert" data-test="pos-serial-error">{serialPickerError}</div>
				{/if}
				<p class="pos-serial-need">
					{pageContents.serial.selected[lang]}: <strong data-test="pos-serial-count">{serialPickerSelected.length}</strong>
					/ {serialPickerNeed}
				</p>
				<input
					class="admin-input pos-serial-search"
					type="text"
					bind:value={serialPickerKeyword}
					placeholder={pageContents.serial.searchPlaceholder[lang]}
					data-test="pos-serial-search"
				/>
				{#if serialPickerBusy}
					<p class="pos-hint">{pageContents.states.loading[lang]}</p>
				{:else if serialPickerFiltered.length === 0}
					<p class="pos-hint" data-test="pos-serial-empty">{pageContents.serial.empty[lang]}</p>
				{:else}
					<div class="pos-serial-list" data-test="pos-serial-list">
						{#each serialPickerFiltered as option (option.serial)}
							<button
								class="pos-serial-row"
								class:pos-serial-row--active={serialPickerSelected.includes(option.serial)}
								onclick={() => toggleSerialPick(option.serial)}
								data-test="pos-serial-row"
							>
								<span class="pos-serial-code">{option.serial}</span>
								{#if serialPickerSelected.includes(option.serial)}
									<span class="pos-serial-check">✓</span>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button
					color="success"
					disabled={serialPickerSelected.length !== serialPickerNeed}
					onClick={confirmSerialPicker}
					data-test="pos-serial-confirm"
				>
					{pageContents.serial.confirm[lang]}
				</Button>
				<Button color="default" variant="ghost" onClick={closeSerialPicker}>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

{#if resultDisplay}
	<Modal bind:display={resultDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				<h2 class="pos-modal-title">{pageContents.result.title[lang]}</h2>
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if lastOrder}
					<div class="pos-result-summary" data-test="pos-order-result">
						<p><strong>{pageContents.result.orderCode[lang]}</strong> {lastOrder.orderCode}</p>
						<p><strong>{pageContents.result.paid[lang]}</strong> {formatMoney(lastOrder.totalAmount)}</p>
						<p><strong>{pageContents.result.change[lang]}</strong> {formatMoney(lastOrder.change)}</p>
					</div>
					{#if lastOrderHasQr}
						<div class="pos-qr-box" data-test="pos-qr-payment">
							<p class="pos-qr-title">{pageContents.result.qrTitle[lang]}</p>
							<img class="pos-qr-img" src={lastOrder.qr?.dataUrl} alt="QR" />
							<p class="pos-qr-code">#{lastOrder.paymentCode}</p>
							<p class="pos-qr-hint">{pageContents.result.qrHint[lang]}</p>
						</div>
					{/if}
				{/if}
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button color="primary" onClick={() => { resultDisplay = false; }} data-test="pos-new-order">
					{pageContents.result.newOrder[lang]}
				</Button>
				<Button color="success" variant="outline" onClick={() => { receiptDisplay = true; }} data-test="pos-print-receipt">
					{pageContents.result.printReceipt[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

{#if receiptDisplay}
	<Modal bind:display={receiptDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				<h2 class="pos-modal-title">{pageContents.receipt.title[lang]}</h2>
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if receiptSnapshot}
					<div class="pos-receipt-paper-select">
						<label class="pos-receipt-paper-option">
							<input type="radio" bind:group={receiptPaper} value="58" data-test="pos-receipt-paper-58" />
							{pageContents.receipt.paper58[lang]}
						</label>
						<label class="pos-receipt-paper-option">
							<input type="radio" bind:group={receiptPaper} value="80" data-test="pos-receipt-paper-80" />
							{pageContents.receipt.paper80[lang]}
						</label>
					</div>
					<div class="pos-receipt-preview {receiptPaper === '58' ? 'receipt-paper-58' : 'receipt-paper-80'}" data-test="pos-receipt-preview">
						{#key receiptSnapshot}
							{@render receiptBody(receiptSnapshot)}
						{/key}
					</div>
				{/if}
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button color="success" onClick={printReceipt} data-test="pos-print-confirm">
					{pageContents.receipt.print[lang]}
				</Button>
				<Button color="error" variant="ghost" onClick={() => { receiptDisplay = false; }} data-test="pos-receipt-close">
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

{#snippet receiptBody(snapshot: ReceiptSnapshot)}
	<div class="pos-receipt">
		<div class="pos-receipt-shop">{snapshot.shopName}</div>
		<div class="pos-receipt-datetime">{snapshot.datetime}</div>
		<div class="pos-receipt-row"><span>{pageContents.receipt.orderLabel[lang]}</span><span>{snapshot.orderCode}</span></div>
		<div class="pos-receipt-row"><span>{pageContents.receipt.customerLabel[lang]}</span><span>{snapshot.customerName}</span></div>
		<div class="pos-receipt-sep"></div>
		{#each snapshot.items as item (item.sku + String(item.quantity))}
			<div class="pos-receipt-item">
				<div class="pos-receipt-item-name">{item.displayName}</div>
				{#if item.serials && item.serials.length > 0}
					<div class="pos-receipt-item-serials">SN: {item.serials.join(', ')}</div>
				{/if}
				<div class="pos-receipt-item-row">
					<span>{item.quantity} × {formatMoney(item.unitPrice)}</span>
					<span>{formatMoney(item.unitPrice * item.quantity - item.lineDiscount)}</span>
				</div>
			</div>
		{/each}
		<div class="pos-receipt-sep"></div>
		<div class="pos-receipt-row"><span>{pageContents.receipt.subtotal[lang]}</span><span>{formatMoney(snapshot.subtotal)}</span></div>
		{#if snapshot.discountAmount > 0}
			<div class="pos-receipt-row"><span>{pageContents.receipt.discount[lang]}</span><span>−{formatMoney(snapshot.discountAmount)}</span></div>
		{/if}
		<div class="pos-receipt-row pos-receipt-row--total"><span>{pageContents.receipt.total[lang]}</span><span>{formatMoney(snapshot.totalAmount)}</span></div>
		{#each snapshot.payments as p, i (i)}
			<div class="pos-receipt-row"><span>{p.method}</span><span>{formatMoney(p.amount)}</span></div>
		{/each}
		{#if snapshot.cashReceived > 0}
			<div class="pos-receipt-row"><span>{pageContents.receipt.cashReceived[lang]}</span><span>{formatMoney(snapshot.cashReceived)}</span></div>
			<div class="pos-receipt-row"><span>{pageContents.receipt.change[lang]}</span><span>{formatMoney(snapshot.change)}</span></div>
		{/if}
		<div class="pos-receipt-sep"></div>
		<div class="pos-receipt-thank">{pageContents.receipt.thank[lang]}</div>
	</div>
{/snippet}

<!-- Khối chỉ hiện khi in (window.print) -->
{#if receiptSnapshot}
	<div class="pos-receipt-print {receiptPaper === '58' ? 'receipt-paper-58' : 'receipt-paper-80'}" aria-hidden="true">
		{#key receiptSnapshot}
			{@render receiptBody(receiptSnapshot)}
		{/key}
	</div>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;

	.pos-page {
		max-width: 1280px;
	}
	.admin-page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.5rem;
		max-width: 1280px;
		margin: 0 auto;
		width: 100%;
	}
	.admin-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.admin-title {
		font-size: 1.75rem;
		font-weight: 700;
	}
	.admin-subtitle {
		color: var(--foreground-500, #64748b);
		font-size: 0.9rem;
	}
	.session-chip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.pos-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
		gap: 1.25rem;
		align-items: start;
	}
	.pos-left {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.pos-search {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.pos-results {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 26rem;
		overflow-y: auto;
		padding-right: 0.25rem;
	}
	.pos-result-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--default-300, #cbd5e1);
		border-radius: var(--field-radius, 0.5rem);
		background: var(--background, #fff);
		cursor: pointer;
		text-align: left;
		width: 100%;
	}
	.pos-result-row:hover {
		background: var(--default-50, #f8fafc);
	}
	.pos-result-main {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.pos-result-name {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.pos-result-attrs {
		font-size: 0.8rem;
		color: var(--foreground-500, #64748b);
	}
	.pos-result-side {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.15rem;
		flex-shrink: 0;
	}
	.pos-result-meta {
		color: var(--foreground-500, #64748b);
		font-size: 0.85rem;
		white-space: nowrap;
	}
	.pos-result-stock {
		font-size: 0.8rem;
		color: var(--foreground-500, #64748b);
	}
	.pos-result-stock--out {
		color: var(--error, #dc2626);
		font-weight: 600;
	}
	.pos-result-stock--unknown {
		font-style: italic;
	}
	/* P2: select đơn vị bán (Lốc/Thùng) trên dòng kết quả — stopPropagation để không thêm base */
	.pos-result-unit {
		font: inherit;
		font-size: 0.78rem;
		padding: 0.15rem 0.3rem;
		border: 1px solid var(--default-300, #cbd5e1);
		border-radius: 0.4rem;
		background: var(--background, #fff);
		color: var(--foreground);
		max-width: 12rem;
	}
	.pos-hint {
		color: var(--foreground-500, #64748b);
		font-size: 0.9rem;
	}

	.pos-right {
		border: 1px solid var(--default-300, #cbd5e1);
		border-radius: var(--field-radius, 0.75rem);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--background, #fff);
	}
	.pos-cart-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.pos-cart-title {
		font-size: 1.1rem;
		font-weight: 700;
	}
	.pos-cart-list {
		display: flex;
		flex-direction: column;
		max-height: 22rem;
		overflow-y: auto;
	}
	.pos-cart-line {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		gap: 0.75rem;
		padding: 0.6rem 0.25rem;
		border-bottom: 1px solid var(--default-200, #e2e8f0);
		align-items: start;
	}
	.pos-cart-line--selected {
		background: var(--default-50, #f8fafc);
	}
	.pos-line-info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}
	.pos-line-name {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	/* P2: badge đơn vị bán (Lốc/Thùng) cạnh tên hàng */
	.pos-line-unit {
		display: inline-block;
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--primary);
		background: color-mix(in srgb, var(--primary) 12%, transparent);
		border-radius: 0.35rem;
		padding: 0.05rem 0.35rem;
		margin-left: 0.3rem;
		vertical-align: middle;
	}
	.pos-line-meta {
		display: block;
		color: var(--foreground-500, #64748b);
		font-size: 0.85rem;
	}
	.pos-line-attrs {
		font-size: 0.8rem;
		color: var(--foreground-500, #64748b);
	}
	.pos-line-serials {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.78rem;
		color: var(--foreground-500, #64748b);
		overflow-wrap: anywhere;
	}
	.pos-line-serials-label {
		font-weight: 600;
	}
	.pos-line-serials-edit {
		border: none;
		background: none;
		color: var(--primary, #2563eb);
		cursor: pointer;
		font-size: 0.78rem;
		padding: 0;
		text-decoration: underline;
	}
	.pos-line-stock {
		font-size: 0.8rem;
		color: var(--foreground-500, #64748b);
	}
	.pos-line-stock--warn {
		color: var(--error, #dc2626);
		font-weight: 600;
	}
	.pos-line-warn {
		color: var(--error, #dc2626);
	}
	.pos-line-discount {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
	}
	.pos-line-discount-label {
		color: var(--foreground-500, #64748b);
		white-space: nowrap;
	}
	.pos-line-discount-input {
		width: 6rem;
		min-height: 1.75rem;
		height: 1.75rem;
		padding: 0 0.4rem;
		font-size: 0.8rem;
	}
	.pos-line-qty {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.pos-qty-input {
		width: 3rem;
		height: 2rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.pos-line-side {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
	}
	.pos-line-total {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		white-space: nowrap;
	}
	.pos-total-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-weight: 700;
		border-top: 2px solid var(--default-200, #e2e8f0);
		padding-top: 0.75rem;
	}
	.pos-total-value {
		font-variant-numeric: tabular-nums;
		color: var(--primary, #2563eb);
	}
	.pos-sub-rows {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.pos-sub-row {
		display: flex;
		justify-content: space-between;
		color: var(--foreground-500, #64748b);
		font-size: 0.85rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.form-label {
		font-size: 0.85rem;
		font-weight: 600;
	}
	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.admin-input {
		height: 2.5rem;
		border: 1px solid var(--default-300, #cbd5e1);
		border-radius: var(--field-radius, 0.5rem);
		padding: 0 0.75rem;
		background: var(--background, #fff);
		color: inherit;
		width: 100%;
	}
	.admin-input:focus {
		outline: 2px solid var(--primary, #2563eb);
		outline-offset: -1px;
	}
	.admin-select {
		height: 2.25rem;
		border: 1px solid var(--default-300, #cbd5e1);
		border-radius: var(--field-radius, 0.5rem);
		padding: 0 0.5rem;
		background: var(--background, #fff);
		width: 100%;
	}
	.pos-notes-input {
		height: auto;
		padding: 0.5rem 0.75rem;
		resize: vertical;
		font-family: inherit;
	}
	.form-error-banner {
		background: var(--danger-soft, #fef2f2);
		border-left: 3px solid var(--error, #dc2626);
		color: var(--error, #dc2626);
		padding: 0.6rem 0.9rem;
		border-radius: 0.375rem;
		margin-bottom: 0.75rem;
		font-size: 0.9rem;
	}

	.pos-modal-title {
		font-size: 1.1rem;
		font-weight: 700;
	}
	.pos-pay-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}
	.pos-pay-col {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}
	.pos-customer-picker {
		position: relative;
	}
	.pos-customer-results {
		position: absolute;
		top: calc(100% + 0.25rem);
		left: 0;
		right: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		max-height: 12rem;
		overflow-y: auto;
		border: 1px solid var(--default-300, #cbd5e1);
		border-radius: var(--field-radius, 0.5rem);
		background: var(--background, #fff);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
	}
	.pos-customer-result {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.55rem 0.75rem;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		width: 100%;
	}
	.pos-customer-result:hover {
		background: var(--default-50, #f8fafc);
	}
	.pos-customer-loyalty {
		color: var(--foreground-500, #64748b);
		font-size: 0.8rem;
		white-space: nowrap;
	}
	.pos-customer-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid var(--default-300, #cbd5e1);
		border-radius: 999px;
		padding: 0.25rem 0.75rem;
		font-size: 0.85rem;
		width: fit-content;
	}
	.pos-customer-clear {
		border: none;
		background: none;
		color: var(--error, #dc2626);
		cursor: pointer;
		font-weight: 700;
		padding: 0;
	}
	.pos-pay-total {
		border-top-color: var(--default-300, #cbd5e1);
	}
	.pos-payment-line {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		border: 1px solid var(--default-200, #e2e8f0);
		border-radius: var(--field-radius, 0.5rem);
		padding: 0.75rem;
	}
	.pos-payment-line--active {
		border-color: var(--primary, #2563eb);
	}
	.pos-payment-remove {
		align-self: flex-end;
		border: none;
		background: none;
		color: var(--error, #dc2626);
		font-size: 0.8rem;
		cursor: pointer;
		padding: 0;
	}
	.pos-split-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
		color: var(--foreground-500, #64748b);
	}
	.pos-split-row--mismatch {
		color: var(--error, #dc2626);
		font-weight: 600;
	}
	.pos-cash-row {
		display: flex;
		gap: 0.5rem;
	}
	.pos-cash-input {
		flex: 1;
		min-width: 0;
	}
	.pos-change-row {
		display: flex;
		justify-content: space-between;
		font-weight: 600;
	}
	.pos-change-value {
		font-variant-numeric: tabular-nums;
		color: var(--success-600, #16a34a);
	}
	.pos-numpad-slot {
		width: 100%;
		height: 264px;
	}
	:global(.pos-numpad-in-modal) {
		position: static !important;
		transform: none !important;
		width: 100% !important;
		height: 100% !important;
		z-index: auto !important;
		box-shadow: none;
		border: 1px solid var(--border, var(--default-300, #cbd5e1));
		border-radius: var(--field-radius, 0.5rem);
	}

	.pos-result-summary {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		p {
			display: flex;
			justify-content: space-between;
			gap: 0.75rem;
			strong {
				color: var(--foreground-500, #64748b);
				font-weight: 600;
			}
		}
	}
	.pos-qr-box {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		border: 1px dashed var(--default-300, #cbd5e1);
		border-radius: var(--field-radius, 0.5rem);
		padding: 1rem;
	}
	.pos-qr-title {
		font-weight: 600;
	}
	.pos-qr-img {
		width: 200px;
		height: 200px;
		background: #fff;
	}
	.pos-qr-code {
		font-family: monospace;
		font-size: 0.82rem;
		overflow-wrap: anywhere;
	}
	.pos-qr-hint {
		color: var(--foreground-500, #64748b);
		font-size: 0.82rem;
		text-align: center;
	}

	// Serial picker modal
	.pos-serial-variant {
		font-weight: 400;
		font-size: 0.85rem;
		color: var(--foreground-500, #64748b);
	}
	.pos-serial-need {
		font-size: 0.9rem;
		color: var(--foreground-500, #64748b);
		strong {
			color: var(--primary, #2563eb);
			font-size: 1rem;
		}
	}
	.pos-serial-search {
		margin-bottom: 0.75rem;
	}
	.pos-serial-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-height: 18rem;
		overflow-y: auto;
		padding-right: 0.25rem;
	}
	.pos-serial-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--default-300, #cbd5e1);
		border-radius: var(--field-radius, 0.5rem);
		background: var(--background, #fff);
		cursor: pointer;
		text-align: left;
		width: 100%;
	}
	.pos-serial-row:hover {
		background: var(--default-50, #f8fafc);
	}
	.pos-serial-row--active {
		border-color: var(--primary, #2563eb);
		background: var(--primary-soft, #eff6ff);
	}
	.pos-serial-code {
		font-family: monospace;
		font-size: 0.9rem;
		overflow-wrap: anywhere;
	}
	.pos-serial-check {
		color: var(--primary, #2563eb);
		font-weight: 700;
	}

	.pos-receipt-paper-select {
		display: flex;
		gap: 1rem;
		margin-bottom: 0.75rem;
		font-size: 0.85rem;
	}
	.pos-receipt-paper-option {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
	}
	.pos-receipt-preview {
		border: 1px dashed var(--default-300, #cbd5e1);
		padding: 0.75rem;
		max-height: 50vh;
		overflow-y: auto;
	}
	.receipt-paper-58 {
		width: 58mm;
		margin: 0 auto;
	}
	.receipt-paper-80 {
		width: 80mm;
		margin: 0 auto;
	}

	.pos-receipt {
		font-family: monospace;
		font-size: 0.78rem;
		line-height: 1.35;
		color: #000;
	}
	.pos-receipt-shop {
		text-align: center;
		font-weight: 700;
		font-size: 0.95rem;
	}
	.pos-receipt-datetime {
		text-align: center;
		font-size: 0.72rem;
		margin-bottom: 0.35rem;
	}
	.pos-receipt-row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.pos-receipt-row--total {
		font-weight: 700;
		font-size: 0.9rem;
		margin-top: 0.25rem;
	}
	.pos-receipt-sep {
		border-top: 1px dashed #000;
		margin: 0.35rem 0;
	}
	.pos-receipt-item-name {
		overflow-wrap: anywhere;
	}
	.pos-receipt-item-serials {
		font-size: 0.68rem;
		overflow-wrap: anywhere;
	}
	.pos-receipt-item-row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.pos-receipt-thank {
		text-align: center;
		margin-top: 0.5rem;
	}

	// Khối in: ẩn trên màn hình, chỉ hiện qua @media print
	.pos-receipt-print {
		display: none;
	}

	@media (max-width: 960px) {
		.pos-layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 680px) {
		.form-grid,
		.pos-pay-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.pos-cart-line {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media print {
		:global(body *) {
			visibility: hidden;
		}
		.pos-receipt-print {
			display: block !important;
			visibility: visible;
			position: absolute;
			inset: 0;
			margin: 0;
			padding: 4mm;
			background: #fff;
		}
		.pos-receipt-print .pos-receipt {
			visibility: visible;
		}
		:global(body) {
			margin: 0;
		}
		.receipt-paper-58 {
			width: 58mm;
		}
		.receipt-paper-80 {
			width: 80mm;
		}
	}
</style>
