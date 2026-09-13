import { collectionSchemas } from '$modules/schema'; // sửa path cho đúng chỗ bạn để file schema

/**
 * ============================================================
 * 1. MAP: field.type (string) -> kiểu TypeScript thật
 * ============================================================
 * Đây là "bảng dịch" duy nhất bạn cần chỉnh nếu sau này
 * thêm type mới vào schema (vd: 'geopoint', 'reference'...)
 */
type FieldTypeMap = {
	string: string;
	number: number;
	boolean: boolean;
	date: Date; // Nếu bạn nhận JSON thô (chưa parse) từ API, đổi thành `string`
	array: unknown[];
	object: Record<string, unknown>;
};

type FieldDef = { type: keyof FieldTypeMap };

/** Suy ra kiểu của 1 field */
type InferField<F extends FieldDef> = FieldTypeMap[F['type']];

/** Suy ra toàn bộ field của 1 collection */
type InferFields<Fields extends Record<string, FieldDef>> = {
	-readonly [K in keyof Fields]: InferField<Fields[K]>;
};

/** Suy ra document type của 1 collection (dựa vào field "fields") */
type InferCollection<C extends { fields: Record<string, FieldDef> }> = InferFields<C['fields']>;

/**
 * ============================================================
 * 2. OVERRIDES (tuỳ chọn) — nơi khai báo những gì schema
 * không thể tự suy ra được:
 *   - union literal ('active' | 'suspended' | ...)
 *   - shape cụ thể của field 'array' / 'object'
 *   - field nullable (vd deletedAt: Date | null)
 * ============================================================
 * Không bắt buộc khai báo hết — field nào không override
 * thì vẫn dùng type tự suy ra ở bước 1 (string/number/Date/...).
 */
interface WebAuthnCredential {
	credentialId: string;
	publicKey: string;
	counter: number;
	transports?: string[];
}

interface OrderItem {
	variantId: string;
	lotId?: string;
	quantity: number;
	price: number;
}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- sẽ bổ sung dần khi cần siết type cho collection cụ thể
interface Overrides {
	users: {
		roleId: 'owner' | 'manager' | 'staff' | 'customer';
		authMethod: 'password' | 'webauthn' | 'oauth';
		webauthnCredentials: WebAuthnCredential[];
		deletedAt: Date | null;
	};
	orders: {
		status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';
		items: OrderItem[];
	};
	products: {
		status: 'active' | 'discontinued' | 'draft';
		variantAttributes: { name: string; options: string[] }[];
		deletedAt: Date | null;
	};

	// Thêm collection khác vào đây khi cần siết chặt type hơn...
}

/** Gộp: field có override -> lấy override, field còn lại -> lấy type tự suy ra */
type ApplyOverrides<Base, Name> = Name extends keyof Overrides
	? Omit<Base, keyof Overrides[Name]> & Overrides[Name]
	: Base;

/**
 * ============================================================
 * 3. PUBLIC API — dùng cái này trong code
 * ============================================================
 */
type Collections = typeof collectionSchemas;

export type CollectionDocument<Name extends keyof Collections> = ApplyOverrides<
	InferCollection<Collections[Name]>,
	Name
>;
