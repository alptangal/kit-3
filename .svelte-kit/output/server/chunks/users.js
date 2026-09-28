var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { c as cbData, a as cb_bucketName, b as cb_scopeName } from "./clients.js";
import { e as encryption } from "./encryption.js";
import "./initSystemVault.js";
class TranslatableError extends Error {
  constructor(content) {
    super(content.en ?? content.vi ?? "Unknown error");
    __publicField(this, "content");
    this.name = "TranslatableError";
    this.content = content;
  }
}
const detailRolesKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`detail_roles\``;
const cbDetailRoles = cbData("detail_roles");
const CACHE_TTL_MS = 6e4;
let grantsCache = null;
async function getAllGrants() {
  if (grantsCache && grantsCache.expiresAt > Date.now()) {
    return grantsCache.data;
  }
  const res = await cbDetailRoles.document.query({
    statement: `SELECT roleName, permissionKey, scope FROM ${detailRolesKeyspace}`,
    readonly: true
  });
  if (!res.ok) {
    console.error("[PermissionChecker] getAllGrants query failed:", res.message ?? res.status);
    return grantsCache?.data ?? [];
  }
  const data = res.ok ? res.data?.results ?? [] : [];
  grantsCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}
class PermissionChecker {
  /** Trả về scope được cấp cho (roleName, permissionKey), hoặc null nếu không có quyền. */
  static async getScope(roleName, permissionKey) {
    const grants = await getAllGrants();
    const grant = grants.find((g) => g.roleName === roleName && g.permissionKey === permissionKey);
    return grant?.scope ?? null;
  }
  /**
   * Kiểm tra actor (theo roleName) có được phép thực hiện permissionKey trong context hiện tại.
   * - scope 'all'         → luôn cho phép.
   * - scope 'own_branch'  → yêu cầu context.branchId === context.targetBranchId.
   * - scope 'own_records' → yêu cầu context.actorUserId === context.targetUserId.
   */
  static async can(roleName, permissionKey, context = {}) {
    const scope = await this.getScope(roleName, permissionKey);
    if (!scope) return false;
    if (scope === "all") return true;
    if (scope === "own_branch") {
      if (!context.branchId || !context.targetBranchId) return false;
      return context.branchId === context.targetBranchId;
    }
    if (scope === "own_records") {
      if (!context.actorUserId || !context.targetUserId) return false;
      return context.actorUserId === context.targetUserId;
    }
    return false;
  }
  /** Giống can(), nhưng throw nếu không đủ quyền — tiện dùng ở đầu route/service. */
  static async assert(roleName, permissionKey, context) {
    const allowed = await this.can(roleName, permissionKey, context);
    if (!allowed) {
      throw new Error(
        `Permission denied: role "${roleName}" lacks "${permissionKey}" in given scope`
      );
    }
  }
}
const users = {
  document: {
    get: {
      success: { vi: "Lấy thông tin người dùng thành công", en: "User fetched successfully" },
      error: { vi: "Lấy thông tin người dùng thất bại", en: "Failed to fetch user" }
    },
    create: {
      success: { vi: "Tạo người dùng thành công", en: "User created successfully" },
      error: { vi: "Tạo người dùng thất bại", en: "Failed to create user" }
    },
    update: {
      success: { vi: "Cập nhật thông tin người dùng thành công", en: "User updated successfully" },
      error: { vi: "Cập nhật thông tin người dùng thất bại", en: "Failed to update user" }
    },
    delete: {
      success: { vi: "Xoá người dùng thành công", en: "User deleted successfully" },
      error: { vi: "Xoá người dùng thất bại", en: "Failed to delete user" }
    },
    touch: {
      success: {
        vi: "Cập nhật thời gian hết hạn tài khoản thành công",
        en: "User expiry updated successfully"
      },
      error: {
        vi: "Cập nhật thời gian hết hạn tài khoản thất bại",
        en: "Failed to update user expiry"
      }
    },
    query: {
      success: {
        vi: "Truy vấn dữ liệu người dùng thành công",
        en: "User query executed successfully"
      },
      error: { vi: "Truy vấn dữ liệu người dùng thất bại", en: "Failed to execute user query" }
    }
  },
  query: {
    collection: {
      create: {
        success: {
          vi: "Tạo bảng dữ liệu người dùng thành công",
          en: "User collection created successfully"
        },
        error: {
          vi: "Tạo bảng dữ liệu người dùng thất bại",
          en: "Failed to create user collection"
        }
      },
      drop: {
        success: {
          vi: "Xoá bảng dữ liệu người dùng thành công",
          en: "User collection dropped successfully"
        },
        error: { vi: "Xoá bảng dữ liệu người dùng thất bại", en: "Failed to drop user collection" }
      },
      list: {
        success: {
          vi: "Lấy danh sách bảng dữ liệu người dùng thành công",
          en: "User collections listed successfully"
        },
        error: {
          vi: "Lấy danh sách bảng dữ liệu người dùng thất bại",
          en: "Failed to list user collections"
        }
      }
    },
    document: {
      search: {
        success: { vi: "Tìm kiếm người dùng thành công", en: "Users searched successfully" },
        error: { vi: "Tìm kiếm người dùng thất bại", en: "Failed to search users" }
      }
    },
    search: {
      getCount: {
        success: {
          vi: "Lấy số lượng người dùng được index thành công",
          en: "User index count fetched successfully"
        },
        error: {
          vi: "Lấy số lượng người dùng được index thất bại",
          en: "Failed to fetch user index count"
        }
      },
      searchIndex: {
        success: {
          vi: "Tìm kiếm người dùng (full-text) thành công",
          en: "User full-text search completed successfully"
        },
        error: {
          vi: "Tìm kiếm người dùng (full-text) thất bại",
          en: "User full-text search failed"
        }
      }
    }
  }
};
const collectionName = "users";
const cbUsers = cbData(collectionName);
const cbUserStatus = cbData("user_status");
cbData("name_roles");
const contents = {
  get: {
    vi: "Thiếu trường dữ liệu cần tìm kiếm",
    en: "Field search is missing."
  },
  notInitialized: {
    vi: "Chưa khởi tạo thông tin user",
    en: "User data was not initialized"
  }
};
const authMessages = {
  invalidCredentials: {
    vi: "Tên đăng nhập hoặc mật khẩu không đúng",
    en: "Invalid username/email or password"
  },
  accountLocked: {
    vi: "Tài khoản đã bị khoá",
    en: "This account has been locked"
  },
  emailTaken: {
    vi: "Email đã được sử dụng",
    en: "Email is already in use"
  },
  usernameTaken: {
    vi: "Tên đăng nhập đã được sử dụng",
    en: "Username is already in use"
  },
  notFound: {
    vi: "Không tìm thấy người dùng",
    en: "User not found"
  }
};
const adminMessages = {
  ...authMessages,
  vaultUninitialized: {},
  permissionDenied: {},
  // MỚI — hoàn thiện nghiệp vụ xoá mềm / khôi phục
  userAlreadyDeleted: {},
  userNotDeleted: {}
};
class Users {
  constructor(metaUser, documentKey) {
    __publicField(this, "user");
    /** documentKey trong Couchbase — undefined nghĩa là user chưa từng được lưu */
    __publicField(this, "documentKey");
    this.user = metaUser;
    this.documentKey = documentKey;
  }
  getDocumentKey() {
    return this.documentKey;
  }
  static async getBy(input) {
    const { usernameBlindIndex, emailBlindIndex, phoneBlindIndex } = input;
    if (!usernameBlindIndex && !emailBlindIndex && !phoneBlindIndex) throw new TranslatableError(contents.get);
    const fieldName = usernameBlindIndex ? "usernameBlindIndex" : emailBlindIndex ? "emailBlindIndex" : "phoneBlindIndex";
    const keyword = usernameBlindIndex ?? emailBlindIndex ?? phoneBlindIndex;
    try {
      const response = await cbUsers.query.document.search({
        conditions: [{ fieldName, keyword }]
      });
      if (response.ok) return response.data;
      throw new Error(`Search failed with status ${response.status}`);
    } catch (e) {
      if (e instanceof TranslatableError) throw e;
      throw new Error(e instanceof Error ? e.message : String(e));
    }
  }
  static async getById(documentKey) {
    const response = await cbUsers.document.get({ documentKey });
    if (!response.ok || !response.data) return void 0;
    return new Users(response.data, documentKey);
  }
  /**
   * Tạo instance Users từ 1 document đã có sẵn trong DB (vd sau khi getBy tìm thấy),
   * để giữ lại documentKey cho các thao tác update/delete sau này.
   */
  static fromDocument(doc) {
    const { _id, ...user } = doc;
    return new Users(user, _id);
  }
  /**
   * SỬA: found từ Users.getBy() có thể chứa cả những document đã bị xoá mềm
   * (deletedAt khác null, do Users.delete()/UserAdminService.delete() không xoá vật lý
   * cũng không đổi blind index). Trước đây isEmailTaken/isUsernameTaken coi các bản ghi
   * đã xoá mềm này vẫn là "đã dùng", khiến 1 email/username KHÔNG BAO GIỜ dùng lại được
   * sau khi user tự xoá tài khoản. Nay chỉ tính các bản ghi còn active (deletedAt rỗng).
   */
  static onlyActive(docs) {
    return (docs ?? []).filter((d) => !d.deletedAt);
  }
  static async isEmailTaken(emailBlindIndex, excludeDocumentKey) {
    const found = Users.onlyActive(await Users.getBy({ emailBlindIndex }));
    if (found.length === 0) return false;
    if (excludeDocumentKey) return found.some((d) => d._id !== excludeDocumentKey);
    return true;
  }
  static async isUsernameTaken(usernameBlindIndex, excludeDocumentKey) {
    const found = Users.onlyActive(await Users.getBy({ usernameBlindIndex }));
    if (found.length === 0) return false;
    if (excludeDocumentKey) return found.some((d) => d._id !== excludeDocumentKey);
    return true;
  }
  static async isPhoneTaken(phoneBlindIndex, excludeDocumentKey) {
    const found = Users.onlyActive(await Users.getBy({ phoneBlindIndex }));
    if (found.length === 0) return false;
    if (excludeDocumentKey) return found.some((d) => d._id !== excludeDocumentKey);
    return true;
  }
  /** Đọc user_status.canLogin theo statusId — thay cho check isLocked cũ không còn khớp schema. */
  static async canLogin(statusId) {
    const status = await cbUserStatus.document.get({ documentKey: statusId });
    if (!status.ok || !status.data) return false;
    return Boolean(status.data.canLogin);
  }
  static async login(input, ipAddress) {
    const { password, ...lookup } = input;
    let found;
    try {
      found = await Users.getBy(lookup);
    } catch {
      return { success: false, messages: authMessages.invalidCredentials };
    }
    const doc = found?.find((d) => !d.deletedAt) ?? found?.[0];
    if (!doc || doc.deletedAt) {
      return { success: false, messages: authMessages.invalidCredentials };
    }
    const allowedToLogin = await Users.canLogin(doc.statusId);
    if (!allowedToLogin) {
      return { success: false, messages: authMessages.accountLocked };
    }
    try {
      await encryption.unlockVault(password, {
        dekIvB64: doc["vaultDekIvB64"],
        saltB64: doc["vaultSaltB64"],
        wrappedDekB64: doc["vaultWrappedDekB64"]
      });
      const instance = Users.fromDocument(doc);
      cbUsers.document.update({
        documentKey: instance.getDocumentKey(),
        content: {
          lastLoginAt: (/* @__PURE__ */ new Date()).toISOString(),
          lastLoginIp: ipAddress ?? null
        }
      }).catch((e) => console.error("[login] update lastLoginAt failed", e));
      return { success: true, user: instance };
    } catch {
      return { success: false, messages: authMessages.invalidCredentials };
    }
  }
  async verifyPassword(password) {
    try {
      const privateKey = await encryption.unlockVault(password, {
        dekIvB64: this.user.vaultDekIvB64,
        saltB64: this.user.vaultSaltB64,
        wrappedDekB64: this.user.vaultWrappedDekB64
      });
      return Boolean(privateKey);
    } catch {
      return false;
    }
  }
  /**
   * Task 1: Lưu hash của password-reset token lên user doc.
   * Token gốc chỉ tồn tại trong email link; DB chỉ lưu SHA-256 hash.
   */
  static async createPasswordResetToken(documentKey, passwordResetTokenHash, passwordResetTokenExpiresAt) {
    try {
      const res = await cbUsers.document.update({
        documentKey,
        content: { passwordResetTokenHash, passwordResetTokenExpiresAt }
      });
      return res.ok === true;
    } catch {
      return false;
    }
  }
  /**
   * Task 1: Self-service reset — token-gated variant của admin resetPassword,
   * KHÔNG cần ActorContext vì token chính là bằng chứng sở hữu.
   * setupVault(newPassword) sinh vault triple mới → swap 3 field + updatedAt + clear token.
   */
  static async resetPasswordWithToken(passwordResetTokenHash, newPassword) {
    let docs;
    try {
      const res = await cbUsers.query.document.search({
        conditions: [{ fieldName: "passwordResetTokenHash", keyword: passwordResetTokenHash }],
        limit: 1
      });
      if (!res.ok) return { ok: false, reason: "invalid" };
      docs = res.data;
    } catch {
      return { ok: false, reason: "invalid" };
    }
    const doc = docs?.[0];
    if (!doc || !doc._id || doc.deletedAt) return { ok: false, reason: "invalid" };
    const expiresAt = doc["passwordResetTokenExpiresAt"];
    if (!expiresAt || new Date(expiresAt).getTime() < Date.now()) {
      return { ok: false, reason: "expired" };
    }
    const vault = await encryption.setupVault(newPassword);
    const instance = Users.fromDocument(doc);
    try {
      const res = await cbUsers.document.update({
        documentKey: instance.getDocumentKey(),
        content: {
          vaultSaltB64: vault.storageRecord.saltB64,
          vaultDekIvB64: vault.storageRecord.dekIvB64,
          vaultWrappedDekB64: vault.storageRecord.wrappedDekB64,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          // One-time use: clear token ngay khi reset thành công
          passwordResetTokenHash: null,
          passwordResetTokenExpiresAt: null
        }
      });
      if (!res.ok) return { ok: false, reason: "invalid" };
      return { ok: true };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }
  /**
   * Task 2: Verify email bằng token — set emailVerifiedAt + statusId='status-active' + clear token.
   */
  static async verifyEmailWithToken(emailVerificationTokenHash) {
    let docs;
    try {
      const res = await cbUsers.query.document.search({
        conditions: [{ fieldName: "emailVerificationTokenHash", keyword: emailVerificationTokenHash }],
        limit: 1
      });
      if (!res.ok) return { ok: false, reason: "invalid" };
      docs = res.data;
    } catch {
      return { ok: false, reason: "invalid" };
    }
    const doc = docs?.[0];
    if (!doc || !doc._id || doc.deletedAt) return { ok: false, reason: "invalid" };
    try {
      const res = await cbUsers.document.update({
        documentKey: doc._id,
        content: {
          statusId: "status-active",
          emailVerifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
          emailVerificationTokenHash: null,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      if (!res.ok) return { ok: false, reason: "invalid" };
      return { ok: true };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }
  async delete() {
    if (!this.user) throw new TranslatableError(contents.notInitialized);
    if (!this.documentKey) {
      return { success: false, messages: users.document.get.error };
    }
    try {
      const res = await cbUsers.document.update({
        documentKey: this.documentKey,
        content: {
          deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
          statusId: "status-suspended"
        }
      });
      if (!res.ok) return { success: false, messages: users.document.delete.error };
      return { success: true, messages: users.document.delete.success };
    } catch {
      return { success: false, messages: users.document.delete.error };
    }
  }
  async changePassword(oldPassword, newPassword) {
    if (!this.documentKey) return { success: false, messages: contents.notInitialized };
    try {
      const newStorageRecord = await encryption.changePassword(oldPassword, newPassword, {
        saltB64: this.user.vaultSaltB64,
        dekIvB64: this.user.vaultDekIvB64,
        wrappedDekB64: this.user.vaultWrappedDekB64
      });
      this.user.vaultSaltB64 = newStorageRecord.saltB64;
      this.user.vaultDekIvB64 = newStorageRecord.dekIvB64;
      this.user.vaultWrappedDekB64 = newStorageRecord.wrappedDekB64;
      const res = await this.save();
      if (!res.success) return { success: false, messages: users.document.update.error };
      return { success: true, messages: users.document.update.success };
    } catch {
      return { success: false, messages: authMessages.invalidCredentials };
    }
  }
  async save() {
    if (!this.user) throw new TranslatableError(contents.notInitialized);
    if (!this.documentKey) {
      const [emailTaken, usernameTaken] = await Promise.all([
        Users.isEmailTaken(this.user.emailBlindIndex),
        Users.isUsernameTaken(this.user.usernameBlindIndex)
      ]);
      if (emailTaken) return { success: false, messages: authMessages.emailTaken };
      if (usernameTaken) return { success: false, messages: authMessages.usernameTaken };
    }
    if (this.documentKey) {
      const documentKey = this.documentKey;
      try {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        this.user.updatedAt = now;
        const res = await cbUsers.document.update({
          documentKey,
          content: { ...this.user, updatedAt: now }
        });
        if (!res.ok) return { success: false, messages: users.document.update.error };
        return { success: true, messages: users.document.update.success };
      } catch {
        return { success: false, messages: users.document.update.error };
      }
    }
    try {
      const newKey = `${collectionName}::${crypto.randomUUID()}`;
      const res = await cbUsers.document.create({
        documentKey: newKey,
        content: { ...this.user, createdAt: (/* @__PURE__ */ new Date()).toISOString() }
      });
      if (!res.ok) return { success: false, messages: users.document.create.error };
      this.documentKey = newKey;
      return { success: true, messages: users.document.create.success };
    } catch {
      return { success: false, messages: users.document.create.error };
    }
  }
}
export {
  PermissionChecker as P,
  Users as U,
  adminMessages as a,
  authMessages as b
};
