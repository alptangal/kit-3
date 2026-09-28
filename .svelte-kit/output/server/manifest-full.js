export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["robots.txt"]),
	mimeTypes: {".txt":"text/plain"},
	_: {
		client: {start:"_app/immutable/entry/start.BnveY7fe.js",app:"_app/immutable/entry/app.BRgm0BqE.js",imports:["_app/immutable/entry/start.BnveY7fe.js","_app/immutable/chunks/B1H-i5Vu.js","_app/immutable/chunks/C2u_6wXe.js","_app/immutable/chunks/D-udZLY0.js","_app/immutable/chunks/ad1uuD-b.js","_app/immutable/entry/app.BRgm0BqE.js","_app/immutable/chunks/PPVm8Dsz.js","_app/immutable/chunks/D-udZLY0.js","_app/immutable/chunks/C2u_6wXe.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/BbFZgtEI.js","_app/immutable/chunks/C0Xf2en6.js","_app/immutable/chunks/FtqbYcpE.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js')),
			__memo(() => import('./nodes/9.js')),
			__memo(() => import('./nodes/10.js')),
			__memo(() => import('./nodes/11.js')),
			__memo(() => import('./nodes/12.js')),
			__memo(() => import('./nodes/13.js')),
			__memo(() => import('./nodes/14.js')),
			__memo(() => import('./nodes/15.js')),
			__memo(() => import('./nodes/16.js')),
			__memo(() => import('./nodes/17.js')),
			__memo(() => import('./nodes/18.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/(unauthorized)",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/(unauthorized)/about",
				pattern: /^\/about\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/(authorized)/admin/brands",
				pattern: /^\/admin\/brands\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/(authorized)/admin/categories",
				pattern: /^\/admin\/categories\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/(authorized)/admin/products",
				pattern: /^\/admin\/products\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/(authorized)/admin/variants",
				pattern: /^\/admin\/variants\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/api/admin/brands/create",
				pattern: /^\/api\/admin\/brands\/create\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/brands/create/_server.ts.js'))
			},
			{
				id: "/api/admin/brands/delete",
				pattern: /^\/api\/admin\/brands\/delete\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/brands/delete/_server.ts.js'))
			},
			{
				id: "/api/admin/brands/detail",
				pattern: /^\/api\/admin\/brands\/detail\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/brands/detail/_server.ts.js'))
			},
			{
				id: "/api/admin/brands/list",
				pattern: /^\/api\/admin\/brands\/list\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/brands/list/_server.ts.js'))
			},
			{
				id: "/api/admin/brands/update",
				pattern: /^\/api\/admin\/brands\/update\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/brands/update/_server.ts.js'))
			},
			{
				id: "/api/admin/categories/create",
				pattern: /^\/api\/admin\/categories\/create\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/categories/create/_server.ts.js'))
			},
			{
				id: "/api/admin/categories/delete",
				pattern: /^\/api\/admin\/categories\/delete\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/categories/delete/_server.ts.js'))
			},
			{
				id: "/api/admin/categories/detail",
				pattern: /^\/api\/admin\/categories\/detail\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/categories/detail/_server.ts.js'))
			},
			{
				id: "/api/admin/categories/list",
				pattern: /^\/api\/admin\/categories\/list\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/categories/list/_server.ts.js'))
			},
			{
				id: "/api/admin/categories/update",
				pattern: /^\/api\/admin\/categories\/update\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/categories/update/_server.ts.js'))
			},
			{
				id: "/api/admin/products/create",
				pattern: /^\/api\/admin\/products\/create\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/products/create/_server.ts.js'))
			},
			{
				id: "/api/admin/products/delete",
				pattern: /^\/api\/admin\/products\/delete\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/products/delete/_server.ts.js'))
			},
			{
				id: "/api/admin/products/detail",
				pattern: /^\/api\/admin\/products\/detail\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/products/detail/_server.ts.js'))
			},
			{
				id: "/api/admin/products/list",
				pattern: /^\/api\/admin\/products\/list\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/products/list/_server.ts.js'))
			},
			{
				id: "/api/admin/products/update",
				pattern: /^\/api\/admin\/products\/update\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/products/update/_server.ts.js'))
			},
			{
				id: "/api/admin/variants/create",
				pattern: /^\/api\/admin\/variants\/create\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/variants/create/_server.ts.js'))
			},
			{
				id: "/api/admin/variants/delete",
				pattern: /^\/api\/admin\/variants\/delete\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/variants/delete/_server.ts.js'))
			},
			{
				id: "/api/admin/variants/detail",
				pattern: /^\/api\/admin\/variants\/detail\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/variants/detail/_server.ts.js'))
			},
			{
				id: "/api/admin/variants/list",
				pattern: /^\/api\/admin\/variants\/list\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/variants/list/_server.ts.js'))
			},
			{
				id: "/api/admin/variants/update",
				pattern: /^\/api\/admin\/variants\/update\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/variants/update/_server.ts.js'))
			},
			{
				id: "/api/auth/refresh",
				pattern: /^\/api\/auth\/refresh\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/auth/refresh/_server.ts.js'))
			},
			{
				id: "/api/dev-emails",
				pattern: /^\/api\/dev-emails\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/dev-emails/_server.ts.js'))
			},
			{
				id: "/api/encryption/public-key",
				pattern: /^\/api\/encryption\/public-key\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/encryption/public-key/_server.ts.js'))
			},
			{
				id: "/api/forgot-password",
				pattern: /^\/api\/forgot-password\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/forgot-password/_server.ts.js'))
			},
			{
				id: "/api/health",
				pattern: /^\/api\/health\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/health/_server.ts.js'))
			},
			{
				id: "/api/login",
				pattern: /^\/api\/login\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/login/_server.ts.js'))
			},
			{
				id: "/api/register",
				pattern: /^\/api\/register\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/register/_server.ts.js'))
			},
			{
				id: "/api/register/check",
				pattern: /^\/api\/register\/check\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/register/check/_server.ts.js'))
			},
			{
				id: "/api/resend-verification",
				pattern: /^\/api\/resend-verification\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/resend-verification/_server.ts.js'))
			},
			{
				id: "/api/reset-password",
				pattern: /^\/api\/reset-password\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/reset-password/_server.ts.js'))
			},
			{
				id: "/api/test",
				pattern: /^\/api\/test\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/test/_server.ts.js'))
			},
			{
				id: "/api/verify-email",
				pattern: /^\/api\/verify-email\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/verify-email/_server.ts.js'))
			},
			{
				id: "/(unauthorized)/forgot-password",
				pattern: /^\/forgot-password\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/(unauthorized)/login",
				pattern: /^\/login\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/(unauthorized)/register",
				pattern: /^\/register\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/(unauthorized)/reset-password",
				pattern: /^\/reset-password\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 13 },
				endpoint: null
			},
			{
				id: "/test",
				pattern: /^\/test\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 15 },
				endpoint: null
			},
			{
				id: "/test/test1",
				pattern: /^\/test\/test1\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 16 },
				endpoint: null
			},
			{
				id: "/ui",
				pattern: /^\/ui\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 17 },
				endpoint: null
			},
			{
				id: "/(unauthorized)/verify-email",
				pattern: /^\/verify-email\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 14 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
