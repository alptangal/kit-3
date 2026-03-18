export const load = async ({ request }) => {
	return { userAgent: request.headers.get('user-agent') };
};
