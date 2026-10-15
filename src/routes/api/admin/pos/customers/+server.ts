// src/routes/api/admin/pos/customers/+server.ts
// POS customer picker: search user role-customer theo tên (firstname/midname/
// lastname/description LIKE) — permission-free như checkout POS (chỉ cần actor
// đăng nhập). Trả tối thiểu field cần chọn khách: _id, tên ghép, loyaltyPoints.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext
} from '$lib/server/admin/api';
import { cbData } from '$modules/couchbase/clients';

const usersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.users`;

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ search?: string; limit?: number }>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(locals);
		if (!actor) {
			return respond(
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}

		const search = (read.data.search ?? '').trim();
		const limit = Math.min(20, Math.max(1, Math.floor(Number(read.data.limit) || 20)));

		const args: (string | number)[] = ['role-customer'];
		let whereClause = 'roleId = $1 AND (deletedAt IS NULL OR deletedAt IS MISSING)';
		if (search) {
			args.push(`%${search}%`);
			whereClause += ` AND (firstname LIKE $${args.length} OR midname LIKE $${args.length} OR lastname LIKE $${args.length} OR description LIKE $${args.length})`;
		}

		const res = await cbData('users').document.query({
			statement: `SELECT META().id AS _id, firstname, midname, lastname, description, loyaltyPoints
				FROM ${usersKeyspace}
				WHERE ${whereClause}
				ORDER BY createdAt DESC
				LIMIT ${limit}`,
			args,
			readonly: true
		});

		if (!res.ok) {
			return respond(
				{ ok: false, message: { vi: 'Truy vấn khách hàng thất bại', en: 'Customer query failed' } },
				500
			);
		}

		const rows = (res.data?.results ?? []) as Array<Record<string, unknown>>;
		const items = rows.map((row) => {
			const parts = [row.firstname, row.midname, row.lastname]
				.map((p) => (typeof p === 'string' ? p.trim() : ''))
				.filter(Boolean);
			return {
				_id: row._id,
				fullName: parts.join(' ') || (row.description as string) || String(row._id),
				loyaltyPoints: Number(row.loyaltyPoints ?? 0)
			};
		});

		return respond({
			ok: true,
			message: { vi: 'Tìm khách hàng thành công', en: 'Customer search completed' },
			data: { items }
		});
	} catch (e) {
		console.error('[POST /api/admin/pos/customers]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
