export const collectionSchemas = {
	users: {
		fields: {
			firstname: { type: 'string', searchable: true, sortable: true, selectable: true },
			midname: { type: 'string', searchable: true, sortable: true, selectable: true },
			lastname: { type: 'string', searchable: true, sortable: true, selectable: true },
			description: { type: 'string', searchable: true, sortable: false, selectable: true },

			// Tham chiếu tới name_roles.name — 1 user CHỈ có 1 role (owner/manager/staff/customer)
			roleId: { type: 'string', searchable: true, sortable: true, selectable: true },

			// Tham chiếu tới user_status.name — thay vì hardcode 'active' như trước,
			// giờ trỏ về catalog quản lý được (admin có thể thêm status mới qua UI)
			statusId: { type: 'string', searchable: true, sortable: true, selectable: true },

			emailBlindIndex: { type: 'string', searchable: true, sortable: false, selectable: false },
			phoneBlindIndex: { type: 'string', searchable: true, sortable: false, selectable: false },
			usernameBlindIndex: { type: 'string', searchable: true, sortable: false, selectable: false },

			emailEncrypted: { type: 'string', searchable: false, sortable: false, selectable: true },
			phoneEncrypted: { type: 'string', searchable: false, sortable: false, selectable: true },
			profileEncrypted: { type: 'string', searchable: false, sortable: false, selectable: true },

			vaultSaltB64: { type: 'string', searchable: false, sortable: false, selectable: true },
			vaultDekIvB64: { type: 'string', searchable: false, sortable: false, selectable: true },
			vaultWrappedDekB64: { type: 'string', searchable: false, sortable: false, selectable: true },

			authMethod: { type: 'string', searchable: true, sortable: false, selectable: true },
			webauthnCredentials: { type: 'array', searchable: false, sortable: false, selectable: false },
			webauthnUserHandle: { type: 'string', searchable: true, sortable: false, selectable: true },

			mfaEnabled: { type: 'boolean', searchable: true, sortable: false, selectable: true },
			lastLoginAt: { type: 'date', searchable: false, sortable: true, selectable: true },
			lastLoginIp: { type: 'string', searchable: false, sortable: false, selectable: false },
			remember: { type: 'boolean', searchable: false, sortable: false, selectable: false },

			// Chỉ áp dụng cho role 'customer' — nhân viên/quản lý không cần các field này
			customerTierEncrypted: {
				type: 'string',
				searchable: false,
				sortable: false,
				selectable: true
			},
			loyaltyPoints: { type: 'number', searchable: true, sortable: true, selectable: true },

			// Chỉ áp dụng cho role 'staff'/'manager' — gắn nhân viên với chi nhánh/kho cụ thể
			branchId: { type: 'string', searchable: true, sortable: false, selectable: true },

			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: false, sortable: true, selectable: true },
			deletedAt: { type: 'date', searchable: false, sortable: false, selectable: false }
		}
	},

	webauthn_challenges: {
		fields: {
			challenge: { type: 'string', searchable: false, sortable: false, selectable: true },
			emailBlindIndex: { type: 'string', searchable: false, sortable: false, selectable: true },
			normalizedEmail: { type: 'string', searchable: false, sortable: false, selectable: true },
			passwordEncryptedTemp: {
				type: 'object',
				searchable: false,
				sortable: false,
				selectable: true
			},
			nameTemp: { type: 'string', searchable: false, sortable: false, selectable: true },
			roleTemp: { type: 'string', searchable: false, sortable: false, selectable: true },
			userHandle: { type: 'string', searchable: false, sortable: false, selectable: true },
			createdAt: { type: 'date', searchable: false, sortable: false, selectable: true }
		}
	},

	// ===== Danh mục vai trò — cố định 4 role, nhưng để dạng collection thay vì
	// enum cứng để sau này mở rộng (ví dụ thêm 'accountant', 'warehouse_staff')
	// mà không cần sửa code/migration schema =====
	name_roles: {
		fields: {
			name: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'owner' | 'manager' | 'staff' | 'customer'
			displayName: { type: 'string', searchable: true, sortable: false, selectable: true }, // tên hiển thị UI, đa ngôn ngữ nếu cần
			description: { type: 'string', searchable: true, sortable: false, selectable: true },

			// Cấp bậc phân quyền — dùng để so sánh nhanh "role A có cao hơn role B không"
			// mà không cần join permissions mỗi lần (owner=100, manager=50, staff=10, customer=0)
			level: { type: 'number', searchable: true, sortable: true, selectable: true },

			// Chặn xoá/sửa các role hệ thống (owner/manager/staff/customer) qua UI quản trị,
			// chỉ cho phép thêm role TUỲ CHỈNH mới (isSystem: false)
			isSystem: { type: 'boolean', searchable: true, sortable: false, selectable: true },

			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},

	// ===== Danh mục hành động có thể phân quyền — dạng "resource:action" =====
	permissions: {
		fields: {
			key: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'products:create', 'orders:refund', 'users:manage'
			resource: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'products' | 'orders' | 'users' | 'inventory' | 'reports'
			action: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'create' | 'read' | 'update' | 'delete' | 'refund' | 'manage'
			description: { type: 'string', searchable: true, sortable: false, selectable: true },
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},

	// ===== Bảng nối role <-> permission (many-to-many) — đây là trái tim của RBAC =====
	detail_roles: {
		fields: {
			roleName: { type: 'string', searchable: true, sortable: true, selectable: true }, // tham chiếu name_roles.name
			permissionKey: { type: 'string', searchable: true, sortable: true, selectable: true }, // tham chiếu permissions.key
			// Cho phép override phạm vi (ví dụ 'staff' chỉ được sửa sản phẩm của branch mình, không phải toàn hệ thống)
			scope: { type: 'string', searchable: true, sortable: false, selectable: true }, // 'all' | 'own_branch' | 'own_records'
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},

	// ===== Danh mục trạng thái tài khoản user =====
	user_status: {
		fields: {
			name: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'active' | 'suspended' | 'banned' | 'pending_verification'
			description: { type: 'string', searchable: true, sortable: true, selectable: true },
			// User ở status này có được phép login không (dùng check nhanh ở route login)
			canLogin: { type: 'boolean', searchable: true, sortable: false, selectable: true },
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},

	products: {
		fields: {
			name: { type: 'string', searchable: true, sortable: true, selectable: true },
			description: { type: 'string', searchable: true, sortable: false, selectable: true },
			categoryId: { type: 'string', searchable: true, sortable: true, selectable: true },
			brandId: { type: 'string', searchable: true, sortable: false, selectable: true },

			// Sản phẩm có biến thể hay không — nếu false, tạo đúng 1 variant "mặc định"
			// khi tạo product, để mọi logic phía sau (inventory, orders) đều thống nhất
			// luôn thao tác qua variantId, không phải rẽ nhánh "có/không biến thể"
			hasVariants: { type: 'boolean', searchable: true, sortable: false, selectable: true },

			// Danh sách CÁC LOẠI thuộc tính biến thể mà sản phẩm này dùng
			// vd: [{ name: "size", options: ["S","M","L"] }, { name: "color", options: ["đỏ","xanh"] }]
			variantAttributes: { type: 'array', searchable: false, sortable: false, selectable: true },

			imageUrl: { type: 'string', searchable: false, sortable: false, selectable: true },
			status: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'active' | 'discontinued' | 'draft'

			createdBy: { type: 'string', searchable: true, sortable: false, selectable: true },
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			deletedAt: { type: 'date', searchable: false, sortable: false, selectable: false }
		}
	},

	// ===== Biến thể — đơn vị bán hàng THỰC SỰ, mỗi variant = 1 SKU riêng =====
	product_variants: {
		fields: {
			productId: { type: 'string', searchable: true, sortable: false, selectable: true },
			sku: { type: 'string', searchable: true, sortable: false, selectable: true }, // duy nhất, vd "AT-S-DO"
			barcode: { type: 'string', searchable: true, sortable: false, selectable: true },

			// Cặp thuộc tính xác định biến thể này — vd { size: "S", color: "đỏ" }
			// Lưu dạng object phẳng thay vì array để query trực tiếp WHERE attributes.size = "S"
			attributes: { type: 'object', searchable: false, sortable: false, selectable: true },

			// Tên hiển thị đầy đủ, tự sinh lúc tạo — vd "Áo thun - S - Đỏ", tránh phải join products + format lại mỗi lần hiển thị
			displayName: { type: 'string', searchable: true, sortable: false, selectable: true },

			price: { type: 'number', searchable: true, sortable: true, selectable: true },
			costPrice: { type: 'number', searchable: false, sortable: true, selectable: true },
			weight: { type: 'number', searchable: false, sortable: false, selectable: true }, // phục vụ tính phí ship nếu cần

			trackLot: { type: 'boolean', searchable: true, sortable: false, selectable: true },
			trackExpiry: { type: 'boolean', searchable: true, sortable: false, selectable: true },
			lowStockThreshold: { type: 'number', searchable: false, sortable: false, selectable: true },

			imageUrl: { type: 'string', searchable: false, sortable: false, selectable: true }, // ảnh riêng cho biến thể (vd ảnh theo màu)
			status: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'active' | 'discontinued'

			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			deletedAt: { type: 'date', searchable: false, sortable: false, selectable: false }
		}
	},
	product_variant_attributes: {
		fields: {
			variantId: { type: 'string', searchable: true, sortable: false, selectable: true },
			attributeTypeName: { type: 'string', searchable: true, sortable: false, selectable: true }, // "size"
			value: { type: 'string', searchable: true, sortable: false, selectable: true }, // "S"
			createdAt: { type: 'date', searchable: false, sortable: false, selectable: true }
		}
	},

	// ===== Tồn kho — giờ gắn với variantId, KHÔNG còn productId =====
	inventory_stock: {
		fields: {
			variantId: { type: 'string', searchable: true, sortable: false, selectable: true },
			branchId: { type: 'string', searchable: true, sortable: false, selectable: true },
			quantityOnHand: { type: 'number', searchable: true, sortable: true, selectable: true },
			quantityReserved: { type: 'number', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: false, sortable: true, selectable: true }
		}
	},

	inventory_lots: {
		fields: {
			variantId: { type: 'string', searchable: true, sortable: false, selectable: true },
			branchId: { type: 'string', searchable: true, sortable: false, selectable: true },
			lotNumber: { type: 'string', searchable: true, sortable: false, selectable: true },
			quantityOnHand: { type: 'number', searchable: true, sortable: true, selectable: true },
			manufacturedAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			expiresAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			receivedAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			supplierId: { type: 'string', searchable: true, sortable: false, selectable: true },
			status: { type: 'string', searchable: true, sortable: true, selectable: true },
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},

	stock_movements: {
		fields: {
			variantId: { type: 'string', searchable: true, sortable: false, selectable: true },
			branchId: { type: 'string', searchable: true, sortable: false, selectable: true },
			lotId: { type: 'string', searchable: true, sortable: false, selectable: true },

			type: { type: 'string', searchable: true, sortable: true, selectable: true },
			quantity: { type: 'number', searchable: false, sortable: false, selectable: true },
			quantityBefore: { type: 'number', searchable: false, sortable: false, selectable: true },
			quantityAfter: { type: 'number', searchable: false, sortable: false, selectable: true },

			referenceType: { type: 'string', searchable: true, sortable: false, selectable: true },
			referenceId: { type: 'string', searchable: true, sortable: false, selectable: true },

			performedBy: { type: 'string', searchable: true, sortable: false, selectable: true },
			note: { type: 'string', searchable: false, sortable: false, selectable: true },
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},

	// orders.items giờ chứa variantId thay vì productId — xem phần "items" bên dưới (không cần đổi schema, chỉ đổi shape của array item)
	orders: {
		fields: {
			orderCode: { type: 'string', searchable: true, sortable: false, selectable: true },
			customerId: { type: 'string', searchable: true, sortable: false, selectable: true },
			staffId: { type: 'string', searchable: true, sortable: false, selectable: true },
			branchId: { type: 'string', searchable: true, sortable: false, selectable: true },
			status: { type: 'string', searchable: true, sortable: true, selectable: true },
			items: { type: 'array', searchable: false, sortable: false, selectable: true }, // [{ variantId, lotId?, quantity, price }]
			totalAmount: { type: 'number', searchable: true, sortable: true, selectable: true },
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},
	// ===== Nhà cung cấp =====
	suppliers: {
		fields: {
			name: { type: 'string', searchable: true, sortable: true, selectable: true },
			contactPerson: { type: 'string', searchable: true, sortable: false, selectable: true },
			phoneEncrypted: { type: 'string', searchable: false, sortable: false, selectable: true }, // thông tin liên hệ NCC, mã hoá vì có thể nhạy cảm tuỳ chính sách
			phoneBlindIndex: { type: 'string', searchable: true, sortable: false, selectable: false },
			address: { type: 'string', searchable: false, sortable: false, selectable: true },
			status: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'active' | 'inactive'
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},

	// ===== Phiếu nhập hàng (Purchase Order) =====
	purchase_orders: {
		fields: {
			poCode: { type: 'string', searchable: true, sortable: false, selectable: true },
			supplierId: { type: 'string', searchable: true, sortable: false, selectable: true },
			branchId: { type: 'string', searchable: true, sortable: false, selectable: true },
			status: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled'
			items: { type: 'array', searchable: false, sortable: false, selectable: true }, // [{ variantId, quantity, unitCost, lotNumber?, expiresAt? }]
			totalCost: { type: 'number', searchable: true, sortable: true, selectable: true },
			createdBy: { type: 'string', searchable: true, sortable: false, selectable: true },
			approvedBy: { type: 'string', searchable: false, sortable: false, selectable: true }, // owner/manager duyệt — audit trail
			expectedAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			receivedAt: { type: 'date', searchable: false, sortable: true, selectable: true },
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},

	// ===== Chuyển kho giữa các chi nhánh =====
	stock_transfers: {
		fields: {
			transferCode: { type: 'string', searchable: true, sortable: false, selectable: true },
			fromBranchId: { type: 'string', searchable: true, sortable: false, selectable: true },
			toBranchId: { type: 'string', searchable: true, sortable: false, selectable: true },
			status: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'pending' | 'in_transit' | 'completed' | 'cancelled'
			items: { type: 'array', searchable: false, sortable: false, selectable: true }, // [{ productId, quantity, lotId? }]
			requestedBy: { type: 'string', searchable: true, sortable: false, selectable: true },
			approvedBy: { type: 'string', searchable: false, sortable: false, selectable: true },
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			completedAt: { type: 'date', searchable: false, sortable: true, selectable: true }
		}
	},

	// ===== Kiểm kê kho (Stock Take / Audit) — đối soát tồn thực tế vs tồn hệ thống =====
	stock_takes: {
		fields: {
			branchId: { type: 'string', searchable: true, sortable: false, selectable: true },
			status: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'in_progress' | 'completed' | 'cancelled'
			items: { type: 'array', searchable: false, sortable: false, selectable: true }, // [{ productId, lotId?, systemQuantity, countedQuantity, variance }]
			performedBy: { type: 'string', searchable: true, sortable: false, selectable: true },
			startedAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			completedAt: { type: 'date', searchable: false, sortable: true, selectable: true }
		}
	},
	brands: {
		fields: {
			name: { type: 'string', searchable: true, sortable: true, selectable: true },
			slug: { type: 'string', searchable: true, sortable: false, selectable: true }, // "nike" — dùng cho URL, đảm bảo duy nhất
			logoUrl: { type: 'string', searchable: false, sortable: false, selectable: true },
			description: { type: 'string', searchable: false, sortable: false, selectable: true },
			status: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'active' | 'inactive'
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},
	categories: {
		fields: {
			name: { type: 'string', searchable: true, sortable: true, selectable: true },
			slug: { type: 'string', searchable: true, sortable: false, selectable: true },
			parentId: { type: 'string', searchable: true, sortable: false, selectable: true }, // hỗ trợ category lồng nhau (vd "Thời trang > Nam > Áo")
			status: { type: 'string', searchable: true, sortable: true, selectable: true },
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},
	branches: {
		fields: {
			name: { type: 'string', searchable: true, sortable: true, selectable: true },
			address: { type: 'string', searchable: false, sortable: false, selectable: true },
			managerId: { type: 'string', searchable: true, sortable: false, selectable: true },
			isWarehouse: { type: 'boolean', searchable: true, sortable: false, selectable: true }, // true = kho tổng, false = cửa hàng bán lẻ
			status: { type: 'string', searchable: true, sortable: true, selectable: true },
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},
	payments: {
		fields: {
			orderId: { type: 'string', searchable: true, sortable: false, selectable: true },
			paymentCode: { type: 'string', searchable: true, sortable: false, selectable: true },

			// 'cash' | 'credit_card' | 'bank_transfer' | 'e_wallet' | 'loyalty_points'
			method: { type: 'string', searchable: true, sortable: false, selectable: true },
			amount: { type: 'number', searchable: true, sortable: true, selectable: true },

			// 'pending' | 'completed' | 'failed' | 'refunded'
			status: { type: 'string', searchable: true, sortable: true, selectable: true },

			transactionReference: { type: 'string', searchable: true, sortable: false, selectable: true }, // Mã giao dịch Bank/VNPAY/Momo/Stripe
			notes: { type: 'string', searchable: false, sortable: false, selectable: true },

			processedBy: { type: 'string', searchable: true, sortable: false, selectable: true }, // staffId
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},

	// ===== Đổi / Trả hàng =====
	order_returns: {
		fields: {
			returnCode: { type: 'string', searchable: true, sortable: false, selectable: true },
			orderId: { type: 'string', searchable: true, sortable: false, selectable: true },
			branchId: { type: 'string', searchable: true, sortable: false, selectable: true },
			customerId: { type: 'string', searchable: true, sortable: false, selectable: true },

			// [{ variantId, lotId?, quantity, refundUnitPrice, reason }]
			items: { type: 'array', searchable: false, sortable: false, selectable: true },

			totalRefundAmount: { type: 'number', searchable: true, sortable: true, selectable: true },
			// 'requested' | 'approved' | 'completed' | 'rejected'
			status: { type: 'string', searchable: true, sortable: true, selectable: true },

			handledBy: { type: 'string', searchable: true, sortable: false, selectable: true },
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: false, sortable: true, selectable: true }
		}
	},
	// ===== Phiên làm việc / Ca thu ngân =====
	pos_sessions: {
		fields: {
			sessionCode: { type: 'string', searchable: true, sortable: false, selectable: true },
			branchId: { type: 'string', searchable: true, sortable: false, selectable: true },
			staffId: { type: 'string', searchable: true, sortable: false, selectable: true },

			openingBalance: { type: 'number', searchable: false, sortable: false, selectable: true }, // Tiền đầu ca trong két
			closingBalance: { type: 'number', searchable: false, sortable: false, selectable: true }, // Tiền thực tế lúc kiểm két cuối ca
			expectedBalance: { type: 'number', searchable: false, sortable: false, selectable: true }, // Tiền lý thuyết = đầu ca + doanh thu tiền mặt
			cashDifference: { type: 'number', searchable: true, sortable: true, selectable: true }, // Chênh lệch (thừa/thiếu)

			// 'open' | 'closed'
			status: { type: 'string', searchable: true, sortable: true, selectable: true },

			openedAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			closedAt: { type: 'date', searchable: false, sortable: true, selectable: true },
			notes: { type: 'string', searchable: false, sortable: false, selectable: true }
		}
	},
	// ===== Chương trình khuyến mãi & Mã giảm giá =====
	promotions: {
		fields: {
			code: { type: 'string', searchable: true, sortable: true, selectable: true }, // ví dụ: "SUMMER2026"
			name: { type: 'string', searchable: true, sortable: false, selectable: true },

			// 'percentage' | 'fixed_amount' | 'buy_x_get_y'
			type: { type: 'string', searchable: true, sortable: false, selectable: true },
			value: { type: 'number', searchable: false, sortable: false, selectable: true }, // % giảm hoặc số tiền giảm

			minOrderValue: { type: 'number', searchable: false, sortable: false, selectable: true },
			maxDiscountAmount: { type: 'number', searchable: false, sortable: false, selectable: true },

			usageLimit: { type: 'number', searchable: false, sortable: false, selectable: true },
			usageCount: { type: 'number', searchable: true, sortable: true, selectable: true },

			status: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'active' | 'expired' | 'disabled'
			startAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			endAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},

	// ===== Lịch sử biến động điểm thưởng khách hàng =====
	loyalty_transactions: {
		fields: {
			customerId: { type: 'string', searchable: true, sortable: false, selectable: true },
			orderId: { type: 'string', searchable: true, sortable: false, selectable: true },

			// 'earn' | 'redeem' | 'expire' | 'adjustment'
			type: { type: 'string', searchable: true, sortable: false, selectable: true },
			points: { type: 'number', searchable: true, sortable: true, selectable: true }, // số dương nếu cộng, âm nếu trừ
			balanceAfter: { type: 'number', searchable: false, sortable: false, selectable: true },

			description: { type: 'string', searchable: false, sortable: false, selectable: true },
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	}, // ===== Nhật ký thao tác quản trị & an ninh =====
	audit_logs: {
		fields: {
			userId: { type: 'string', searchable: true, sortable: false, selectable: true },
			userRole: { type: 'string', searchable: true, sortable: false, selectable: true },

			action: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN_FAILED'
			collectionName: { type: 'string', searchable: true, sortable: true, selectable: true },
			documentId: { type: 'string', searchable: true, sortable: false, selectable: true },

			ipAddress: { type: 'string', searchable: true, sortable: false, selectable: true },
			userAgent: { type: 'string', searchable: false, sortable: false, selectable: true },

			// Chi tiết thay đổi { before: {...}, after: {...} }
			changes: { type: 'object', searchable: false, sortable: false, selectable: true },

			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},
	// ===== Thông báo gửi tới người dùng =====
	notifications: {
		fields: {
			userId: { type: 'string', searchable: true, sortable: false, selectable: true }, // Nguồn nhận

			// 'system' | 'order' | 'inventory' | 'promotion' | 'security'
			type: { type: 'string', searchable: true, sortable: false, selectable: true },

			title: { type: 'string', searchable: true, sortable: false, selectable: true },
			body: { type: 'string', searchable: false, sortable: false, selectable: true },

			// Chứa metadata bấm vào điều hướng (vd: { targetUrl: "/orders/123", orderId: "123" })
			data: { type: 'object', searchable: false, sortable: false, selectable: true },

			isRead: { type: 'boolean', searchable: true, sortable: true, selectable: true },
			readAt: { type: 'date', searchable: false, sortable: true, selectable: true },

			// 'in_app' | 'push' | 'email' | 'sms'
			channel: { type: 'string', searchable: true, sortable: false, selectable: true },

			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			deletedAt: { type: 'date', searchable: false, sortable: false, selectable: false }
		}
	},

	// ===== Mẫu thông báo (Template hỗ trợ biến động & đa ngôn ngữ) =====
	notification_templates: {
		fields: {
			code: { type: 'string', searchable: true, sortable: true, selectable: true }, // ví dụ: "ORDER_CREATED_CUSTOMER"
			titleTemplate: { type: 'string', searchable: false, sortable: false, selectable: true }, // "Đơn hàng {{orderCode}} đã tạo thành công"
			bodyTemplate: { type: 'string', searchable: false, sortable: false, selectable: true },

			// 'email' | 'sms' | 'in_app' | 'push'
			channel: { type: 'string', searchable: true, sortable: false, selectable: true },

			status: { type: 'string', searchable: true, sortable: true, selectable: true }, // 'active' | 'inactive'
			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	}, // ===== Hộp thoại / Phòng chat =====
	conversations: {
		fields: {
			// 'internal_staff' (Chat nội bộ) | 'customer_support' (CSKH) | 'group'
			type: { type: 'string', searchable: true, sortable: false, selectable: true },

			title: { type: 'string', searchable: true, sortable: false, selectable: true }, // Tên nhóm chat (nếu có)

			// Danh sách userId tham gia chat
			participantIds: { type: 'array', searchable: false, sortable: false, selectable: true },

			// Nếu là chat CSKH -> gắn trực tiếp với khách hàng và chi nhánh phụ trách
			customerId: { type: 'string', searchable: true, sortable: false, selectable: true },
			branchId: { type: 'string', searchable: true, sortable: false, selectable: true },

			// Trích dẫn tin nhắn mới nhất để hiển thị nhanh trên UI danh sách hội thoại
			lastMessageText: { type: 'string', searchable: false, sortable: false, selectable: true },
			lastMessageAt: { type: 'date', searchable: true, sortable: true, selectable: true },

			// 'open' | 'resolved' | 'archived'
			status: { type: 'string', searchable: true, sortable: true, selectable: true },

			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: false, sortable: true, selectable: true }
		}
	},

	// ===== Chi tiết Tin nhắn =====
	messages: {
		fields: {
			conversationId: { type: 'string', searchable: true, sortable: false, selectable: true },
			senderId: { type: 'string', searchable: true, sortable: false, selectable: true },

			// Hỗ trợ tin nhắn dạng mã hóa End-to-End (E2EE) nếu dùng chung kiến trúc Vault/Crypto hiện tại
			// 'text' | 'image' | 'file' | 'system' | 'encrypted_payload'
			contentType: { type: 'string', searchable: true, sortable: false, selectable: true },

			contentEncrypted: { type: 'string', searchable: false, sortable: false, selectable: true }, // Nội dung tin nhắn mã hóa / văn bản thô
			mediaUrl: { type: 'string', searchable: false, sortable: false, selectable: true }, // URL ảnh / file đính kèm

			// Mảng các userId đã đọc tin nhắn này
			readBy: { type: 'array', searchable: false, sortable: false, selectable: true },

			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			deletedAt: { type: 'date', searchable: false, sortable: false, selectable: false }
		}
	},
	system: {
		fields: {
			initApp: { type: 'object', searchable: true, sortable: false, selectable: true }
		}
	},
	refresh_tokens: {
		fields: {
			// ===== Khóa chính & Tham chiếu =====
			userId: { type: 'string', searchable: true, sortable: false, selectable: true },

			// Hash của refresh token (KHÔNG lưu token thô vì security)
			// Token được hash trước khi lưu — so sánh hash khi verify
			tokenHash: { type: 'string', searchable: true, sortable: false, selectable: false },

			// ===== Metadata Token =====
			// Family ID để detect token reuse attack (rotation chain)
			// Nếu user submit token cũ → invalidate toàn bộ family
			familyId: { type: 'string', searchable: true, sortable: false, selectable: true },

			// Thế hệ token trong family này (theo dõi rotation)
			generation: { type: 'number', searchable: false, sortable: false, selectable: true },

			expiresAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			isRevoked: { type: 'boolean', searchable: true, sortable: false, selectable: true },
			revokedAt: { type: 'date', searchable: false, sortable: true, selectable: true },
			revokedReason: { type: 'string', searchable: true, sortable: false, selectable: true },
			// 'logout' | 'password_changed' | 'suspicious_activity' | 'manual' | 'device_logout'

			// ===== Device & Security Tracking =====
			// Để detect unauthorized access từ device/IP khác
			deviceId: { type: 'string', searchable: true, sortable: false, selectable: true },
			deviceNameEncrypted: { type: 'string', searchable: false, sortable: false, selectable: true },
			deviceTypeEncrypted: { type: 'string', searchable: false, sortable: false, selectable: true },
			// 'web' | 'mobile_ios' | 'mobile_android' | 'desktop'

			ipAddress: { type: 'string', searchable: true, sortable: false, selectable: false }, // audit
			userAgent: { type: 'string', searchable: false, sortable: false, selectable: false }, // audit

			// ===== Sử dụng & Audit =====
			lastUsedAt: { type: 'date', searchable: false, sortable: true, selectable: true },
			usageCount: { type: 'number', searchable: false, sortable: false, selectable: true },

			// Ghi lại mỗi lần refresh -> audit trail
			refreshHistory: { type: 'array', searchable: false, sortable: false, selectable: true },
			// [{ refreshedAt, ipAddress, newTokenHash, generation }]

			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	},

	// ===== Optional: Token Rotation Audit (chi tiết hơn) =====
	token_rotation_logs: {
		fields: {
			userId: { type: 'string', searchable: true, sortable: false, selectable: true },
			oldTokenHash: { type: 'string', searchable: false, sortable: false, selectable: false },
			newTokenHash: { type: 'string', searchable: false, sortable: false, selectable: false },

			action: { type: 'string', searchable: true, sortable: true, selectable: true },
			// 'rotated' | 'revoked' | 'reuse_detected' | 'expired'

			familyId: { type: 'string', searchable: true, sortable: false, selectable: true },
			generation: { type: 'number', searchable: false, sortable: false, selectable: true },

			ipAddress: { type: 'string', searchable: true, sortable: false, selectable: false },
			reason: { type: 'string', searchable: false, sortable: false, selectable: true },

			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true }
		}
	}
} as const;
const collectionSchemasVault = {
	system_secrets: {
		fields: {
			// Discriminator — phân biệt document này thuộc loại nào
			type: { type: 'string', searchable: false, sortable: false, selectable: true },

			// ===== Chỉ có ở document type: 'rsa_keypair' =====
			publicKeyB64: { type: 'string', searchable: false, sortable: false, selectable: true },
			privateKeyEncrypted: { type: 'object', searchable: false, sortable: false, selectable: true }, // {ivB64, ciphertextB64}

			// ===== Vault protection record — CHUNG cho mọi loại secret =====
			// Đây chính là storageRecord trả về từ setupVault(vault_password)
			saltB64: { type: 'string', searchable: false, sortable: false, selectable: true },
			dekIvB64: { type: 'string', searchable: false, sortable: false, selectable: true },
			wrappedDekB64: { type: 'string', searchable: false, sortable: false, selectable: true },

			version: { type: 'number', searchable: false, sortable: false, selectable: true },
			createdAt: { type: 'date', searchable: false, sortable: false, selectable: true },
			rotatedAt: { type: 'date', searchable: false, sortable: false, selectable: true }
		}
	}
} as const;
export type CollectionSchemas = typeof collectionSchemas;
export type CollectionName = keyof CollectionSchemas;
export type FieldOf<C extends CollectionName> = keyof CollectionSchemas[C]['fields'];

export type SearchableFieldOf<C extends CollectionName> = {
	[K in FieldOf<C>]: CollectionSchemas[C]['fields'][K] extends { searchable: true } ? K : never;
}[FieldOf<C>];

export type SortableFieldOf<C extends CollectionName> = {
	[K in FieldOf<C>]: CollectionSchemas[C]['fields'][K] extends { sortable: true } ? K : never;
}[FieldOf<C>];

export type SelectableFieldOf<C extends CollectionName> = {
	[K in FieldOf<C>]: CollectionSchemas[C]['fields'][K] extends { selectable: true } ? K : never;
}[FieldOf<C>];

type FieldTypeName = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';

export type Operator = 'EQUALS' | 'CONTAINS' | 'GT' | 'LT' | 'GTE' | 'LTE';

const operatorsByType: Record<FieldTypeName, Operator[]> = {
	string: ['EQUALS', 'CONTAINS'],
	number: ['EQUALS', 'GT', 'LT', 'GTE', 'LTE'],
	date: ['EQUALS', 'GT', 'LT', 'GTE', 'LTE'],
	boolean: ['EQUALS'],
	array: [],
	object: []
};

const n1qlOperatorMap: Record<Operator, string> = {
	EQUALS: '=',
	GT: '>',
	LT: '<',
	GTE: '>=',
	LTE: '<=',
	CONTAINS: 'LIKE' // xử lý riêng, không dùng trực tiếp
};

export const getSchema = <C extends CollectionName>(collectionName: C) => {
	const schema = collectionSchemas[collectionName];
	if (!schema) throw new Error(`No schema defined for collection: ${collectionName}`);
	return schema;
};

type FieldDef = {
	type: FieldTypeName;
	searchable: boolean;
	sortable: boolean;
	selectable: boolean;
};

const getFieldDef = <C extends CollectionName>(collectionName: C, fieldName: string): FieldDef => {
	const schema = getSchema(collectionName);
	const field = (schema.fields as Record<string, FieldDef>)[fieldName];
	if (!field) {
		throw new Error(`Field "${fieldName}" is not defined in schema for "${collectionName}"`);
	}
	return field;
};

export const assertSearchableField = <C extends CollectionName>(
	collectionName: C,
	fieldName: SearchableFieldOf<C>
): FieldDef => {
	const field = getFieldDef(collectionName, String(fieldName));
	if (!field.searchable) {
		throw new Error(`Field "${String(fieldName)}" is not searchable in "${collectionName}"`);
	}
	return field;
};

export const assertSortableField = <C extends CollectionName>(
	collectionName: C,
	fieldName: SortableFieldOf<C>
): FieldDef => {
	const field = getFieldDef(collectionName, String(fieldName));
	if (!field.sortable) {
		throw new Error(`Field "${String(fieldName)}" is not sortable in "${collectionName}"`);
	}
	return field;
};

export const assertSelectableFields = <C extends CollectionName>(
	collectionName: C,
	fields: SelectableFieldOf<C>[]
): SelectableFieldOf<C>[] => {
	for (const f of fields) {
		const field = getFieldDef(collectionName, String(f));
		if (!field.selectable) {
			throw new Error(`Field "${String(f)}" is not selectable in "${collectionName}"`);
		}
	}
	return fields;
};

export const assertOperatorAllowed = (
	fieldType: FieldTypeName,
	operator: Operator,
	fieldName: string
) => {
	const allowed = operatorsByType[fieldType];
	if (!allowed.includes(operator)) {
		throw new Error(
			`Operator "${operator}" is not allowed for field "${fieldName}" of type "${fieldType}". Allowed: ${allowed.join(', ')}`
		);
	}
};

export const assertValueMatchesType = (
	fieldType: FieldTypeName,
	value: unknown,
	fieldName: string
) => {
	switch (fieldType) {
		case 'string':
			if (typeof value !== 'string') throw new Error(`Field "${fieldName}" expects a string value`);
			break;
		case 'number':
			if (typeof value !== 'number' || Number.isNaN(value))
				throw new Error(`Field "${fieldName}" expects a number value`);
			break;
		case 'boolean':
			if (typeof value !== 'boolean')
				throw new Error(`Field "${fieldName}" expects a boolean value`);
			break;
		case 'date':
			if (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
				throw new Error(`Field "${fieldName}" expects an ISO date string`);
			break;
		case 'array':
		case 'object':
			throw new Error(`Field "${fieldName}" of type ${fieldType} is not queryable via search`);
	}
};

export const toN1qlOperator = (operator: Operator) => n1qlOperatorMap[operator];
