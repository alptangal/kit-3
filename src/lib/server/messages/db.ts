//$lib/server/messages/db.ts

import type { TranslateContent } from '$interfaces/basic';
import { couchbase } from '$modules/couchbase';
import type { CollectionName } from '$modules/schema';

const cb = couchbase;
const dataApi = cb.dataApi;
type ApiShape = ReturnType<typeof dataApi<CollectionName>>;
type MessageMapOf<T> = {
	[K in keyof T]: T[K] extends (...args: never[]) => unknown
		? { error: TranslateContent; success: TranslateContent } // là 1 method -> map thành message string
		: T[K] extends object
			? MessageMapOf<T[K]> // là object con -> đệ quy tiếp
			: never;
};

// 3. Type cuối cùng dùng cho users
type UsersMessages = MessageMapOf<ApiShape>;

const managementData = cb.managementData; // hoặc import trực tiếp nếu có export riêng

type ManagementApiShape = ReturnType<typeof managementData>;

type ManagementApiMessageMapOf<T> = {
	[K in keyof T]: T[K] extends (...args: never[]) => infer R
		? R extends Promise<unknown>
			? { error: TranslateContent; success: TranslateContent } // async method -> leaf message
			: R extends object
				? MessageMapOf<R> // factory function (sync, trả về object) -> đệ quy tiếp vào R
				: { error: TranslateContent; success: TranslateContent }
		: T[K] extends object
			? MessageMapOf<T[K]> // object con thường (như organizations, projects) -> đệ quy tiếp
			: never;
};

type ManagementMessages = ManagementApiMessageMapOf<ManagementApiShape>;

