//$lib/server/cloudflare-workers-stub.ts

/**
 * Stub scheme "cloudflare:workers" cho vitest (node environment).
 *
 * PartyServer (package chính thức của Cloudflare thay thế partykit/server) khai
 * báo `import { DurableObject } from 'cloudflare:workers'` — module này chỉ tồn
 * tại trong workerd runtime (wrangler dev / production Workers). Khi vitest chạy
 * unit test import partykit/src/server.ts (class Main extends Server extends
 * DurableObject), node ESM loader từ chối scheme 'cloudflare:' → alias resolve
 * về file này.
 *
 * Trong workerd, DurableObject constructor lưu state vào this.ctx và env vào
 * this.env (partyserver/dist/index.js:786 getter `name` đọc this.ctx.id.name).
 * Stub MIRROR hành vi đó — nếu không, mọi getter kế thừa (name, storage, env)
 * đọc this.ctx undefined → "TypeError: Cannot read properties of undefined
 * (reading 'id')". Tests vẫn inject DurableObjectState giả lập qua constructor.
 */

export class DurableObject {
	// biome-ignore lint: mirror workerd runtime — ctx/env phải nằm trên instance
	constructor(state: unknown, env: unknown) {
		// @ts-expect-error mirror workerd runtime property layout
		this.ctx = state;
		// @ts-expect-error mirror workerd runtime property layout
		this.env = env;
	}
}
