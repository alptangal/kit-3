import { randomUUID } from "crypto";
const collectionSchemas = {
  users: {
    fields: {
      firstname: { type: "string", searchable: true, sortable: true, selectable: true },
      midname: { type: "string", searchable: true, sortable: true, selectable: true },
      lastname: { type: "string", searchable: true, sortable: true, selectable: true },
      description: { type: "string", searchable: true, sortable: false, selectable: true },
      // Tham chiếu tới name_roles theo DOCUMENT KEY (vd 'role-owner'), KHÔNG PHẢI field `name`
      // ('owner'). Chỗ nào cần lấy roleName dạng chuỗi ('owner'/'manager'/...) để đưa vào
      // ActorContext.roleName / PermissionChecker phải fetch name_roles.get({documentKey: roleId})
      // rồi đọc field `name`, chứ không dùng roleId trực tiếp làm roleName.
      roleId: {
        type: "string",
        searchable: true,
        sortable: true,
        selectable: true,
        required: true
      },
      // Tham chiếu tới user_status.name — thay vì hardcode 'active' như trước,
      // giờ trỏ về catalog quản lý được (admin có thể thêm status mới qua UI)
      statusId: {
        type: "string",
        searchable: true,
        sortable: true,
        selectable: true,
        required: true
      },
      emailBlindIndex: {
        type: "string",
        searchable: true,
        sortable: false,
        selectable: false,
        required: true
      },
      phoneBlindIndex: {
        type: "string",
        searchable: true,
        sortable: false,
        selectable: false,
        required: true
      },
      usernameBlindIndex: {
        type: "string",
        searchable: true,
        sortable: false,
        selectable: false,
        required: true
      },
      emailEncrypted: {
        type: "string",
        searchable: false,
        sortable: false,
        selectable: true,
        required: true
      },
      phoneEncrypted: {
        type: "string",
        searchable: false,
        sortable: false,
        selectable: true,
        required: true
      },
      profileEncrypted: {
        type: "string",
        searchable: false,
        sortable: false,
        selectable: true,
        required: true
      },
      vaultSaltB64: {
        type: "string",
        searchable: false,
        sortable: false,
        selectable: true,
        required: true
      },
      vaultDekIvB64: {
        type: "string",
        searchable: false,
        sortable: false,
        selectable: true,
        required: true
      },
      vaultWrappedDekB64: {
        type: "string",
        searchable: false,
        sortable: false,
        selectable: true,
        required: true
      },
      authMethod: {
        type: "string",
        searchable: true,
        sortable: false,
        selectable: true,
        required: true
      },
      webauthnCredentials: {
        type: "array",
        searchable: false,
        sortable: false,
        selectable: false,
        required: true
      },
      webauthnUserHandle: {
        type: "string",
        searchable: true,
        sortable: false,
        selectable: true,
        required: true
      },
      mfaEnabled: {
        type: "boolean",
        searchable: true,
        sortable: false,
        selectable: true,
        required: true
      },
      lastLoginAt: {
        type: "string",
        searchable: false,
        sortable: true,
        selectable: true
      },
      lastLoginIp: {
        type: "string",
        searchable: false,
        sortable: false,
        selectable: false
      },
      remember: {
        type: "boolean",
        searchable: false,
        sortable: false,
        selectable: false,
        required: true
      },
      // === Password reset flow (Task 1) — optional, hashed token tìm qua search API ===
      passwordResetTokenHash: { type: "string", searchable: true, sortable: false, selectable: false },
      passwordResetTokenExpiresAt: { type: "string", searchable: false, sortable: false, selectable: false },
      // === Email verification flow (Task 2) — optional ===
      emailVerificationTokenHash: { type: "string", searchable: true, sortable: false, selectable: false },
      emailVerifiedAt: { type: "string", searchable: false, sortable: false, selectable: true },
      // Chỉ áp dụng cho role 'customer' — nhân viên/quản lý không cần các field này
      customerTierEncrypted: {
        type: "string",
        searchable: false,
        sortable: false,
        selectable: true
      },
      loyaltyPoints: { type: "number", searchable: true, sortable: true, selectable: true },
      // Chỉ áp dụng cho role 'staff'/'manager' — gắn nhân viên với chi nhánh/kho cụ thể
      branchId: {
        type: "string",
        searchable: true,
        sortable: false,
        selectable: true
      },
      createdAt: {
        type: "date",
        searchable: true,
        sortable: true,
        selectable: true
      },
      updatedAt: {
        type: "date",
        searchable: false,
        sortable: true,
        selectable: true
      },
      deletedAt: {
        type: "date",
        searchable: true,
        sortable: false,
        selectable: false
      }
    }
  },
  webauthn_challenges: {
    fields: {
      challenge: { type: "string", searchable: false, sortable: false, selectable: true },
      emailBlindIndex: { type: "string", searchable: false, sortable: false, selectable: true },
      normalizedEmail: { type: "string", searchable: false, sortable: false, selectable: true },
      passwordEncryptedTemp: {
        type: "object",
        searchable: false,
        sortable: false,
        selectable: true
      },
      nameTemp: { type: "string", searchable: false, sortable: false, selectable: true },
      roleTemp: { type: "string", searchable: false, sortable: false, selectable: true },
      userHandle: { type: "string", searchable: false, sortable: false, selectable: true },
      createdAt: { type: "date", searchable: false, sortable: false, selectable: true }
    }
  },
  // ===== Danh mục vai trò — cố định 4 role, nhưng để dạng collection thay vì
  // enum cứng để sau này mở rộng (ví dụ thêm 'accountant', 'warehouse_staff')
  // mà không cần sửa code/migration schema =====
  name_roles: {
    fields: {
      name: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'owner' | 'manager' | 'staff' | 'customer'
      displayName: { type: "string", searchable: true, sortable: false, selectable: true },
      // tên hiển thị UI, đa ngôn ngữ nếu cần
      description: { type: "string", searchable: true, sortable: false, selectable: true },
      // Cấp bậc phân quyền — dùng để so sánh nhanh "role A có cao hơn role B không"
      // mà không cần join permissions mỗi lần (owner=100, manager=50, staff=10, customer=0)
      level: { type: "number", searchable: true, sortable: true, selectable: true },
      // Chặn xoá/sửa các role hệ thống (owner/manager/staff/customer) qua UI quản trị,
      // chỉ cho phép thêm role TUỲ CHỈNH mới (isSystem: false)
      isSystem: { type: "boolean", searchable: true, sortable: false, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      updatedAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  // ===== Danh mục hành động có thể phân quyền — dạng "resource:action" =====
  permissions: {
    fields: {
      key: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'products:create', 'orders:refund', 'users:manage'
      resource: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'products' | 'orders' | 'users' | 'inventory' | 'reports'
      action: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'create' | 'read' | 'update' | 'delete' | 'refund' | 'manage'
      description: { type: "string", searchable: true, sortable: false, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  // ===== Bảng nối role <-> permission (many-to-many) — đây là trái tim của RBAC =====
  detail_roles: {
    fields: {
      roleName: { type: "string", searchable: true, sortable: true, selectable: true },
      // tham chiếu name_roles.name
      permissionKey: { type: "string", searchable: true, sortable: true, selectable: true },
      // tham chiếu permissions.key
      // Cho phép override phạm vi (ví dụ 'staff' chỉ được sửa sản phẩm của branch mình, không phải toàn hệ thống)
      scope: { type: "string", searchable: true, sortable: false, selectable: true },
      // 'all' | 'own_branch' | 'own_records'
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  // ===== Danh mục trạng thái tài khoản user =====
  user_status: {
    fields: {
      name: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'active' | 'suspended' | 'banned' | 'pending_verification'
      description: { type: "string", searchable: true, sortable: true, selectable: true },
      // User ở status này có được phép login không (dùng check nhanh ở route login)
      canLogin: { type: "boolean", searchable: true, sortable: false, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      updatedAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  products: {
    fields: {
      name: { type: "string", searchable: true, sortable: true, selectable: true },
      description: { type: "string", searchable: true, sortable: false, selectable: true },
      categoryId: { type: "string", searchable: true, sortable: true, selectable: true },
      brandId: { type: "string", searchable: true, sortable: false, selectable: true },
      // Sản phẩm có biến thể hay không — nếu false, tạo đúng 1 variant "mặc định"
      // khi tạo product, để mọi logic phía sau (inventory, orders) đều thống nhất
      // luôn thao tác qua variantId, không phải rẽ nhánh "có/không biến thể"
      hasVariants: { type: "boolean", searchable: true, sortable: false, selectable: true },
      // Danh sách CÁC LOẠI thuộc tính biến thể mà sản phẩm này dùng
      // vd: [{ name: "size", options: ["S","M","L"] }, { name: "color", options: ["đỏ","xanh"] }]
      variantAttributes: { type: "array", searchable: false, sortable: false, selectable: true },
      imageUrl: { type: "string", searchable: false, sortable: false, selectable: true },
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'active' | 'discontinued' | 'draft'
      createdBy: { type: "string", searchable: true, sortable: false, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      updatedAt: { type: "date", searchable: true, sortable: true, selectable: true },
      deletedAt: { type: "date", searchable: false, sortable: false, selectable: false }
    }
  },
  // ===== Biến thể — đơn vị bán hàng THỰC SỰ, mỗi variant = 1 SKU riêng =====
  product_variants: {
    fields: {
      productId: { type: "string", searchable: true, sortable: false, selectable: true },
      sku: { type: "string", searchable: true, sortable: false, selectable: true },
      // duy nhất, vd "AT-S-DO"
      barcode: { type: "string", searchable: true, sortable: false, selectable: true },
      // Cặp thuộc tính xác định biến thể này — vd { size: "S", color: "đỏ" }
      // Lưu dạng object phẳng thay vì array để query trực tiếp WHERE attributes.size = "S"
      attributes: { type: "object", searchable: false, sortable: false, selectable: true },
      // Tên hiển thị đầy đủ, tự sinh lúc tạo — vd "Áo thun - S - Đỏ", tránh phải join products + format lại mỗi lần hiển thị
      displayName: { type: "string", searchable: true, sortable: false, selectable: true },
      price: { type: "number", searchable: true, sortable: true, selectable: true },
      costPrice: { type: "number", searchable: false, sortable: true, selectable: true },
      weight: { type: "number", searchable: false, sortable: false, selectable: true },
      // phục vụ tính phí ship nếu cần
      trackLot: { type: "boolean", searchable: true, sortable: false, selectable: true },
      trackExpiry: { type: "boolean", searchable: true, sortable: false, selectable: true },
      lowStockThreshold: { type: "number", searchable: false, sortable: false, selectable: true },
      imageUrl: { type: "string", searchable: false, sortable: false, selectable: true },
      // ảnh riêng cho biến thể (vd ảnh theo màu)
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'active' | 'discontinued'
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      updatedAt: { type: "date", searchable: true, sortable: true, selectable: true },
      deletedAt: { type: "date", searchable: false, sortable: false, selectable: false }
    }
  },
  product_variant_attributes: {
    fields: {
      variantId: { type: "string", searchable: true, sortable: false, selectable: true },
      attributeTypeName: { type: "string", searchable: true, sortable: false, selectable: true },
      // "size"
      value: { type: "string", searchable: true, sortable: false, selectable: true },
      // "S"
      createdAt: { type: "date", searchable: false, sortable: false, selectable: true }
    }
  },
  // ===== Tồn kho — giờ gắn với variantId, KHÔNG còn productId =====
  inventory_stock: {
    fields: {
      variantId: { type: "string", searchable: true, sortable: false, selectable: true },
      branchId: { type: "string", searchable: true, sortable: false, selectable: true },
      quantityOnHand: { type: "number", searchable: true, sortable: true, selectable: true },
      quantityReserved: { type: "number", searchable: true, sortable: true, selectable: true },
      updatedAt: { type: "date", searchable: false, sortable: true, selectable: true }
    }
  },
  inventory_lots: {
    fields: {
      variantId: { type: "string", searchable: true, sortable: false, selectable: true },
      branchId: { type: "string", searchable: true, sortable: false, selectable: true },
      lotNumber: { type: "string", searchable: true, sortable: false, selectable: true },
      quantityOnHand: { type: "number", searchable: true, sortable: true, selectable: true },
      manufacturedAt: { type: "date", searchable: true, sortable: true, selectable: true },
      expiresAt: { type: "date", searchable: true, sortable: true, selectable: true },
      receivedAt: { type: "date", searchable: true, sortable: true, selectable: true },
      supplierId: { type: "string", searchable: true, sortable: false, selectable: true },
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  stock_movements: {
    fields: {
      variantId: { type: "string", searchable: true, sortable: false, selectable: true },
      branchId: { type: "string", searchable: true, sortable: false, selectable: true },
      lotId: { type: "string", searchable: true, sortable: false, selectable: true },
      type: { type: "string", searchable: true, sortable: true, selectable: true },
      quantity: { type: "number", searchable: false, sortable: false, selectable: true },
      quantityBefore: { type: "number", searchable: false, sortable: false, selectable: true },
      quantityAfter: { type: "number", searchable: false, sortable: false, selectable: true },
      referenceType: { type: "string", searchable: true, sortable: false, selectable: true },
      referenceId: { type: "string", searchable: true, sortable: false, selectable: true },
      performedBy: { type: "string", searchable: true, sortable: false, selectable: true },
      note: { type: "string", searchable: false, sortable: false, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  // orders.items giờ chứa variantId thay vì productId — xem phần "items" bên dưới (không cần đổi schema, chỉ đổi shape của array item)
  orders: {
    fields: {
      orderCode: { type: "string", searchable: true, sortable: false, selectable: true },
      customerId: { type: "string", searchable: true, sortable: false, selectable: true },
      staffId: { type: "string", searchable: true, sortable: false, selectable: true },
      branchId: { type: "string", searchable: true, sortable: false, selectable: true },
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      items: { type: "array", searchable: false, sortable: false, selectable: true },
      // [{ variantId, lotId?, quantity, price }]
      totalAmount: { type: "number", searchable: true, sortable: true, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      updatedAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  // ===== Nhà cung cấp =====
  suppliers: {
    fields: {
      name: { type: "string", searchable: true, sortable: true, selectable: true },
      contactPerson: { type: "string", searchable: true, sortable: false, selectable: true },
      phoneEncrypted: { type: "string", searchable: false, sortable: false, selectable: true },
      // thông tin liên hệ NCC, mã hoá vì có thể nhạy cảm tuỳ chính sách
      phoneBlindIndex: { type: "string", searchable: true, sortable: false, selectable: false },
      address: { type: "string", searchable: false, sortable: false, selectable: true },
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'active' | 'inactive'
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      updatedAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  // ===== Phiếu nhập hàng (Purchase Order) =====
  purchase_orders: {
    fields: {
      poCode: { type: "string", searchable: true, sortable: false, selectable: true },
      supplierId: { type: "string", searchable: true, sortable: false, selectable: true },
      branchId: { type: "string", searchable: true, sortable: false, selectable: true },
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled'
      items: { type: "array", searchable: false, sortable: false, selectable: true },
      // [{ variantId, quantity, unitCost, lotNumber?, expiresAt? }]
      totalCost: { type: "number", searchable: true, sortable: true, selectable: true },
      createdBy: { type: "string", searchable: true, sortable: false, selectable: true },
      approvedBy: { type: "string", searchable: false, sortable: false, selectable: true },
      // owner/manager duyệt — audit trail
      expectedAt: { type: "date", searchable: true, sortable: true, selectable: true },
      receivedAt: { type: "date", searchable: false, sortable: true, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      updatedAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  // ===== Chuyển kho giữa các chi nhánh =====
  stock_transfers: {
    fields: {
      transferCode: { type: "string", searchable: true, sortable: false, selectable: true },
      fromBranchId: { type: "string", searchable: true, sortable: false, selectable: true },
      toBranchId: { type: "string", searchable: true, sortable: false, selectable: true },
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'pending' | 'in_transit' | 'completed' | 'cancelled'
      items: { type: "array", searchable: false, sortable: false, selectable: true },
      // [{ productId, quantity, lotId? }]
      requestedBy: { type: "string", searchable: true, sortable: false, selectable: true },
      approvedBy: { type: "string", searchable: false, sortable: false, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      completedAt: { type: "date", searchable: false, sortable: true, selectable: true }
    }
  },
  // ===== Kiểm kê kho (Stock Take / Audit) — đối soát tồn thực tế vs tồn hệ thống =====
  stock_takes: {
    fields: {
      branchId: { type: "string", searchable: true, sortable: false, selectable: true },
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'in_progress' | 'completed' | 'cancelled'
      items: { type: "array", searchable: false, sortable: false, selectable: true },
      // [{ productId, lotId?, systemQuantity, countedQuantity, variance }]
      performedBy: { type: "string", searchable: true, sortable: false, selectable: true },
      startedAt: { type: "date", searchable: true, sortable: true, selectable: true },
      completedAt: { type: "date", searchable: false, sortable: true, selectable: true }
    }
  },
  brands: {
    fields: {
      name: { type: "string", searchable: true, sortable: true, selectable: true },
      slug: { type: "string", searchable: true, sortable: false, selectable: true },
      // "nike" — dùng cho URL, đảm bảo duy nhất
      logoUrl: { type: "string", searchable: false, sortable: false, selectable: true },
      description: { type: "string", searchable: false, sortable: false, selectable: true },
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'active' | 'inactive'
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      updatedAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  categories: {
    fields: {
      name: { type: "string", searchable: true, sortable: true, selectable: true },
      slug: { type: "string", searchable: true, sortable: false, selectable: true },
      parentId: { type: "string", searchable: true, sortable: false, selectable: true },
      // hỗ trợ category lồng nhau (vd "Thời trang > Nam > Áo")
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      updatedAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  branches: {
    fields: {
      name: { type: "string", searchable: true, sortable: true, selectable: true },
      address: { type: "string", searchable: false, sortable: false, selectable: true },
      managerId: { type: "string", searchable: true, sortable: false, selectable: true },
      isWarehouse: { type: "boolean", searchable: true, sortable: false, selectable: true },
      // true = kho tổng, false = cửa hàng bán lẻ
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      updatedAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  payments: {
    fields: {
      orderId: { type: "string", searchable: true, sortable: false, selectable: true },
      paymentCode: { type: "string", searchable: true, sortable: false, selectable: true },
      // 'cash' | 'credit_card' | 'bank_transfer' | 'e_wallet' | 'loyalty_points'
      method: { type: "string", searchable: true, sortable: false, selectable: true },
      amount: { type: "number", searchable: true, sortable: true, selectable: true },
      // 'pending' | 'completed' | 'failed' | 'refunded'
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      transactionReference: { type: "string", searchable: true, sortable: false, selectable: true },
      // Mã giao dịch Bank/VNPAY/Momo/Stripe
      notes: { type: "string", searchable: false, sortable: false, selectable: true },
      processedBy: { type: "string", searchable: true, sortable: false, selectable: true },
      // staffId
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  // ===== Đổi / Trả hàng =====
  order_returns: {
    fields: {
      returnCode: { type: "string", searchable: true, sortable: false, selectable: true },
      orderId: { type: "string", searchable: true, sortable: false, selectable: true },
      branchId: { type: "string", searchable: true, sortable: false, selectable: true },
      customerId: { type: "string", searchable: true, sortable: false, selectable: true },
      // [{ variantId, lotId?, quantity, refundUnitPrice, reason }]
      items: { type: "array", searchable: false, sortable: false, selectable: true },
      totalRefundAmount: { type: "number", searchable: true, sortable: true, selectable: true },
      // 'requested' | 'approved' | 'completed' | 'rejected'
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      handledBy: { type: "string", searchable: true, sortable: false, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      updatedAt: { type: "date", searchable: false, sortable: true, selectable: true }
    }
  },
  // ===== Phiên làm việc / Ca thu ngân =====
  pos_sessions: {
    fields: {
      sessionCode: { type: "string", searchable: true, sortable: false, selectable: true },
      branchId: { type: "string", searchable: true, sortable: false, selectable: true },
      staffId: { type: "string", searchable: true, sortable: false, selectable: true },
      openingBalance: { type: "number", searchable: false, sortable: false, selectable: true },
      // Tiền đầu ca trong két
      closingBalance: { type: "number", searchable: false, sortable: false, selectable: true },
      // Tiền thực tế lúc kiểm két cuối ca
      expectedBalance: { type: "number", searchable: false, sortable: false, selectable: true },
      // Tiền lý thuyết = đầu ca + doanh thu tiền mặt
      cashDifference: { type: "number", searchable: true, sortable: true, selectable: true },
      // Chênh lệch (thừa/thiếu)
      // 'open' | 'closed'
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      openedAt: { type: "date", searchable: true, sortable: true, selectable: true },
      closedAt: { type: "date", searchable: false, sortable: true, selectable: true },
      notes: { type: "string", searchable: false, sortable: false, selectable: true }
    }
  },
  // ===== Chương trình khuyến mãi & Mã giảm giá =====
  promotions: {
    fields: {
      code: { type: "string", searchable: true, sortable: true, selectable: true },
      // ví dụ: "SUMMER2026"
      name: { type: "string", searchable: true, sortable: false, selectable: true },
      // 'percentage' | 'fixed_amount' | 'buy_x_get_y'
      type: { type: "string", searchable: true, sortable: false, selectable: true },
      value: { type: "number", searchable: false, sortable: false, selectable: true },
      // % giảm hoặc số tiền giảm
      minOrderValue: { type: "number", searchable: false, sortable: false, selectable: true },
      maxDiscountAmount: { type: "number", searchable: false, sortable: false, selectable: true },
      usageLimit: { type: "number", searchable: false, sortable: false, selectable: true },
      usageCount: { type: "number", searchable: true, sortable: true, selectable: true },
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'active' | 'expired' | 'disabled'
      startAt: { type: "date", searchable: true, sortable: true, selectable: true },
      endAt: { type: "date", searchable: true, sortable: true, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  // ===== Lịch sử biến động điểm thưởng khách hàng =====
  loyalty_transactions: {
    fields: {
      customerId: { type: "string", searchable: true, sortable: false, selectable: true },
      orderId: { type: "string", searchable: true, sortable: false, selectable: true },
      // 'earn' | 'redeem' | 'expire' | 'adjustment'
      type: { type: "string", searchable: true, sortable: false, selectable: true },
      points: { type: "number", searchable: true, sortable: true, selectable: true },
      // số dương nếu cộng, âm nếu trừ
      balanceAfter: { type: "number", searchable: false, sortable: false, selectable: true },
      description: { type: "string", searchable: false, sortable: false, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  // ===== Nhật ký thao tác quản trị & an ninh =====
  audit_logs: {
    fields: {
      userId: { type: "string", searchable: true, sortable: false, selectable: true },
      userRole: { type: "string", searchable: true, sortable: false, selectable: true },
      action: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN_FAILED'
      collectionName: { type: "string", searchable: true, sortable: true, selectable: true },
      documentId: { type: "string", searchable: true, sortable: false, selectable: true },
      ipAddress: { type: "string", searchable: true, sortable: false, selectable: true },
      userAgent: { type: "string", searchable: false, sortable: false, selectable: true },
      // Chi tiết thay đổi { before: {...}, after: {...} }
      changes: { type: "object", searchable: false, sortable: false, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  // ===== Thông báo gửi tới người dùng =====
  notifications: {
    fields: {
      userId: { type: "string", searchable: true, sortable: false, selectable: true },
      // Nguồn nhận
      // 'system' | 'order' | 'inventory' | 'promotion' | 'security'
      type: { type: "string", searchable: true, sortable: false, selectable: true },
      title: { type: "string", searchable: true, sortable: false, selectable: true },
      body: { type: "string", searchable: false, sortable: false, selectable: true },
      // Chứa metadata bấm vào điều hướng (vd: { targetUrl: "/orders/123", orderId: "123" })
      data: { type: "object", searchable: false, sortable: false, selectable: true },
      isRead: { type: "boolean", searchable: true, sortable: true, selectable: true },
      readAt: { type: "date", searchable: false, sortable: true, selectable: true },
      // 'in_app' | 'push' | 'email' | 'sms'
      channel: { type: "string", searchable: true, sortable: false, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      deletedAt: { type: "date", searchable: false, sortable: false, selectable: false }
    }
  },
  // ===== Mẫu thông báo (Template hỗ trợ biến động & đa ngôn ngữ) =====
  notification_templates: {
    fields: {
      code: { type: "string", searchable: true, sortable: true, selectable: true },
      // ví dụ: "ORDER_CREATED_CUSTOMER"
      titleTemplate: { type: "string", searchable: false, sortable: false, selectable: true },
      // "Đơn hàng {{orderCode}} đã tạo thành công"
      bodyTemplate: { type: "string", searchable: false, sortable: false, selectable: true },
      // 'email' | 'sms' | 'in_app' | 'push'
      channel: { type: "string", searchable: true, sortable: false, selectable: true },
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'active' | 'inactive'
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      updatedAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  // ===== Hộp thoại / Phòng chat =====
  conversations: {
    fields: {
      // 'internal_staff' (Chat nội bộ) | 'customer_support' (CSKH) | 'group'
      type: { type: "string", searchable: true, sortable: false, selectable: true },
      title: { type: "string", searchable: true, sortable: false, selectable: true },
      // Tên nhóm chat (nếu có)
      // Danh sách userId tham gia chat
      participantIds: { type: "array", searchable: false, sortable: false, selectable: true },
      // Nếu là chat CSKH -> gắn trực tiếp với khách hàng và chi nhánh phụ trách
      customerId: { type: "string", searchable: true, sortable: false, selectable: true },
      branchId: { type: "string", searchable: true, sortable: false, selectable: true },
      // Trích dẫn tin nhắn mới nhất để hiển thị nhanh trên UI danh sách hội thoại
      lastMessageText: { type: "string", searchable: false, sortable: false, selectable: true },
      lastMessageAt: { type: "date", searchable: true, sortable: true, selectable: true },
      // 'open' | 'resolved' | 'archived'
      status: { type: "string", searchable: true, sortable: true, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      updatedAt: { type: "date", searchable: false, sortable: true, selectable: true }
    }
  },
  // ===== Chi tiết Tin nhắn =====
  messages: {
    fields: {
      conversationId: { type: "string", searchable: true, sortable: false, selectable: true },
      senderId: { type: "string", searchable: true, sortable: false, selectable: true },
      // Hỗ trợ tin nhắn dạng mã hóa End-to-End (E2EE) nếu dùng chung kiến trúc Vault/Crypto hiện tại
      // 'text' | 'image' | 'file' | 'system' | 'encrypted_payload'
      contentType: { type: "string", searchable: true, sortable: false, selectable: true },
      contentEncrypted: { type: "string", searchable: false, sortable: false, selectable: true },
      // Nội dung tin nhắn mã hóa / văn bản thô
      mediaUrl: { type: "string", searchable: false, sortable: false, selectable: true },
      // URL ảnh / file đính kèm
      // Mảng các userId đã đọc tin nhắn này
      readBy: { type: "array", searchable: false, sortable: false, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true },
      deletedAt: { type: "date", searchable: false, sortable: false, selectable: false }
    }
  },
  system: {
    fields: {
      initApp: { type: "object", searchable: true, sortable: false, selectable: true }
    }
  },
  refresh_tokens: {
    fields: {
      // ===== Khóa chính & Tham chiếu =====
      userId: { type: "string", searchable: true, sortable: false, selectable: true },
      // Hash của refresh token (KHÔNG lưu token thô vì security)
      // Token được hash trước khi lưu — so sánh hash khi verify
      tokenHash: { type: "string", searchable: true, sortable: false, selectable: false },
      // ===== Metadata Token =====
      // Family ID để detect token reuse attack (rotation chain)
      // Nếu user submit token cũ → invalidate toàn bộ family
      familyId: { type: "string", searchable: true, sortable: false, selectable: true },
      // Thế hệ token trong family này (theo dõi rotation)
      generation: { type: "number", searchable: false, sortable: false, selectable: true },
      expiresAt: { type: "date", searchable: true, sortable: true, selectable: true },
      isRevoked: { type: "boolean", searchable: true, sortable: false, selectable: true },
      revokedAt: { type: "date", searchable: false, sortable: true, selectable: true },
      revokedReason: { type: "string", searchable: true, sortable: false, selectable: true },
      // 'logout' | 'password_changed' | 'suspicious_activity' | 'manual' | 'device_logout'
      // ===== Device & Security Tracking =====
      // Để detect unauthorized access từ device/IP khác
      deviceId: { type: "string", searchable: true, sortable: false, selectable: true },
      deviceNameEncrypted: { type: "string", searchable: false, sortable: false, selectable: true },
      deviceTypeEncrypted: { type: "string", searchable: false, sortable: false, selectable: true },
      // 'web' | 'mobile_ios' | 'mobile_android' | 'desktop'
      ipAddress: { type: "string", searchable: true, sortable: false, selectable: false },
      // audit
      userAgent: { type: "string", searchable: false, sortable: false, selectable: false },
      // audit
      // ===== Sử dụng & Audit =====
      lastUsedAt: { type: "date", searchable: false, sortable: true, selectable: true },
      usageCount: { type: "number", searchable: false, sortable: false, selectable: true },
      // Ghi lại mỗi lần refresh -> audit trail
      refreshHistory: { type: "array", searchable: false, sortable: false, selectable: true },
      // [{ refreshedAt, ipAddress, newTokenHash, generation }]
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  // ===== Optional: Token Rotation Audit (chi tiết hơn) =====
  token_rotation_logs: {
    fields: {
      userId: { type: "string", searchable: true, sortable: false, selectable: true },
      oldTokenHash: { type: "string", searchable: false, sortable: false, selectable: false },
      newTokenHash: { type: "string", searchable: false, sortable: false, selectable: false },
      action: { type: "string", searchable: true, sortable: true, selectable: true },
      // 'rotated' | 'revoked' | 'reuse_detected' | 'expired'
      familyId: { type: "string", searchable: true, sortable: false, selectable: true },
      generation: { type: "number", searchable: false, sortable: false, selectable: true },
      ipAddress: { type: "string", searchable: true, sortable: false, selectable: false },
      reason: { type: "string", searchable: false, sortable: false, selectable: true },
      createdAt: { type: "date", searchable: true, sortable: true, selectable: true }
    }
  },
  system_secrets: {
    fields: {
      type: { type: "string", searchable: false, sortable: false, selectable: true },
      publicKeyB64: { type: "string", searchable: false, sortable: false, selectable: true },
      privateKeyEncrypted: { type: "object", searchable: false, sortable: false, selectable: true },
      saltB64: { type: "string", searchable: false, sortable: false, selectable: true },
      dekIvB64: { type: "string", searchable: false, sortable: false, selectable: true },
      wrappedDekB64: { type: "string", searchable: false, sortable: false, selectable: true },
      version: { type: "number", searchable: false, sortable: false, selectable: true },
      createdAt: { type: "date", searchable: false, sortable: false, selectable: true },
      rotatedAt: { type: "date", searchable: false, sortable: false, selectable: true }
    }
  }
};
const operatorsByType = {
  string: ["EQUALS", "CONTAINS"],
  number: ["EQUALS", "GT", "LT", "GTE", "LTE"],
  date: ["EQUALS", "GT", "LT", "GTE", "LTE"],
  boolean: ["EQUALS"],
  array: [],
  object: []
};
const n1qlOperatorMap = {
  EQUALS: "=",
  GT: ">",
  LT: "<",
  GTE: ">=",
  LTE: "<=",
  CONTAINS: "LIKE"
  // xử lý riêng, không dùng trực tiếp
};
const getSchema = (collectionName) => {
  const schema = collectionSchemas[collectionName];
  if (!schema) throw new Error(`No schema defined for collection: ${collectionName}`);
  return schema;
};
const getFieldDef = (collectionName, fieldName) => {
  const schema = getSchema(collectionName);
  const field = schema.fields[fieldName];
  if (!field) {
    throw new Error(`Field "${fieldName}" is not defined in schema for "${collectionName}"`);
  }
  return field;
};
const assertSearchableField = (collectionName, fieldName) => {
  const field = getFieldDef(collectionName, String(fieldName));
  if (!field.searchable) {
    throw new Error(`Field "${String(fieldName)}" is not searchable in "${collectionName}"`);
  }
  return field;
};
const assertSortableField = (collectionName, fieldName) => {
  const field = getFieldDef(collectionName, String(fieldName));
  if (!field.sortable) {
    throw new Error(`Field "${String(fieldName)}" is not sortable in "${collectionName}"`);
  }
  return field;
};
const assertSelectableFields = (collectionName, fields) => {
  for (const f of fields) {
    const field = getFieldDef(collectionName, String(f));
    if (!field.selectable) {
      throw new Error(`Field "${String(f)}" is not selectable in "${collectionName}"`);
    }
  }
  return fields;
};
const assertOperatorAllowed = (fieldType, operator, fieldName) => {
  const allowed = operatorsByType[fieldType];
  if (!allowed.includes(operator)) {
    throw new Error(
      `Operator "${operator}" is not allowed for field "${fieldName}" of type "${fieldType}". Allowed: ${allowed.join(", ")}`
    );
  }
};
const assertValueMatchesType = (fieldType, value, fieldName) => {
  switch (fieldType) {
    case "string":
      if (typeof value !== "string") throw new Error(`Field "${fieldName}" expects a string value`);
      break;
    case "number":
      if (typeof value !== "number" || Number.isNaN(value))
        throw new Error(`Field "${fieldName}" expects a number value`);
      break;
    case "boolean":
      if (typeof value !== "boolean")
        throw new Error(`Field "${fieldName}" expects a boolean value`);
      break;
    case "date":
      if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
        throw new Error(`Field "${fieldName}" expects an ISO date string`);
      break;
    case "array":
    case "object":
      throw new Error(`Field "${fieldName}" of type ${fieldType} is not queryable via search`);
  }
};
const toN1qlOperator = (operator) => n1qlOperatorMap[operator];
function normalizeError(e, context) {
  if (e instanceof Error) {
    return new Error(`${context}: ${e.message}`, { cause: e });
  }
  return new Error(`${context}: ${String(e)}`);
}
const managementData = (data) => {
  const { apiKeySecret, organizationId } = data;
  const baseUrl = "https://cloudapi.cloud.couchbase.com";
  const headers = {
    authorization: `Bearer ${apiKeySecret}`,
    "content-type": "application/json"
  };
  return {
    organizations: {
      async get() {
        try {
          const res = await fetch(`${baseUrl}/v4/organizations/${organizationId}`, { headers });
          if (res.ok) {
            const jsonData = await res.json();
            return {
              data: jsonData,
              ok: true
            };
          }
          throw new Error(`[Organizations.get] ${res.status} ${res.statusText}`);
        } catch (e) {
          throw normalizeError(e, "couchbase.managementData.organizations.get");
        }
      },
      async list() {
        try {
          const res = await fetch(`${baseUrl}/v4/organizations`, { headers });
          if (res.ok) {
            const jsonData = await res.json();
            return {
              data: jsonData["data"],
              ok: true
            };
          }
          throw new Error(`[Organizations.list] ${res.status} ${res.statusText}`);
        } catch (e) {
          throw normalizeError(e, "couchbase.managementData.organizations.list");
        }
      },
      async updateConfiguration(data2) {
        try {
          const { subdomain } = data2;
          const res = await fetch(`${baseUrl}/v4/organizations/${organizationId}/configuration`, {
            method: "put",
            headers,
            body: JSON.stringify({
              subdomain
            })
          });
          if (res.ok) {
            return { ok: true };
          }
          throw new Error(`[Organizations.updateConfiguration] ${res.status} ${res.statusText}`);
        } catch (e) {
          throw normalizeError(e, "couchbase.managementData.organizations.updateConfiguration");
        }
      }
    },
    projects: {
      async create(data2) {
        try {
          const { name, description } = data2;
          const res = await fetch(`${baseUrl}/v4/organizations/${organizationId}/projects`, {
            method: "post",
            headers,
            body: JSON.stringify({
              name,
              description
            })
          });
          if (res.ok) {
            const jsonData = await res.json();
            return {
              data: jsonData.id,
              ok: true
            };
          }
          throw new Error(`[Projects.create] ${res.status} ${res.statusText}`);
        } catch (e) {
          throw normalizeError(e, "couchbase.managementData.projects.create");
        }
      },
      async list() {
        try {
          const res = await fetch(`${baseUrl}/v4/organizations/${organizationId}/projects`, {
            headers
          });
          if (res.ok) {
            const jsonData = await res.json();
            return { data: jsonData, ok: true };
          }
          throw new Error(`[Projects.list] ${res.status} ${res.statusText}`);
        } catch (e) {
          throw normalizeError(e, "couchbase.managementData.project.list");
        }
      },
      async get(data2) {
        try {
          const { projectId } = data2;
          const res = await fetch(
            `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}`,
            {
              headers
            }
          );
          if (res.ok) {
            const jsonData = await res.json();
            return { data: jsonData, ok: true };
          }
          throw new Error(`[Projects.get] ${res.status} ${res.statusText}`);
        } catch (e) {
          throw normalizeError(e, "couchbase.managementData.projects.get");
        }
      },
      async update(data2) {
        try {
          const { projectId, name, description } = data2;
          const res = await fetch(
            `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}`,
            {
              headers,
              method: "put",
              body: JSON.stringify({
                name,
                description
              })
            }
          );
          if (res.ok) {
            return { ok: true };
          }
          throw new Error(`[Projects.update] ${res.status} ${res.statusText}`);
        } catch (e) {
          throw normalizeError(e, "couchbase.managementData.projects.update");
        }
      },
      async delete(data2) {
        try {
          const { projectId } = data2;
          const res = await fetch(
            `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}`,
            {
              headers,
              method: "delete"
            }
          );
          if (res.ok) {
            return { ok: true };
          }
          throw new Error(`[Projects.delete] ${res.status} ${res.statusText}`);
        } catch (e) {
          throw normalizeError(e, "couchbase.managementData.projects.delete");
        }
      }
    },
    cluster(data2) {
      const { projectId } = data2;
      return {
        async create(data3) {
          try {
            const { name, description, cloudProvider, serviceGroups, availability, support } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters`,
              {
                method: "post",
                headers,
                body: JSON.stringify({
                  name,
                  description,
                  cloudProvider,
                  serviceGroups,
                  availability,
                  support
                })
              }
            );
            if (res.ok) {
              const jsonData = await res.json();
              return { data: jsonData.id, ok: true };
            }
            throw new Error(`[Clusters.create] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.cluster.create");
          }
        },
        async list() {
          try {
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters`,
              {
                headers
              }
            );
            if (res.ok) {
              const jsonData = await res.json();
              return {
                ...jsonData,
                ok: true
              };
            }
            throw new Error(`[Clusters.list] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.cluster.list");
          }
        },
        async get(data3) {
          try {
            const { clusterId } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}`,
              {
                headers
              }
            );
            if (res.ok) {
              const jsonData = await res.json();
              return { data: jsonData, ok: true };
            }
            throw new Error(`[Clusters.get] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.cluster.get");
          }
        },
        async update(data3) {
          try {
            const { clusterId, name, description, support, serviceGroups } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}`,
              {
                method: "put",
                headers,
                body: JSON.stringify({
                  name,
                  description,
                  support,
                  serviceGroups
                })
              }
            );
            if (res.ok) {
              return { ok: true };
            }
            throw new Error(`[Clusters.update] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.cluster.update");
          }
        },
        async delete(data3) {
          try {
            const { clusterId } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}`,
              {
                method: "delete",
                headers
              }
            );
            if (res.ok) {
              return { ok: true };
            }
            throw new Error(`[Clusters.delete] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.cluster.delete");
          }
        },
        async getCapacityStatistics(data3) {
          try {
            const { clusterId } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/stats`,
              {
                headers
              }
            );
            if (res.ok) {
              const jsonData = await res.json();
              return { data: jsonData, ok: true };
            }
            throw new Error(`[Clusters.getCapacityStatistics] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.cluster.getCapacityStatistics");
          }
        },
        async turnOn(data3) {
          try {
            const { clusterId, turnOnLinkedAppService } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/activationState`,
              {
                method: "post",
                headers,
                body: JSON.stringify({
                  turnOnLinkedAppService
                })
              }
            );
            if (res.ok) {
              return { ok: true };
            }
            throw new Error(`[Clusters.turnOn] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.cluster.turnOn");
          }
        },
        async turnOff(data3) {
          try {
            const { clusterId } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/activationState`,
              {
                method: "delete",
                headers
              }
            );
            if (res.ok) {
              return { ok: true };
            }
            throw new Error(`[Clusters.turnOff] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.cluster.turnOff");
          }
        }
      };
    },
    buckets(data2) {
      const { projectId, clusterId } = data2;
      return {
        async create(data3) {
          try {
            const {
              name,
              type = "couchbase",
              storageBackend = "couchstore",
              vbuckets = 128,
              memoryAllocationInMb = 100,
              bucketConflictResolution = "seqno",
              durabilityLevel = "none",
              replicas = 1,
              priority = 0,
              evictionPolicy = "fullEviction",
              flushEnabled = false
            } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets`,
              {
                method: "post",
                headers,
                body: JSON.stringify({
                  name,
                  type,
                  storageBackend,
                  vbuckets,
                  memoryAllocationInMb,
                  bucketConflictResolution,
                  durabilityLevel,
                  replicas,
                  priority,
                  evictionPolicy,
                  flushEnabled
                })
              }
            );
            if (res.ok) {
              const jsonData = await res.json();
              return { data: jsonData.id, ok: true };
            }
            throw new Error(`[Buckets.create] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.buckets.create");
          }
        },
        async list() {
          try {
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets`,
              {
                headers
              }
            );
            if (res.ok) {
              const jsonData = await res.json();
              return { ...jsonData, ok: true };
            }
            throw new Error(`[Buckets.list] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.buckets.list");
          }
        },
        async get(data3) {
          try {
            const { bucketId } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}`,
              {
                headers
              }
            );
            if (res.ok) {
              const jsonData = await res.json();
              return { data: jsonData, ok: true };
            }
            throw new Error(`[Buckets.get] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.buckets.get");
          }
        },
        async update(data3) {
          try {
            const {
              bucketId,
              memoryAllocationInMb,
              durabilityLevel,
              replicas,
              flushEnabled = false,
              timeToLiveInSeconds,
              enableCrossClusterVersioning,
              priority = 0
            } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}`,
              {
                method: "put",
                headers,
                body: JSON.stringify({
                  memoryAllocationInMb,
                  durabilityLevel,
                  replicas,
                  flushEnabled,
                  timeToLiveInSeconds,
                  enableCrossClusterVersioning,
                  priority
                })
              }
            );
            if (res.ok) {
              return { ok: true };
            }
            throw new Error(`[Buckets.update] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.buckets.update");
          }
        },
        async delete(data3) {
          try {
            const { bucketId } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}`,
              {
                method: "delete",
                headers
              }
            );
            if (res.ok) {
              return { ok: true };
            }
            throw new Error(`[Buckets.delete] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.buckets.delete");
          }
        }
      };
    },
    scopes(data2) {
      const { projectId, clusterId, bucketId } = data2;
      return {
        async create(data3) {
          try {
            const { name } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes`,
              {
                method: "post",
                headers,
                body: JSON.stringify({
                  name
                })
              }
            );
            if (res.ok) {
              return { ok: true };
            }
            throw new Error(`[Scopes.create] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.scopes.create");
          }
        },
        async list() {
          try {
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes`,
              {
                headers
              }
            );
            if (res.ok) {
              const jsonData = await res.json();
              return { data: jsonData, ok: true };
            }
            throw new Error(`[Scopes.list] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.scopes.list");
          }
        },
        async get(data3) {
          try {
            const { scopeName } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}`,
              {
                headers
              }
            );
            if (res.ok) {
              const jsonData = await res.json();
              return { data: jsonData, ok: true };
            }
            throw new Error(`[scopes.get] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.scopes.get");
          }
        },
        async delete(data3) {
          try {
            const { scopeName } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}`,
              {
                headers,
                method: "delete"
              }
            );
            if (res.ok) {
              return { ok: true };
            }
            throw new Error(`[Scopes.delete] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.scopes.delete");
          }
        }
      };
    },
    collections(data2) {
      const { projectId, clusterId, bucketId, scopeName } = data2;
      return {
        async create(data3) {
          try {
            const { name, maxTTL } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}/collections`,
              {
                headers,
                method: "post",
                body: JSON.stringify({
                  name,
                  maxTTL
                })
              }
            );
            if (res.ok) {
              return { ok: true };
            }
            throw new Error(`[Collections.create] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.collections.create");
          }
        },
        async list() {
          try {
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}/collections`,
              {
                headers
              }
            );
            if (res.ok) {
              const jsonData = await res.json();
              return { ...jsonData, ok: true };
            }
            throw new Error(`[Collections.list] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.collections.list");
          }
        },
        async get(data3) {
          try {
            const { collectionName } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}/collections/${collectionName}`,
              {
                headers
              }
            );
            if (res.ok) {
              const jsonData = await res.json();
              return { data: jsonData, ok: true };
            }
            throw new Error(`[Collections.get] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.collections.get");
          }
        },
        async update(data3) {
          try {
            const { collectionName, maxTTL } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}/collections/${collectionName}`,
              {
                headers,
                method: "put",
                body: JSON.stringify({
                  maxTTL
                })
              }
            );
            if (res.ok) {
              return { ok: true };
            }
            throw new Error(`[Collections.update] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.collections.update");
          }
        },
        async delete(data3) {
          try {
            const { collectionName } = data3;
            const res = await fetch(
              `${baseUrl}/v4/organizations/${organizationId}/projects/${projectId}/clusters/${clusterId}/buckets/${bucketId}/scopes/${scopeName}/collections/${collectionName}`,
              {
                headers,
                method: "delete"
              }
            );
            if (res.ok) {
              return { ok: true };
            }
            throw new Error(`[Collections.delete] ${res.status} ${res.statusText}`);
          } catch (e) {
            throw normalizeError(e, "couchbase.managementData.collections.delete");
          }
        }
      };
    }
  };
};
async function readErrorMessage(res) {
  try {
    const text = await res.text();
    return text || res.statusText || `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}
const dataApi = (data) => {
  const { clusterId, username, password, bucketName, scopeName, collectionName } = data;
  const headers = {
    authorization: `Basic ${btoa(`${username}:${password}`)}`,
    "content-type": "application/json"
  };
  const encodeKey = (documentKey) => encodeURIComponent(documentKey);
  const getDocument = async (data2) => {
    try {
      const { documentKey } = data2;
      const res = await fetch(
        `https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${encodeKey(documentKey)}`,
        {
          headers
        }
      );
      const isOk = res.status < 400;
      return {
        status: res.status,
        ...isOk ? { data: await res.json() } : { message: await readErrorMessage(res) },
        get ok() {
          return res.status < 400;
        }
      };
    } catch (e) {
      throw normalizeError(e, "couchbase.dataApi.document.get");
    }
  };
  return {
    document: {
      get: getDocument,
      async create(data2) {
        try {
          const { documentKey = randomUUID(), content } = data2;
          const res = await fetch(
            `https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${encodeKey(documentKey)}`,
            {
              headers,
              method: "post",
              body: JSON.stringify(content)
            }
          );
          const isOk = res.status < 400;
          return {
            status: res.status,
            ...isOk ? {} : { message: await readErrorMessage(res) },
            get ok() {
              return res.status < 400;
            }
          };
        } catch (e) {
          throw normalizeError(e, "couchbase.dataApi.document.create");
        }
      },
      async update(data2) {
        try {
          const { documentKey, content, overwriteAll = false } = data2;
          let currentDocument = void 0;
          if (!overwriteAll) {
            const response = await getDocument({ documentKey });
            if (response.ok) {
              currentDocument = response.data;
            }
          }
          const res = await fetch(
            `https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${encodeKey(documentKey)}`,
            {
              headers,
              method: "put",
              body: JSON.stringify({ ...currentDocument ?? {}, ...content })
            }
          );
          const isOk = res.status < 400;
          return {
            status: res.status,
            ...isOk ? {} : { message: await readErrorMessage(res) },
            get ok() {
              return res.status < 400;
            }
          };
        } catch (e) {
          throw normalizeError(e, "couchbase.dataApi.document.update");
        }
      },
      async delete(data2) {
        try {
          const { documentKey } = data2;
          const res = await fetch(
            `https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${encodeKey(documentKey)}`,
            {
              headers,
              method: "delete"
            }
          );
          const isOk = res.status < 400;
          return {
            status: res.status,
            ...isOk ? {} : { message: await readErrorMessage(res) },
            get ok() {
              return res.status < 400;
            }
          };
        } catch (e) {
          throw normalizeError(e, "couchbase.dataApi.document.delete");
        }
      },
      async touch(data2) {
        try {
          const { documentKey, expiry, returnContent } = data2;
          const res = await fetch(
            `https://${clusterId}.data.cloud.couchbase.com/v1/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}/documents/${encodeKey(documentKey)}/touch`,
            {
              headers,
              method: "post",
              body: JSON.stringify({
                expiry,
                returnContent
              })
            }
          );
          const isOk = res.status < 400;
          return {
            status: res.status,
            ...isOk ? {} : { message: await readErrorMessage(res) },
            get ok() {
              return res.status < 400;
            }
          };
        } catch (e) {
          throw normalizeError(e, "couchbase.dataApi.document.touch");
        }
      },
      async query(data2) {
        try {
          const {
            statement,
            readonly = false,
            scan_consistency = "request_plus",
            profile = "timings",
            format = "JSON",
            compression = "NONE",
            timeout = "10s",
            metrics = true,
            pretty = false,
            controls = false,
            ...options
          } = data2;
          const res = await fetch(
            `https://${clusterId}.data.cloud.couchbase.com/_p/query/query/service`,
            {
              headers,
              method: "post",
              body: JSON.stringify({
                statement,
                readonly,
                scan_consistency,
                profile,
                format,
                compression,
                timeout,
                metrics,
                pretty,
                controls,
                ...options
              })
            }
          );
          const bodyText = await res.text();
          const isOk = res.status < 400;
          let parsedBody = void 0;
          if (bodyText) {
            try {
              parsedBody = JSON.parse(bodyText);
            } catch {
              parsedBody = void 0;
            }
          }
          return {
            status: res.status,
            ...isOk ? { data: parsedBody } : { message: bodyText || res.statusText || `HTTP ${res.status}` },
            get ok() {
              return res.status < 400;
            }
          };
        } catch (e) {
          throw normalizeError(e, "couchbase.dataApi.document.query");
        }
      }
    },
    get query() {
      const document = this.document;
      return {
        collection: {
          async create(data2) {
            const { name } = data2;
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
              throw new Error(`Invalid collection name: "${name}"`);
            }
            const statement = `CREATE COLLECTION \`${bucketName}\`.\`${scopeName}\`.\`${name}\``;
            const res = await document.query({ statement });
            return {
              status: res.status,
              ...res.ok ? {} : { message: res.message },
              get ok() {
                return res.status < 400;
              }
            };
          },
          async drop(data2) {
            const { name } = data2;
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
              throw new Error(`Invalid collection name: "${name}"`);
            }
            const statement = `DROP COLLECTION \`${bucketName}\`.\`${scopeName}\`.\`${name}\``;
            const res = await document.query({ statement });
            return {
              status: res.status,
              ...res.ok ? {} : { message: res.message },
              get ok() {
                return res.status < 400;
              }
            };
          },
          async list() {
            const statement = `SELECT name
						FROM system:keyspaces
						WHERE \`bucket\` = "${bucketName}" AND \`scope\` = "${scopeName}";`;
            const res = await document.query({ statement });
            return {
              status: res.status,
              ...res.ok ? {} : { message: res.message },
              get ok() {
                return res.status < 400;
              },
              ...res.ok && res.data ? { data: res.data.results } : {}
            };
          }
        },
        document: {
          async search(data2) {
            const {
              conditions,
              logicalOperator = "AND",
              selectFields,
              orderBy,
              orderDirection = "DESC",
              limit = 20,
              offset = 0
            } = data2;
            if (!conditions || conditions.length === 0) {
              throw new Error("At least one condition is required");
            }
            const selectClause = selectFields && selectFields.length ? `META(k).id AS _id, ${assertSelectableFields(collectionName, selectFields).map((f) => `k.\`${String(f)}\``).join(", ")}` : `META(k).id AS _id, k.*`;
            const args = [];
            const whereClauses = conditions.map((cond) => {
              const { fieldName, keyword, operator = "EQUALS" } = cond;
              const field = assertSearchableField(collectionName, fieldName);
              assertOperatorAllowed(field.type, operator, String(fieldName));
              assertValueMatchesType(field.type, keyword, String(fieldName));
              if (operator === "CONTAINS") {
                args.push(`%${keyword}%`);
                return `LOWER(k.\`${String(fieldName)}\`) LIKE LOWER($${args.length})`;
              }
              args.push(keyword);
              return `k.\`${String(fieldName)}\` ${toN1qlOperator(operator)} $${args.length}`;
            });
            const whereClause = whereClauses.join(` ${logicalOperator} `);
            let orderClause = "";
            if (orderBy) {
              assertSortableField(collectionName, orderBy);
              orderClause = `ORDER BY k.\`${String(orderBy)}\` ${orderDirection === "ASC" ? "ASC" : "DESC"}`;
            }
            const safeLimit = Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 20;
            const safeOffset = Number.isInteger(Number(offset)) && Number(offset) >= 0 ? Number(offset) : 0;
            const cappedLimit = Math.min(safeLimit, 100);
            const statement = `
							SELECT ${selectClause}
							FROM \`${bucketName}\`.\`${scopeName}\`.\`${collectionName}\` AS k
							WHERE ${whereClause}
							${orderClause}
							LIMIT ${cappedLimit}
							OFFSET ${safeOffset}
						`.trim();
            const res = await document.query({ statement, args, readonly: true });
            return {
              status: res.status,
              get ok() {
                return res.status < 400;
              },
              ...res.ok && res.data ? { data: res.data.results } : { message: res.message }
            };
          }
        },
        /**
         * Returns the number of documents indexed in the specified Search index.
         * @indexName The name of the Search index definition. You must use the fully qualified name for the index, which includes the bucket and scope.
         */
        search: {
          async getCount(data2) {
            try {
              const { indexName } = data2;
              const url = `https://${clusterId}.data.cloud.couchbase.com/_p/fts/api/index/${indexName}/count`;
              const res = await fetch(url, { headers });
              if (res.ok) {
                const jsonData = await res.json();
                return {
                  status: res.status,
                  get ok() {
                    return res.status < 400;
                  },
                  count: jsonData.count
                };
              }
              const errorBody = await res.text();
              throw new Error(
                `[Search.getCount] ${res.status} ${res.statusText} — Body: ${errorBody}`
              );
            } catch (e) {
              throw normalizeError(e, "couchbase.dataApi.query.search.getCount");
            }
          },
          /**
           * Thực thi truy vấn Full Text Search trên 1 Search Index đã định nghĩa (scoped tới bucket/scope hiện tại).
           * @indexName Tên index (không cần fully-qualified — endpoint đã scoped theo bucket/scope trong URL)
           * @query FTS query object theo chuẩn Couchbase — có thể là match query, query string, boolean query...
           *        Xem: https://docs.couchbase.com/server/current/fts/fts-query-string-syntax.html
           * @size Số kết quả tối đa trả về (mặc định 10)
           * @from Vị trí bắt đầu — dùng cho phân trang
           * @fields Danh sách field muốn trả về trong "fields" của mỗi hit (mặc định chỉ trả id + score)
           * @sort Cách sắp xếp — mặc định theo "-_score" (điểm liên quan giảm dần)
           * @highlight Bật highlight đoạn text khớp — hữu ích cho UI hiển thị kết quả tìm kiếm
           */
          async searchIndex(data2) {
            try {
              const {
                indexName,
                query,
                size = 10,
                from = 0,
                fields,
                sort,
                highlight,
                facets,
                explain = false
              } = data2;
              if (!indexName) throw new Error("indexName is required");
              if (!query) throw new Error("query is required");
              const safeSize = Number.isInteger(size) && size > 0 ? Math.min(size, 1e3) : 10;
              const safeFrom = Number.isInteger(from) && from >= 0 ? from : 0;
              const url = `https://${clusterId}.data.cloud.couchbase.com/_p/fts/api/bucket/${bucketName}/scope/${scopeName}/index/${indexName}/query`;
              const res = await fetch(url, {
                method: "post",
                headers,
                body: JSON.stringify({
                  query,
                  size: safeSize,
                  from: safeFrom,
                  ...fields ? { fields } : {},
                  ...sort ? { sort } : {},
                  ...highlight ? { highlight } : {},
                  ...facets ? { facets } : {},
                  explain
                })
              });
              if (res.ok) {
                const jsonData = await res.json();
                return {
                  status: res.status,
                  get ok() {
                    return res.status < 400;
                  },
                  hits: jsonData.hits ?? [],
                  total: jsonData.total_hits ?? 0,
                  took: jsonData.took
                };
              }
              const errorBody = await res.text();
              return {
                status: res.status,
                get ok() {
                  return false;
                },
                message: `${res.status} ${res.statusText} — Body: ${errorBody}`
              };
            } catch (e) {
              throw normalizeError(e, "couchbase.search.searchIndex");
            }
          }
        }
      };
    }
  };
};
const couchbase = {
  managementData,
  dataApi
};
const username_owner = "admin";
const password_owner = "123123_Qwe";
const email_owner = "phuongdomega@atomicmail.io";
const cb_clusterIdManagement = "bfec0c04-51d2-48a4-acd8-d28873727fec";
const cb_clusterId = "wufhafdvqtx2ps4h";
const cb_bucketId = "cGh1b25nZG9tZWdh";
const cb_username = "admin";
const cb_password = "123123_Qwe";
const cb_api_key_secret = "dXRMSjJIbHNiMzhHdERpNTRDM2dTUHVteWxLMVRRVWw6ZDJAfjNNTmlAdithcU95Mmx0Ym1WUlpPUkhYaE9pbm8hNVM1cVFAQ3VJdWZxa3FLbHVvY2tyblchZlV2YVQhOA==";
const cb_bucketName = "phuongdomega";
const cb_scopeName = "_default";
const cb_organizationId = "4ac7ac30-123c-4383-909a-89c99ec57df0";
const cb_projectId = "8a862a3c-7a67-4010-86c1-e4fa5a7dff93";
const cb_clusterId_vault = "yj0bdhww2fdmq9-q";
const cb_username_vault = "admin";
const cb_password_vault = "123123_Qwe";
const cb_bucketName_vault = "phuongdomega-vault";
const cb_scopeName_vault = "_default";
const cb_collectionName_vault = "vaults";
const cb_document_id_rsa_key_vault = "rsa-keypair";
const vault_password = "123123_Qwe";
const cb = couchbase;
const cbData = (collectionName) => {
  return cb.dataApi({
    clusterId: cb_clusterId,
    username: cb_username,
    password: cb_password,
    bucketName: cb_bucketName,
    scopeName: cb_scopeName,
    collectionName
  });
};
const cbVault = (collectionName) => cb.dataApi({
  clusterId: cb_clusterId_vault,
  username: cb_username_vault,
  password: cb_password_vault,
  bucketName: cb_bucketName_vault,
  scopeName: cb_scopeName_vault,
  collectionName
});
export {
  cb_bucketName as a,
  cb_scopeName as b,
  cbData as c,
  cbVault as d,
  cb_document_id_rsa_key_vault as e,
  cb_collectionName_vault as f,
  couchbase as g,
  cb_organizationId as h,
  cb_api_key_secret as i,
  cb_bucketId as j,
  cb_clusterIdManagement as k,
  cb_projectId as l,
  collectionSchemas as m,
  email_owner as n,
  password_owner as p,
  username_owner as u,
  vault_password as v
};
