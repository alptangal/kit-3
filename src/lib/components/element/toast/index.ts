import { getContext, setContext } from 'svelte';
import type { ToastConfigs } from './_interface';

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

let toastMethods: ToastMethods | null = null;

export function setToastMethods(methods: ToastMethods) {
	toastMethods = methods;
}

export function getToastMethods(): ToastMethods | null {
	return toastMethods;
}

// Lazy getter for client - avoids SSR issues
function getClient() {
	// Dynamic import to avoid circular dependencies and SSR issues
	const { client } = require('$store/basic.svelte');
	return client;
}

function createToast(data: ToastData): string {
	const client = getClient();
	if (!client.browser) {
		client.browser = {};
	}
	if (!client.browser.toasts) {
		client.browser.toasts = {
			children: new Map(),
			create(toastData: ToastData) {
				const id = toastData.id ?? crypto.randomUUID();
				const showCloseButton = toastData.showCloseButton ?? true;
				this.children.set(id, { ...toastData, id, showCloseButton });
				return id;
			},
			remove(key: string) {
				this.children.delete(key);
			}
		};
	}
	return client.browser.toasts.create(data);
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
		const client = getClient();
		client.browser?.toasts?.remove?.(id);
	}
};