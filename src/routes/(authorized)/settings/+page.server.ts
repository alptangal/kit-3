import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// C6: settings chuyển vào /admin/settings (đồng bộ sidebar với các trang
// admin khác) — route cũ redirect vĩnh viễn để giữ bookmark cũ hoạt động.
export const load: PageServerLoad = async () => {
	redirect(308, '/admin/settings');
};
