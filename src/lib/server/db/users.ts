//$lib/server/db/users.ts

import type { TranslateContent } from '$interfaces/basic';
import { TranslatableError } from '$lib/errors/translatable-error';
import { cb_bucketName, cb_scopeName } from '$env/static/private';

import { cbData } from '$modules/couchbase/clients';
import { encryption } from '$modules/encryption';
import type { User } from '$modules/schema';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { users } from '../messages/db';

const collectionName = 'users';
const cbUsers = cbData(collectionName);
const cbUserStatus = cbData('user_status');
const cbRoles = cbData('name_roles');

// SỬA: dùng để build keyspace đầy đủ `bucket`.`scope`.`collection` cho các câu N1QL
// viết tay trong UserAdminService.list() — trước đó chỉ dùng bare `users`,
// sẽ lỗi trên Couchbase Server thật vì thiếu định danh bucket/scope.
const usersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`${collectionName}\``;

const contents: Record<'get' | 'save' | 'notInitialized', TranslateContent> = {
	get: {
		vi: 'Thiếu trường dữ liệu cần tìm kiếm',
		en: 'Field search is missing.'
	},
	save: {
		vi: 'Chưa khởi tạo thông tin user',
		en: 'User data was not initial'
	},
	notInitialized: {
		vi: 'Chưa khởi tạo thông tin user',
		en: 'User data was not initialized'
	}
};

// Message riêng cho các nghiệp vụ đặc thù, không nằm trong CRUD chung (không tự sinh từ cbData)
const authMessages = {
	invalidCredentials: {
		vi: 'Tên đăng nhập hoặc mật khẩu không đúng',
		en: 'Invalid username/email or password'
	} as TranslateContent,
	accountLocked: {
		vi: 'Tài khoản đã bị khoá',
		en: 'This account has been locked'
	} as TranslateContent,
	emailTaken: {
		vi: 'Email đã được sử dụng',
		en: 'Email is already in use'
	} as TranslateContent,
	usernameTaken: {
		vi: 'Tên đăng nhập đã được sử dụng',
		en: 'Username is already in use'
	} as TranslateContent,
	notFound: {
		vi: 'Không tìm thấy người dùng',
		en: 'User not found'
	} as TranslateContent
};

const adminMessages = {
	...authMessages,
	statusUpdated: {
		vi: 'Cập nhật trạng thái tài khoản thành công',
		en: 'Account status updated successfully'
	} as TranslateContent,
	statusNotFound: {
		vi: 'Trạng thái không tồn tại trong hệ thống',
		en: 'Status does not exist'
	} as TranslateContent,
	roleUpdated: {
		vi: 'Cập nhật vai trò thành công',
		en: 'Role updated successfully'
	} as TranslateContent,
	roleNotFound: {
		vi: 'Vai trò không tồn tại trong hệ thống',
		en: 'Role does not exist'
	} as TranslateContent,
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	} as TranslateContent,
	userDeleted: {
		vi: 'Xoá người dùng thành công',
		en: 'User deleted successfully'
	} as TranslateContent,
	deleteFailed: {
		vi: 'Xoá người dùng thất bại',
		en: 'Failed to delete user'
	} as TranslateContent,
	updateFailed: {
		vi: 'Cập nhật người dùng thất bại',
		en: 'Failed to update user'
	} as TranslateContent,
	queryFailed: {
		vi: 'Lấy danh sách người dùng thất bại',
		en: 'Failed to fetch user list'
	} as TranslateContent
};

type UserDocument = User & { _id: string };

/**
 * Users — entity đại diện cho 1 user + các thao tác TỰ THÂN
 * (tìm kiếm, đăng nhập, đổi/kiểm tra mật khẩu, lưu/xoá CHÍNH MÌNH).
 *
 * Không chứa logic quản trị người khác (khoá tài khoản, đổi role, xoá user khác, list toàn bộ)
 * — những thao tác đó thuộc về UserAdminService, vì chúng cần kiểm tra quyền của actor
 * trước khi chạy, khác bản chất với việc user tự thao tác trên chính mình.
 */
export class Users {
	user: User;
	/** documentKey trong Couchbase — undefined nghĩa là user chưa từng được lưu */
	private documentKey?: string;

	constructor(metaUser: User, documentKey?: string) {
		this.user = metaUser;
		this.documentKey = documentKey;
	}

	getDocumentKey(): string | undefined {
		return this.documentKey;
	}

