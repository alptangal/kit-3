
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/(unauthorized)" | "/(authorized)" | "/" | "/(authorized" | "/(authorized/)" | "/(unauthorized)/about" | "/(authorized)/admin" | "/(authorized)/admin/brands" | "/(authorized)/admin/categories" | "/(authorized)/admin/products" | "/(authorized)/admin/variants" | "/api" | "/api/admin" | "/api/admin/brands" | "/api/admin/brands/create" | "/api/admin/brands/delete" | "/api/admin/brands/detail" | "/api/admin/brands/list" | "/api/admin/brands/update" | "/api/admin/categories" | "/api/admin/categories/create" | "/api/admin/categories/delete" | "/api/admin/categories/detail" | "/api/admin/categories/list" | "/api/admin/categories/update" | "/api/admin/inventory" | "/api/admin/inventory/branches" | "/api/admin/inventory/lots" | "/api/admin/inventory/lots/create" | "/api/admin/inventory/lots/list" | "/api/admin/inventory/stock" | "/api/admin/inventory/stock/adjust" | "/api/admin/inventory/stock/get" | "/api/admin/inventory/stock/list" | "/api/admin/products" | "/api/admin/products/create" | "/api/admin/products/delete" | "/api/admin/products/detail" | "/api/admin/products/list" | "/api/admin/products/update" | "/api/admin/roles" | "/api/admin/users" | "/api/admin/users/create" | "/api/admin/users/delete" | "/api/admin/users/detail" | "/api/admin/users/list" | "/api/admin/users/reset-password" | "/api/admin/users/restore" | "/api/admin/users/set-role" | "/api/admin/users/set-status" | "/api/admin/users/update" | "/api/admin/variants" | "/api/admin/variants/create" | "/api/admin/variants/delete" | "/api/admin/variants/detail" | "/api/admin/variants/list" | "/api/admin/variants/update" | "/api/auth" | "/api/auth/refresh" | "/api/dev-emails" | "/api/encryption" | "/api/encryption/public-key" | "/api/forgot-password" | "/api/health" | "/api/login" | "/api/register" | "/api/register/check" | "/api/resend-verification" | "/api/reset-password" | "/api/test" | "/api/verify-email" | "/(unauthorized)/forgot-password" | "/(unauthorized)/login" | "/(authorized)/profile" | "/(unauthorized)/register" | "/(unauthorized)/reset-password" | "/test" | "/test/test1" | "/ui" | "/(unauthorized)/verify-email";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/(unauthorized)": Record<string, never>;
			"/(authorized)": Record<string, never>;
			"/": Record<string, never>;
			"/(authorized": Record<string, never>;
			"/(authorized/)": Record<string, never>;
			"/(unauthorized)/about": Record<string, never>;
			"/(authorized)/admin": Record<string, never>;
			"/(authorized)/admin/brands": Record<string, never>;
			"/(authorized)/admin/categories": Record<string, never>;
			"/(authorized)/admin/products": Record<string, never>;
			"/(authorized)/admin/variants": Record<string, never>;
			"/api": Record<string, never>;
			"/api/admin": Record<string, never>;
			"/api/admin/brands": Record<string, never>;
			"/api/admin/brands/create": Record<string, never>;
			"/api/admin/brands/delete": Record<string, never>;
			"/api/admin/brands/detail": Record<string, never>;
			"/api/admin/brands/list": Record<string, never>;
			"/api/admin/brands/update": Record<string, never>;
			"/api/admin/categories": Record<string, never>;
			"/api/admin/categories/create": Record<string, never>;
			"/api/admin/categories/delete": Record<string, never>;
			"/api/admin/categories/detail": Record<string, never>;
			"/api/admin/categories/list": Record<string, never>;
			"/api/admin/categories/update": Record<string, never>;
			"/api/admin/inventory": Record<string, never>;
			"/api/admin/inventory/branches": Record<string, never>;
			"/api/admin/inventory/lots": Record<string, never>;
			"/api/admin/inventory/lots/create": Record<string, never>;
			"/api/admin/inventory/lots/list": Record<string, never>;
			"/api/admin/inventory/stock": Record<string, never>;
			"/api/admin/inventory/stock/adjust": Record<string, never>;
			"/api/admin/inventory/stock/get": Record<string, never>;
			"/api/admin/inventory/stock/list": Record<string, never>;
			"/api/admin/products": Record<string, never>;
			"/api/admin/products/create": Record<string, never>;
			"/api/admin/products/delete": Record<string, never>;
			"/api/admin/products/detail": Record<string, never>;
			"/api/admin/products/list": Record<string, never>;
			"/api/admin/products/update": Record<string, never>;
			"/api/admin/roles": Record<string, never>;
			"/api/admin/users": Record<string, never>;
			"/api/admin/users/create": Record<string, never>;
			"/api/admin/users/delete": Record<string, never>;
			"/api/admin/users/detail": Record<string, never>;
			"/api/admin/users/list": Record<string, never>;
			"/api/admin/users/reset-password": Record<string, never>;
			"/api/admin/users/restore": Record<string, never>;
			"/api/admin/users/set-role": Record<string, never>;
			"/api/admin/users/set-status": Record<string, never>;
			"/api/admin/users/update": Record<string, never>;
			"/api/admin/variants": Record<string, never>;
			"/api/admin/variants/create": Record<string, never>;
			"/api/admin/variants/delete": Record<string, never>;
			"/api/admin/variants/detail": Record<string, never>;
			"/api/admin/variants/list": Record<string, never>;
			"/api/admin/variants/update": Record<string, never>;
			"/api/auth": Record<string, never>;
			"/api/auth/refresh": Record<string, never>;
			"/api/dev-emails": Record<string, never>;
			"/api/encryption": Record<string, never>;
			"/api/encryption/public-key": Record<string, never>;
			"/api/forgot-password": Record<string, never>;
			"/api/health": Record<string, never>;
			"/api/login": Record<string, never>;
			"/api/register": Record<string, never>;
			"/api/register/check": Record<string, never>;
			"/api/resend-verification": Record<string, never>;
			"/api/reset-password": Record<string, never>;
			"/api/test": Record<string, never>;
			"/api/verify-email": Record<string, never>;
			"/(unauthorized)/forgot-password": Record<string, never>;
			"/(unauthorized)/login": Record<string, never>;
			"/(authorized)/profile": Record<string, never>;
			"/(unauthorized)/register": Record<string, never>;
			"/(unauthorized)/reset-password": Record<string, never>;
			"/test": Record<string, never>;
			"/test/test1": Record<string, never>;
			"/ui": Record<string, never>;
			"/(unauthorized)/verify-email": Record<string, never>
		};
		Pathname(): "/" | "/about" | "/admin" | "/admin/brands" | "/admin/categories" | "/admin/products" | "/admin/variants" | "/api/admin/brands/create" | "/api/admin/brands/delete" | "/api/admin/brands/detail" | "/api/admin/brands/list" | "/api/admin/brands/update" | "/api/admin/categories/create" | "/api/admin/categories/delete" | "/api/admin/categories/detail" | "/api/admin/categories/list" | "/api/admin/categories/update" | "/api/admin/inventory/branches" | "/api/admin/inventory/lots/create" | "/api/admin/inventory/lots/list" | "/api/admin/inventory/stock/adjust" | "/api/admin/inventory/stock/get" | "/api/admin/inventory/stock/list" | "/api/admin/products/create" | "/api/admin/products/delete" | "/api/admin/products/detail" | "/api/admin/products/list" | "/api/admin/products/update" | "/api/admin/roles" | "/api/admin/users/create" | "/api/admin/users/delete" | "/api/admin/users/detail" | "/api/admin/users/list" | "/api/admin/users/reset-password" | "/api/admin/users/restore" | "/api/admin/users/set-role" | "/api/admin/users/set-status" | "/api/admin/users/update" | "/api/admin/variants/create" | "/api/admin/variants/delete" | "/api/admin/variants/detail" | "/api/admin/variants/list" | "/api/admin/variants/update" | "/api/auth/refresh" | "/api/dev-emails" | "/api/encryption/public-key" | "/api/forgot-password" | "/api/health" | "/api/login" | "/api/register" | "/api/register/check" | "/api/resend-verification" | "/api/reset-password" | "/api/test" | "/api/verify-email" | "/forgot-password" | "/login" | "/profile" | "/register" | "/reset-password" | "/test" | "/test/test1" | "/ui" | "/verify-email";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/robots.txt" | string & {};
	}
}