// src/routes/(storefront)/_interface.ts
// Helper dùng chung cho các trang storefront (copy thuần từ
// (authorized)/admin/_interface.ts resolveServerMessage — hàm pure).
import type { TranslateContent } from '$interfaces/basic';

export const STOREFRONT_CONTENTS = {
	layout: {
		brand: { vi: 'Cửa hàng', en: 'Store' },
		navProducts: { vi: 'Sản phẩm', en: 'Products' },
		navSearch: { vi: 'Tìm kiếm', en: 'Search' },
		navCart: { vi: 'Giỏ hàng', en: 'Cart' },
		navAccount: { vi: 'Tài khoản', en: 'Account' },
		navOrders: { vi: 'Đơn hàng của tôi', en: 'My orders' },
		navAdmin: { vi: 'Trang quản trị', en: 'Admin' },
		footerNote: { vi: 'Cửa hàng trực tuyến — xây dựng trên hệ thống quản lý bán hàng.', en: 'Online store — powered by the sales management system.' }
	},
	landing: {
		heroTitle: { vi: 'Mua sắm đơn giản, giao hàng nhanh', en: 'Simple shopping, fast delivery' },
		heroSubtitle: { vi: 'Khám phá danh mục sản phẩm của chúng tôi và đặt hàng chỉ trong vài bước.', en: 'Explore our catalog and place an order in a few steps.' },
		ctaBrowse: { vi: 'Xem sản phẩm', en: 'Browse products' },
		featureShip: { vi: 'Giao hàng toàn quốc', en: 'Nationwide delivery' },
		featureShipDesc: { vi: 'Đối tác vận chuyển đáng tin cậy, theo dõi đơn dễ dàng.', en: 'Reliable carriers, easy order tracking.' },
		featurePay: { vi: 'Thanh toán linh hoạt', en: 'Flexible payment' },
		featurePayDesc: { vi: 'Tiền mặt, chuyển khoản, MoMo, ZaloPay — tùy bạn chọn.', en: 'Cash, bank transfer, MoMo, ZaloPay — your choice.' },
		featureSupport: { vi: 'Hỗ trợ tận tình', en: 'Dedicated support' },
		featureSupportDesc: { vi: 'Đội ngũ luôn sẵn sàng giải đáp thắc mắc của bạn.', en: 'Our team is always ready to help.' }
	},
	products: {
		title: { vi: 'Sản phẩm', en: 'Products' },
		searchPlaceholder: { vi: 'Tìm sản phẩm…', en: 'Search products…' },
		empty: { vi: 'Chưa có sản phẩm nào.', en: 'No products yet.' },
		addToCart: { vi: 'Thêm vào giỏ', en: 'Add to cart' },
		from: { vi: 'Từ', en: 'From' },
		outOfStock: { vi: 'Hết hàng', en: 'Out of stock' },
		loadFailed: { vi: 'Không tải được sản phẩm', en: 'Failed to load products' },
		addedToCart: { vi: 'Đã thêm vào giỏ hàng', en: 'Added to cart' },
		variantLabel: { vi: 'Phiên bản', en: 'Variant' }
	},
	cart: {
		title: { vi: 'Giỏ hàng', en: 'Cart' },
		empty: { vi: 'Giỏ hàng của bạn đang trống.', en: 'Your cart is empty.' },
		continueShopping: { vi: 'Tiếp tục mua sắm', en: 'Continue shopping' },
		checkout: { vi: 'Tiến hành thanh toán', en: 'Proceed to checkout' },
		promoCode: { vi: 'Mã khuyến mãi', en: 'Promotion code' },
		apply: { vi: 'Áp dụng', en: 'Apply' },
		remove: { vi: 'Xoá', en: 'Remove' },
		clearCart: { vi: 'Xoá giỏ hàng', en: 'Clear cart' },
		subtotal: { vi: 'Tạm tính', en: 'Subtotal' },
		discount: { vi: 'Giảm giá', en: 'Discount' },
		total: { vi: 'Tổng cộng', en: 'Total' },
		quantity: { vi: 'Số lượng', en: 'Quantity' },
		loadFailed: { vi: 'Không tải được giỏ hàng', en: 'Failed to load cart' },
		loginRequired: { vi: 'Bạn cần đăng nhập để xem giỏ hàng.', en: 'Please log in to view your cart.' },
		login: { vi: 'Đăng nhập', en: 'Log in' }
	},
	checkout: {
		title: { vi: 'Thanh toán', en: 'Checkout' },
		stepAddress: { vi: 'Địa chỉ giao hàng', en: 'Shipping address' },
		stepPayment: { vi: 'Phương thức thanh toán', en: 'Payment method' },
		stepReview: { vi: 'Xác nhận đơn hàng', en: 'Review & place order' },
		street: { vi: 'Địa chỉ (số nhà, đường)', en: 'Street address' },
		ward: { vi: 'Phường/Xã', en: 'Ward' },
		district: { vi: 'Quận/Huyện', en: 'District' },
		province: { vi: 'Tỉnh/Thành phố', en: 'Province' },
		postalCode: { vi: 'Mã bưu chính (tùy chọn)', en: 'Postal code (optional)' },
		phoneNumber: { vi: 'Số điện thoại', en: 'Phone number' },
		recipientName: { vi: 'Tên người nhận', en: 'Recipient name' },
		next: { vi: 'Tiếp tục', en: 'Continue' },
		back: { vi: 'Quay lại', en: 'Back' },
		placeOrder: { vi: 'Đặt hàng', en: 'Place order' },
		paymentCash: { vi: 'Tiền mặt tại cửa hàng', en: 'Cash at store' },
		paymentBankTransfer: { vi: 'Chuyển khoản ngân hàng', en: 'Bank transfer' },
		paymentMomo: { vi: 'Ví MoMo', en: 'MoMo wallet' },
		paymentZalopay: { vi: 'Ví ZaloPay', en: 'ZaloPay wallet' },
		paymentCod: { vi: 'Thanh toán khi nhận hàng', en: 'Cash on delivery' },
		invalidShippingAddress: { vi: 'Địa chỉ giao hàng chưa đầy đủ', en: 'Shipping address is incomplete' },
		notesLabel: { vi: 'Ghi chú (tùy chọn)', en: 'Notes (optional)' },
		placeFailed: { vi: 'Đặt hàng thất bại', en: 'Failed to place order' },
		orderSummary: { vi: 'Đơn hàng của bạn', en: 'Your order' },
		shippingTo: { vi: 'Giao đến', en: 'Shipping to' },
		payWith: { vi: 'Thanh toán bằng', en: 'Pay with' },
		loadFailed: { vi: 'Không tải được giỏ hàng', en: 'Failed to load cart' },
		loginRequired: { vi: 'Bạn cần đăng nhập để thanh toán.', en: 'Please log in to checkout.' },
		login: { vi: 'Đăng nhập', en: 'Log in' }
	},
	success: {
		title: { vi: 'Đặt hàng thành công!', en: 'Order placed successfully!' },
		subtitle: { vi: 'Cảm ơn bạn đã mua hàng. Đơn của bạn đang được xử lý.', en: 'Thanks for your purchase. Your order is being processed.' },
		orderCode: { vi: 'Mã đơn hàng', en: 'Order code' },
		continueShopping: { vi: 'Tiếp tục mua sắm', en: 'Continue shopping' },
		qrHint: {
			vi: 'Quét QR bằng app ngân hàng/ví để thanh toán. Hệ thống tự xác nhận khi nhận được giao dịch.',
			en: 'Scan the QR with your banking/e-wallet app to pay. The system auto-confirms when the transaction is received.'
		}
	},
	account: {
		title: { vi: 'Tài khoản của tôi', en: 'My account' },
		greeting: { vi: 'Xin chào', en: 'Hello' },
		infoTitle: { vi: 'Thông tin tài khoản', en: 'Account information' },
		username: { vi: 'Tên đăng nhập', en: 'Username' },
		email: { vi: 'Email', en: 'Email' },
		phone: { vi: 'Số điện thoại', en: 'Phone number' },
		notProvided: { vi: 'Chưa cập nhật', en: 'Not provided' },
		ordersTitle: { vi: 'Đơn hàng của tôi', en: 'My orders' },
		ordersEmpty: { vi: 'Bạn chưa có đơn hàng nào.', en: 'You have no orders yet.' },
		orderCode: { vi: 'Mã đơn', en: 'Order' },
		orderStatus: { vi: 'Trạng thái', en: 'Status' },
		orderTotal: { vi: 'Tổng tiền', en: 'Total' },
		orderDate: { vi: 'Ngày đặt', en: 'Date' },
		orderItems: { vi: 'Sản phẩm', en: 'Items' },
		viewDetails: { vi: 'Xem chi tiết', en: 'View details' },
		hideDetails: { vi: 'Ẩn chi tiết', en: 'Hide details' },
		loadFailed: { vi: 'Không tải được đơn hàng', en: 'Failed to load orders' },
		loginRequired: { vi: 'Bạn cần đăng nhập để xem tài khoản.', en: 'Please log in to view your account.' },
		login: { vi: 'Đăng nhập', en: 'Log in' },
		logout: { vi: 'Đăng xuất', en: 'Log out' },
		continueShopping: { vi: 'Tiếp tục mua sắm', en: 'Continue shopping' }
	},
	search: {
		title: { vi: 'Tìm kiếm', en: 'Search' },
		searchPlaceholder: { vi: 'Nhập tên sản phẩm…', en: 'Search products…' },
		searchButton: { vi: 'Tìm', en: 'Search' },
		resultsFor: { vi: 'Kết quả cho', en: 'Results for' },
		empty: { vi: 'Không tìm thấy sản phẩm nào.', en: 'No products found.' },
		emptyHint: { vi: 'Thử từ khoá khác hoặc xem tất cả sản phẩm.', en: 'Try a different keyword or browse all products.' },
		browseAll: { vi: 'Xem tất cả sản phẩm', en: 'Browse all products' },
		loadFailed: { vi: 'Không tải được sản phẩm', en: 'Failed to load products' },
		addToCart: { vi: 'Thêm vào giỏ', en: 'Add to cart' },
		from: { vi: 'Từ', en: 'From' },
		resultCount: { vi: 'sản phẩm', en: 'products' }
	},
	home: {
		featuredTitle: { vi: 'Sản phẩm mới', en: 'New arrivals' },
		featuredSubtitle: { vi: 'Những sản phẩm mới nhất trong cửa hàng.', en: 'The latest products in our store.' },
		viewAll: { vi: 'Xem tất cả', en: 'View all' },
		addToCart: { vi: 'Thêm vào giỏ', en: 'Add to cart' },
		from: { vi: 'Từ', en: 'From' },
		loadFailed: { vi: 'Không tải được sản phẩm', en: 'Failed to load products' },
		viewDetails: { vi: 'Xem chi tiết', en: 'View details' }
	},
	detail: {
		backToProducts: { vi: '← Quay lại sản phẩm', en: '← Back to products' },
		addToCart: { vi: 'Thêm vào giỏ', en: 'Add to cart' },
		variantLabel: { vi: 'Phiên bản', en: 'Variant' },
		quantity: { vi: 'Số lượng', en: 'Quantity' },
		outOfStock: { vi: 'Hết hàng', en: 'Out of stock' },
		notFound: { vi: 'Không tìm thấy sản phẩm', en: 'Product not found' },
		loadFailed: { vi: 'Không tải được sản phẩm', en: 'Failed to load product' },
		addedToCart: { vi: 'Đã thêm vào giỏ hàng', en: 'Added to cart' },
		relatedTitle: { vi: 'Sản phẩm liên quan', en: 'Related products' },
		from: { vi: 'Từ', en: 'From' },
		goToCart: { vi: 'Xem giỏ hàng', en: 'Go to cart' }
	}
} as const;

/** Lấy nội dung theo lang từ một TranslateContent. */
export function sf(
	content: TranslateContent,
	lang: 'vi' | 'en'
): string {
	return content[lang] ?? content.en ?? '';
}

/** resolveServerMessage copy thuần từ (authorized)/admin/_interface.ts:91. */
export function resolveServerMessage(
	message: unknown,
	lang: 'vi' | 'en',
	fallback: string
): string {
	if (message && typeof message === 'object' && 'vi' in (message as Record<string, unknown>) && 'en' in (message as Record<string, unknown>)) {
		const m = message as TranslateContent;
		return m[lang] || m.en || fallback;
	}
	if (typeof message === 'string' && message) return message;
	return fallback;
}
