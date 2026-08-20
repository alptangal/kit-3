const collectionSchemas = {
	users: {
		fields: {
			name: { type: 'string', searchable: true, sortable: true, selectable: true },
			description: { type: 'string', searchable: true, sortable: false, selectable: true },
			status: { type: 'string', searchable: true, sortable: true, selectable: true },
			role: { type: 'string', searchable: true, sortable: true, selectable: true },

			emailBlindIndex: { type: 'string', searchable: true, sortable: false, selectable: false },
			phoneBlindIndex: { type: 'string', searchable: true, sortable: false, selectable: false },
			usernameBlindIndex: { type: 'string', searchable: true, sortable: false, selectable: false },

			emailEncrypted: { type: 'string', searchable: false, sortable: false, selectable: true },
			phoneEncrypted: { type: 'string', searchable: false, sortable: false, selectable: true },
			profileEncrypted: { type: 'string', searchable: false, sortable: false, selectable: true },

			vaultSaltB64: { type: 'string', searchable: false, sortable: false, selectable: true },
			vaultDekIvB64: { type: 'string', searchable: false, sortable: false, selectable: true },
			vaultWrappedDekB64: { type: 'string', searchable: false, sortable: false, selectable: true },

			webauthnCredentials: { type: 'array', searchable: false, sortable: false, selectable: false },
			webauthnUserHandle: { type: 'string', searchable: true, sortable: false, selectable: true },

			passwordHash: { type: 'string', searchable: false, sortable: false, selectable: false },
			mfaEnabled: { type: 'boolean', searchable: true, sortable: false, selectable: true },
			lastLoginAt: { type: 'date', searchable: false, sortable: true, selectable: true },
			lastLoginIp: { type: 'string', searchable: false, sortable: false, selectable: false },

			createdAt: { type: 'date', searchable: true, sortable: true, selectable: true },
			updatedAt: { type: 'date', searchable: false, sortable: true, selectable: true },
			deletedAt: { type: 'date', searchable: false, sortable: false, selectable: false }
		}
	},
	webauthn_challenges: {
		fields: {
			challenge: { type: 'string', searchable: false, sortable: false, selectable: true },
			emailBlindIndex: { type: 'string', searchable: false, sortable: false, selectable: true },
			emailEncrypted: { type: 'object', searchable: false, sortable: false, selectable: true },
			vaultSaltB64: { type: 'string', searchable: false, sortable: false, selectable: true },
			vaultDekIvB64: { type: 'string', searchable: false, sortable: false, selectable: true },
			vaultWrappedDekB64: { type: 'string', searchable: false, sortable: false, selectable: true },
			nameTemp: { type: 'string', searchable: false, sortable: false, selectable: true },
			userHandle: { type: 'string', searchable: false, sortable: false, selectable: true },
			createdAt: { type: 'date', searchable: false, sortable: false, selectable: true }
		}
	},
	products: {
		fields: {
			name: { type: 'string', searchable: true, sortable: true, selectable: true },
			category: { type: 'string', searchable: true, sortable: true, selectable: true },
			price: { type: 'number', searchable: true, sortable: true, selectable: true },
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
