// $lib/server/db/posts.ts
// PostService + PostCategoryService — quản trị blog/tin tức (Phase 6).
// Pattern theo PaymentService (payments.ts): messages từ messages/db,
// N1QL qua cbData('posts').document.query, permission blog:read/blog:manage.

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { ActorContext } from '$lib/server/db/products';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { posts as postMessages, post_categories as categoryMessages } from '../messages/db';

const cbPosts = cbData('posts');
const cbPostCategories = cbData('post_categories');
const postsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`posts\``;
const postCategoriesKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`post_categories\``;

const postAdminMessages = {
	notFound: postMessages.notFound,
	queryFailed: postMessages.queryFailed,
	permissionDenied: postMessages.permissionDenied,
	createFailed: postMessages.createFailed,
	updateFailed: postMessages.updateFailed,
	deleteFailed: postMessages.deleteFailed,
	publishFailed: postMessages.publishFailed,
	archiveFailed: postMessages.archiveFailed,
	slugTaken: postMessages.slugTaken,
	invalidStatus: postMessages.invalidStatus,
	languageInvalid: postMessages.languageInvalid,
	titleRequired: postMessages.titleRequired
} as const;

const categoryAdminMessages = {
	notFound: categoryMessages.notFound,
	queryFailed: categoryMessages.queryFailed,
	permissionDenied: categoryMessages.permissionDenied,
	createFailed: categoryMessages.createFailed,
	updateFailed: categoryMessages.updateFailed,
	deleteFailed: categoryMessages.deleteFailed,
	inUse: categoryMessages.inUse,
	slugTaken: categoryMessages.slugTaken,
	nameRequired: categoryMessages.nameRequired
} as const;

const POST_ADMIN_SAFE_FIELDS = [
	'postId',
	'slug',
	'title',
	'excerpt',
	'coverImageUrl',
	'authorId',
	'authorName',
	'categoryId',
	'tags',
	'status',
	'publishedAt',
	'viewCount',
	'seoTitle',
	'seoDescription',
	'language',
	'createdAt',
	'updatedAt'
] as const;

// list KHÔNG trả content (rich text có thể rất lớn) — chỉ khi get/getBySlug.
const POST_LIST_FIELDS = [
	'postId',
	'slug',
	'title',
	'excerpt',
	'coverImageUrl',
	'authorId',
	'authorName',
	'categoryId',
	'tags',
	'status',
	'publishedAt',
	'viewCount',
	'language',
	'createdAt',
	'updatedAt'
] as const;

const CATEGORY_SAFE_FIELDS = [
	'categoryId',
	'name',
	'slug',
	'description',
	'sortOrder',
	'status',
	'createdAt',
	'updatedAt'
] as const;

export const VALID_POST_STATUSES = ['draft', 'published', 'archived'] as const;
export const VALID_POST_LANGUAGES = ['vi', 'en'] as const;
export type PostStatus = typeof VALID_POST_STATUSES[number];
export type PostLanguage = typeof VALID_POST_LANGUAGES[number];

interface PostDocument {
	_id?: string;
	postId: string;
	slug: string;
	title: string;
	excerpt?: string;
	content?: string;
	coverImageUrl?: string;
	authorId: string;
	authorName?: string;
	categoryId?: string;
	tags?: string[];
	status: string;
	publishedAt?: string | null;
	viewCount: number;
	seoTitle?: string;
	seoDescription?: string;
	language: string;
	createdAt: string;
	updatedAt: string;
}

interface PostCategoryDocument {
	_id?: string;
	categoryId: string;
	name: string;
	slug: string;
	description?: string;
	sortOrder: number;
	status: string;
	createdAt: string;
	updatedAt: string;
}

function sanitizePostForAdmin(doc: PostDocument): Record<string, unknown> {
	const safe = { _id: doc._id, content: doc.content } as Record<string, unknown>;
	for (const field of POST_ADMIN_SAFE_FIELDS) {
		if (doc[field] !== undefined) safe[field] = (doc as unknown as Record<string, unknown>)[field];
	}
	return safe;
}

function sanitizeCategoryForAdmin(doc: PostCategoryDocument): Record<string, unknown> {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of CATEGORY_SAFE_FIELDS) {
		if (doc[field] !== undefined) safe[field] = (doc as unknown as Record<string, unknown>)[field];
	}
	return safe;
}