export const users: UsersMessages = {
	document: {
		get: {
			success: { vi: 'Lấy thông tin người dùng thành công', en: 'User fetched successfully' },
			error: { vi: 'Lấy thông tin người dùng thất bại', en: 'Failed to fetch user' }
		},
		create: {
			success: { vi: 'Tạo người dùng thành công', en: 'User created successfully' },
			error: { vi: 'Tạo người dùng thất bại', en: 'Failed to create user' }
		},
		update: {
			success: { vi: 'Cập nhật thông tin người dùng thành công', en: 'User updated successfully' },
			error: { vi: 'Cập nhật thông tin người dùng thất bại', en: 'Failed to update user' }
		},
		delete: {
			success: { vi: 'Xoá người dùng thành công', en: 'User deleted successfully' },
			error: { vi: 'Xoá người dùng thất bại', en: 'Failed to delete user' }
		},
		touch: {
			success: {
				vi: 'Cập nhật thời gian hết hạn tài khoản thành công',
				en: 'User expiry updated successfully'
			},
			error: {
				vi: 'Cập nhật thời gian hết hạn tài khoản thất bại',
				en: 'Failed to update user expiry'
			}
		},
		query: {
			success: {
				vi: 'Truy vấn dữ liệu người dùng thành công',
				en: 'User query executed successfully'
			},
			error: { vi: 'Truy vấn dữ liệu người dùng thất bại', en: 'Failed to execute user query' }
		}
	},
	query: {
		collection: {
			create: {
				success: {
					vi: 'Tạo bảng dữ liệu người dùng thành công',
					en: 'User collection created successfully'
				},
				error: {
					vi: 'Tạo bảng dữ liệu người dùng thất bại',
					en: 'Failed to create user collection'
				}
			},
			drop: {
				success: {
					vi: 'Xoá bảng dữ liệu người dùng thành công',
					en: 'User collection dropped successfully'
				},
				error: { vi: 'Xoá bảng dữ liệu người dùng thất bại', en: 'Failed to drop user collection' }
			},
			list: {
				success: {
					vi: 'Lấy danh sách bảng dữ liệu người dùng thành công',
					en: 'User collections listed successfully'
				},
				error: {
					vi: 'Lấy danh sách bảng dữ liệu người dùng thất bại',
					en: 'Failed to list user collections'
				}
			}
		},
		document: {
			search: {
				success: { vi: 'Tìm kiếm người dùng thành công', en: 'Users searched successfully' },
				error: { vi: 'Tìm kiếm người dùng thất bại', en: 'Failed to search users' }
			}
		},
		search: {
			getCount: {
				success: {
					vi: 'Lấy số lượng người dùng được index thành công',
					en: 'User index count fetched successfully'
				},
				error: {
					vi: 'Lấy số lượng người dùng được index thất bại',
					en: 'Failed to fetch user index count'
				}
			},
			searchIndex: {
				success: {
					vi: 'Tìm kiếm người dùng (full-text) thành công',
					en: 'User full-text search completed successfully'
				},
				error: {
					vi: 'Tìm kiếm người dùng (full-text) thất bại',
					en: 'User full-text search failed'
				}
			}
		}
	}
};
// SỬA: Export biến management để các service có thể sử dụng thông điệp dịch của API quản trị
export const management: ManagementMessages = {
	organizations: {
		get: {
			success: { vi: 'Lấy thông tin tổ chức thành công', en: 'Organization fetched successfully' },
			error: { vi: 'Lấy thông tin tổ chức thất bại', en: 'Failed to fetch organization' }
		},
		list: {
			success: { vi: 'Lấy danh sách tổ chức thành công', en: 'Organizations listed successfully' },
			error: { vi: 'Lấy danh sách tổ chức thất bại', en: 'Failed to list organizations' }
		},
		updateConfiguration: {
			success: {
				vi: 'Cập nhật cấu hình tổ chức thành công',
				en: 'Organization configuration updated successfully'
			},
			error: {
				vi: 'Cập nhật cấu hình tổ chức thất bại',
				en: 'Failed to update organization configuration'
			}
		}
	},
	projects: {
		create: {
			success: { vi: 'Tạo dự án thành công', en: 'Project created successfully' },
			error: { vi: 'Tạo dự án thất bại', en: 'Failed to create project' }
		},
		list: {
			success: { vi: 'Lấy danh sách dự án thành công', en: 'Projects listed successfully' },
			error: { vi: 'Lấy danh sách dự án thất bại', en: 'Failed to list projects' }
		},
		get: {
			success: { vi: 'Lấy thông tin dự án thành công', en: 'Project fetched successfully' },
			error: { vi: 'Lấy thông tin dự án thất bại', en: 'Failed to fetch project' }
		},
		update: {
			success: { vi: 'Cập nhật dự án thành công', en: 'Project updated successfully' },
			error: { vi: 'Cập nhật dự án thất bại', en: 'Failed to update project' }
		},
		delete: {
			success: { vi: 'Xoá dự án thành công', en: 'Project deleted successfully' },
			error: { vi: 'Xoá dự án thất bại', en: 'Failed to delete project' }
		}
	},
	cluster: {
		create: {
			success: { vi: 'Tạo cluster thành công', en: 'Cluster created successfully' },
			error: { vi: 'Tạo cluster thất bại', en: 'Failed to create cluster' }
		},
		list: {
			success: { vi: 'Lấy danh sách cluster thành công', en: 'Clusters listed successfully' },
			error: { vi: 'Lấy danh sách cluster thất bại', en: 'Failed to list clusters' }
		},
		get: {
			success: { vi: 'Lấy thông tin cluster thành công', en: 'Cluster fetched successfully' },
			error: { vi: 'Lấy thông tin cluster thất bại', en: 'Failed to fetch cluster' }
		},
		update: {
			success: { vi: 'Cập nhật cluster thành công', en: 'Cluster updated successfully' },
			error: { vi: 'Cập nhật cluster thất bại', en: 'Failed to update cluster' }
		},
		delete: {
			success: { vi: 'Xoá cluster thành công', en: 'Cluster deleted successfully' },
			error: { vi: 'Xoá cluster thất bại', en: 'Failed to delete cluster' }
		},
		getCapacityStatistics: {
			success: {
				vi: 'Lấy thống kê dung lượng thành công',
				en: 'Capacity statistics fetched successfully'
			},
			error: { vi: 'Lấy thống kê dung lượng thất bại', en: 'Failed to fetch capacity statistics' }
		},
		turnOn: {
			success: { vi: 'Bật cluster thành công', en: 'Cluster turned on successfully' },
			error: { vi: 'Bật cluster thất bại', en: 'Failed to turn on cluster' }
		},
		turnOff: {
			success: { vi: 'Tắt cluster thành công', en: 'Cluster turned off successfully' },
			error: { vi: 'Tắt cluster thất bại', en: 'Failed to turn off cluster' }
		}
	},
	buckets: {
		create: {
			success: { vi: 'Tạo bucket thành công', en: 'Bucket created successfully' },
			error: { vi: 'Tạo bucket thất bại', en: 'Failed to create bucket' }
		},
		list: {
			success: { vi: 'Lấy danh sách bucket thành công', en: 'Buckets listed successfully' },
			error: { vi: 'Lấy danh sách bucket thất bại', en: 'Failed to list buckets' }
		},
		get: {
			success: { vi: 'Lấy thông tin bucket thành công', en: 'Bucket fetched successfully' },
			error: { vi: 'Lấy thông tin bucket thất bại', en: 'Failed to fetch bucket' }
		},
		update: {
			success: { vi: 'Cập nhật bucket thành công', en: 'Bucket updated successfully' },
			error: { vi: 'Cập nhật bucket thất bại', en: 'Failed to update bucket' }
		},
		delete: {
			success: { vi: 'Xoá bucket thành công', en: 'Bucket deleted successfully' },
			error: { vi: 'Xoá bucket thất bại', en: 'Failed to delete bucket' }
		}
	},
	scopes: {
		create: {
			success: { vi: 'Tạo scope thành công', en: 'Scope created successfully' },
			error: { vi: 'Tạo scope thất bại', en: 'Failed to create scope' }
		},
		list: {
			success: { vi: 'Lấy danh sách scope thành công', en: 'Scopes listed successfully' },
			error: { vi: 'Lấy danh sách scope thất bại', en: 'Failed to list scopes' }
		},
		get: {
			success: { vi: 'Lấy thông tin scope thành công', en: 'Scope fetched successfully' },
			error: { vi: 'Lấy thông tin scope thất bại', en: 'Failed to fetch scope' }
		},
		delete: {
			success: { vi: 'Xoá scope thành công', en: 'Scope deleted successfully' },
			error: { vi: 'Xoá scope thất bại', en: 'Failed to delete scope' }
		}
	},
	collections: {
		create: {
			success: { vi: 'Tạo collection thành công', en: 'Collection created successfully' },
			error: { vi: 'Tạo collection thất bại', en: 'Failed to create collection' }
		},
		list: {
			success: { vi: 'Lấy danh sách collection thành công', en: 'Collections listed successfully' },
			error: { vi: 'Lấy danh sách collection thất bại', en: 'Failed to list collections' }
		},
		get: {
			success: { vi: 'Lấy thông tin collection thành công', en: 'Collection fetched successfully' },
			error: { vi: 'Lấy thông tin collection thất bại', en: 'Failed to fetch collection' }
		},
		update: {
			success: { vi: 'Cập nhật collection thành công', en: 'Collection updated successfully' },
			error: { vi: 'Cập nhật collection thất bại', en: 'Failed to update collection' }
		},
		delete: {
			success: { vi: 'Xoá collection thành công', en: 'Collection deleted successfully' },
			error: { vi: 'Xoá collection thất bại', en: 'Failed to delete collection' }
		}
	}
};

