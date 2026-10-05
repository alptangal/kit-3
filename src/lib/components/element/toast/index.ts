import { getContext, setContext } from 'svelte';
import type { ToastConfigs } from './_interface';
import { client } from '$store/basic.svelte';
import { browser } from '$app/environment';
import { SvelteMap } from 'svelte/reactivity';

const key = Symbol('toast-context');
export function setToastContext(context: ToastConfigs) {
	setContext(key, context);
}
export function getToastContext(): ToastConfigs | undefined {
	return getContext(key);
}

// Toast utility function for programmatic toast creation
export interface ToastData {
	id?: string;
	title: string;
	description?: string;
	color?: 'success' | 'error' | 'warning' | 'info' | 'default';
	duration?: number | 'infinite';
	position?: 'top' | 'bottom' | 'left' | 'right';
	offset?: number;
	indicator?: string;
	showCloseButton?: boolean;
	action?: {
		label: string;
		onClick: () => void;
		variant?: 'primary' | 'secondary' | 'ghost';
	};
	disabled?: boolean;
}

export interface ToastMethods {
	success: (title: string, description?: string, options?: Omit<ToastData, 'title' | 'description' | 'color'>) => string;
	error: (title: string, description?: string, options?: Omit<ToastData, 'title' | 'description' | 'color'>) => string;
	warning: (title: string, description?: string, options?: Omit<ToastData, 'title' | 'description' | 'color'>) => string;
	info: (title: string, description?: string, options?: Omit<ToastData, 'title' | 'description' | 'color'>) => string;
	default: (title: string, description?: string, options?: Omit<ToastData, 'title' | 'description' | 'color'>) => string;
	remove: (id: string) => void;
}

// Reactive source of truth for toasts. Kept on `client.browser.toasts` so the
// globally-mounted ToastWrapper and any per-page wrapper both read the same map.
// A SvelteMap (not a plain Map) is required for the Wrapper's `{#each}` to
// re-render when entries are added/removed.
type ToastStore = {
	children: SvelteMap<string, ToastData & { id: string; showCloseButton: boolean }>;
	create: (data: ToastData) => string;
	remove: (key: string) => void;
};

function ensureToastStore(): ToastStore | undefined {
	if (!browser || !client.browser) return undefined;
	const existing = (client.browser as { toasts?: ToastStore }).toasts;
	if (existing) return existing;
	const store: ToastStore = {
		children: new SvelteMap(),
		create(data: ToastData) {
			const id = data.id ?? (typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString(36));
			const showCloseButton = data.showCloseButton ?? true;
			this.children.set(id, { ...data, id, showCloseButton });
			return id;
		},
		remove(key) {
			this.children.delete(key);
		}
	};
	(client.browser as { toasts?: ToastStore }).toasts = store;
	return store;
}

function createToast(data: ToastData): string {
	const store = ensureToastStore();
	if (!store) return '';
	return store.create(data);
}

export const toast: ToastMethods = {
	success: (title, description, options = {}) => {
		return createToast({ ...options, title, description, color: 'success' });
	},
	error: (title, description, options = {}) => {
		return createToast({ ...options, title, description, color: 'error' });
	},
	warning: (title, description, options = {}) => {
		return createToast({ ...options, title, description, color: 'warning' });
	},
	info: (title, description, options = {}) => {
		return createToast({ ...options, title, description, color: 'info' });
	},
	default: (title, description, options = {}) => {
		return createToast({ ...options, title, description, color: 'default' });
	},
	remove: (id: string) => {
		ensureToastStore()?.remove(id);
	}
};
