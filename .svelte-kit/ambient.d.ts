
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const username_owner: string;
	export const password_owner: string;
	export const email_owner: string;
	export const webauthn_rp_id: string;
	export const webauthn_rp_name: string;
	export const webauthn_origin: string;
	export const cb_connection: string;
	export const cb_clusterIdManagement: string;
	export const cb_clusterId: string;
	export const cb_bucketId: string;
	export const cb_username: string;
	export const cb_password: string;
	export const cb_api_key_secret: string;
	export const cb_bucketName: string;
	export const cb_scopeName: string;
	export const cb_organizationId: string;
	export const cb_projectId: string;
	export const cb_connection_vault: string;
	export const cb_clusterId_vault: string;
	export const cb_clusterIdManagement_vault: string;
	export const cb_username_vault: string;
	export const cb_password_vault: string;
	export const cb_api_key_secret_vault: string;
	export const cb_bucketName_vault: string;
	export const cb_scopeName_vault: string;
	export const cb_collectionName_vault: string;
	export const cb_document_id_rsa_key_vault: string;
	export const cb_document_id_index_key_vault: string;
	export const vault_password: string;
	export const cb_organizationId_vault: string;
	export const cb_projectId_vault: string;
	export const CLOUDFLARE_ACCOUNT_ID: string;
	export const CLOUDFLARE_API_TOKEN: string;
	export const PARTYKIT_INTERNAL_TOKEN: string;
	export const PARTYKIT_PUSH_URL: string;
	export const PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS: string;
	export const INVOCATION_ID: string;
	export const NODE_ENV: string;
	export const ALLUSERSPROFILE: string;
	export const AI_AGENT: string;
	export const ANTHROPIC_AUTH_TOKEN: string;
	export const CLAUDE_CODE_AGENT: string;
	export const ANTHROPIC_BASE_URL: string;
	export const INIT_CWD: string;
	export const CLAUDECODE: string;
	export const ANTHROPIC_DEFAULT_FABLE_MODEL: string;
	export const ANTHROPIC_DEFAULT_HAIKU_MODEL: string;
	export const ANTHROPIC_DEFAULT_SONNET_MODEL: string;
	export const LOGONSERVER: string;
	export const COMMONPROGRAMFILES: string;
	export const SVELTEKIT_FORK: string;
	export const ANTHROPIC_DEFAULT_OPUS_MODEL: string;
	export const CLAUDE_CODE_EXECPATH: string;
	export const APPDATA: string;
	export const CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT: string;
	export const CLAUDE_CODE_CHILD_SESSION: string;
	export const CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN: string;
	export const CLAUDE_CODE_ENTRYPOINT: string;
	export const CLAUDE_CODE_SESSION_ID: string;
	export const CLAUDE_CODE_MESSAGING_SOCKET: string;
	export const npm_config_engine_strict: string;
	export const CLAUDE_CODE_MESSAGING_TOKEN: string;
	export const CLAUDE_CODE_SESSION_ATTENDED: string;
	export const CLAUDE_EFFORT: string;
	export const CLAUDE_JOB_DIR: string;
	export const HOMEPATH: string;
	export const CLAUDE_PID: string;
	export const COLOR: string;
	export const EDITOR: string;
	export const npm_config_local_prefix: string;
	export const CommonProgramW6432: string;
	export const COLORTERM: string;
	export const npm_config_userconfig: string;
	export const COMPUTERNAME: string;
	export const COMSPEC: string;
	export const COREPACK_ENABLE_AUTO_PIN: string;
	export const DriverData: string;
	export const EXEPATH: string;
	export const FORCE_COLOR: string;
	export const GIT_EDITOR: string;
	export const npm_config_global_prefix: string;
	export const HOME: string;
	export const HOMEDRIVE: string;
	export const npm_config_noproxy: string;
	export const IMPECCABLE_SESSION_ID: string;
	export const LOCALAPPDATA: string;
	export const MSYSTEM: string;
	export const NODE: string;
	export const NoDefaultCurrentDirectoryInExePath: string;
	export const npm_command: string;
	export const npm_config_npm_version: string;
	export const npm_config_allow_scripts: string;
	export const npm_config_cache: string;
	export const npm_config_globalconfig: string;
	export const npm_execpath: string;
	export const npm_config_node_gyp: string;
	export const npm_config_init_module: string;
	export const npm_config_prefix: string;
	export const npm_config_user_agent: string;
	export const npm_lifecycle_event: string;
	export const npm_lifecycle_script: string;
	export const npm_node_execpath: string;
	export const WINDIR: string;
	export const npm_package_json: string;
	export const npm_package_name: string;
	export const npm_package_version: string;
	export const NUMBER_OF_PROCESSORS: string;
	export const OLDPWD: string;
	export const OneDrive: string;
	export const OS: string;
	export const PATH: string;
	export const PATHEXT: string;
	export const PLINK_PROTOCOL: string;
	export const PNPM_HOME: string;
	export const PROCESSOR_ARCHITECTURE: string;
	export const PROCESSOR_IDENTIFIER: string;
	export const PROCESSOR_LEVEL: string;
	export const PROCESSOR_REVISION: string;
	export const ProgramData: string;
	export const PROGRAMFILES: string;
	export const TERM: string;
	export const ProgramW6432: string;
	export const PROMPT: string;
	export const PSModulePath: string;
	export const PUBLIC: string;
	export const PWD: string;
	export const SESSIONNAME: string;
	export const SHELL: string;
	export const SHLVL: string;
	export const SYSTEMDRIVE: string;
	export const SYSTEMROOT: string;
	export const TEMP: string;
	export const TMP: string;
	export const USERDOMAIN: string;
	export const USERDOMAIN_ROAMINGPROFILE: string;
	export const USERNAME: string;
	export const USERPROFILE: string;
	export const WSLENV: string;
	export const WT_PROFILE_ID: string;
	export const _: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	export const PUBLIC_PARTYKIT_HOST: string;
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		username_owner: string;
		password_owner: string;
		email_owner: string;
		webauthn_rp_id: string;
		webauthn_rp_name: string;
		webauthn_origin: string;
		cb_connection: string;
		cb_clusterIdManagement: string;
		cb_clusterId: string;
		cb_bucketId: string;
		cb_username: string;
		cb_password: string;
		cb_api_key_secret: string;
		cb_bucketName: string;
		cb_scopeName: string;
		cb_organizationId: string;
		cb_projectId: string;
		cb_connection_vault: string;
		cb_clusterId_vault: string;
		cb_clusterIdManagement_vault: string;
		cb_username_vault: string;
		cb_password_vault: string;
		cb_api_key_secret_vault: string;
		cb_bucketName_vault: string;
		cb_scopeName_vault: string;
		cb_collectionName_vault: string;
		cb_document_id_rsa_key_vault: string;
		cb_document_id_index_key_vault: string;
		vault_password: string;
		cb_organizationId_vault: string;
		cb_projectId_vault: string;
		CLOUDFLARE_ACCOUNT_ID: string;
		CLOUDFLARE_API_TOKEN: string;
		PARTYKIT_INTERNAL_TOKEN: string;
		PARTYKIT_PUSH_URL: string;
		PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS: string;
		INVOCATION_ID: string;
		NODE_ENV: string;
		ALLUSERSPROFILE: string;
		AI_AGENT: string;
		ANTHROPIC_AUTH_TOKEN: string;
		CLAUDE_CODE_AGENT: string;
		ANTHROPIC_BASE_URL: string;
		INIT_CWD: string;
		CLAUDECODE: string;
		ANTHROPIC_DEFAULT_FABLE_MODEL: string;
		ANTHROPIC_DEFAULT_HAIKU_MODEL: string;
		ANTHROPIC_DEFAULT_SONNET_MODEL: string;
		LOGONSERVER: string;
		COMMONPROGRAMFILES: string;
		SVELTEKIT_FORK: string;
		ANTHROPIC_DEFAULT_OPUS_MODEL: string;
		CLAUDE_CODE_EXECPATH: string;
		APPDATA: string;
		CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT: string;
		CLAUDE_CODE_CHILD_SESSION: string;
		CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN: string;
		CLAUDE_CODE_ENTRYPOINT: string;
		CLAUDE_CODE_SESSION_ID: string;
		CLAUDE_CODE_MESSAGING_SOCKET: string;
		npm_config_engine_strict: string;
		CLAUDE_CODE_MESSAGING_TOKEN: string;
		CLAUDE_CODE_SESSION_ATTENDED: string;
		CLAUDE_EFFORT: string;
		CLAUDE_JOB_DIR: string;
		HOMEPATH: string;
		CLAUDE_PID: string;
		COLOR: string;
		EDITOR: string;
		npm_config_local_prefix: string;
		CommonProgramW6432: string;
		COLORTERM: string;
		npm_config_userconfig: string;
		COMPUTERNAME: string;
		COMSPEC: string;
		COREPACK_ENABLE_AUTO_PIN: string;
		DriverData: string;
		EXEPATH: string;
		FORCE_COLOR: string;
		GIT_EDITOR: string;
		npm_config_global_prefix: string;
		HOME: string;
		HOMEDRIVE: string;
		npm_config_noproxy: string;
		IMPECCABLE_SESSION_ID: string;
		LOCALAPPDATA: string;
		MSYSTEM: string;
		NODE: string;
		NoDefaultCurrentDirectoryInExePath: string;
		npm_command: string;
		npm_config_npm_version: string;
		npm_config_allow_scripts: string;
		npm_config_cache: string;
		npm_config_globalconfig: string;
		npm_execpath: string;
		npm_config_node_gyp: string;
		npm_config_init_module: string;
		npm_config_prefix: string;
		npm_config_user_agent: string;
		npm_lifecycle_event: string;
		npm_lifecycle_script: string;
		npm_node_execpath: string;
		WINDIR: string;
		npm_package_json: string;
		npm_package_name: string;
		npm_package_version: string;
		NUMBER_OF_PROCESSORS: string;
		OLDPWD: string;
		OneDrive: string;
		OS: string;
		PATH: string;
		PATHEXT: string;
		PLINK_PROTOCOL: string;
		PNPM_HOME: string;
		PROCESSOR_ARCHITECTURE: string;
		PROCESSOR_IDENTIFIER: string;
		PROCESSOR_LEVEL: string;
		PROCESSOR_REVISION: string;
		ProgramData: string;
		PROGRAMFILES: string;
		TERM: string;
		ProgramW6432: string;
		PROMPT: string;
		PSModulePath: string;
		PUBLIC: string;
		PWD: string;
		SESSIONNAME: string;
		SHELL: string;
		SHLVL: string;
		SYSTEMDRIVE: string;
		SYSTEMROOT: string;
		TEMP: string;
		TMP: string;
		USERDOMAIN: string;
		USERDOMAIN_ROAMINGPROFILE: string;
		USERNAME: string;
		USERPROFILE: string;
		WSLENV: string;
		WT_PROFILE_ID: string;
		_: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		PUBLIC_PARTYKIT_HOST: string;
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