// MỚI — messages cho mảng nghiệp vụ orders (đơn hàng) + customers (khách hàng).
// Const rời (không tự sinh từ cbData) như pattern của users/products — service
// tham chiếu qua identity (===) để statusForServiceFailure map HTTP status.
export const orders: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy đơn hàng',
		en: 'Order not found'
	},
	queryFailed: {
		vi: 'Lấy danh sách đơn hàng thất bại',
		en: 'Failed to fetch order list'
	},
	createFailed: {
		vi: 'Tạo đơn hàng thất bại',
		en: 'Failed to create order'
	},
	updateFailed: {
		vi: 'Cập nhật đơn hàng thất bại',
		en: 'Failed to update order'
	},
	deleteFailed: {
		vi: 'Xoá đơn hàng thất bại',
		en: 'Failed to delete order'
	},
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	},
	variantNotFound: {
		vi: 'Không tìm thấy biến thể sản phẩm trong đơn',
		en: 'Product variant not found'
	},
	itemsRequired: {
		vi: 'Đơn hàng cần ít nhất 1 sản phẩm',
		en: 'Order requires at least one item'
	},
	customerRequired: {
		vi: 'Đơn hàng cần chọn khách hàng',
		en: 'Order requires a customer'
	},
	invalidStatus: {
		vi: 'Trạng thái đơn hàng không hợp lệ',
		en: 'Invalid order status'
	},
	invalidStatusTransition: {
		vi: 'Không thể chuyển sang trạng thái này',
		en: 'Invalid status transition'
	},
	statusUpdated: {
		vi: 'Cập nhật trạng thái đơn hàng thành công',
		en: 'Order status updated successfully'
	},
	statsFailed: {
		vi: 'Lấy thống kê đơn hàng thất bại',
		en: 'Failed to fetch order statistics'
	},
	customerNotFound: {
		vi: 'Không tìm thấy khách hàng',
		en: 'Customer not found'
	}
};

