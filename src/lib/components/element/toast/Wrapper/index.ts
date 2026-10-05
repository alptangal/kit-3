import { getContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import type { ToastWrapperConfigs } from '../_interface';

const key = Symbol('toast-wrapper-context');
export function setToastWrapperContext(context: ToastWrapperConfigs) {
	setContext(key, context);
}
export function getToastWrapperContext(): ToastWrapperConfigs | undefined {
	return getContext(key);
}

// Một trang có thể mount NHIỀU <ToastWrapper> (global layout + demo riêng). Tất cả cùng
// đọc MỘT store reactive (client.browser.toasts.children), nên nếu không dedup thì mỗi
// toast render một lần trên MỌI wrapper. Wrapper có `data-test` (tự gọi là "primary")
// sở hữu việc render; wrapper global (không data-test) nhường chỗ khi có primary.
// Key là uuid (string) của từng wrapper instance — dùng SvelteMap để `primaryCount`
// (read trong $derived) cập nhật reactive khi wrapper mount/unmount.
export const toastWrapperRegistry = new SvelteMap<string, boolean>();