	static async getBy(input: Partial<Pick<User, 'emailBlindIndex' | 'usernameBlindIndex'>>) {
		const { usernameBlindIndex, emailBlindIndex } = input;
		if (!usernameBlindIndex && !emailBlindIndex) throw new TranslatableError(contents.get);

		const fieldName = usernameBlindIndex ? 'usernameBlindIndex' : 'emailBlindIndex';
		const keyword = (usernameBlindIndex ?? emailBlindIndex) as string;

		try {
			const response = await cbUsers.query.document.search({
				conditions: [{ fieldName, keyword }]
			});
			if (response.ok) return response.data as UserDocument[] | undefined;
			throw new Error(`Search failed with status ${response.status}`);
		} catch (e) {
			if (e instanceof TranslatableError) throw e;
			throw new Error(e instanceof Error ? e.message : String(e));
		}
	}

	static async getById(documentKey: string): Promise<Users | undefined> {
		const response = await cbUsers.document.get({ documentKey });
		if (!response.ok || !response.data) return undefined;
		return new Users(response.data as User, documentKey);
	}

	/**
	 * Tạo instance Users từ 1 document đã có sẵn trong DB (vd sau khi getBy tìm thấy),
	 * để giữ lại documentKey cho các thao tác update/delete sau này.
	 */
	static fromDocument(doc: UserDocument): Users {
		const { _id, ...user } = doc;
		return new Users(user as User, _id);
	}
	/**
	 * SỬA: found từ Users.getBy() có thể chứa cả những document đã bị xoá mềm
	 * (deletedAt khác null, do Users.delete()/UserAdminService.delete() không xoá vật lý
	 * cũng không đổi blind index). Trước đây isEmailTaken/isUsernameTaken coi các bản ghi
	 * đã xoá mềm này vẫn là "đã dùng", khiến 1 email/username KHÔNG BAO GIỜ dùng lại được
	 * sau khi user tự xoá tài khoản. Nay chỉ tính các bản ghi còn active (deletedAt rỗng).
	 */
	private static onlyActive(docs?: UserDocument[]): UserDocument[] {
		return (docs ?? []).filter((d) => !d.deletedAt);
	}

	static async isEmailTaken(
		emailBlindIndex: string,
		excludeDocumentKey?: string
	): Promise<boolean> {
		const found = Users.onlyActive(await Users.getBy({ emailBlindIndex }));
		if (found.length === 0) return false;
		if (excludeDocumentKey) return found.some((d) => d._id !== excludeDocumentKey);
		return true;
	}
	static async isUsernameTaken(
		usernameBlindIndex: string,
		excludeDocumentKey?: string
	): Promise<boolean> {
		const found = Users.onlyActive(await Users.getBy({ usernameBlindIndex }));
		if (found.length === 0) return false;
		if (excludeDocumentKey) return found.some((d) => d._id !== excludeDocumentKey);
		return true;
	}

	/** Đọc user_status.canLogin theo statusId — thay cho check isLocked cũ không còn khớp schema. */
	private static async canLogin(statusId: string): Promise<boolean> {
		const status = await cbUserStatus.document.get({ documentKey: statusId });
		if (!status.ok || !status.data) return false;
		return Boolean((status.data as { canLogin?: boolean }).canLogin);
	}

	static async login(
		input: Partial<Pick<User, 'emailBlindIndex' | 'usernameBlindIndex'>> & { password: string },
		ipAddress?: string
	): Promise<{ success: true; user: Users } | { success: false; messages: TranslateContent }> {
		const { password, ...lookup } = input;
		let found: Awaited<ReturnType<typeof Users.getBy>>;
		try {
			found = await Users.getBy(lookup);
		} catch {
			return { success: false, messages: authMessages.invalidCredentials };
		}
		// SỬA: nếu tồn tại nhiều document trùng blind index (vd 1 bản active + 1 bản đã xoá
		// mềm sau khi cho phép đăng ký lại email/username cũ — xem Users.onlyActive), ưu tiên
		// lấy bản ghi ACTIVE thay vì luôn lấy found[0] (có thể vô tình là bản đã xoá).
		const doc = found?.find((d) => !d.deletedAt) ?? found?.[0];

		if (!doc) {
			return { success: false, messages: authMessages.invalidCredentials };
		}

		const allowedToLogin = await Users.canLogin(doc.statusId);
		if (!allowedToLogin) {
			return { success: false, messages: authMessages.accountLocked };
		}

		try {
			// unlockVault không bao giờ resolve giá trị falsy — nó luôn trả về CryptoKey
			// hoặc throw khi sai mật khẩu. Bắt lỗi bằng try/catch là đủ, không cần check `if (!privateKey)`.
			await encryption.unlockVault(password, {
				dekIvB64: doc['vaultDekIvB64'],
				saltB64: doc['vaultSaltB64'],
				wrappedDekB64: doc['vaultWrappedDekB64']
			});
			const instance = Users.fromDocument(doc);
			// cập nhật lastLoginAt/lastLoginIp — không await để không làm chậm phản hồi login,
			// nhưng vẫn log lỗi nếu update thất bại
			cbUsers.document
				.update({
					documentKey: instance.getDocumentKey()!,
					content: {
						lastLoginAt: new Date().toISOString(),
						lastLoginIp: ipAddress ?? null
					} as Partial<User> as User
				})
				.catch((e) => console.error('[login] update lastLoginAt failed', e));
			return { success: true, user: instance };
		} catch {
			return { success: false, messages: authMessages.invalidCredentials };
		}
	}