export const customers: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy khách hàng',
		en: 'Customer not found'
	},
	queryFailed: {
		vi: 'Lấy danh sách khách hàng thất bại',
		en: 'Failed to fetch customer list'
	},
	createFailed: {
		vi: 'Tạo khách hàng thất bại',
		en: 'Failed to create customer'
	},
	updateFailed: {
		vi: 'Cập nhật khách hàng thất bại',
		en: 'Failed to update customer'
	},
	deleteFailed: {
		vi: 'Xoá khách hàng thất bại',
		en: 'Failed to delete customer'
	},
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	},
	statusNotFound: {
		vi: 'Trạng thái không tồn tại trong hệ thống',
		en: 'Status does not exist'
	},
	invalidStatus: {
		vi: 'Trạng thái tài khoản không hợp lệ',
		en: 'Invalid account status'
	},
	statusUpdated: {
		vi: 'Cập nhật trạng thái khách hàng thành công',
		en: 'Customer status updated successfully'
	},
	vaultUninitialized: {
		vi: 'Hệ thống chưa khởi tạo kho mã hoá (systemVault)',
		en: 'System vault has not been initialized'
	}
};

// Phase 5 — messages nghiệp vụ carts (giỏ hàng storefront). Const rời pattern
// orders/customers — CartService tham chiếu qua identity (===).
export const carts: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy giỏ hàng',
		en: 'Cart not found'
	},
	queryFailed: {
		vi: 'Lấy giỏ hàng thất bại',
		en: 'Failed to fetch cart'
	},
	createFailed: {
		vi: 'Tạo giỏ hàng thất bại',
		en: 'Failed to create cart'
	},
	updateFailed: {
		vi: 'Cập nhật giỏ hàng thất bại',
		en: 'Failed to update cart'
	},
	deleteFailed: {
		vi: 'Xoá giỏ hàng thất bại',
		en: 'Failed to delete cart'
	},
	permissionDenied: {
		vi: 'Bạn chỉ có thể thao tác trên giỏ hàng của chính mình',
		en: 'You can only access your own cart'
	},
	variantNotFound: {
		vi: 'Sản phẩm không tồn tại hoặc đã ngừng bán',
		en: 'Product variant not found or unavailable'
	},
	itemsRequired: {
		vi: 'Giỏ hàng cần ít nhất 1 sản phẩm',
		en: 'Cart requires at least one item'
	},
	invalidQuantity: {
		vi: 'Số lượng không hợp lệ',
		en: 'Invalid quantity'
	},
	invalidPromotion: {
		vi: 'Mã khuyến mãi không hợp lệ',
		en: 'Invalid promotion code'
	},
	branchRequired: {
		vi: 'Vui lòng chọn chi nhánh',
		en: 'Please select a branch'
	}
};

// Phase 5 — messages nghiệp vụ checkouts (thanh toán storefront).
export const checkouts: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy phiên thanh toán',
		en: 'Checkout not found'
	},
	queryFailed: {
		vi: 'Lấy phiên thanh toán thất bại',
		en: 'Failed to fetch checkout'
	},
	createFailed: {
		vi: 'Tạo phiên thanh toán thất bại',
		en: 'Failed to create checkout'
	},
	updateFailed: {
		vi: 'Cập nhật phiên thanh toán thất bại',
		en: 'Failed to update checkout'
	},
	permissionDenied: {
		vi: 'Bạn chỉ có thể thao tác trên phiên thanh toán của chính mình',
		en: 'You can only access your own checkout'
	},
	cartEmpty: {
		vi: 'Giỏ hàng trống — không thể thanh toán',
		en: 'Cart is empty — cannot checkout'
	},
	cartNotFound: {
		vi: 'Giỏ hàng không tồn tại hoặc đã hết hạn',
		en: 'Cart not found or expired'
	},
	invalidPaymentMethod: {
		vi: 'Phương thức thanh toán không hợp lệ',
		en: 'Invalid payment method'
	},
	invalidShippingAddress: {
		vi: 'Địa chỉ giao hàng chưa đầy đủ',
		en: 'Shipping address is incomplete'
	},
	orderCreateFailed: {
		vi: 'Tạo đơn hàng thất bại — vui lòng thử lại',
		en: 'Failed to create order — please try again'
	}
};

