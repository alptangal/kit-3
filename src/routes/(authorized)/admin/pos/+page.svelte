<!-- src/routes/(authorized)/admin/pos/+page.svelte -->
<!-- POS terminal: search variants / scan barcode -> cart -> checkout (cash with numpad + change) -->
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

	interface CartLine {
		variantId: string;
		sku: string;
		displayName: string;
		unitPrice: number;
		quantity: number;
	}

	// ── Ngôn ngữ ──
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : (client.browser?.language ?? 'en'));

	const pageContents: { [k: string]: any } = {
		title: { vi: 'Bán hàng POS', en: 'POS terminal' },
		subtitle: {
			vi: 'Quét mã vạch hoặc tìm sản phẩm, thanh toán tại quầy và trừ tồn kho ngay lập tức',
			en: 'Scan barcode or search products, checkout at the counter with instant stock deduction'
		},
		search: {
			label: { vi: 'Tìm sản phẩm', en: 'Search product' },
			placeholder: { vi: 'Tên, SKU hoặc mã vạch…', en: 'Name, SKU or barcode…' },
			hint: { vi: 'Nhập để tìm (tối đa 20 kết quả)', en: 'Type to search (max 20 results)' },
			empty: { vi: 'Không có kết quả', en: 'No results' },
			scanLabel: { vi: 'Quét mã vạch (Enter sau mỗi mã)', en: 'Scan barcode (Enter per code)' }
		},
		cart: {
			title: { vi: 'Giỏ hàng', en: 'Cart' },
			empty: { vi: 'Chưa có sản phẩm — quét mã hoặc chọn từ kết quả tìm kiếm', en: 'No items yet — scan a code or pick from search results' },
			product: { vi: 'Sản phẩm', en: 'Product' },
			price: { vi: 'Đơn giá', en: 'Price' },
			quantity: { vi: 'SL', en: 'Qty' },
			lineTotal: { vi: 'Thành tiền', en: 'Total' },
			total: { vi: 'Tổng cộng', en: 'Grand total' },
			clear: { vi: 'Xoá giỏ', en: 'Clear cart' }
		},
		payment: {
			title: { vi: 'Thanh toán', en: 'Checkout' },
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
			cashReceived: { vi: 'Tiền khách đưa', en: 'Cash received' },
			change: { vi: 'Tiền thừa trả khách', en: 'Change' },
			confirm: { vi: 'Xác nhận thanh toán', en: 'Confirm payment' },
			discount: { vi: 'Giảm giá khách hàng (%)', en: 'Customer discount (%)' }
		},
		session: {
			label: { vi: 'Phiên POS', en: 'POS session' },
			none: { vi: 'Bán không gắn ca', en: 'Selling without session' },
			linked: { vi: 'Đã gắn ca', en: 'Linked to session' },
			open: { vi: 'Mở ca nhanh', en: 'Quick open session' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' },
			checkoutFailed: { vi: 'Thanh toán không thành công', en: 'Checkout failed' },
			added: { vi: 'Đã thêm vào giỏ', en: 'Added to cart' },
			notFound: { vi: 'Không tìm thấy sản phẩm với mã này', en: 'No product found for this code' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		},
		result: {
			title: { vi: 'Hoàn tất đơn hàng', en: 'Order completed' },
			orderCode: { vi: 'Mã đơn', en: 'Order code' },
			paid: { vi: 'Đã thu', en: 'Paid' },
			change: { vi: 'Tiền thừa', en: 'Change' },
			newOrder: { vi: 'Đơn mới', en: 'New order' },
			qrTitle: { vi: 'QR thanh toán — chờ khách quét', en: 'Payment QR — waiting for scan' },
			qrHint: {
				vi: 'Khách quét QR bằng app ngân hàng/ví. Hệ thống tự xác nhận khi tool đối soát thấy giao dịch.',
				en: 'Customer scans with banking/e-wallet app. The system auto-confirms once the checker tool sees the transaction.'
			}
		}
	};

	// ── Cặp khoá RSA ──
	let encryptionKeys = $state<
		| undefined
		| {
				publicKey: CryptoKey;
				privateKey: CryptoKey;
		  }
	>(undefined);

	// ── Danh sách chi nhánh (chọn nơi trừ tồn kho) ──
	let branches = $state<BranchOption[]>([]);
	let branchId = $state('');

	// ── Search ──
	let searchKeyword = $state('');
	let searchResults = $state<VariantRow[]>([]);
	let searchBusy = $state(false);
	let searchDone = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	// ── Barcode scan (Input type=barcode) ──
	let scannedCodes = $state<string[]>([]);

	// ── Cart ──
	let cart = $state<CartLine[]>([]);
	const cartTotal = $derived(cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));

	function addVariantToCart(variant: VariantRow) {
		const existing = cart.find((line) => line.variantId === variant._id);
		if (existing) {
			existing.quantity += 1;
		} else {
			cart.push({
				variantId: variant._id,
				sku: variant.sku ?? variant._id,
				displayName: variant.displayName ?? variant.sku ?? variant._id,
				unitPrice: Number(variant.price ?? 0),
				quantity: 1
			});
		}
	}

	// Mã vạch mới quét → tìm variant theo barcode rồi thêm vào giỏ
	async function onScannedCodesChange() {
		if (scannedCodes.length === 0) return;
		const code = scannedCodes[scannedCodes.length - 1];
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/pos/search',
				{ method: 'POST', body: { search: code, limit: 20 } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { items?: VariantRow[] } | undefined;
				const hit = (data?.items ?? []).find((row) => row.barcode === code);
				if (hit) {
					addVariantToCart(hit);
				} else {
					showToast(pageContents.states.notFound[lang], 'error');
				}
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/pos] scan search failed:', err);
		} finally {
			// Xoá mã đã xử lý để lần quét kế tiếp rỗng — Input codes là source-of-truth
			scannedCodes = [];
		}
	}

	// ── Search debounce ──
	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer);
		const keyword = searchKeyword.trim();
		if (!keyword) {
			searchResults = [];
			searchDone = false;
			return;
		}
		searchTimer = setTimeout(() => void runSearch(keyword), 300);
	}

	async function runSearch(keyword: string) {
		// Keys có thể chưa sẵn sàng (onMount async) → thử lại một lần sau 700ms
		if (!encryptionKeys) {
			searchTimer = setTimeout(() => void runSearch(keyword), 700);
			return;
		}
		searchBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/pos/search',
				{ method: 'POST', body: { search: keyword, limit: 20 } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { items?: VariantRow[] } | undefined;
				searchResults = data?.items ?? [];
				searchDone = true;
			} else {
				searchResults = [];
				searchDone = true;
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/pos] search failed:', err);
		} finally {
			searchBusy = false;
		}
	}

	// ── Session hiện tại ──
	let currentSession = $state<PosSession | null>(null);
	const sessionDisplay = $state<{ deviceId: string }>({ deviceId: 'pos-terminal' });

	// ── Payment modal ──
	let payDisplay = $state(false);
	let paymentMethod = $state<
		'cash' | 'bank_pos' | 'momo' | 'zalopay' | 'bank_transfer' | 'cod' | 'loyalty_points'
	>('cash');
	let cashReceived = $state(0);
	let customerDiscount = $state(0);
	let checkoutBusy = $state(false);
	let checkoutError = $state<string | undefined>(undefined);
	let showNumpad = $state(false);

	// ── Numpad (Keyboard.Number) điều khiển qua numberKeyboardState ──
	let cashInputRef = $state<HTMLInputElement | undefined>(undefined);
	// Bridge: numpad dispatch CustomEvent('keydown', {detail}) vào ref; ta tự xử lý
	// detail qua listener gắn thủ công (action) — event handler attribute Svelte
	// không bắt CustomEvent keydown re-dispatch (probe: self-listener nhận được,
	// onkeydown attr không chạy).
	function numpadTargetAction(node: HTMLInputElement) {
		node.addEventListener('keydown', handleNumpadKey);
		return {
			destroy() {
				node.removeEventListener('keydown', handleNumpadKey);
			}
		};
	}

	const payable = $derived(
		Math.max(0, Math.round(cartTotal * (1 - Math.min(Math.max(customerDiscount, 0), 100) / 100)))
	);
	const changeAmount = $derived(
		paymentMethod === 'cash' ? Math.max(0, cashReceived - payable) : 0
	);

	function openPayModal() {
		if (cart.length === 0) return;
		checkoutError = undefined;
		cashReceived = 0;
		payDisplay = true;
	}

	// Xử lý phím numpad: digits xây chuỗi, 'ac' xoá hết, 'del' xoá 1 ký tự
	function handleNumpadKey(e: Event) {
		const detail = (e as CustomEvent<string>).detail as NumberKeyAllowed | undefined;
		if (!detail) return;
		e.preventDefault();
		let text = String(cashReceived ?? '');
		if (detail === 'ac') {
			text = '';
		} else if (detail === 'del') {
			text = text.slice(0, -1);
		} else if (detail >= '0' && detail <= '9') {
			if (text === '0') text = detail;
			else text += detail;
		} else if (detail === '.') {
			if (!text.includes('.')) text = text === '' ? '0.' : text + '.';
		} else if (detail === '+' || detail === '-' || detail === 'x' || detail === ':' || detail === '%' || detail === '=' || detail === '(' || detail === ')') {
			// Máy tính cho phép cộng dồn: a + b = → dùng '+' nối chuỗi rồi eval an toàn khi '='
			if (detail === '=') {
				text = evaluateExpression(text);
			} else {
				const symbol = detail === 'x' ? '*' : detail === ':' ? '/' : detail;
				if (text && /[0-9)]$/.test(text)) text += symbol;
			}
		}
		cashReceived = text === '' ? 0 : (Number(text) || 0);
	}

	function evaluateExpression(text: string): string {
		if (!/^[-+*/().0-9\s]+$/.test(text) || text.trim() === '') return text;
		try {
			// eslint-disable-next-line no-new-func
			const value = Function(`"use strict"; return (${text})`)() as unknown;
			if (typeof value === 'number' && Number.isFinite(value)) {
				return String(Math.max(0, Math.round(value)));
			}
		} catch {
			/* biểu thức hỏng → giữ nguyên */
		}
		return text;
	}

	function toggleNumpad() {
		showNumpad = !showNumpad;
		if (showNumpad) {
			// Bridge value sync 2 chiều giữa numpad target và cashReceived
			numberKeyboardState.target = {
				get value() {
					return cashReceived === 0 ? '' : String(cashReceived);
				},
				set value(v: string | undefined) {
					cashReceived = v === undefined || v === '' ? 0 : Number(v) || 0;
				},
				ref: cashInputRef
			};
		} else {
			numberKeyboardState.target = null;
		}
	}

	// ── Result modal ──
	let resultDisplay = $state(false);
	let lastOrder = $state<{
		orderCode?: string;
		change?: number;
		totalAmount?: number;
		paymentCode?: string;
		qr?: { payload: string; dataUrl: string };
	} | null>(null);

	const QR_PAY_METHODS = ['momo', 'zalopay', 'bank_transfer'];
	const lastOrderHasQr = $derived(!!lastOrder?.qr?.dataUrl);

	async function submitCheckout() {
		if (checkoutBusy || !encryptionKeys) return;
		if (cart.length === 0) {
			checkoutError = pageContents.cart.empty[lang];
			return;
		}
		if (paymentMethod === 'cash' && cashReceived < payable) {
			checkoutError = pageContents.payment.cashReceived[lang] + ' < ' + pageContents.payment.total?.[lang];
			checkoutError = resolveServerMessage(
				{ vi: 'Tiền khách đưa nhỏ hơn tổng tiền cần thanh toán', en: 'Cash received is less than payable' },
				lang,
				pageContents.states.checkoutFailed[lang]
			);
			return;
		}
		checkoutBusy = true;
		checkoutError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/pos/checkout',
				{
					method: 'POST',
					body: {
						items: cart.map((line) => ({
							variantId: line.variantId,
							quantity: line.quantity,
							unitPrice: line.unitPrice
						})),
						paymentMethod,
						sessionId: currentSession?._id || undefined,
						branchId: branchId || undefined,
						cashReceived: paymentMethod === 'cash' ? cashReceived : undefined,
						customerDiscount: customerDiscount > 0 ? customerDiscount : undefined
					}
				},
				encryptionKeys
			);
			checkoutBusy = false;
			if (response.ok) {
				lastOrder = (response.data as typeof lastOrder) ?? null;
				cart = [];
				payDisplay = false;
				showNumpad = false;
				numberKeyboardState.target = null;
				resultDisplay = true;
				void refreshSession();
			} else {
				checkoutError = resolveServerMessage(response.message, lang, pageContents.states.checkoutFailed[lang]);
			}
		} catch (err) {
			checkoutBusy = false;
			checkoutError = resolveServerMessage(undefined, lang, pageContents.states.requestFailed[lang]);
			if (import.meta.env.DEV) console.error('[admin/pos] checkout failed:', err);
		}
	}

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	function formatMoney(value?: number | null): string {
		if (value === null || value === undefined) return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(value);
	}

	// ── Session helpers ──
	async function refreshSession() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/pos/sessions/current',
				{
					method: 'POST',
					body: { deviceId: sessionDisplay.deviceId }
				},
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { session?: PosSession } | PosSession | undefined;
				currentSession =
					((data as { session?: PosSession })?.session ?? (data as PosSession)) ?? null;
			} else {
				currentSession = null;
			}
		} catch {
			currentSession = null;
		}
	}

	async function quickOpenSession() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/pos/sessions/open',
				{
					method: 'POST',
					body: { deviceId: sessionDisplay.deviceId, openingBalance: 0 }
				},
				encryptionKeys
			);
			if (response.ok) {
				showToast(pageContents.session.open[lang], 'success');
				await refreshSession();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.states.requestFailed[lang]), 'error');
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/pos] quick open session failed:', err);
		}
	}

	async function loadBranches() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/inventory/branches',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			if (response.ok) {
				branches = (response.data as BranchOption[] | undefined) ?? [];
				if (!branchId && branches.length > 0) branchId = branches[0]._id;
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/pos] load branches failed:', err);
		}
	}

	onMount(() => {
		void (async () => {
			if (!client.browser) client.browser = {};
			const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
			encryptionKeys = { privateKey, publicKey };
			await Promise.all([loadBranches(), refreshSession()]);
		})();
		return () => {
			numberKeyboardState.target = null;
		};
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<section class="admin-page pos-page">
	<header class="admin-header">
		<div class="admin-header-text">
			<h1 class="admin-title">{pageContents.title[lang]}</h1>
			<p class="admin-subtitle">{pageContents.subtitle[lang]}</p>
		</div>
		<div class="admin-header-actions session-chip">
			{#if currentSession}
				<Badge color="success" data-test="pos-session-badge"
					>{pageContents.session.linked[lang]} · {currentSession.deviceId ?? ''}</Badge
				>
			{:else}
				<Badge color="warning" data-test="pos-session-badge">{pageContents.session.none[lang]}</Badge>
				<Button color="primary" size="sm" onClick={quickOpenSession} data-test="pos-quick-open-session">
					{pageContents.session.open[lang]}
				</Button>
			{/if}
		</div>
	</header>

	<div class="pos-layout">
		<!-- ── Cột trái: search + kết quả ── -->
		<div class="pos-left">
			<div class="pos-search">
				<label class="form-field">
					<span class="form-label">{pageContents.search.label[lang]}</span>
					<input
						class="admin-input"
						type="text"
						bind:value={searchKeyword}
						oninput={onSearchInput}
						placeholder={pageContents.search.placeholder[lang]}
						data-test="pos-search-input"
					/>
				</label>
				<label class="form-field">
					<span class="form-label">{pageContents.search.scanLabel[lang]}</span>
					<!-- Input type barcode: mỗi mã Enter sẽ push vào codes[] -->
					<Input
						type="barcode"
						bind:codes={scannedCodes}
						beepOn
						placeholder="…"
						data-test="pos-barcode-input"
					/>
				</label>
			</div>

			{#if searchKeyword.trim()}
				<div class="pos-results" data-test="pos-search-results">
					{#if searchBusy}
						<p class="pos-hint">{pageContents.states.loading[lang]}</p>
					{:else if searchResults.length === 0}
						{#if searchDone}
							<p class="pos-hint">{pageContents.search.empty[lang]}</p>
						{/if}
					{:else}
						{#each searchResults as row (row._id)}
							<button
								class="pos-result-row"
								data-test="pos-result-row"
								onclick={() => addVariantToCart(row)}
							>
								<span class="pos-result-name">{row.displayName ?? row.sku}</span>
								<span class="pos-result-meta">{row.sku ?? ''} · {formatMoney(row.price)}</span>
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<!-- ── Cột phải: cart + checkout ── -->
		<div class="pos-right">
			<div class="pos-cart-head">
				<h2 class="pos-cart-title">{pageContents.cart.title[lang]}</h2>
				{#if cart.length > 0}
					<Button
						color="error"
						variant="ghost"
						size="sm"
						onclick={() => {
							cart = [];
						}}
						data-test="pos-clear-cart"
					>
						{pageContents.cart.clear[lang]}
					</Button>
				{/if}
			</div>

			{#if cart.length === 0}
				<p class="pos-hint" data-test="pos-cart-empty">{pageContents.cart.empty[lang]}</p>
			{:else}
				<div class="pos-cart-list" data-test="pos-cart-list">
					{#each cart as line (line.variantId)}
						<div class="pos-cart-line" data-test="pos-cart-line">
							<div class="pos-line-info">
								<span class="pos-line-name">{line.displayName}</span>
								<span class="pos-line-meta">{line.sku} · {formatMoney(line.unitPrice)}</span>
							</div>
							<div class="pos-line-qty">
								<Button
									color="default"
									variant="outline"
									size="sm"
									data-test="pos-qty-minus"
									onclick={() => {
										if (line.quantity <= 1) {
											cart = cart.filter((l) => l.variantId !== line.variantId);
										} else {
											line.quantity -= 1;
										}
									}}>−</Button
								>
								<span class="pos-qty" data-test="pos-qty-value">{line.quantity}</span>
								<Button
									color="default"
									variant="outline"
									size="sm"
									data-test="pos-qty-plus"
									onclick={() => {
										line.quantity += 1;
									}}>+</Button
								>
							</div>
							<div class="pos-line-total">{formatMoney(line.unitPrice * line.quantity)}</div>
						</div>
					{/each}
				</div>
			{/if}

			<div class="pos-total-row">
				<span>{pageContents.cart.total[lang]}</span>
				<span class="pos-total-value" data-test="pos-cart-total">{formatMoney(cartTotal)}</span>
			</div>

			<!-- Quy ước màu nút: thanh toán = success -->
			<Button
				color="success"
				size="lg"
				disabled={cart.length === 0}
				onClick={openPayModal}
				data-test="pos-checkout-btn"
			>
				{pageContents.payment.confirm[lang]}
			</Button>
		</div>
	</div>
</section>

<!-- ── Modal thanh toán ── -->
{#if payDisplay}
	<Modal bind:display={payDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.payment.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if checkoutError}
					<div class="form-error-banner" role="alert" data-test="pos-checkout-error">{checkoutError}</div>
				{/if}
				<div class="form-grid">
					<label class="form-field">
						<span class="form-label">{pageContents.payment.method[lang]}</span>
						<select class="admin-select" bind:value={paymentMethod} data-test="pos-payment-method">
							<option value="cash">{pageContents.payment.methods.cash[lang]}</option>
							<option value="bank_pos">{pageContents.payment.methods.bank_pos[lang]}</option>
							<option value="momo">{pageContents.payment.methods.momo[lang]}</option>
							<option value="zalopay">{pageContents.payment.methods.zalopay[lang]}</option>
							<option value="bank_transfer">{pageContents.payment.methods.bank_transfer[lang]}</option>
							<option value="cod">{pageContents.payment.methods.cod[lang]}</option>
							<option value="loyalty_points">{pageContents.payment.methods.loyalty_points[lang]}</option>
						</select>
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.payment.discount[lang]}</span>
						<input class="admin-input" type="number" min="0" max="100" bind:value={customerDiscount} data-test="pos-discount" />
					</label>
				</div>

				<div class="pos-total-row pos-pay-total">
					<span>{pageContents.cart.total[lang]}</span>
					<span class="pos-total-value" data-test="pos-payable">{formatMoney(payable)}</span>
				</div>

				{#if paymentMethod === 'cash'}
					<div class="form-field">
						<span class="form-label">{pageContents.payment.cashReceived[lang]}</span>
						<div class="pos-cash-row">
							<input
								class="admin-input pos-cash-input"
								type="text"
								inputmode="decimal"
								value={cashReceived === 0 ? '' : String(cashReceived)}
								oninput={(e) => (cashReceived = Number((e.currentTarget as HTMLInputElement).value) || 0)}
								use:numpadTargetAction
								bind:this={cashInputRef}
								data-test="pos-cash-received"
							/>
							<Button
								color="default"
								variant="outline"
								size="sm"
								onClick={toggleNumpad}
								data-test="pos-toggle-numpad"
							>
								{showNumpad ? '▼' : '▲'} ⌨
							</Button>
						</div>
					</div>
					<div class="pos-change-row">
						<span>{pageContents.payment.change[lang]}</span>
						<span class="pos-change-value" data-test="pos-change">{formatMoney(changeAmount)}</span>
					</div>
				{/if}

				{#if showNumpad && paymentMethod === 'cash'}
					<!-- Numpad nằm TRONG modal body: modal phủ trang, numpad ngoài modal
					     sẽ bị modal đè (hit-testing trượt). Trong modal → phím click được. -->
					<div class="pos-numpad-slot">
						<Keyboard.Number class="pos-numpad-in-modal" />
					</div>
				{/if}
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- thanh toán = success -->
				<Button
					color="success"
					loading={checkoutBusy}
					disabled={checkoutBusy}
					onClick={submitCheckout}
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

<!-- ── Modal kết quả ── -->
{#if resultDisplay}
	<Modal bind:display={resultDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.result.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if lastOrder}
					<div class="pos-result-summary" data-test="pos-order-result">
						<p>
							<strong>{pageContents.result.orderCode[lang]}:</strong>
							{lastOrder.orderCode ?? '—'}
						</p>
						<p>
							<strong>{pageContents.result.paid[lang]}:</strong>
							{formatMoney(lastOrder.totalAmount)}
						</p>
						<p>
							<strong>{pageContents.result.change[lang]}:</strong>
							{formatMoney(lastOrder.change)}
						</p>
					</div>
					{#if lastOrderHasQr}
						<!-- QR thanh toán cho khách quét (momo/zalopay/bank_transfer) -->
						<div class="pos-qr-box" data-test="pos-qr-payment">
							<p class="pos-qr-title">{pageContents.result.qrTitle[lang]}</p>
							<img class="pos-qr-img" src={lastOrder.qr!.dataUrl} alt="QR {lastOrder.paymentCode ?? ''}" />
							<p class="pos-qr-code">#{lastOrder.paymentCode ?? '—'}</p>
							<p class="pos-qr-hint">{pageContents.result.qrHint[lang]}</p>
						</div>
					{/if}
				{/if}
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button
					color="primary"
					onClick={() => {
						resultDisplay = false;
					}}
				>
					{pageContents.result.newOrder[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;

	/* Numpad trong modal thanh toán: bỏ fixed bottom của Keyboard.Number,
	   render inline trong modal body — không đè input, không đẩy body margin.
	   Slot chiều cao cố định để 5 hàng phím giãn full-cell thay vì 15px. */
	.pos-numpad-slot {
		width: 100%;
		height: 264px;
	}
	.pos-numpad-slot :global(.pos-numpad-in-modal) {
		position: static !important;
		transform: none !important;
		width: 100% !important;
		height: 100% !important;
		z-index: auto !important;
		box-shadow: none;
		border: var(--border-width, 1px) solid var(--border, hsl(0 0% 88%));
		border-radius: var(--field-radius, 0.75rem);
	}

	.pos-page {
		max-width: 1280px;
	}

	/* QR thanh toán trong modal kết quả — khách quét bằng app ngân hàng/ví */
	.pos-qr-box {
		margin-top: 0.75rem;
		padding: 0.85rem;
		border: 1px dashed var(--default-300, hsl(0 0% 88%));
		border-radius: 0.75rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		text-align: center;
	}
	.pos-qr-title {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--foreground);
	}
	.pos-qr-img {
		width: 200px;
		height: 200px;
		object-fit: contain;
		background: #fff;
		border-radius: 0.5rem;
		padding: 0.35rem;
	}
	.pos-qr-code {
		margin: 0;
		font-family: var(--font-mono, monospace);
		font-size: 0.82rem;
		color: var(--foreground);
		overflow-wrap: anywhere;
	}
	.pos-qr-hint {
		margin: 0;
		font-size: 0.78rem;
		color: var(--foreground-500, #64748b);
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
		color: var(--foreground);
		margin: 0;
	}
	.admin-subtitle {
		color: var(--foreground-500, #64748b);
		margin: 0.25rem 0 0;
	}
	.session-chip {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.pos-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
		gap: 1.25rem;
		align-items: start;
		@media (max-width: 960px) {
			grid-template-columns: 1fr;
		}
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
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
		padding: 0.75rem 1rem;
		border: 1px solid var(--default-300, #e2e8f0);
		border-radius: var(--field-radius, 0.75rem);
		background: var(--background);
		cursor: pointer;
		text-align: left;
		&:hover {
			background: var(--default-50, #f8fafc);
		}
	}
	.pos-result-name {
		font-weight: 600;
		color: var(--foreground);
	}
	.pos-result-meta {
		color: var(--foreground-500, #64748b);
		white-space: nowrap;
	}

	.pos-right {
		border: 1px solid var(--default-300, #e2e8f0);
		border-radius: var(--field-radius, 0.75rem);
		background: var(--background);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.pos-cart-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.pos-cart-title {
		font-size: 1.1rem;
		font-weight: 700;
		margin: 0;
		color: var(--foreground);
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
		align-items: center;
		padding: 0.6rem 0.25rem;
		border-bottom: 1px solid var(--default-200, #eef2f7);
	}
	.pos-line-name {
		font-weight: 600;
		color: var(--foreground);
	}
	.pos-line-meta {
		display: block;
		color: var(--foreground-500, #64748b);
		font-size: 0.85rem;
	}
	.pos-line-qty {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.pos-qty {
		min-width: 2rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.pos-line-total {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		color: var(--foreground);
	}
	.pos-total-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-weight: 700;
		font-size: 1.05rem;
		color: var(--foreground);
		border-top: 2px solid var(--default-200, #eef2f7);
		padding-top: 0.75rem;
	}
	.pos-total-value {
		font-variant-numeric: tabular-nums;
		color: var(--primary, #2563eb);
	}
	.pos-pay-total {
		margin-top: 0.5rem;
	}
	.pos-cash-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.pos-cash-input {
		flex: 1;
	}
	.pos-change-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-weight: 600;
		color: var(--foreground);
		padding: 0.5rem 0.25rem;
	}
	.pos-change-value {
		font-variant-numeric: tabular-nums;
		color: var(--success-600, #16a34a);
	}
	.pos-result-summary {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		p {
			margin: 0;
		}
	}

	.admin-input {
		height: 2.5rem;
		border-radius: var(--field-radius, 0.75rem);
		border: 1px solid var(--default-300, #e2e8f0);
		padding: 0 0.75rem;
		background: var(--background);
		color: var(--foreground);
		width: 100%;
		&:focus {
			outline: 2px solid var(--primary, #2563eb);
			outline-offset: -1px;
		}
	}
	.admin-select {
		height: 2.25rem;
		border-radius: var(--field-radius, 0.75rem);
		border: 1px solid var(--default-300, #e2e8f0);
		padding: 0 0.5rem;
		background: var(--background);
		color: var(--foreground);
		width: 100%;
	}
	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.form-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--foreground);
	}
	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		@media (max-width: 680px) {
			grid-template-columns: 1fr;
		}
	}
	.form-error-banner {
		background: var(--danger-soft, #fef2f2);
		border-left: 3px solid var(--error, #dc2626);
		padding: 0.6rem 0.9rem;
		border-radius: 0.375rem;
		color: var(--foreground);
		margin-bottom: 0.75rem;
	}
	.pos-hint {
		color: var(--foreground-500, #64748b);
		margin: 0;
	}
</style>
