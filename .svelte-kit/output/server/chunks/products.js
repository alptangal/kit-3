import { c as cbData, a as cb_bucketName, b as cb_scopeName } from "./clients.js";
import { P as PermissionChecker } from "./users.js";
const cbProducts = cbData("products");
const cbVariants = cbData("product_variants");
const cbCategories = cbData("categories");
const cbBrands = cbData("brands");
const productsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`products\``;
const variantsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`product_variants\``;
const categoriesKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`categories\``;
const brandsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`brands\``;
const adminMessages = {
  notFound: {
    vi: "Không tìm thấy sản phẩm",
    en: "Product not found"
  },
  queryFailed: {
    vi: "Lấy danh sách sản phẩm thất bại",
    en: "Failed to fetch product list"
  },
  createFailed: {
    vi: "Tạo sản phẩm thất bại",
    en: "Failed to create product"
  },
  updateFailed: {
    vi: "Cập nhật sản phẩm thất bại",
    en: "Failed to update product"
  },
  deleteFailed: {
    vi: "Xoá sản phẩm thất bại",
    en: "Failed to delete product"
  },
  permissionDenied: {
    vi: "Bạn không có quyền thực hiện thao tác này",
    en: "You do not have permission to perform this action"
  },
  variantNotFound: {
    vi: "Không tìm thấy biến thể sản phẩm",
    en: "Product variant not found"
  },
  variantCreateFailed: {
    vi: "Tạo biến thể thất bại",
    en: "Failed to create variant"
  },
  variantUpdateFailed: {
    vi: "Cập nhật biến thể thất bại",
    en: "Failed to update variant"
  },
  variantDeleteFailed: {
    vi: "Xoá biến thể thất bại",
    en: "Failed to delete variant"
  },
  categoryNotFound: {
    vi: "Không tìm thấy danh mục",
    en: "Category not found"
  },
  categoryCreateFailed: {
    vi: "Tạo danh mục thất bại",
    en: "Failed to create category"
  },
  categoryUpdateFailed: {
    vi: "Cập nhật danh mục thất bại",
    en: "Failed to update category"
  },
  categoryDeleteFailed: {
    vi: "Xoá danh mục thất bại",
    en: "Failed to delete category"
  },
  brandNotFound: {
    vi: "Không tìm thấy thương hiệu",
    en: "Brand not found"
  },
  brandCreateFailed: {
    vi: "Tạo thương hiệu thất bại",
    en: "Failed to create brand"
  },
  brandUpdateFailed: {
    vi: "Cập nhật thương hiệu thất bại",
    en: "Failed to update brand"
  },
  brandDeleteFailed: {
    vi: "Xoá thương hiệu thất bại",
    en: "Failed to delete brand"
  },
  slugTaken: {
    vi: "Slug đã được sử dụng",
    en: "Slug is already taken"
  },
  skuTaken: {
    vi: "SKU đã được sử dụng",
    en: "SKU is already taken"
  }
};
const PRODUCT_ADMIN_SAFE_FIELDS = [
  "name",
  "description",
  "categoryId",
  "brandId",
  "hasVariants",
  "variantAttributes",
  "imageUrl",
  "status",
  "createdBy",
  "createdAt",
  "updatedAt",
  "deletedAt"
];
const VARIANT_ADMIN_SAFE_FIELDS = [
  "productId",
  "sku",
  "barcode",
  "attributes",
  "displayName",
  "price",
  "costPrice",
  "weight",
  "trackLot",
  "trackExpiry",
  "lowStockThreshold",
  "imageUrl",
  "status",
  "createdAt",
  "updatedAt",
  "deletedAt"
];
const CATEGORY_ADMIN_SAFE_FIELDS = [
  "name",
  "slug",
  "parentId",
  "status",
  "createdAt",
  "updatedAt"
];
const BRAND_ADMIN_SAFE_FIELDS = [
  "name",
  "slug",
  "logoUrl",
  "description",
  "status",
  "createdAt",
  "updatedAt"
];
function sanitizeProductForAdmin(doc) {
  const safe = { _id: doc._id };
  for (const field of PRODUCT_ADMIN_SAFE_FIELDS) {
    safe[field] = doc[field];
  }
  return safe;
}
function sanitizeVariantForAdmin(doc) {
  const safe = { _id: doc._id };
  for (const field of VARIANT_ADMIN_SAFE_FIELDS) {
    safe[field] = doc[field];
  }
  return safe;
}
function sanitizeCategoryForAdmin(doc) {
  const safe = { _id: doc._id };
  for (const field of CATEGORY_ADMIN_SAFE_FIELDS) {
    safe[field] = doc[field];
  }
  return safe;
}
function sanitizeBrandForAdmin(doc) {
  const safe = { _id: doc._id };
  for (const field of BRAND_ADMIN_SAFE_FIELDS) {
    safe[field] = doc[field];
  }
  return safe;
}
class ProductAdminService {
  static async requirePermission(actor, permissionKey, targetBranchId, targetUserId) {
    const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
      branchId: actor.branchId,
      targetBranchId,
      actorUserId: actor.userId,
      targetUserId
    });
    if (!allowed) return { success: false, messages: adminMessages.permissionDenied };
    return null;
  }
  // ========== PRODUCTS ==========
  static async list(actor, options = {}) {
    const scope = await PermissionChecker.getScope(actor.roleName, "products:read");
    if (!scope) return { success: false, messages: adminMessages.permissionDenied };
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const conditions = [];
    const args = [];
    if (scope === "own_branch") {
      if (!actor.branchId) {
        return { success: false, messages: adminMessages.permissionDenied };
      }
    }
    if (!options.includeDeleted) {
      conditions.push("(deletedAt IS NULL OR deletedAt IS MISSING)");
    }
    if (options.search) {
      args.push(`%${options.search}%`);
      conditions.push(`name LIKE $${args.length}`);
    }
    if (options.categoryId) {
      args.push(options.categoryId);
      conditions.push(`categoryId = $${args.length}`);
    }
    if (options.brandId) {
      args.push(options.brandId);
      conditions.push(`brandId = $${args.length}`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const selectClause = `META().id AS _id, ${PRODUCT_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(", ")}`;
    const [countRes, dataRes] = await Promise.all([
      cbProducts.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${productsKeyspace} ${whereClause}`,
        args,
        readonly: true
      }),
      cbProducts.document.query({
        statement: `SELECT ${selectClause} FROM ${productsKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
        args,
        readonly: true
      })
    ]);
    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: adminMessages.queryFailed };
    }
    const total = Number(countRes.data?.results?.[0] ?? 0);
    const items = (dataRes.data?.results ?? []).map(sanitizeProductForAdmin);
    return { success: true, items, total, page, pageSize };
  }
  static async getById(actor, documentKey) {
    const denied = await this.requirePermission(actor, "products:read", null, documentKey);
    if (denied) return denied;
    const res = await cbProducts.document.get({ documentKey });
    if (!res.ok || !res.data) {
      return { success: false, messages: adminMessages.notFound };
    }
    return { success: true, data: sanitizeProductForAdmin({ ...res.data, _id: documentKey }) };
  }
  static async create(actor, data) {
    const denied = await this.requirePermission(actor, "products:create");
    if (denied) return denied;
    if (data.categoryId) {
      const catRes = await cbCategories.document.get({ documentKey: data.categoryId });
      if (!catRes.ok) return { success: false, messages: adminMessages.categoryNotFound };
    }
    if (data.brandId) {
      const brandRes = await cbBrands.document.get({ documentKey: data.brandId });
      if (!brandRes.ok) return { success: false, messages: adminMessages.brandNotFound };
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const documentKey = `product::${crypto.randomUUID()}`;
    const productDoc = {
      name: data.name.trim(),
      description: data.description ?? "",
      categoryId: data.categoryId ?? null,
      brandId: data.brandId ?? null,
      hasVariants: data.hasVariants,
      variantAttributes: data.variantAttributes ?? null,
      imageUrl: data.imageUrl ?? null,
      status: data.status ?? "active",
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    try {
      const res = await cbProducts.document.create({
        documentKey,
        content: productDoc
      });
      if (!res.ok) return { success: false, messages: adminMessages.createFailed };
      return { success: true, messages: { vi: "Tạo sản phẩm thành công", en: "Product created successfully" }, documentKey };
    } catch {
      return { success: false, messages: adminMessages.createFailed };
    }
  }
  static async update(actor, documentKey, data) {
    const target = await cbProducts.document.get({ documentKey });
    if (!target.ok || !target.data) return { success: false, messages: adminMessages.notFound };
    const denied = await this.requirePermission(actor, "products:update", null, documentKey);
    if (denied) return denied;
    if (data.categoryId !== void 0 && data.categoryId) {
      const catRes = await cbCategories.document.get({ documentKey: data.categoryId });
      if (!catRes.ok) return { success: false, messages: adminMessages.categoryNotFound };
    }
    if (data.brandId !== void 0 && data.brandId) {
      const brandRes = await cbBrands.document.get({ documentKey: data.brandId });
      if (!brandRes.ok) return { success: false, messages: adminMessages.brandNotFound };
    }
    const updatePayload = { updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (data.name !== void 0) updatePayload.name = data.name.trim();
    if (data.description !== void 0) updatePayload.description = data.description;
    if (data.categoryId !== void 0) updatePayload.categoryId = data.categoryId;
    if (data.brandId !== void 0) updatePayload.brandId = data.brandId;
    if (data.hasVariants !== void 0) updatePayload.hasVariants = data.hasVariants;
    if (data.variantAttributes !== void 0) updatePayload.variantAttributes = data.variantAttributes;
    if (data.imageUrl !== void 0) updatePayload.imageUrl = data.imageUrl;
    if (data.status !== void 0) updatePayload.status = data.status;
    try {
      const res = await cbProducts.document.update({ documentKey, content: updatePayload });
      if (!res.ok) return { success: false, messages: adminMessages.updateFailed };
      return { success: true, messages: { vi: "Cập nhật sản phẩm thành công", en: "Product updated successfully" } };
    } catch {
      return { success: false, messages: adminMessages.updateFailed };
    }
  }
  static async delete(actor, documentKey) {
    const target = await cbProducts.document.get({ documentKey });
    if (!target.ok || !target.data) return { success: false, messages: adminMessages.notFound };
    const denied = await this.requirePermission(actor, "products:delete", null, documentKey);
    if (denied) return denied;
    const variantCheck = await cbVariants.document.query({
      statement: `SELECT RAW COUNT(*) FROM ${variantsKeyspace} WHERE productId = $1 AND (deletedAt IS NULL OR deletedAt IS MISSING)`,
      args: [documentKey],
      readonly: true
    });
    if (variantCheck.ok && Number(variantCheck.data?.results?.[0] ?? 0) > 0) {
      return { success: false, messages: { vi: "Sản phẩm có biến thể, không thể xoá", en: "Product has variants, cannot delete" } };
    }
    try {
      const res = await cbProducts.document.update({
        documentKey,
        content: { deletedAt: (/* @__PURE__ */ new Date()).toISOString(), status: "discontinued" }
      });
      if (!res.ok) return { success: false, messages: adminMessages.deleteFailed };
      return { success: true, messages: { vi: "Xoá sản phẩm thành công", en: "Product deleted successfully" } };
    } catch {
      return { success: false, messages: adminMessages.deleteFailed };
    }
  }
  // ========== VARIANTS ==========
  static async listVariants(actor, options = {}) {
    const scope = await PermissionChecker.getScope(actor.roleName, "products:read");
    if (!scope) return { success: false, messages: adminMessages.permissionDenied };
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const conditions = [];
    const args = [];
    if (!options.includeDeleted) {
      conditions.push("(deletedAt IS NULL OR deletedAt IS MISSING)");
    }
    if (options.productId) {
      args.push(options.productId);
      conditions.push(`productId = $${args.length}`);
    }
    if (options.search) {
      args.push(`%${options.search}%`);
      conditions.push(`(sku LIKE $${args.length} OR displayName LIKE $${args.length} OR barcode LIKE $${args.length})`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const selectClause = `META().id AS _id, ${VARIANT_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(", ")}`;
    const [countRes, dataRes] = await Promise.all([
      cbVariants.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${variantsKeyspace} ${whereClause}`,
        args,
        readonly: true
      }),
      cbVariants.document.query({
        statement: `SELECT ${selectClause} FROM ${variantsKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
        args,
        readonly: true
      })
    ]);
    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: adminMessages.queryFailed };
    }
    const total = Number(countRes.data?.results?.[0] ?? 0);
    const items = (dataRes.data?.results ?? []).map(sanitizeVariantForAdmin);
    return { success: true, items, total, page, pageSize };
  }
  static async getVariantById(actor, documentKey) {
    const denied = await this.requirePermission(actor, "products:read", null, documentKey);
    if (denied) return denied;
    const res = await cbVariants.document.get({ documentKey });
    if (!res.ok || !res.data) {
      return { success: false, messages: adminMessages.variantNotFound };
    }
    return { success: true, data: sanitizeVariantForAdmin({ ...res.data, _id: documentKey }) };
  }
  static async createVariant(actor, data) {
    const denied = await this.requirePermission(actor, "products:create");
    if (denied) return denied;
    const prodRes = await cbProducts.document.get({ documentKey: data.productId });
    if (!prodRes.ok) return { success: false, messages: adminMessages.notFound };
    const skuCheck = await cbVariants.document.query({
      statement: `SELECT RAW COUNT(*) FROM ${variantsKeyspace} WHERE sku = $1 AND (deletedAt IS NULL OR deletedAt IS MISSING)`,
      args: [data.sku.trim().toUpperCase()],
      readonly: true
    });
    if (skuCheck.ok && Number(skuCheck.data?.results?.[0] ?? 0) > 0) {
      return { success: false, messages: adminMessages.skuTaken };
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const documentKey = `variant::${crypto.randomUUID()}`;
    const variantDoc = {
      productId: data.productId,
      sku: data.sku.trim().toUpperCase(),
      barcode: data.barcode ?? null,
      attributes: data.attributes,
      displayName: data.displayName.trim(),
      price: data.price,
      costPrice: data.costPrice ?? null,
      weight: data.weight ?? null,
      trackLot: data.trackLot ?? false,
      trackExpiry: data.trackExpiry ?? false,
      lowStockThreshold: data.lowStockThreshold ?? null,
      imageUrl: data.imageUrl ?? null,
      status: data.status ?? "active",
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    try {
      const res = await cbVariants.document.create({ documentKey, content: variantDoc });
      if (!res.ok) return { success: false, messages: adminMessages.variantCreateFailed };
      return { success: true, messages: { vi: "Tạo biến thể thành công", en: "Variant created successfully" }, documentKey };
    } catch {
      return { success: false, messages: adminMessages.variantCreateFailed };
    }
  }
  static async updateVariant(actor, documentKey, data) {
    const target = await cbVariants.document.get({ documentKey });
    if (!target.ok || !target.data) return { success: false, messages: adminMessages.variantNotFound };
    const denied = await this.requirePermission(actor, "products:update", null, documentKey);
    if (denied) return denied;
    if (data.sku !== void 0) {
      const skuCheck = await cbVariants.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${variantsKeyspace} WHERE sku = $1 AND META().id != $2 AND (deletedAt IS NULL OR deletedAt IS MISSING)`,
        args: [data.sku.trim().toUpperCase(), documentKey],
        readonly: true
      });
      if (skuCheck.ok && Number(skuCheck.data?.results?.[0] ?? 0) > 0) {
        return { success: false, messages: adminMessages.skuTaken };
      }
    }
    const updatePayload = { updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (data.sku !== void 0) updatePayload.sku = data.sku.trim().toUpperCase();
    if (data.barcode !== void 0) updatePayload.barcode = data.barcode;
    if (data.attributes !== void 0) updatePayload.attributes = data.attributes;
    if (data.displayName !== void 0) updatePayload.displayName = data.displayName.trim();
    if (data.price !== void 0) updatePayload.price = data.price;
    if (data.costPrice !== void 0) updatePayload.costPrice = data.costPrice;
    if (data.weight !== void 0) updatePayload.weight = data.weight;
    if (data.trackLot !== void 0) updatePayload.trackLot = data.trackLot;
    if (data.trackExpiry !== void 0) updatePayload.trackExpiry = data.trackExpiry;
    if (data.lowStockThreshold !== void 0) updatePayload.lowStockThreshold = data.lowStockThreshold;
    if (data.imageUrl !== void 0) updatePayload.imageUrl = data.imageUrl;
    if (data.status !== void 0) updatePayload.status = data.status;
    try {
      const res = await cbVariants.document.update({ documentKey, content: updatePayload });
      if (!res.ok) return { success: false, messages: adminMessages.variantUpdateFailed };
      return { success: true, messages: { vi: "Cập nhật biến thể thành công", en: "Variant updated successfully" } };
    } catch {
      return { success: false, messages: adminMessages.variantUpdateFailed };
    }
  }
  static async deleteVariant(actor, documentKey) {
    const target = await cbVariants.document.get({ documentKey });
    if (!target.ok || !target.data) return { success: false, messages: adminMessages.variantNotFound };
    const denied = await this.requirePermission(actor, "products:delete", null, documentKey);
    if (denied) return denied;
    const invCheck = await cbData("inventory_stock").document.query({
      statement: `SELECT RAW COUNT(*) FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`inventory_stock\` WHERE variantId = $1`,
      args: [documentKey],
      readonly: true
    });
    if (invCheck.ok && Number(invCheck.data?.results?.[0] ?? 0) > 0) {
      return { success: false, messages: { vi: "Biến thể có tồn kho, không thể xoá", en: "Variant has inventory, cannot delete" } };
    }
    try {
      const res = await cbVariants.document.update({
        documentKey,
        content: { deletedAt: (/* @__PURE__ */ new Date()).toISOString(), status: "discontinued" }
      });
      if (!res.ok) return { success: false, messages: adminMessages.variantDeleteFailed };
      return { success: true, messages: { vi: "Xoá biến thể thành công", en: "Variant deleted successfully" } };
    } catch {
      return { success: false, messages: adminMessages.variantDeleteFailed };
    }
  }
  // ========== CATEGORIES ==========
  static async listCategories(actor, options = {}) {
    const denied = await this.requirePermission(actor, "products:read");
    if (denied) return denied;
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50));
    const offset = (page - 1) * pageSize;
    const conditions = [];
    const args = [];
    if (!options.includeDeleted) ;
    if (options.parentId !== void 0) {
      if (options.parentId) {
        args.push(options.parentId);
        conditions.push(`parentId = $${args.length}`);
      } else {
        conditions.push("(parentId IS NULL OR parentId IS MISSING)");
      }
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const selectClause = `META().id AS _id, ${CATEGORY_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(", ")}`;
    const res = await cbCategories.document.query({
      statement: `SELECT ${selectClause} FROM ${categoriesKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
      args,
      readonly: true
    });
    if (!res.ok) return { success: false, messages: adminMessages.queryFailed };
    const categories = (res.data?.results ?? []).map(sanitizeCategoryForAdmin);
    return { success: true, categories };
  }
  static async getCategoryById(actor, documentKey) {
    const denied = await this.requirePermission(actor, "products:read", null, documentKey);
    if (denied) return denied;
    const res = await cbCategories.document.get({ documentKey });
    if (!res.ok || !res.data) {
      return { success: false, messages: adminMessages.categoryNotFound };
    }
    return { success: true, data: sanitizeCategoryForAdmin({ ...res.data, _id: documentKey }) };
  }
  static async createCategory(actor, data) {
    const denied = await this.requirePermission(actor, "products:create");
    if (denied) return denied;
    const slugCheck = await cbCategories.document.query({
      statement: `SELECT RAW COUNT(*) FROM ${categoriesKeyspace} WHERE slug = $1`,
      args: [data.slug.trim().toLowerCase()],
      readonly: true
    });
    if (slugCheck.ok && Number(slugCheck.data?.results?.[0] ?? 0) > 0) {
      return { success: false, messages: adminMessages.slugTaken };
    }
    if (data.parentId) {
      const parentRes = await cbCategories.document.get({ documentKey: data.parentId });
      if (!parentRes.ok) return { success: false, messages: adminMessages.categoryNotFound };
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const documentKey = `category::${crypto.randomUUID()}`;
    const categoryDoc = {
      name: data.name.trim(),
      slug: data.slug.trim().toLowerCase(),
      parentId: data.parentId ?? null,
      status: data.status ?? "active",
      createdAt: now,
      updatedAt: now
    };
    try {
      const res = await cbCategories.document.create({ documentKey, content: categoryDoc });
      if (!res.ok) return { success: false, messages: adminMessages.categoryCreateFailed };
      return { success: true, messages: { vi: "Tạo danh mục thành công", en: "Category created successfully" }, documentKey };
    } catch {
      return { success: false, messages: adminMessages.categoryCreateFailed };
    }
  }
  static async updateCategory(actor, documentKey, data) {
    const target = await cbCategories.document.get({ documentKey });
    if (!target.ok || !target.data) return { success: false, messages: adminMessages.categoryNotFound };
    const denied = await this.requirePermission(actor, "products:update", null, documentKey);
    if (denied) return denied;
    if (data.slug !== void 0) {
      const slugCheck = await cbCategories.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${categoriesKeyspace} WHERE slug = $1 AND META().id != $2`,
        args: [data.slug.trim().toLowerCase(), documentKey],
        readonly: true
      });
      if (slugCheck.ok && Number(slugCheck.data?.results?.[0] ?? 0) > 0) {
        return { success: false, messages: adminMessages.slugTaken };
      }
    }
    if (data.parentId !== void 0 && data.parentId) {
      const parentRes = await cbCategories.document.get({ documentKey: data.parentId });
      if (!parentRes.ok) return { success: false, messages: adminMessages.categoryNotFound };
      if (data.parentId === documentKey) {
        return { success: false, messages: { vi: "Danh mục không thể là cha của chính nó", en: "Category cannot be its own parent" } };
      }
    }
    const updatePayload = { updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (data.name !== void 0) updatePayload.name = data.name.trim();
    if (data.slug !== void 0) updatePayload.slug = data.slug.trim().toLowerCase();
    if (data.parentId !== void 0) updatePayload.parentId = data.parentId;
    if (data.status !== void 0) updatePayload.status = data.status;
    try {
      const res = await cbCategories.document.update({ documentKey, content: updatePayload });
      if (!res.ok) return { success: false, messages: adminMessages.categoryUpdateFailed };
      return { success: true, messages: { vi: "Cập nhật danh mục thành công", en: "Category updated successfully" } };
    } catch {
      return { success: false, messages: adminMessages.categoryUpdateFailed };
    }
  }
  static async deleteCategory(actor, documentKey) {
    const target = await cbCategories.document.get({ documentKey });
    if (!target.ok || !target.data) return { success: false, messages: adminMessages.categoryNotFound };
    const denied = await this.requirePermission(actor, "products:delete", null, documentKey);
    if (denied) return denied;
    const childCheck = await cbCategories.document.query({
      statement: `SELECT RAW COUNT(*) FROM ${categoriesKeyspace} WHERE parentId = $1`,
      args: [documentKey],
      readonly: true
    });
    if (childCheck.ok && Number(childCheck.data?.results?.[0] ?? 0) > 0) {
      return { success: false, messages: { vi: "Danh mục có danh mục con, không thể xoá", en: "Category has children, cannot delete" } };
    }
    const prodCheck = await cbProducts.document.query({
      statement: `SELECT RAW COUNT(*) FROM ${productsKeyspace} WHERE categoryId = $1 AND (deletedAt IS NULL OR deletedAt IS MISSING)`,
      args: [documentKey],
      readonly: true
    });
    if (prodCheck.ok && Number(prodCheck.data?.results?.[0] ?? 0) > 0) {
      return { success: false, messages: { vi: "Danh mục đang được sử dụng bởi sản phẩm", en: "Category is used by products" } };
    }
    try {
      const res = await cbCategories.document.delete({ documentKey });
      if (!res.ok) return { success: false, messages: adminMessages.categoryDeleteFailed };
      return { success: true, messages: { vi: "Xoá danh mục thành công", en: "Category deleted successfully" } };
    } catch {
      return { success: false, messages: adminMessages.categoryDeleteFailed };
    }
  }
  // ========== BRANDS ==========
  static async listBrands(actor, options = {}) {
    const denied = await this.requirePermission(actor, "products:read");
    if (denied) return denied;
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50));
    const offset = (page - 1) * pageSize;
    const conditions = [];
    const args = [];
    if (options.search) {
      args.push(`%${options.search}%`);
      conditions.push(`name LIKE $${args.length}`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const selectClause = `META().id AS _id, ${BRAND_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(", ")}`;
    const res = await cbBrands.document.query({
      statement: `SELECT ${selectClause} FROM ${brandsKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
      args,
      readonly: true
    });
    if (!res.ok) return { success: false, messages: adminMessages.queryFailed };
    const brands = (res.data?.results ?? []).map(sanitizeBrandForAdmin);
    return { success: true, brands };
  }
  static async getBrandById(actor, documentKey) {
    const denied = await this.requirePermission(actor, "products:read", null, documentKey);
    if (denied) return denied;
    const res = await cbBrands.document.get({ documentKey });
    if (!res.ok || !res.data) {
      return { success: false, messages: adminMessages.brandNotFound };
    }
    return { success: true, data: sanitizeBrandForAdmin({ ...res.data, _id: documentKey }) };
  }
  static async createBrand(actor, data) {
    const denied = await this.requirePermission(actor, "products:create");
    if (denied) return denied;
    const slugCheck = await cbBrands.document.query({
      statement: `SELECT RAW COUNT(*) FROM ${brandsKeyspace} WHERE slug = $1`,
      args: [data.slug.trim().toLowerCase()],
      readonly: true
    });
    if (slugCheck.ok && Number(slugCheck.data?.results?.[0] ?? 0) > 0) {
      return { success: false, messages: adminMessages.slugTaken };
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const documentKey = `brand::${crypto.randomUUID()}`;
    const brandDoc = {
      name: data.name.trim(),
      slug: data.slug.trim().toLowerCase(),
      logoUrl: data.logoUrl ?? null,
      description: data.description ?? "",
      status: data.status ?? "active",
      createdAt: now,
      updatedAt: now
    };
    try {
      const res = await cbBrands.document.create({ documentKey, content: brandDoc });
      if (!res.ok) return { success: false, messages: adminMessages.brandCreateFailed };
      return { success: true, messages: { vi: "Tạo thương hiệu thành công", en: "Brand created successfully" }, documentKey };
    } catch {
      return { success: false, messages: adminMessages.brandCreateFailed };
    }
  }
  static async updateBrand(actor, documentKey, data) {
    const target = await cbBrands.document.get({ documentKey });
    if (!target.ok || !target.data) return { success: false, messages: adminMessages.brandNotFound };
    const denied = await this.requirePermission(actor, "products:update", null, documentKey);
    if (denied) return denied;
    if (data.slug !== void 0) {
      const slugCheck = await cbBrands.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${brandsKeyspace} WHERE slug = $1 AND META().id != $2`,
        args: [data.slug.trim().toLowerCase(), documentKey],
        readonly: true
      });
      if (slugCheck.ok && Number(slugCheck.data?.results?.[0] ?? 0) > 0) {
        return { success: false, messages: adminMessages.slugTaken };
      }
    }
    const updatePayload = { updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (data.name !== void 0) updatePayload.name = data.name.trim();
    if (data.slug !== void 0) updatePayload.slug = data.slug.trim().toLowerCase();
    if (data.logoUrl !== void 0) updatePayload.logoUrl = data.logoUrl;
    if (data.description !== void 0) updatePayload.description = data.description;
    if (data.status !== void 0) updatePayload.status = data.status;
    try {
      const res = await cbBrands.document.update({ documentKey, content: updatePayload });
      if (!res.ok) return { success: false, messages: adminMessages.brandUpdateFailed };
      return { success: true, messages: { vi: "Cập nhật thương hiệu thành công", en: "Brand updated successfully" } };
    } catch {
      return { success: false, messages: adminMessages.brandUpdateFailed };
    }
  }
  static async deleteBrand(actor, documentKey) {
    const target = await cbBrands.document.get({ documentKey });
    if (!target.ok || !target.data) return { success: false, messages: adminMessages.brandNotFound };
    const denied = await this.requirePermission(actor, "products:delete", null, documentKey);
    if (denied) return denied;
    const prodCheck = await cbProducts.document.query({
      statement: `SELECT RAW COUNT(*) FROM ${productsKeyspace} WHERE brandId = $1 AND (deletedAt IS NULL OR deletedAt IS MISSING)`,
      args: [documentKey],
      readonly: true
    });
    if (prodCheck.ok && Number(prodCheck.data?.results?.[0] ?? 0) > 0) {
      return { success: false, messages: { vi: "Thương hiệu đang được sử dụng bởi sản phẩm", en: "Brand is used by products" } };
    }
    try {
      const res = await cbBrands.document.delete({ documentKey });
      if (!res.ok) return { success: false, messages: adminMessages.brandDeleteFailed };
      return { success: true, messages: { vi: "Xoá thương hiệu thành công", en: "Brand deleted successfully" } };
    } catch {
      return { success: false, messages: adminMessages.brandDeleteFailed };
    }
  }
}
export {
  ProductAdminService as P
};
