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
