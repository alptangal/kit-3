// src/lib/components/element/date-picker/_context.ts
// Tách DatePickerConfigs ra file leaf (KHÔNG import Root .svelte) để tránh
// circular import khi sub-component đọc context qua barrel (SSR).
// Mirror popover/_context.ts + dropdown-menu/_context.ts.
import { getContext, setContext } from 'svelte';
import type { DatePickerConfigs } from './_interface';

const NAME = Symbol('date-picker-context');

export function setDatePickerContext(context: DatePickerConfigs) {
	setContext(NAME, context);
}

export function getDatePickerContext(): DatePickerConfigs | undefined {
	return getContext(NAME);
}