// ===== Phase 5: Thanh toán (đối soát) =====
export const payments: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy thanh toán',
		en: 'Payment not found'
	},
	queryFailed: {
		vi: 'Lấy danh sách thanh toán thất bại',
		en: 'Failed to fetch payment list'
	},
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	},
	invalidStatus: {
		vi: 'Thanh toán không ở trạng thái chờ xử lý',
		en: 'Payment is not in a pending state'
	},
	invalidMethod: {
		vi: 'Chỉ thanh toán chuyển khoản ngân hàng mới cần đối soát thủ công',
		en: 'Only bank transfer payments require manual reconciliation'
	},
	alreadyProcessed: {
		vi: 'Thanh toán đã được xử lý trước đó',
		en: 'Payment has already been processed'
	},
	reasonRequired: {
		vi: 'Vui lòng nhập lý do đánh dấu thất bại',
		en: 'Please provide a failure reason'
	},
	confirmFailed: {
		vi: 'Xác nhận thanh toán thất bại',
		en: 'Failed to confirm payment'
	},
	markFailedFailed: {
		vi: 'Đánh dấu thanh toán thất bại lỗi',
		en: 'Failed to mark payment as failed'
	},
	statusUpdated: {
		vi: 'Cập nhật trạng thái thanh toán thành công',
		en: 'Payment status updated successfully'
	}
};

// ===== Phase 5: Vận chuyển =====
export const shipments: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy vận đơn',
		en: 'Shipment not found'
	},
	queryFailed: {
		vi: 'Lấy danh sách vận đơn thất bại',
		en: 'Failed to fetch shipment list'
	},
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	},
	invalidStatus: {
		vi: 'Trạng thái vận đơn không hợp lệ',
		en: 'Invalid shipment status'
	},
	updateFailed: {
		vi: 'Cập nhật trạng thái vận đơn thất bại',
		en: 'Failed to update shipment status'
	},
	statusUpdated: {
		vi: 'Cập nhật trạng thái vận đơn thành công',
		en: 'Shipment status updated successfully'
	}
};

// ===== Phase 5: Điều phối đơn hàng (POS + online) =====
export const fulfillment: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy đơn hàng',
		en: 'Order not found'
	},
	queryFailed: {
		vi: 'Lấy hàng chờ xử lý đơn thất bại',
		en: 'Failed to fetch fulfillment queue'
	},
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	},
	invalidStatus: {
		vi: 'Chỉ đơn ở trạng thái paid/confirmed mới có thể xử lý',
		en: 'Only paid/confirmed orders can be fulfilled'
	},
	invalidPickupStatus: {
		vi: 'Chỉ đơn click-and-collect mới có thể chuyển sang chờ nhận tại cửa hàng',
		en: 'Only click-and-collect orders can be marked awaiting pickup'
	},
	fulfillFailed: {
		vi: 'Xử lý đơn hàng thất bại',
		en: 'Failed to fulfill order'
	},
	fulfilled: {
		vi: 'Đã xử lý đơn hàng xong',
		en: 'Order fulfilled successfully'
	},
	awaitingPickup: {
		vi: 'Đã chuyển đơn sang chờ khách nhận tại cửa hàng',
		en: 'Order marked as awaiting pickup'
	},
	statsFailed: {
		vi: 'Lấy thống kê tổng quan thất bại',
		en: 'Failed to fetch dashboard statistics'
	}
};

// ===== Thông báo hệ thống =====
export const notifications: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy thông báo',
		en: 'Notification not found'
	},
	queryFailed: {
		vi: 'Lấy danh sách thông báo thất bại',
		en: 'Failed to fetch notification list'
	},
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	},
	invalidType: {
		vi: 'Loại thông báo không hợp lệ',
		en: 'Invalid notification type'
	},
	createFailed: {
		vi: 'Tạo thông báo thất bại',
		en: 'Failed to create notification'
	},
	markReadFailed: {
		vi: 'Đánh dấu thông báo đã đọc thất bại',
		en: 'Failed to mark notification as read'
	},
	deleteFailed: {
		vi: 'Xoá thông báo thất bại',
		en: 'Failed to delete notification'
	}
};

