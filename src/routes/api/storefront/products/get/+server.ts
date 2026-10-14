// src/routes/api/storefront/products/get/+server.ts
// Chi tiết 1 sản phẩm công khai cho storefront (/store/products/[id]) —
// chỉ trả product active + variants active, KHÔNG lộ cost fields
// (costPrice/createdBy). Kèm related products cùng category (tối đa 4).
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted } from '$lib/server/admin/api';
import { cbData } from '$modules/couchbase/clients';
import { cb_bucketName, cb_scopeName } from '$env/static/private';

const cbProducts = cbData('products');
const cbVariants = cbData('product_variants');

const productsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`products\``;
const variantsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`product_variants\``;

async function loadVariants(productId: string) {
	const vRes = await cbVariants.document.query({
		statement: `SELECT META().id AS variantId, v.sku, v.displayName, v.attributes, v.price, v.imageUrl
			FROM ${variantsKeyspace} v
			WHERE v.productId = $1 AND v.status = 'active' AND (v.deletedAt IS NULL OR v.deletedAt IS MISSING)`,
		args: [productId],
		readonly: true
	});
	return vRes.ok ? (vRes.data?.results ?? []) : [];
}

export const POST: RequestHandler = async (event) => {
	try {
		const read = await readAdminRequest<{ productId?: string }>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const productId = typeof read.data.productId === 'string' ? read.data.productId.trim() : '';
		if (!productId) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu mã sản phẩm', en: 'Missing product id' } },
				400
			);
		}

		const pRes = await cbProducts.document.query({
			statement: `SELECT p._id AS productId, p.name, p.description, p.categoryId, p.brandId, p.imageUrl
				FROM ${productsKeyspace} p
				WHERE p._id = $1 AND p.status = 'active' AND (p.deletedAt IS NULL OR p.deletedAt IS MISSING)
				LIMIT 1`,
			args: [productId],
			readonly: true
		});
		if (!pRes.ok) {
			return respond(
				{ ok: false, message: { vi: 'Lấy sản phẩm thất bại', en: 'Failed to fetch product' } },
				400
			);
		}
		const product = pRes.data?.results?.[0];
		if (!product) {
			return respond(
				{ ok: false, message: { vi: 'Không tìm thấy sản phẩm', en: 'Product not found' } },
				404
			);
		}

		const variants = await loadVariants(String(product.productId));

		// Related: cùng category (nếu có), loại chính nó, tối đa 4 — best-effort.
		let related: Record<string, unknown>[] = [];
		const categoryId = typeof product.categoryId === 'string' ? product.categoryId : undefined;
		if (categoryId) {
			const rRes = await cbProducts.document.query({
				statement: `SELECT p._id AS productId, p.name, p.description, p.categoryId, p.brandId, p.imageUrl
					FROM ${productsKeyspace} p
					WHERE p.categoryId = $1 AND p._id != $2 AND p.status = 'active'
						AND (p.deletedAt IS NULL OR p.deletedAt IS MISSING)
					ORDER BY p.createdAt DESC LIMIT 4`,
				args: [categoryId, productId],
				readonly: true
			});
			if (rRes.ok && rRes.data?.results?.length) {
				related = await Promise.all(
					rRes.data.results.map(async (rp) => ({
						...rp,
						variants: await loadVariants(String(rp.productId))
					}))
				);
			}
		}

		return respond({
			ok: true,
			message: { vi: 'Lấy sản phẩm thành công', en: 'Product fetched successfully' },
			data: { product: { ...product, variants }, related }
		});
	} catch (e) {
		console.error('[POST /api/storefront/products/get]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
