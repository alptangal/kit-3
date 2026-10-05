// src/lib/components/element/datatable/_context.ts
// DataTable Symbol context — tách ra file leaf (KHÔNG import .svelte) để tránh
// circular import khi sub (Head/Body/Pagination) đọc qua barrel.
// Bỏ writable store của table v1: root giữ $state, sub đọc reactive qua getters.
import { getContext, setContext } from 'svelte';
import type { DataTableSharedState } from './_interface';

const DATATABLE_CTX = Symbol('datatable-context');

export function setDataTableContext(context: DataTableSharedState) {
	setContext(DATATABLE_CTX, context);
}

export function getDataTableContext(): DataTableSharedState | undefined {
	return getContext(DATATABLE_CTX);
}