// ===== Tin nhắn nội bộ =====
export const messages: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy tin nhắn',
		en: 'Message not found'
	},
	queryFailed: {
		vi: 'Lấy danh sách tin nhắn thất bại',
		en: 'Failed to fetch message list'
	},
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	},
	sendFailed: {
		vi: 'Gửi tin nhắn thất bại',
		en: 'Failed to send message'
	},
	markReadFailed: {
		vi: 'Đánh dấu tin nhắn đã đọc thất bại',
		en: 'Failed to mark message as read'
	},
	deleteFailed: {
		vi: 'Xoá tin nhắn thất bại',
		en: 'Failed to delete message'
	},
	invalidRecipient: {
		vi: 'Vui lòng chọn ít nhất một người nhận',
		en: 'Please choose at least one recipient'
	},
	subjectRequired: {
		vi: 'Vui lòng nhập tiêu đề',
		en: 'Please provide a subject'
	}
};

// ===== Email logs =====
export const email_logs: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy email log',
		en: 'Email log not found'
	},
	queryFailed: {
		vi: 'Lấy danh sách email log thất bại',
		en: 'Failed to fetch email log list'
	},
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	},
	invalidStatus: {
		vi: 'Email đã gửi thành công, không thể retry',
		en: 'Email already sent, cannot retry'
	},
	invalidInput: {
		vi: 'Thiếu thông tin email (người nhận/tiêu đề/template)',
		en: 'Missing email info (recipient/subject/template)'
	},
	createFailed: {
		vi: 'Ghi log email thất bại',
		en: 'Failed to create email log'
	},
	retryFailed: {
		vi: 'Retry gửi email thất bại',
		en: 'Failed to retry email'
	},
	deleteFailed: {
		vi: 'Xoá email log thất bại',
		en: 'Failed to delete email log'
	}
};

// ===== Phase 6: Blog / Tin tức =====
export const posts: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy bài viết',
		en: 'Post not found'
	},
	queryFailed: {
		vi: 'Truy vấn bài viết thất bại',
		en: 'Failed to query posts'
	},
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	},
	createFailed: {
		vi: 'Tạo bài viết thất bại',
		en: 'Failed to create post'
	},
	updateFailed: {
		vi: 'Cập nhật bài viết thất bại',
		en: 'Failed to update post'
	},
	deleteFailed: {
		vi: 'Xoá bài viết thất bại',
		en: 'Failed to delete post'
	},
	publishFailed: {
		vi: 'Xuất bản bài viết thất bại',
		en: 'Failed to publish post'
	},
	archiveFailed: {
		vi: 'Lưu trữ bài viết thất bại',
		en: 'Failed to archive post'
	},
	slugTaken: {
		vi: 'Đường dẫn bài viết đã tồn tại trong ngôn ngữ này',
		en: 'A post with this slug already exists for this language'
	},
	invalidStatus: {
		vi: 'Trạng thái bài viết không hợp lệ — chỉ xuất bản được từ bản nháp',
		en: 'Invalid post status — only drafts can be published'
	},
	languageInvalid: {
		vi: 'Ngôn ngữ bài viết không hợp lệ (vi hoặc en)',
		en: 'Invalid post language (vi or en)'
	},
	titleRequired: {
		vi: 'Vui lòng nhập tiêu đề bài viết',
		en: 'Post title is required'
	}
};

export const post_categories: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy danh mục bài viết',
		en: 'Post category not found'
	},
	queryFailed: {
		vi: 'Truy vấn danh mục bài viết thất bại',
		en: 'Failed to query post categories'
	},
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	},
	createFailed: {
		vi: 'Tạo danh mục bài viết thất bại',
		en: 'Failed to create post category'
	},
	updateFailed: {
		vi: 'Cập nhật danh mục bài viết thất bại',
		en: 'Failed to update post category'
	},
	deleteFailed: {
		vi: 'Xoá danh mục bài viết thất bại',
		en: 'Failed to delete post category'
	},
	inUse: {
		vi: 'Không thể xoá — vẫn còn bài viết thuộc danh mục này',
		en: 'Cannot delete — posts still reference this category'
	},
	slugTaken: {
		vi: 'Đường dẫn danh mục đã tồn tại',
		en: 'A category with this slug already exists'
	},
	nameRequired: {
		vi: 'Vui lòng nhập tên danh mục',
		en: 'Category name is required'
	}
};