/**
 * Sinh slug từ title — strip diacritics tiếng Việt (NFD + bỏ combining marks),
 * ký tự không phải chữ/số → '-', gộp nhiều '-' liền, trim '-' hai đầu, lowercase.
 */
export function slugify(input: string): string {
	return input
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '') // bỏ dấu tiếng Việt (à á ạ ả ã → a)
		.replace(/đ/gi, 'd')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

interface ListResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

export class PostService {
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string
	): Promise<{ success: false; messages: TranslateContent } | null> {
		const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			actorUserId: actor.userId
		});
		if (!allowed) return { success: false, messages: postAdminMessages.permissionDenied };
		return null;
	}

	/** Slug trùng trong CÙNG language → append -2, -3… */
	private static async resolveUniqueSlug(
		slug: string,
		language: string,
		excludePostId?: string
	): Promise<string> {
		let candidate = slug || 'post';
		let suffix = 1;
		// Vòng lặp có hạn — tối đa 50 lần thử để tránh query vô hạn khi DB lỗi.
		while (suffix < 50) {
			const checkRes = await cbPosts.document.query({
				statement: `SELECT META().id AS _id FROM ${postsKeyspace} WHERE slug = $1 AND language = $2 AND META().id != $3 LIMIT 1`,
				args: [candidate, language, excludePostId ?? ''],
				readonly: true
			});
			const taken = checkRes.ok && (checkRes.data?.results?.length ?? 0) > 0;
			if (!taken) return candidate;
			suffix += 1;
			candidate = `${slug}-${suffix}`;
		}
		return `${slug}-${Date.now()}`;
	}

	/** Danh sách bài viết — filter status/categoryId/authorId/tag/search title, phân trang. */
	static async list(
		actor: ActorContext,
		options: {
			status?: string;
			categoryId?: string;
			authorId?: string;
			tag?: string;
			search?: string;
			language?: string;
			page?: number;
			pageSize?: number;
		} = {}
	): Promise<{ success: true; data: ListResult } | { success: false; messages: TranslateContent }> {
		const denied = await this.requirePermission(actor, 'blog:read');
		if (denied) return denied;

		try {
			const page = Math.max(1, options.page ?? 1);
			const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
			const offset = (page - 1) * pageSize;

			const conditions: string[] = [];
			const args: (string | number)[] = [];
			if (options.status) {
				conditions.push(`p.status = $${args.length + 1}`);
				args.push(options.status);
			}
			if (options.categoryId) {
				conditions.push(`p.categoryId = $${args.length + 1}`);
				args.push(options.categoryId);
			}
			if (options.authorId) {
				conditions.push(`p.authorId = $${args.length + 1}`);
				args.push(options.authorId);
			}
			if (options.language) {
				conditions.push(`p.language = $${args.length + 1}`);
				args.push(options.language);
			}
			if (options.tag) {
				// tags là array string — ANY để khớp 1 phần tử
				conditions.push(`ANY t IN p.tags SATISFIES t = $${args.length + 1} END`);
				args.push(options.tag);
			}
			if (options.search?.trim()) {
				conditions.push(`LOWER(p.title) LIKE $${args.length + 1}`);
				args.push(`%${options.search.trim().toLowerCase()}%`);
			}
			const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

			const selectClause = POST_LIST_FIELDS.map((f) => `p.\`${f}\``).join(', ');
			const dataStatement = `
				SELECT ${selectClause}, META().id AS _id
				FROM ${postsKeyspace} p
				${whereClause}
				ORDER BY p.createdAt DESC
				LIMIT $${args.length + 1} OFFSET $${args.length + 2}
			`.trim();
			const dataArgs = [...args, pageSize, offset];

			const countStatement = `
				SELECT RAW COUNT(*) AS total
				FROM ${postsKeyspace} p
				${whereClause}
			`.trim();

			const [dataRes, countRes] = await Promise.all([
				cbPosts.document.query({ statement: dataStatement, args: dataArgs, readonly: true }),
				cbPosts.document.query({ statement: countStatement, args, readonly: true })
			]);

			if (!dataRes.ok || !countRes.ok) {
				return { success: false, messages: postAdminMessages.queryFailed };
			}
			const rows = (dataRes.data?.results ?? []) as unknown as PostDocument[];
			const total = Number(countRes.data?.results?.[0] ?? 0);

			return {
				success: true,
				data: {
					items: rows.map(sanitizePostForAdmin),
					total,
					page,
					pageSize
				}
			};
		} catch {
			return { success: false, messages: postAdminMessages.queryFailed };
		}
	}

	/** Chi tiết 1 bài viết theo META().id (kèm content rich text). */
	static async get(
		actor: ActorContext,
		postId: string
	): Promise<{ success: true; data: Record<string, unknown> } | { success: false; messages: TranslateContent }> {
		const denied = await this.requirePermission(actor, 'blog:read');
		if (denied) return denied;

		try {
			const statement = `SELECT p.*, META().id AS _id FROM ${postsKeyspace} p WHERE META().id = $1 LIMIT 1`;
			const res = await cbPosts.document.query({ statement, args: [postId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as PostDocument | null;
			if (!doc) return { success: false, messages: postAdminMessages.notFound };
			return { success: true, data: sanitizePostForAdmin(doc) };
		} catch {
			return { success: false, messages: postAdminMessages.queryFailed };
		}
	}

	/**
	 * Public — lấy bài published theo slug (+ language, default vi).
	 * KHÔNG kiểm tra permission (route storefront công khai), chỉ trả post published.
	 */
	static async getBySlug(
		slug: string,
		language = 'vi'
	): Promise<{ success: true; data: Record<string, unknown> } | { success: false; messages: TranslateContent }> {
		try {
			const statement = `SELECT p.*, META().id AS _id FROM ${postsKeyspace} p WHERE p.slug = $1 AND p.language = $2 AND p.status = 'published' LIMIT 1`;
			const res = await cbPosts.document.query({ statement, args: [slug, language], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as PostDocument | null;
			if (!doc) return { success: false, messages: postMessages.notFound };
			return { success: true, data: sanitizePostForAdmin(doc) };
		} catch {
			return { success: false, messages: postMessages.queryFailed };
		}
	}

	/**
	 * Tạo bài viết. Slug không truyền → tự sinh từ title (strip diacritics),
	 * trùng trong cùng language → append -2, -3…
	 */
	static async create(
		actor: ActorContext,
		data: {
			title: string;
			slug?: string;
			excerpt?: string;
			content?: string;
			coverImageUrl?: string;
			authorName?: string;
			categoryId?: string;
			tags?: string[];
			status?: string;
			seoTitle?: string;
			seoDescription?: string;
			language?: string;
		}
	): Promise<{ success: true; data: Record<string, unknown> } | { success: false; messages: TranslateContent }> {
		const denied = await this.requirePermission(actor, 'blog:manage');
		if (denied) return denied;

		if (!data.title?.trim()) return { success: false, messages: postAdminMessages.titleRequired };
		const language = data.language ?? 'vi';
		if (!VALID_POST_LANGUAGES.includes(language as PostLanguage)) {
			return { success: false, messages: postAdminMessages.languageInvalid };
		}

		try {
			const now = new Date().toISOString();
			const baseSlug = data.slug?.trim() ? slugify(data.slug.trim()) : slugify(data.title.trim());
			const slug = await this.resolveUniqueSlug(baseSlug, language);

			const status =
				data.status && VALID_POST_STATUSES.includes(data.status as PostStatus)
					? data.status
					: 'draft';

			const documentKey = `post_${slug}_${Date.now()}`;
			const doc: PostDocument = {
				postId: documentKey,
				slug,
				title: data.title.trim(),
				excerpt: data.excerpt ?? '',
				content: data.content ?? '',
				coverImageUrl: data.coverImageUrl ?? '',
				authorId: actor.userId,
				authorName: data.authorName ?? undefined,
				categoryId: data.categoryId ?? '',
				tags: Array.isArray(data.tags) ? data.tags.map((t) => String(t).trim()).filter(Boolean) : [],
				status,
				publishedAt: status === 'published' ? now : null,
				viewCount: 0,
				seoTitle: data.seoTitle ?? '',
				seoDescription: data.seoDescription ?? '',
				language,
				createdAt: now,
				updatedAt: now
			};

			const createRes = await cbPosts.document.create({ documentKey, content: doc });
			if (!createRes.ok) return { success: false, messages: postAdminMessages.createFailed };

			return { success: true, data: sanitizePostForAdmin({ ...doc, _id: documentKey }) };
		} catch {
			return { success: false, messages: postAdminMessages.createFailed };
		}
	}

	/** Cập nhật bài viết (partial) — slug đổi → kiểm tra trùng + append -2 nếu cần. */
	static async update(
		actor: ActorContext,
		postId: string,
		data: {
			title?: string;
			slug?: string;
			excerpt?: string;
			content?: string;
			coverImageUrl?: string;
			categoryId?: string;
			tags?: string[];
			seoTitle?: string;
			seoDescription?: string;
			language?: string;
		}
	): Promise<{ success: true; data: Record<string, unknown> } | { success: false; messages: TranslateContent }> {
		const denied = await this.requirePermission(actor, 'blog:manage');
		if (denied) return denied;

		try {
			const findStatement = `SELECT p.*, META().id AS _id FROM ${postsKeyspace} p WHERE META().id = $1 LIMIT 1`;
			const findRes = await cbPosts.document.query({ statement: findStatement, args: [postId], readonly: true });
			const doc = (findRes.data?.results?.[0] ?? null) as PostDocument | null;
			if (!doc) return { success: false, messages: postAdminMessages.notFound };

			const now = new Date().toISOString();
			const sets: string[] = [`updatedAt = $2`];

			if (data.title !== undefined) {
				if (!data.title.trim()) return { success: false, messages: postAdminMessages.titleRequired };
				sets.push(`title = $3`);
			}
			if (data.excerpt !== undefined) sets.push(`excerpt = $4`);
			if (data.content !== undefined) sets.push(`content = $5`);
			if (data.coverImageUrl !== undefined) sets.push(`coverImageUrl = $6`);
			if (data.categoryId !== undefined) sets.push(`categoryId = $7`);
			if (data.tags !== undefined) sets.push(`tags = $8`);
			if (data.seoTitle !== undefined) sets.push(`seoTitle = $9`);
			if (data.seoDescription !== undefined) sets.push(`seoDescription = $10`);

			// slug/language đổi → resolve lại unique (trừ chính nó)
			let newSlug: string | undefined;
			const language = data.language ?? doc.language;
			if (!VALID_POST_LANGUAGES.includes(language as PostLanguage)) {
				return { success: false, messages: postAdminMessages.languageInvalid };
			}
			if (data.slug !== undefined || (data.language !== undefined && data.language !== doc.language)) {
				const baseSlug = data.slug?.trim() ? slugify(data.slug.trim()) : slugify(doc.title);
				newSlug = await this.resolveUniqueSlug(baseSlug, language, postId);
				sets.push(`slug = $11`);
			}
			if (data.language !== undefined) sets.push(`language = $12`);

			const statement = `
				UPDATE ${postsKeyspace}
				SET ${sets.join(', ')}
				WHERE META().id = $1
				RETURNING p.*
			`.trim();
			const args: unknown[] = [
				postId,
				now,
				data.title !== undefined ? data.title.trim() : null,
				data.excerpt ?? null,
				data.content ?? null,
				data.coverImageUrl ?? null,
				data.categoryId ?? null,
				data.tags !== undefined ? data.tags.map((t) => String(t).trim()).filter(Boolean) : null,
				data.seoTitle ?? null,
				data.seoDescription ?? null,
				newSlug ?? null,
				data.language !== undefined ? data.language : null
			];

			const updateRes = await cbPosts.document.query({
				statement,
				args: args as (string | number)[],
				readonly: false
			});
			if (!updateRes.ok || !updateRes.data?.results?.length) {
				return { success: false, messages: postAdminMessages.updateFailed };
			}

			const updated = updateRes.data.results[0] as unknown as PostDocument;
			return { success: true, data: sanitizePostForAdmin(updated) };
		} catch {
			return { success: false, messages: postAdminMessages.updateFailed };
		}
	}

	/** draft → published, set publishedAt. Cho phép republish từ archived. */
	static async publish(
		actor: ActorContext,
		postId: string
	): Promise<{ success: true; data: Record<string, unknown> } | { success: false; messages: TranslateContent }> {
		const denied = await this.requirePermission(actor, 'blog:manage');
		if (denied) return denied;

		try {
			const now = new Date().toISOString();
			const statement = `
				UPDATE ${postsKeyspace}
				SET status = 'published', publishedAt = $2, updatedAt = $2
				WHERE META().id = $1 AND status IN ['draft', 'archived']
				RETURNING p.*
			`.trim();
			const res = await cbPosts.document.query({ statement, args: [postId, now], readonly: false });
			if (!res.ok || !res.data?.results?.length) {
				// Không khớp row = không tồn tại HOẶC đã published
				const check = await cbPosts.document.query({
					statement: `SELECT META().id AS _id FROM ${postsKeyspace} WHERE META().id = $1 LIMIT 1`,
					args: [postId],
					readonly: true
				});
				if (!check.ok || !check.data?.results?.length) {
					return { success: false, messages: postAdminMessages.notFound };
				}
				return { success: false, messages: postAdminMessages.invalidStatus };
			}
			return { success: true, data: sanitizePostForAdmin(res.data.results[0] as unknown as PostDocument) };
		} catch {
			return { success: false, messages: postAdminMessages.publishFailed };
		}
	}

	/** published/draft → archived. */
	static async archive(
		actor: ActorContext,
		postId: string
	): Promise<{ success: true; data: Record<string, unknown> } | { success: false; messages: TranslateContent }> {
		const denied = await this.requirePermission(actor, 'blog:manage');
		if (denied) return denied;

		try {
			const now = new Date().toISOString();
			const statement = `
				UPDATE ${postsKeyspace}
				SET status = 'archived', updatedAt = $2
				WHERE META().id = $1 AND status IN ['draft', 'published']
				RETURNING p.*
			`.trim();
			const res = await cbPosts.document.query({ statement, args: [postId, now], readonly: false });
			if (!res.ok || !res.data?.results?.length) {
				const check = await cbPosts.document.query({
					statement: `SELECT META().id AS _id FROM ${postsKeyspace} WHERE META().id = $1 LIMIT 1`,
					args: [postId],
					readonly: true
				});
				if (!check.ok || !check.data?.results?.length) {
					return { success: false, messages: postAdminMessages.notFound };
				}
				return { success: false, messages: postAdminMessages.invalidStatus };
			}
			return { success: true, data: sanitizePostForAdmin(res.data.results[0] as unknown as PostDocument) };
		} catch {
			return { success: false, messages: postAdminMessages.archiveFailed };
		}
	}

	/** Xoá hẳn bài viết. */
	static async delete(
		actor: ActorContext,
		postId: string
	): Promise<{ success: true; data: Record<string, unknown> } | { success: false; messages: TranslateContent }> {
		const denied = await this.requirePermission(actor, 'blog:manage');
		if (denied) return denied;

		try {
			const findStatement = `SELECT p.*, META().id AS _id FROM ${postsKeyspace} p WHERE META().id = $1 LIMIT 1`;
			const findRes = await cbPosts.document.query({ statement: findStatement, args: [postId], readonly: true });
			const doc = (findRes.data?.results?.[0] ?? null) as PostDocument | null;
			if (!doc) return { success: false, messages: postAdminMessages.notFound };

			const delRes = await cbPosts.document.delete({ documentKey: postId });
			if (!delRes.ok) return { success: false, messages: postAdminMessages.deleteFailed };

			return { success: true, data: sanitizePostForAdmin(doc) };
		} catch {
			return { success: false, messages: postAdminMessages.deleteFailed };
		}
	}

	/** Tăng lượt xem (public, gọi từ route storefront — không cần permission). */
	static async incrementView(
		postId: string
	): Promise<{ success: true; viewCount: number } | { success: false; messages: TranslateContent }> {
		try {
			const statement = `
				UPDATE ${postsKeyspace}
				SET viewCount = viewCount + 1
				WHERE META().id = $1 AND status = 'published'
				RETURNING p.viewCount
			`.trim();
			const res = await cbPosts.document.query({ statement, args: [postId], readonly: false });
			if (!res.ok || !res.data?.results?.length) {
				return { success: false, messages: postMessages.notFound };
			}
			const row = res.data.results[0] as { viewCount?: number };
			return { success: true, viewCount: Number(row?.viewCount ?? 0) };
		} catch {
			return { success: false, messages: postMessages.queryFailed };
		}
	}
}

export class PostCategoryService {
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string
	): Promise<{ success: false; messages: TranslateContent } | null> {
		const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			actorUserId: actor.userId
		});
		if (!allowed) return { success: false, messages: categoryAdminMessages.permissionDenied };
		return null;
	}

	private static async resolveUniqueSlug(
		slug: string,
		excludeCategoryId?: string
	): Promise<string> {
		let candidate = slug || 'category';
		let suffix = 1;
		while (suffix < 50) {
			const checkRes = await cbPostCategories.document.query({
				statement: `SELECT META().id AS _id FROM ${postCategoriesKeyspace} WHERE slug = $1 AND META().id != $2 LIMIT 1`,
				args: [candidate, excludeCategoryId ?? ''],
				readonly: true
			});
			const taken = checkRes.ok && (checkRes.data?.results?.length ?? 0) > 0;
			if (!taken) return candidate;
			suffix += 1;
			candidate = `${slug}-${suffix}`;
		}
		return `${slug}-${Date.now()}`;
	}

	static async list(
		actor: ActorContext,
		options: { status?: string; page?: number; pageSize?: number } = {}
	): Promise<{ success: true; data: ListResult } | { success: false; messages: TranslateContent }> {
		const denied = await this.requirePermission(actor, 'blog:read');
		if (denied) return denied;

		try {
			const page = Math.max(1, options.page ?? 1);
			const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 100));
			const offset = (page - 1) * pageSize;

			const conditions: string[] = [];
			const args: (string | number)[] = [];
			if (options.status) {
				conditions.push(`c.status = $${args.length + 1}`);
				args.push(options.status);
			}
			const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

			const selectClause = CATEGORY_SAFE_FIELDS.map((f) => `c.\`${f}\``).join(', ');
			const dataStatement = `
				SELECT ${selectClause}, META().id AS _id
				FROM ${postCategoriesKeyspace} c
				${whereClause}
				ORDER BY c.sortOrder ASC, c.name ASC
				LIMIT $${args.length + 1} OFFSET $${args.length + 2}
			`.trim();
			const dataArgs = [...args, pageSize, offset];

			const countStatement = `
				SELECT RAW COUNT(*) AS total
				FROM ${postCategoriesKeyspace} c
				${whereClause}
			`.trim();

			const [dataRes, countRes] = await Promise.all([
				cbPostCategories.document.query({ statement: dataStatement, args: dataArgs, readonly: true }),
				cbPostCategories.document.query({ statement: countStatement, args, readonly: true })
			]);

			if (!dataRes.ok || !countRes.ok) {
				return { success: false, messages: categoryAdminMessages.queryFailed };
			}
			const rows = (dataRes.data?.results ?? []) as unknown as PostCategoryDocument[];
			const total = Number(countRes.data?.results?.[0] ?? 0);

			return {
				success: true,
				data: { items: rows.map(sanitizeCategoryForAdmin), total, page, pageSize }
			};
		} catch {
			return { success: false, messages: categoryAdminMessages.queryFailed };
		}
	}

	static async get(
		actor: ActorContext,
		categoryId: string
	): Promise<{ success: true; data: Record<string, unknown> } | { success: false; messages: TranslateContent }> {
		const denied = await this.requirePermission(actor, 'blog:read');
		if (denied) return denied;

		try {
			const statement = `SELECT c.*, META().id AS _id FROM ${postCategoriesKeyspace} c WHERE META().id = $1 LIMIT 1`;
			const res = await cbPostCategories.document.query({ statement, args: [categoryId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as PostCategoryDocument | null;
			if (!doc) return { success: false, messages: categoryAdminMessages.notFound };
			return { success: true, data: sanitizeCategoryForAdmin(doc) };
		} catch {
			return { success: false, messages: categoryAdminMessages.queryFailed };
		}
	}

	static async create(
		actor: ActorContext,
		data: { name: string; slug?: string; description?: string; sortOrder?: number; status?: string }
	): Promise<{ success: true; data: Record<string, unknown> } | { success: false; messages: TranslateContent }> {
		const denied = await this.requirePermission(actor, 'blog:manage');
		if (denied) return denied;

		if (!data.name?.trim()) return { success: false, messages: categoryAdminMessages.nameRequired };

		try {
			const now = new Date().toISOString();
			const baseSlug = data.slug?.trim() ? slugify(data.slug.trim()) : slugify(data.name.trim());
			const slug = await this.resolveUniqueSlug(baseSlug);

			const documentKey = `postcat_${slug}_${Date.now()}`;
			const doc: PostCategoryDocument = {
				categoryId: documentKey,
				name: data.name.trim(),
				slug,
				description: data.description ?? '',
				sortOrder: Number.isFinite(data.sortOrder) ? Number(data.sortOrder) : 0,
				status: data.status === 'inactive' ? 'inactive' : 'active',
				createdAt: now,
				updatedAt: now
			};

			const createRes = await cbPostCategories.document.create({ documentKey, content: doc });
			if (!createRes.ok) return { success: false, messages: categoryAdminMessages.createFailed };

			return { success: true, data: sanitizeCategoryForAdmin({ ...doc, _id: documentKey }) };
		} catch {
			return { success: false, messages: categoryAdminMessages.createFailed };
		}
	}

	static async update(
		actor: ActorContext,
		categoryId: string,
		data: { name?: string; slug?: string; description?: string; sortOrder?: number; status?: string }
	): Promise<{ success: true; data: Record<string, unknown> } | { success: false; messages: TranslateContent }> {
		const denied = await this.requirePermission(actor, 'blog:manage');
		if (denied) return denied;

		if (data.name !== undefined && !data.name.trim()) {
			return { success: false, messages: categoryAdminMessages.nameRequired };
		}

		try {
			const findStatement = `SELECT c.*, META().id AS _id FROM ${postCategoriesKeyspace} c WHERE META().id = $1 LIMIT 1`;
			const findRes = await cbPostCategories.document.query({ statement: findStatement, args: [categoryId], readonly: true });
			const doc = (findRes.data?.results?.[0] ?? null) as PostCategoryDocument | null;
			if (!doc) return { success: false, messages: categoryAdminMessages.notFound };

			const now = new Date().toISOString();
			const sets: string[] = [`updatedAt = $2`];
			if (data.name !== undefined) sets.push(`name = $3`);
			if (data.description !== undefined) sets.push(`description = $4`);
			if (data.sortOrder !== undefined) sets.push(`sortOrder = $5`);
			if (data.status !== undefined) sets.push(`status = $6`);

			let newSlug: string | undefined;
			if (data.slug !== undefined || data.name !== undefined) {
				const baseSlug = data.slug?.trim() ? slugify(data.slug.trim()) : slugify((data.name ?? doc.name).trim());
				newSlug = await this.resolveUniqueSlug(baseSlug, categoryId);
				sets.push(`slug = $7`);
			}

			const statement = `
				UPDATE ${postCategoriesKeyspace}
				SET ${sets.join(', ')}
				WHERE META().id = $1
				RETURNING c.*
			`.trim();
			const args: unknown[] = [
				categoryId,
				now,
				data.name !== undefined ? data.name.trim() : null,
				data.description ?? null,
				data.sortOrder !== undefined ? Number(data.sortOrder) : null,
				data.status ?? null,
				newSlug ?? null
			];

			const updateRes = await cbPostCategories.document.query({
				statement,
				args: args as (string | number)[],
				readonly: false
			});
			if (!updateRes.ok || !updateRes.data?.results?.length) {
				return { success: false, messages: categoryAdminMessages.updateFailed };
			}
			return { success: true, data: sanitizeCategoryForAdmin(updateRes.data.results[0] as unknown as PostCategoryDocument) };
		} catch {
			return { success: false, messages: categoryAdminMessages.updateFailed };
		}
	}

	/** Chỉ xoá được khi KHÔNG còn post nào dùng categoryId này. */
	static async delete(
		actor: ActorContext,
		categoryId: string
	): Promise<{ success: true; data: Record<string, unknown> } | { success: false; messages: TranslateContent }> {
		const denied = await this.requirePermission(actor, 'blog:manage');
		if (denied) return denied;

		try {
			const findStatement = `SELECT c.*, META().id AS _id FROM ${postCategoriesKeyspace} c WHERE META().id = $1 LIMIT 1`;
			const findRes = await cbPostCategories.document.query({ statement: findStatement, args: [categoryId], readonly: true });
			const doc = (findRes.data?.results?.[0] ?? null) as PostCategoryDocument | null;
			if (!doc) return { success: false, messages: categoryAdminMessages.notFound };

			const inUseRes = await cbPosts.document.query({
				statement: `SELECT RAW COUNT(*) AS total FROM ${postsKeyspace} p WHERE p.categoryId = $1`,
				args: [categoryId],
				readonly: true
			});
			const inUse = Number(inUseRes.data?.results?.[0] ?? 0);
			if (inUse > 0) return { success: false, messages: categoryAdminMessages.inUse };

			const delRes = await cbPostCategories.document.delete({ documentKey: categoryId });
			if (!delRes.ok) return { success: false, messages: categoryAdminMessages.deleteFailed };

			return { success: true, data: sanitizeCategoryForAdmin(doc) };
		} catch {
			return { success: false, messages: categoryAdminMessages.deleteFailed };
		}
	}
}