	async verifyPassword(password: string): Promise<boolean> {
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

	async delete(): Promise<{ success: boolean; messages?: TranslateContent }> {
		if (!this.user) throw new TranslatableError(contents.notInitialized);
		if (!this.documentKey) {
			return { success: false, messages: users.document.get.error };
		}

		try {
			// SỬA: phải kiểm tra `res.ok` — couchbase.ts không throw khi HTTP trả lỗi
			// (404/409/500...), chỉ throw khi lỗi mạng. Không check .ok trước đây khiến
			// 1 lần xoá thất bại vẫn bị báo success: true.
			const res = await cbUsers.document.update({
				documentKey: this.documentKey,
				content: {
					deletedAt: new Date().toISOString(),
					statusId: 'status-suspended'
				} as Partial<User> as User
			});
			if (!res.ok) return { success: false, messages: users.document.delete.error };
			return { success: true, messages: users.document.delete.success };
		} catch {
			return { success: false, messages: users.document.delete.error };
		}
	}
	async changePassword(
		oldPassword: string,
		newPassword: string
	): Promise<{ success: boolean; messages: TranslateContent }> {
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
			// sai oldPassword -> unlockVault bên trong changePassword throw
			return { success: false, messages: authMessages.invalidCredentials };
		}
	}

	async save(): Promise<{ success: boolean; messages?: TranslateContent; data?: unknown }> {
		if (!this.user) throw new TranslatableError(contents.notInitialized);
		if (!this.documentKey) {
			const [emailTaken, usernameTaken] = await Promise.all([
				Users.isEmailTaken(this.user.emailBlindIndex),
				Users.isUsernameTaken(this.user.usernameBlindIndex)
			]);
			if (emailTaken) return { success: false, messages: authMessages.emailTaken };
			if (usernameTaken) return { success: false, messages: authMessages.usernameTaken };
			// LƯU Ý (chưa sửa ở đây): giữa 2 lần check trên và create() bên dưới vẫn tồn tại
			// race condition (check-then-act) — 2 request đăng ký cùng lúc cùng email/username
			// vẫn có thể lọt qua cả hai. Cách khắc phục triệt để là dùng documentKey xác định
			// (vd theo usernameBlindIndex) để tận dụng tính atomic của document.create(), giống
			// cách seed-data.ts đang tạo tài khoản admin với key `${collectionName}-${username}`.
			// Việc này cần sửa thêm ở dataApi (encodeURIComponent documentKey khi build URL,
			// vì blind index base64 có thể chứa '/', '+', '=' làm hỏng URL path) nên không đổi
			// trong phạm vi file này.
		}
		if (this.documentKey) {
			const documentKey = this.documentKey;
			try {
				const res = await cbUsers.document.update({
					documentKey,
					content: { ...this.user, updatedAt: new Date().toISOString() }
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
				content: { ...this.user, createdAt: new Date().toISOString() }
			});
			if (!res.ok) return { success: false, messages: users.document.create.error };
			this.documentKey = newKey;
			return { success: true, messages: users.document.create.success };
		} catch {
			return { success: false, messages: users.document.create.error };
		}
	}
}

interface AdminListResult {
	items: UserDocument[];
	total: number;
	page: number;
	pageSize: number;
}

/** Danh tính của người đang thực hiện thao tác quản trị — lấy từ session đã xác thực. */
export interface ActorContext {
	/** roleName (vd 'owner' | 'manager'), KHÔNG phải roleId — dùng để tra detail_roles. */
	roleName: string;
	userId: string;
	branchId?: string;
}

/**
 * UserAdminService — các thao tác QUẢN TRỊ trên user KHÁC actor.
 * Đây không phải "class cho user có role admin" — role là dữ liệu động (name_roles/detail_roles),
 * nên quyền được kiểm tra tại runtime qua PermissionChecker thay vì hard-code theo role.
 * Thêm role mới hoặc đổi phạm vi quyền qua UI sẽ tự động áp dụng, không cần sửa service này.
 */
export class UserAdminService {
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string,
		targetBranchId?: string | null,
		targetUserId?: string
	): Promise<{ success: false; messages: TranslateContent } | null> {
		const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			targetBranchId,
			actorUserId: actor.userId,
			targetUserId
		});
		if (!allowed) return { success: false, messages: adminMessages.permissionDenied };
		return null;
	}

	/** Tra `level` của 1 role theo TÊN role (vd 'manager') — dùng cho actor.roleName. */
	private static async getRoleLevelByName(roleName: string): Promise<number | null> {
		const res = await cbRoles.query.document.search({
			conditions: [{ fieldName: 'name', keyword: roleName }],
			limit: 1
		});
		if (!res.ok || !res.data || res.data.length === 0) return null;
		const level = (res.data[0] as { level?: number }).level;
		return typeof level === 'number' ? level : null;
	}

	/** Tra `level` của 1 role theo documentKey (vd 'role-owner') — dùng cho user.roleId. */
	private static async getRoleLevelById(roleId: string): Promise<number | null> {
		const res = await cbRoles.document.get({ documentKey: roleId });
		if (!res.ok || !res.data) return null;
		const level = (res.data as { level?: number }).level;
		return typeof level === 'number' ? level : null;
	}
	/**
	 * SỬA (lỗ hổng leo thang quyền): trước đây setStatus/setRole/delete chỉ kiểm tra
	 * PermissionChecker theo scope (all/own_branch/own_records) mà KHÔNG kiểm tra cấp bậc
	 * role (`level` trong name_roles — field này đã tồn tại sẵn cho đúng mục đích này nhưng
	 * chưa từng được dùng). Hệ quả: 1 'manager' có thể setRole('role-owner') CHO CHÍNH MÌNH
	 * hoặc đổi role/khoá 1 'manager' khác cùng chi nhánh, miễn scope 'own_branch' khớp branchId.
	 *
	 * Hàm này chặn 2 việc:
	 *  1) Actor không được thao tác quản trị lên CHÍNH MÌNH qua kênh admin — muốn tự đổi mật khẩu/
	 *     tự xoá tài khoản thì dùng Users.changePassword()/Users.delete() (self-service).
	 *  2) Actor chỉ được thao tác lên user có `level` THẤP HƠN level của actor.
	 */
	private static async assertCanManageTarget(
		actor: ActorContext,
		target: Users
	): Promise<{ success: false; messages: TranslateContent } | null> {
		if (target.getDocumentKey() === actor.userId) {
			return { success: false, messages: adminMessages.permissionDenied };
		}

		const [actorLevel, targetLevel] = await Promise.all([
			this.getRoleLevelByName(actor.roleName),
			this.getRoleLevelById(target.user.roleId)
		]);

		if (actorLevel === null || targetLevel === null || actorLevel <= targetLevel) {
			return { success: false, messages: adminMessages.permissionDenied };
		}
		return null;
	}

	/**
	 * Đổi statusId của user (thay cho isLocked boolean cũ) — tận dụng catalog user_status
	 * để thêm status mới qua UI mà không cần sửa code.
	 */
	static async setStatus(
		actor: ActorContext,
		documentKey: string,
		statusId: string
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await Users.getById(documentKey);
		if (!target) return { success: false, messages: adminMessages.notFound };

		const denied = await this.requirePermission(
			actor,
			'users:manage',
			target.user.branchId,
			documentKey
		);
		if (denied) return denied;

		const hierarchyDenied = await this.assertCanManageTarget(actor, target);
		if (hierarchyDenied) return hierarchyDenied;

		const status = await cbUserStatus.document.get({ documentKey: statusId });
		if (!status.ok || !status.data)
			return { success: false, messages: adminMessages.statusNotFound };

		try {
			const res = await cbUsers.document.update({
				documentKey,
				content: { statusId, updatedAt: new Date().toISOString() } as Partial<User> as User
			});
			// SỬA: trước đây trả nhầm `users.document.create.error` khi UPDATE thất bại.
			if (!res.ok) return { success: false, messages: adminMessages.updateFailed };
			return { success: true, messages: adminMessages.statusUpdated };
		} catch {
			return { success: false, messages: adminMessages.updateFailed };
		}
	}

	/** Đổi roleId của user — validate roleId tồn tại trong name_roles trước khi ghi. */
	static async setRole(
		actor: ActorContext,
		documentKey: string,
		roleId: string
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await Users.getById(documentKey);
		if (!target) return { success: false, messages: adminMessages.notFound };

		const denied = await this.requirePermission(
			actor,
			'users:manage',
			target.user.branchId,
			documentKey
		);
		if (denied) return denied;

		const hierarchyDenied = await this.assertCanManageTarget(actor, target);
		if (hierarchyDenied) return hierarchyDenied;

		const role = await cbRoles.document.get({ documentKey: roleId });
		if (!role.ok || !role.data) return { success: false, messages: adminMessages.roleNotFound };

		// SỬA: chặn actor gán 1 role có level >= level của chính actor
		// (vd manager không được tự/hoặc gán cho người khác role 'owner').
		const newRoleLevel = (role.data as { level?: number }).level;
		const actorLevel = await this.getRoleLevelByName(actor.roleName);
		if (actorLevel === null || typeof newRoleLevel !== 'number' || newRoleLevel >= actorLevel) {
			return { success: false, messages: adminMessages.permissionDenied };
		}

		try {
			const res = await cbUsers.document.update({
				documentKey,
				content: { roleId, updatedAt: new Date().toISOString() } as Partial<User> as User
			});
			// SỬA: trước đây trả nhầm `users.document.create.error` khi UPDATE thất bại.
			if (!res.ok) return { success: false, messages: adminMessages.updateFailed };
			return { success: true, messages: adminMessages.roleUpdated };
		} catch {
			return { success: false, messages: adminMessages.updateFailed };
		}
	}

	/** Xoá 1 user bất kỳ (khác với Users.delete() vốn chỉ tự xoá chính mình). */
	static async delete(
		actor: ActorContext,
		documentKey: string
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await Users.getById(documentKey);
		if (!target) return { success: false, messages: adminMessages.notFound };

		const denied = await this.requirePermission(actor, 'users:manage', target.user.branchId);
		if (denied) return denied;

		try {
			const res = await cbUsers.document.update({
				documentKey: documentKey,
				content: {
					deletedAt: new Date().toISOString(),
					statusId: 'status-suspended'
				} as Partial<User> as User
			});
			if (!res.ok) return { success: false, messages: adminMessages.deleteFailed };
			return { success: true, messages: adminMessages.userDeleted };
		} catch {
			return { success: false, messages: adminMessages.deleteFailed };
		}
	}
	/**
	 * SỬA: câu N1QL trước đây dùng `FROM \`users\`` (bare keyspace) — thiếu định danh
	 * bucket/scope nên sẽ lỗi trên Couchbase Server thật (không giống `search()` trong
	 * couchbase.ts vốn luôn build fully-qualified `bucket.scope.collection`).
	 * Nay dùng `usersKeyspace` đã build sẵn ở đầu file.
	 */
	static async list(
		actor: ActorContext,
		options: { page?: number; pageSize?: number } = {}
	): Promise<
		{ success: false; messages: TranslateContent } | ({ success: true } & AdminListResult)
	> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'users:manage');
		if (!scope) return { success: false, messages: adminMessages.permissionDenied };

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		let whereClause = '';
		let args: string[] = [];

		if (scope === 'all') {
			whereClause = '';
		} else if (scope === 'own_branch') {
			if (!actor.branchId) {
				return { success: false, messages: adminMessages.permissionDenied };
			}
			whereClause = 'WHERE branchId = $1';
			args = [actor.branchId];
		} else if (scope === 'own_records') {
			whereClause = 'WHERE META().id = $1';
			args = [actor.userId];
		} else {
			// Scope không xác định — từ chối an toàn thay vì để lọt xuống "không lọc gì cả"
			return { success: false, messages: adminMessages.permissionDenied };
		}

		const [countRes, dataRes] = await Promise.all([
			cbUsers.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${usersKeyspace} ${whereClause}`,
				args,
				readonly: true
			}),
			cbUsers.document.query({
				statement: `SELECT META().id AS _id, * FROM ${usersKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
				args,
				readonly: true
			})
		]);

		if (!countRes.ok || !dataRes.ok) {
			return { success: false, messages: adminMessages.queryFailed };
		}

		const total = Number(countRes.data?.results?.[0] ?? 0);
		const items = (dataRes.data?.results ?? []) as UserDocument[];

		return { success: true, items, total, page, pageSize };
	}
}