// ── WebAuthn (passkey / biometric login) ──
export const webauthn: Record<string, TranslateContent> = {
	// registration
	registerOptionsFailed: {
		vi: 'Không thể tạo yêu cầu đăng ký thiết bị. Vui lòng thử lại.',
		en: 'Could not create registration request. Please try again.'
	},
	registerVerifyFailed: {
		vi: 'Xác minh đăng ký thiết bị thất bại',
		en: 'Failed to verify device registration'
	},
	registerSuccess: {
		vi: 'Đã đăng ký thiết bị đăng nhập sinh trắc học',
		en: 'Biometric sign-in device registered'
	},
	registerAlreadyExists: {
		vi: 'Thiết bị này đã được đăng ký trước đó',
		en: 'This device has already been registered'
	},
	// authentication
	authOptionsFailed: {
		vi: 'Không thể tạo yêu cầu đăng nhập. Vui lòng thử lại.',
		en: 'Could not create sign-in request. Please try again.'
	},
	authVerifyFailed: {
		vi: 'Xác minh đăng nhập thất bại',
		en: 'Sign-in verification failed'
	},
	authSuccess: {
		vi: 'Đăng nhập bằng sinh trắc học thành công',
		en: 'Biometric sign-in successful'
	},
	challengeExpired: {
		vi: 'Phiên xác thực đã hết hạn. Vui lòng thử lại.',
		en: 'Authentication session expired. Please try again.'
	},
	credentialNotFound: {
		vi: 'Thiết bị này chưa được đăng ký trên hệ thống',
		en: 'This device is not registered on the system'
	},
	counterMismatch: {
		vi: 'Phát hiện dấu hiệu bất thường trên thiết bị. Đăng nhập bị từ chối.',
		en: 'Unusual device activity detected. Sign-in rejected.'
	},
	userHandleMismatch: {
		vi: 'Thiết bị không thuộc về tài khoản này',
		en: 'Device does not belong to this account'
	},
	// credentials management
	listFailed: {
		vi: 'Không thể tải danh sách thiết bị',
		en: 'Could not load device list'
	},
	renameSuccess: {
		vi: 'Đã đổi tên thiết bị',
		en: 'Device renamed'
	},
	renameFailed: {
		vi: 'Đổi tên thiết bị thất bại',
		en: 'Failed to rename device'
	},
	nameTooLong: {
		vi: 'Tên thiết bị quá dài (tối đa 64 ký tự)',
		en: 'Device name is too long (max 64 characters)'
	},
	deleteSuccess: {
		vi: 'Đã xoá thiết bị',
		en: 'Device removed'
	},
	deleteFailed: {
		vi: 'Xoá thiết bị thất bại',
		en: 'Failed to remove device'
	},
	notFound: {
		vi: 'Không tìm thấy thiết bị',
		en: 'Device not found'
	},
	notOwned: {
		vi: 'Bạn không có quyền với thiết bị này',
		en: 'You do not have permission for this device'
	},
	userIdRequired: {
		vi: 'Thiếu thông tin người dùng',
		en: 'Missing user information'
	},
	credentialIdRequired: {
		vi: 'Thiếu thông tin thiết bị',
		en: 'Missing device information'
	},
	notSupported: {
		vi: 'Thiết bị hoặc trình duyệt không hỗ trợ đăng nhập sinh trắc học',
		en: 'Device or browser does not support biometric sign-in'
	}
};

