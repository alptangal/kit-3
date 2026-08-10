import type { MetaUser } from '$interfaces/basic';
import type { Handle } from '@sveltejs/kit';

async function getUserFromToken(token: string): Promise<MetaUser | undefined> {
	return undefined;
}
export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get('session');
	event.locals.user = token ? await getUserFromToken(token) : undefined;

	const { pathname } = event.url;

	if (pathname.startsWith('/admin') && event.locals.user?.role !== 'admin') {
		return new Response(null, { status: 303, headers: { location: '/login' } });
	}

	if (pathname.startsWith('/profile') && !event.locals.user) {
		return new Response(null, { status: 303, headers: { location: '/login' } });
	}

	return resolve(event);
};
