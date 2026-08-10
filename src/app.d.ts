// See https://svelte.dev/docs/kit/types#app.d.ts

import type { MetaUser } from '$interfaces/basic';

// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user: MetaUser | undefined;
		}
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