// ============================================================
// Marketing — campaigns
// ============================================================
export const campaigns: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy chiến dịch',
		en: 'Campaign not found'
	},
	queryFailed: {
		vi: 'Không thể truy vấn danh sách chiến dịch',
		en: 'Failed to query campaigns'
	},
	createFailed: {
		vi: 'Không thể tạo chiến dịch',
		en: 'Failed to create campaign'
	},
	updateFailed: {
		vi: 'Không thể cập nhật chiến dịch',
		en: 'Failed to update campaign'
	},
	deleteFailed: {
		vi: 'Không thể xóa chiến dịch',
		en: 'Failed to delete campaign'
	},
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện hành động này',
		en: 'You do not have permission to perform this action'
	},
	invalidStatusTransition: {
		vi: 'Chuyển trạng thái không hợp lệ',
		en: 'Invalid status transition'
	},
	promotionNotFound: {
		vi: 'Một hoặc nhiều khuyến mãi không tồn tại',
		en: 'One or more promotions do not exist'
	},
	statsFailed: {
		vi: 'Không thể lấy thống kê chiến dịch',
		en: 'Failed to get campaign stats'
	},
	created: {
		vi: 'Đã tạo chiến dịch',
		en: 'Campaign created'
	},
	updated: {
		vi: 'Đã cập nhật chiến dịch',
		en: 'Campaign updated'
	},
	deleted: {
		vi: 'Đã xóa chiến dịch',
		en: 'Campaign deleted'
	},
	launched: {
		vi: 'Đã khởi chạy chiến dịch',
		en: 'Campaign launched'
	},
	paused: {
		vi: 'Đã tạm dừng chiến dịch',
		en: 'Campaign paused'
	},
	completed: {
		vi: 'Đã hoàn thành chiến dịch',
		en: 'Campaign completed'
	},
	cancelled: {
		vi: 'Đã hủy chiến dịch',
		en: 'Campaign cancelled'
	},
	promotionsLinked: {
		vi: 'Đã liên kết khuyến mãi',
		en: 'Promotions linked'
	}
};

// ============================================================
// Social media — accounts
// ============================================================
export const social_accounts: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy tài khoản mạng xã hội',
		en: 'Social account not found'
	},
	queryFailed: {
		vi: 'Không thể truy vấn danh sách tài khoản',
		en: 'Failed to query social accounts'
	},
	connectFailed: {
		vi: 'Không thể kết nối tài khoản',
		en: 'Failed to connect account'
	},
	updateFailed: {
		vi: 'Không thể cập nhật tài khoản',
		en: 'Failed to update account'
	},
	deleteFailed: {
		vi: 'Không thể xóa tài khoản',
		en: 'Failed to delete account'
	},
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện hành động này',
		en: 'You do not have permission to perform this action'
	},
	tokenEncryptionFailed: {
		vi: 'Không thể mã hóa access token',
		en: 'Failed to encrypt access token'
	},
	vaultUninitialized: {
		vi: 'Vault hệ thống chưa được khởi tạo',
		en: 'System vault is not initialized'
	},
	connected: {
		vi: 'Đã kết nối tài khoản',
		en: 'Account connected'
	},
	disconnected: {
		vi: 'Đã ngắt kết nối tài khoản',
		en: 'Account disconnected'
	},
	deleted: {
		vi: 'Đã xóa tài khoản',
		en: 'Account deleted'
	},
	updated: {
		vi: 'Đã cập nhật tài khoản',
		en: 'Account updated'
	}
};

// ============================================================
// Social media — posts
// ============================================================
export const social_posts: Record<string, TranslateContent> = {
	notFound: {
		vi: 'Không tìm thấy bài đăng',
		en: 'Social post not found'
	},
	queryFailed: {
		vi: 'Không thể truy vấn danh sách bài đăng',
		en: 'Failed to query social posts'
	},
	createFailed: {
		vi: 'Không thể tạo bài đăng',
		en: 'Failed to create social post'
	},
	updateFailed: {
		vi: 'Không thể cập nhật bài đăng',
		en: 'Failed to update social post'
	},
	deleteFailed: {
		vi: 'Không thể xóa bài đăng',
		en: 'Failed to delete social post'
	},
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện hành động này',
		en: 'You do not have permission to perform this action'
	},
	invalidStatusTransition: {
		vi: 'Chuyển trạng thái không hợp lệ',
		en: 'Invalid status transition'
	},
	scheduleRequired: {
		vi: 'Thời gian lên lịch là bắt buộc',
		en: 'Scheduled time is required'
	},
	platformAccountMissing: {
		vi: 'Không có tài khoản kết nối cho nền tảng này',
		en: 'No connected account for this platform'
	},
	created: {
		vi: 'Đã tạo bài đăng',
		en: 'Post created'
	},
	deleted: {
		vi: 'Đã xóa bài đăng',
		en: 'Post deleted'
	},
	scheduled: {
		vi: 'Đã lên lịch đăng bài',
		en: 'Post scheduled'
	},
	published: {
		vi: 'Đã đăng bài',
		en: 'Post published'
	},
	cancelled: {
		vi: 'Đã hủy bài đăng',
		en: 'Post cancelled'
	}
};
