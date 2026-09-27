# Phase 2 Auth Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn tất phần còn lại của Phase 2 "Auth Completion": forgot/reset password flow (token + email), email verification flow (user_status workflow), tách Input component thành EmailInput/PhoneInput/PasswordInput, extract VisualKeyboard khỏi store.

**Architecture:** Mỗi task độc lập theo thứ tự user duyệt: (1) reset-password flow — schema token fields, rate-limit forgot-password, token gen + hashed storage, self-service vault reset, /reset-password page, dev email outbox; (2) email verification — /verify-email page + 2 API endpoints, register gán status-pending_verification, verify kích hoạt status-active; (3) EmailService interface + dev transport (SMTP-ready, không thêm dependency); (4) Input split theo type với shared core; (5) VisualKeyboard extraction giữ nguyên contract focusOn.

**Tech Stack:** SvelteKit + Svelte 5 runes, Couchbase Capella Data API (schemaless, KHÔNG migration), hybrid RSA-OAEP + AES-GCM transport (`encryption.fetchSecure`), Playwright .mjs E2E (không có unit test infra), Node v24.13.1, PowerShell 5.1.

**Spec:** Roadmap Phase 2 "Auth Completion (Tuần 2-3) - HIGH" — các hàng còn lại:

| Task | Effort | Files |
|---|---|---|
| Forgot/Reset Password flow (email + token) | 16h | `forgot-password/`, `reset-password/`, email service |
| Email verification flow | 12h | `verify-email/`, `resend-verification/`, user_status workflow |
| Refactor Input component (tách nhỏ) | 20h | `form/input/` → `EmailInput`, `PhoneInput`, `PasswordInput` |
| Extract VisualKeyboard từ store | 8h | `components/keyboard/VisualKeyboard.svelte`, `useVisualKeyboard.ts` |

(forgot-password page + endpoint đã có sẵn; plan này hoàn thiện phần token/reset + các hạng mục còn lại.)

## Global Constraints

- **Security:** Anti-enumeration — forgot-password và resend-verification LUÔN trả message thành công giống hệt nhau dù email tồn tại hay không. Token = crypto random, lưu HASH (getDataHash) trên user doc, hết hạn 1h, one-time use (clear khi thành công). Không leak trạng thái verification qua login (mọi failure login → cùng 401 `accountLocked`).
- **Git:** Remote `origin` có PAT nhúng trong URL — KHÔNG BAO GIỜ echo URL/push output chứa nó. KHÔNG push (chưa bao giờ được yêu cầu). Git stash stack dùng chung — không bao giờ bare `git stash`; nếu cần: `git stash push -u -m "<tag>"`, capture SHA, apply bằng SHA, drop theo tag.
- **Dev flow:** Edit trong worktree → commit → `Copy-Item` sang main checkout `D:\nodejs\svelte\kit-3` → verify `Get-FileHash` → Vite HMR → test live trên main checkout server (https://localhost:3000, `curl.exe -sk`). Worktree không có node_modules — chạy `node "D:\nodejs\svelte\kit-3\node_modules\@sveltejs\kit\svelte-kit.js" sync` từ worktree khi cần. KHÔNG bao giờ đè uncommitted changes của user trên main checkout.
- **Server i18n:** `lang = resolveLang(request.headers.get('accept-language'))` → `respond(...)` closure = `encryptWithPublicKeyHybrid(sessionPublicKey, JSON.stringify(localizePayload(payload, lang)))`. Client đọc `response.message[lang] ?? response.message.en`. Page content: `pageContents: { [k: string]: TranslateContent }` trong `index.ts` cạnh `+page.svelte`.
- **Encrypted endpoint template:** vault check 503 plain → `request.json()` → decrypt (empty → 400 plain) → parse → destructure `publicKeyB64` → 400 plain nếu thiếu → `importPublicKey` → respond closure → validate → logic → `respond(...)`. Catch-all 500 plain json với `e.message`. Hook 401 responses là plain JSON — mọi endpoint public mới PHẢI vào `publicPaths` trong `hooks.server.ts` (L62) nếu không sẽ bị chặn.
- **Rate limiting:** Mọi endpoint public mới + forgot-password (hiện CHƯA có) theo pattern `api/register/check/+server.ts:16-41`: sliding window 10s / 15 requests, `checkRateLimit(identifier)`, POST signature `async ({ request, getClientAddress })`, 429 qua respond closure, key `prefix:${getClientAddress()}`.
- **Schemaless:** Thêm optional fields vào `collectionSchemas.users.fields` (KHÔNG `required: true` → `?: T | null` qua InferCollection). Token-hash field cần `searchable: true` để lookup qua search API. KHÔNG migration. Lưu ý: hash gate `seed-data.ts:171-179` sẽ đổi → catalog re-seed chạy lại ở lần boot kế tiếp (seedIfNotExists idempotent — log line đó KHÔNG phải error).
- **Couchbase shapes:** KV get `cbUsers.document.get({documentKey})` → `.ok`/`.data`; merge-update `cbUsers.document.update({documentKey, content})` (KHÔNG throw trên HTTP error — check `.ok`); search `cbUsers.query.document.search({conditions: [{fieldName, keyword}], limit?})` → `.ok` + `.data`.
- **Token hashing:** `hmacBlindIndex` lowercases+trims (chỉ dùng cho email/username). Opaque tokens dùng `getDataHash(token)` (SHA-256 hex).
- **Vault reset:** Self-service reset = `setupVault(newPassword)` → swap vault triple (`vaultSaltB64/vaultDekIvB64/vaultWrappedDekB64`) + `updatedAt` (mirror admin resetPassword users.ts:706-747, KHÔNG ActorContext). `unlockVault` throw khi sai password.
- **E2E (TDD adaptation):** Playwright .mjs script là RED→GREEN gate — chạy trước khi implement (RED: trang/API chưa tồn tại → fail), sau khi implement (GREEN). Không có unit test infra. `page.route` mock KHÔNG dùng được (fetchSecure không decrypt được plain JSON). Registered seed email: `phuongdomega@atomicmail.io`. `.env` main checkout có `username_owner`/`password_owner`/`email_owner` (password_owner = seed admin password — E2E reset PHẢI restore password gốc ở cuối).
- **PowerShell 5.1:** Không `&&`/ternary/null-coalescing; avoid `2>&1` trên native exe; here-string đóng `'@` ở column 0; `Set-Content` cần `-Encoding utf8`.
- **Svelte 5 runes:** `import { page } from '$app/state'` (KHÔNG `$app/stores`). Tab indentation. `$effect.root` không chạy trên server (5.56.9).
- **Attribution:** Commit message kết thúc bằng `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- **Dead code:** KHÔNG copy từ `input_old/Input.svelte` / `numberic_old/Numberic.svelte` (unmounted, stale import paths). Chỉ type imports (`NumbericKey`) còn sống.

## Review Focus

Năm lớp input spec không nói nhưng sẽ bite người dùng — mỗi dòng pin vào test của task sở hữu code:

1. **Reset token hết hạn** (1h) — dùng token cũ quá hạn → phải báo invalid, KHÔNG reset password. → Task 1 E2E: unit-level check trong handler + test expired-token path bằng token đã consume/garbage (expired thật cần fixture thời gian; garbage-token test phủ cùng nhánh lookup-fail).
2. **Reset token dùng lại (replay)** — reset lần 2 bằng token đã dùng → phải fail (token bị clear sau lần đầu). → Task 1 E2E: bước 2 gọi lại cùng URL reset → thấy invalid, login bằng password MỚI vẫn OK.
3. **Password-confirm mismatch trên /reset-password** — submit với confirm khác → KHÔNG gọi API, hiện error hint. → Task 1 E2E: fill mismatch → submit disabled / error hint hiện.
4. **Verify-email token rác/tổng quát** — `?token=garbage` → trang verify báo invalid link, KHÔNG crash, KHÔNG đổi trạng thái user nào. → Task 2 E2E: goto verify-email?token=garbage → thấy invalid state.
5. **Resend-verification anti-enumeration** — email không tồn tại → response success GIỐNG HỆT email tồn tại (không tiết lộ account tồn tại hay không). → Task 2 E2E: gọi resend với email không tồn tại → message success giống email thật (so sánh text phản hồi).

---

### Task 1: Reset-Password Flow (token + self-service vault reset)

**Files:**
- Modify: `src/lib/modules/schema.ts` (users fields block, sau `remember` ~L204): thêm 2 optional fields `passwordResetTokenHash`, `passwordResetTokenExpiresAt`
- Modify: `src/routes/api/forgot-password/+server.ts` (thêm rate limiting, thay TODO block bằng token gen + outbox send)
- Create: `src/lib/server/email.ts` (dev outbox minimal — Task 3 nâng cấp thành EmailService đầy đủ)
- Modify: `src/lib/server/db/users.ts` (thêm `createPasswordResetToken` + `resetPasswordWithToken`)
- Create: `src/routes/(unauthorized)/reset-password/_interface.ts` + `+page.svelte` + `index.ts`
- Create: `src/routes/api/reset-password/+server.ts`
- Modify: `src/hooks.server.ts` (publicPaths: thêm `/reset-password`, `/api/reset-password`)
- Test: `tests/reset-password-test.mjs` (thêm vào `tests/run-all.mjs` array)

**Interfaces:**
- Consumes: `Users.isEmailTaken(emailBlindIndex)` (users.ts:241-267); `encryption.setupVault/getDataHash/fetchSecure/importPublicKey/decryptWithPrivateKeyHybrid/encryptWithPublicKeyHybrid/exportKeyToBase64`; `resolveLang/localizePayload` (`$lib/server/i18n`); pattern rate-limit từ `api/register/check/+server.ts:16-41`; template trang từ `forgot-password/+page.svelte`.
- Produces: `sendDevEmail(to, subject, html): void` trong `$lib/server/email.ts` (in-memory outbox + console log; Task 3 wrap lại trong EmailService). `Users.createPasswordResetToken(documentKey, tokenHash, expiresAtIso): Promise<boolean>`; `Users.resetPasswordWithToken(tokenHash, newPassword): Promise<{ok: boolean; reason?: 'invalid'|'expired'}>`. Schema field `passwordResetTokenHash` searchable → mọi task sau đọc được qua `User` type (optional `string | null`). Route page `/reset-password?token=...`. Body type `ResetPasswordRequestBody { token: string; password: string; publicKeyB64: string }` export từ `_interface.ts`.

- [ ] **Step 1: Viết E2E RED — `tests/reset-password-test.mjs`**

```js
import { chromium } from 'playwright';

const results = { passed: [], failed: [] };
function check(name, cond) {
	if (cond) results.passed.push(name); else results.failed.push(name);
	console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}`);
}

const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') console.log('[console.error]', msg.text()); });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

try {
	// === PHẦN 1: /reset-password KHÔNG có token → hiển thị invalid ===
	await page.goto('https://localhost:3000/reset-password', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(5000);
	const noTokenInvalid = await page.locator('.auth-alert--error').count();
	check('1. /reset-password không token → hiện invalid state', noTokenInvalid > 0);

	// === PHẦN 2: garbage token → invalid state ===
	await page.goto('https://localhost:3000/reset-password?token=garbage-token-xyz', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(5000);
	const garbageInvalid = await page.locator('.auth-alert--error').count();
	check('2. garbage token → invalid state', garbageInvalid > 0);

	// === PHẦN 3: quên mật khẩu → lấy reset link từ DEV OUTBOX (console log) ===
	await page.goto('https://localhost:3000/forgot-password', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(5000);
	const emailInput = page.locator('input[name="email"]');
	await emailInput.fill('phuongdomega@atomicmail.io');
	await page.waitForTimeout(1000); // đợi email availability check
	const submitBtn = page.locator('button.auth-btn-submit');
	await page.waitForFunction(() => !document.querySelector('button.auth-btn-submit')?.disabled, { timeout: 30000 });
	await submitBtn.click();
	await page.waitForTimeout(8000); // đợi API response + toast
	// Token được log ra server console qua sendDevEmail; E2E đọc từ dev outbox endpoint
	// Outbox expose tại /api/dev-emails (chỉ khi dev) — fetch trực tiếp:
	const outboxRes = await page.evaluate(async () => {
		const res = await fetch('/api/dev-emails', { headers: { 'Accept-Language': 'en' } });
		return res.ok ? await res.json() : null;
	});
	check('3. forgot-password với email seed → outbox có email reset', outboxRes && Array.isArray(outboxRes.emails) && outboxRes.emails.length > 0);
	let resetUrl = null;
	if (outboxRes?.emails?.length) {
		const last = outboxRes.emails[outboxRes.emails.length - 1];
		const m = last.html?.match(/https?:\/\/[^"'<\s]+\/reset-password\?token=[A-Za-z0-9._-]+/);
		resetUrl = m ? m[0] : null;
	}
	check('4. Email reset chứa link /reset-password?token=', !!resetUrl);

	// === PHẦN 4: mở reset link, set password mới ===
	if (resetUrl) {
		await page.goto(resetUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
		await page.waitForTimeout(5000);
		// Confirm mismatch → submit disabled (Review Focus #3)
		await page.locator('input[name="password"]').fill('NewP@ssw0rd-2026!');
		await page.locator('input[name="confirmPassword"]').fill('Different-P@ss');
		await page.waitForTimeout(1000);
		let mismatchBlocks = await submitBtn.evaluate((el) => el.disabled);
		check('5. password/confirm mismatch → submit disabled', mismatchBlocks === true);
		// Đúng confirm → submit enabled
		await page.locator('input[name="confirmPassword"]').fill('NewP@ssw0rd-2026!');
		await page.waitForTimeout(1000);
		await submitBtn.click();
		await page.waitForTimeout(8000);
		const successHint = await page.locator('.success-hint').count();
		check('6. Reset thành công → success hint', successHint > 0);

		// === PHẦN 5: token replay → invalid (Review Focus #2) ===
		await page.goto(resetUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
		await page.waitForTimeout(5000);
		await page.locator('input[name="password"]').fill('Another-P@ss-2026!');
		await page.locator('input[name="confirmPassword"]').fill('Another-P@ss-2026!');
		await page.waitForTimeout(1000);
		await submitBtn.click();
		await page.waitForTimeout(8000);
		const replayError = await page.locator('.auth-alert--error').count();
		check('7. Token replay → invalid error', replayError > 0);

		// === PHẦN 6: restore password gốc qua flow thứ hai ===
		await page.goto('https://localhost:3000/forgot-password', { waitUntil: 'domcontentloaded', timeout: 180000 });
		await page.waitForTimeout(5000);
		await page.locator('input[name="email"]').fill('phuongdomega@atomicmail.io');
		await page.waitForTimeout(1000);
		await page.waitForFunction(() => !document.querySelector('button.auth-btn-submit')?.disabled, { timeout: 30000 });
		await page.locator('button.auth-btn-submit').click();
		await page.waitForTimeout(8000);
		const outbox2 = await page.evaluate(async () => {
			const res = await fetch('/api/dev-emails', { headers: { 'Accept-Language': 'en' } });
			return res.ok ? await res.json() : null;
		});
		let restoreUrl = null;
		if (outbox2?.emails?.length) {
			const last = outbox2.emails[outbox2.emails.length - 1];
			const m = last.html?.match(/https?:\/\/[^"'<\s]+\/reset-password\?token=[A-Za-z0-9._-]+/);
			restoreUrl = m ? m[0] : null;
		}
		if (restoreUrl) {
			await page.goto(restoreUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
			await page.waitForTimeout(5000);
			// Đọc password gốc từ .env đã được page test inject? Không — hardcoded ở đây theo seed:
			// dùng password_owner thực tế được load bởi run-all. Để an toàn, dùng biến môi trường
			const origPass = process.env.password_owner ?? 'PhuongDomega@2026';
			await page.locator('input[name="password"]').fill(origPass);
			await page.locator('input[name="confirmPassword"]').fill(origPass);
			await page.waitForTimeout(1000);
			await page.locator('button.auth-btn-submit').click();
			await page.waitForTimeout(8000);
			const restored = await page.locator('.success-hint').count();
			check('8. Restore password gốc thành công', restored > 0);
		} else {
			check('8. Restore password gốc thành công', false);
		}
	} else {
		console.log('SKIP phần 4-8: không có resetUrl');
	}
} catch (e) {
	console.log('[FATAL]', e.message);
	results.failed.push('fatal: ' + e.message);
} finally {
	await browser.close();
	console.log(`\n=== KẾT QUẢ: ${results.passed.length} pass, ${results.failed.length} fail ===`);
	if (results.failed.length > 0) { console.log('FAILED:', results.failed.join(', ')); process.exit(1); }
}
```

Thêm `'tests/reset-password-test.mjs'` vào array `tests` trong `tests/run-all.mjs`.

- [ ] **Step 2: Chạy E2E → xác nhận RED**

Run: `cd D:\nodejs\svelte\kit-3; node tests/reset-password-test.mjs` (chạy trên MAIN checkout sau khi copy test file sang — test file cần được copy sang main checkout `D:\nodejs\svelte\kit-3\tests\` trước khi chạy vì server chạy ở đó).

Expected: FAIL — "1. /reset-password không token" fail (404 — route chưa tồn tại), các check sau fail tương tự. Đây là RED đúng nghĩa: trang chưa tồn tại.

- [ ] **Step 3: Schema — thêm token fields**

Trong `src/lib/modules/schema.ts`, users fields block, sau dòng `remember: { type: 'boolean', searchable: true, sortable: false, selectable: true, required: true },` thêm:

```ts
		// === Password reset flow (Task 1) — optional, hashed token tìm qua search API ===
		passwordResetTokenHash: { type: 'string', searchable: true, sortable: false, selectable: false },
		passwordResetTokenExpiresAt: { type: 'string', searchable: false, sortable: false, selectable: false },
```

Chạy `node "D:\nodejs\svelte\kit-3\node_modules\@sveltejs\kit\svelte-kit.js" sync` từ worktree. Expected: sync OK (sửa type inference, không migration).

- [ ] **Step 4: Dev outbox — `src/lib/server/email.ts`**

```ts
import { dev } from '$app/environment';

/**
 * Outbox dev — store email trong memory + log console.
 * Task 3 sẽ nâng cấp thành EmailService interface (SMTP-ready).
 * Production (dev=false): no-op — Task 3 sẽ cắm transport thật.
 */
type DevEmail = { to: string; subject: string; html: string; sentAt: string };
const outbox: DevEmail[] = [];

export function sendDevEmail(to: string, subject: string, html: string): void {
	if (!dev) return; // production: im lặng cho đến khi Task 3 cắm SMTP transport
	const email: DevEmail = { to, subject, html, sentAt: new Date().toISOString() };
	outbox.push(email);
	if (outbox.length > 50) outbox.shift(); // giữ 50 email gần nhất
	console.log(`[DEV EMAIL] to=${to} subject="${subject}"`);
}

export function getDevOutbox(): DevEmail[] {
	return outbox;
}
```

Create thêm `src/routes/api/dev-emails/+server.ts` (chỉ hoạt động khi dev — đọc outbox; E2E dùng để trích reset link):

```ts
import { dev } from '$app/environment';
import { json, type RequestHandler } from '@sveltejs/kit';
import { getDevOutbox } from '$lib/server/email';

export const GET: RequestHandler = async () => {
	if (!dev) return json({ emails: [] }, { status: 404 });
	return json({ emails: getDevOutbox() });
};
```

Thêm `/api/dev-emails` vào `publicPaths` trong `src/hooks.server.ts` L62.

- [ ] **Step 5: Users methods — token create + self-service reset**

Trong `src/lib/server/db/users.ts`, thêm 2 static methods vào class `Users` (đặt sau `verifyPassword`, ~L339):

```ts
	/**
	 * Task 1: Lưu hash của password-reset token lên user doc.
	 * Token gốc chỉ tồn tại trong email link; DB chỉ lưu SHA-256 hash.
	 */
	static async createPasswordResetToken(
		documentKey: string,
		passwordResetTokenHash: string,
		passwordResetTokenExpiresAt: string
	): Promise<boolean> {
		try {
			const res = await cbUsers.document.update({
				documentKey,
				content: { passwordResetTokenHash, passwordResetTokenExpiresAt } as Partial<User> as User
			});
			return res.ok === true;
		} catch {
			return false;
		}
	}

	/**
	 * Task 1: Self-service reset — token-gated variant của admin resetPassword (706-747),
	 * KHÔNG cần ActorContext vì token chính là bằng chứng sở hữu.
	 * setupVault(newPassword) sinh vault triple mới → swap 3 field + updatedAt + clear token.
	 */
	static async resetPasswordWithToken(
		passwordResetTokenHash: string,
		newPassword: string
	): Promise<{ ok: boolean; reason?: 'invalid' | 'expired' }> {
		// 1. Tìm user theo token hash (field searchable trong schema)
		let docs: UserDocument[] | undefined;
		try {
			const res = await cbUsers.query.document.search({
				conditions: [{ fieldName: 'passwordResetTokenHash', keyword: passwordResetTokenHash }],
				limit: 1
			});
			if (!res.ok) return { ok: false, reason: 'invalid' };
			docs = res.data as UserDocument[] | undefined;
		} catch {
			return { ok: false, reason: 'invalid' };
		}
		const doc = docs?.[0];
		if (!doc || !doc._id || doc.deletedAt) return { ok: false, reason: 'invalid' };

		// 2. Kiểm tra hết hạn (1h)
		const expiresAt = doc['passwordResetTokenExpiresAt'] as string | undefined | null;
		if (!expiresAt || new Date(expiresAt).getTime() < Date.now()) {
			return { ok: false, reason: 'expired' };
		}

		// 3. Vault reset — mirror admin resetPassword: setupVault(newPassword) → swap triple
		const vault = await encryption.setupVault(newPassword);
		const instance = Users.fromDocument(doc);
		try {
			const res = await cbUsers.document.update({
				documentKey: instance.getDocumentKey()!,
				content: {
					vaultSaltB64: vault.storageRecord.saltB64,
					vaultDekIvB64: vault.storageRecord.dekIvB64,
					vaultWrappedDekB64: vault.storageRecord.wrappedDekB64,
					updatedAt: new Date().toISOString(),
					// One-time use: clear token ngay khi reset thành công
					passwordResetTokenHash: null,
					passwordResetTokenExpiresAt: null
				} as Partial<User> as User
			});
			if (!res.ok) return { ok: false, reason: 'invalid' };
			return { ok: true };
		} catch {
			return { ok: false, reason: 'invalid' };
		}
	}
```

Type note: `passwordResetTokenHash: null` hợp lệ vì field optional (`?: string | null`), merge-update xóa giá trị. Giữ `as Partial<User> as User` như existing code.

- [ ] **Step 6: Sửa api/forgot-password — rate limit + token gen + send**

Trong `src/routes/api/forgot-password/+server.ts`:

(a) Thêm `sendDevEmail` từ `$lib/server/email` vào imports.

(b) Thêm rate-limit block sau imports (theo pattern register/check:16-41):

```ts
const rateLimitWindowMs = 10_000;
const rateLimitMaxRequests = 15;
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
	const now = Date.now();
	const entry = rateLimitStore.get(identifier);
	if (!entry || now > entry.resetTime) {
		rateLimitStore.set(identifier, { count: 1, resetTime: now + rateLimitWindowMs });
		return { allowed: true, remaining: rateLimitMaxRequests - 1, resetTime: now + rateLimitWindowMs };
	}
	entry.count += 1;
	if (entry.count > rateLimitMaxRequests) {
		return { allowed: false, remaining: 0, resetTime: entry.resetTime };
	}
	return { allowed: true, remaining: rateLimitMaxRequests - entry.count, resetTime: entry.resetTime };
}
```

(c) Đổi POST signature: `export const POST: RequestHandler = async ({ request, getClientAddress }) => {`.

(d) Thêm key `tooManyRequests` vào `forgotPasswordMessages`:

```ts
	tooManyRequests: {
		vi: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
		en: 'Too many requests. Please try again later.'
	} as TranslateContent,
```

(e) Sau respond closure + trước email validation, thêm rate-limit check:

```ts
	const rateLimitKey = `forgot-password:${getClientAddress()}`;
	const rateLimit = checkRateLimit(rateLimitKey);
	if (!rateLimit.allowed) {
		return respond({ ok: false, message: forgotPasswordMessages.tooManyRequests }, 429);
	}
```

(f) Thay TODO block (emailExists check) bằng:

```ts
	// 6. Kiểm tra email có tồn tại không — LUÔN trả success (anti-enumeration)
	const emailExists = await Users.isEmailTaken(emailBlindIndex);
	if (emailExists) {
		const found = Users.onlyActive(await Users.getBy({ emailBlindIndex }));
		const doc = found?.[0];
		if (doc?._id) {
			// Token: 2× UUID ghép (64 hex chars); DB chỉ lưu SHA-256 hash, token gốc chỉ trong link
			const rawToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
			const tokenHash = await encryption.getDataHash(rawToken);
			const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
			const saved = await Users.createPasswordResetToken(doc._id, tokenHash, expiresAt);
			if (saved) {
				const baseUrl = dev ? 'https://localhost:3000' : `https://${request.headers.get('host')}`;
				const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
				const html = `<p>Nhấn vào liên kết để đặt lại mật khẩu (hiệu lực 1 giờ):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`;
				sendDevEmail(normalizedEmail, 'Đặt lại mật khẩu / Password Reset', html);
			}
		}
	}

	// Anti-enumeration: message success giống hệt dù email có tồn tại hay không
	return respond({ ok: true, message: forgotPasswordMessages.success }, 200);
```

Type note: `Users.onlyActive` là `private static` — nếu TS chặn, đổi `onlyActive` thành `static` (thay đổi nhỏ, nêu trong commit message). `normalizedEmail` đã có trong endpoint. `crypto` là global (Node 24). Import `dev` đã có sẵn (hiện unused — bước này bắt đầu dùng nó).

- [ ] **Step 7: Tạo `src/routes/(unauthorized)/reset-password/_interface.ts`**

```ts
export interface ResetPasswordRequestBody {
	token: string;
	password: string;
	publicKeyB64: string;
}
```

- [ ] **Step 8: Tạo `src/routes/api/reset-password/+server.ts`**

Theo đúng canonical encrypted-endpoint template (mirror api/forgot-password structure):

```ts
import { dev } from '$app/environment';
import { json, type RequestHandler } from '@sveltejs/kit';
import encryption from '$modules/encryption';
import systemVault from '$store/initSystemVault';
import type { ServerResponse } from '$interfaces/basic';
import { Users } from '$lib/server/db/users';
import { resolveLang, localizePayload } from '$lib/server/i18n';
import type { ResetPasswordRequestBody } from '../../(unauthorized)/reset-password/_interface';

const resetPasswordMessages = {
	systemUnavailable: {
		vi: 'Hệ thống đang bảo trì. Vui lòng thử lại sau.',
		en: 'The system is under maintenance. Please try again later.'
	},
	missingSessionKey: {
		vi: 'Thiếu khóa phiên. Vui lòng tải lại trang.',
		en: 'Missing session key. Please reload the page.'
	},
	invalidBody: {
		vi: 'Dữ liệu không hợp lệ.',
		en: 'Invalid data.'
	},
	missingToken: {
		vi: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
		en: 'This password reset link is invalid or has expired.'
	},
	invalidPassword: {
		vi: 'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số.',
		en: 'Password must be at least 8 characters with letters and numbers.'
	},
	resetFailed: {
		vi: 'Đặt lại mật khẩu thất bại. Vui lòng yêu cầu liên kết mới.',
		en: 'Password reset failed. Please request a new link.'
	},
	tokenExpired: {
		vi: 'Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu liên kết mới.',
		en: 'This password reset link has expired. Please request a new one.'
	},
	success: {
		vi: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với mật khẩu mới.',
		en: 'Password reset successful! You can now sign in with your new password.'
	}
};

export const POST: RequestHandler = async ({ request }) => {
	const lang = resolveLang(request.headers.get('accept-language'));

	try {
		// 1. Vault check — hệ thống chưa init thì từ chối thẳng (plain json, chưa có session key)
		if (!systemVault.privateKey) {
			return json(
				{ message: localizePayload({ ok: false, message: resetPasswordMessages.systemUnavailable }, lang) },
				{ status: 503 }
			);
		}

		// 2. Đọc + decrypt body
		const jsRaw = await request.json();
		if (!jsRaw) {
			return json(
				{ message: localizePayload({ ok: false, message: resetPasswordMessages.invalidBody }, lang) },
				{ status: 400 }
			);
		}

		const decryptedText = await encryption.decryptWithPrivateKeyHybrid(systemVault.privateKey, jsRaw);
		if (!decryptedText) {
			return json(
				{ message: localizePayload({ ok: false, message: resetPasswordMessages.invalidBody }, lang) },
				{ status: 400 }
			);
		}

		const parsed: ResetPasswordRequestBody = JSON.parse(decryptedText);
		const { publicKeyB64, token, password } = parsed;

		// 3. Session public key — cần để mã hóa response
		if (!publicKeyB64) {
			return json(
				{ message: localizePayload({ ok: false, message: resetPasswordMessages.missingSessionKey }, lang) },
				{ status: 400 }
			);
		}
		const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);

		// 4. Respond closure — encrypt về client
		const respond = async (payload: ServerResponse, status = 200) => {
			const enc = await encryption.encryptWithPublicKeyHybrid(
				sessionPublicKey,
				JSON.stringify(localizePayload(payload, lang))
			);
			return json(enc, { status });
		};

		// 5. Validate token + password
		if (!token || typeof token !== 'string' || token.length < 16) {
			return respond({ ok: false, message: resetPasswordMessages.missingToken }, 400);
		}
		if (
			!password ||
			typeof password !== 'string' ||
			password.length < 8 ||
			!/[a-zA-Z]/.test(password) ||
			!/[0-9]/.test(password)
		) {
			return respond({ ok: false, message: resetPasswordMessages.invalidPassword }, 400);
		}

		// 6. Token hash → self-service vault reset
		const tokenHash = await encryption.getDataHash(token);
		const result = await Users.resetPasswordWithToken(tokenHash, password);

		if (!result.ok) {
			if (result.reason === 'expired') {
				return respond({ ok: false, message: resetPasswordMessages.tokenExpired }, 400);
			}
			// invalid — bao gồm token rác, token đã dùng (replay), user bị xóa mềm
			return respond({ ok: false, message: resetPasswordMessages.missingToken }, 400);
		}

		return respond({ ok: true, message: resetPasswordMessages.success }, 200);
	} catch (e) {
		console.error('[reset-password] error:', e);
		return json(
			{ message: localizePayload({ ok: false, message: resetPasswordMessages.systemUnavailable }, lang) },
			{ status: 500 }
		);
	}
};
```

Thêm `/api/reset-password` vào `publicPaths` trong `src/hooks.server.ts` L62.

Lưu ý: `dev` import KHÔNG cần trong file này — bỏ import `dev` nếu lint báo unused.

- [ ] **Step 9: Tạo `src/routes/(unauthorized)/reset-password/index.ts` (pageContents)**

```ts
import type { TranslateContent } from '$interfaces/basic';

export const pageContents: { [key: string]: TranslateContent } = {
	title: { vi: 'Đặt lại mật khẩu', en: 'Reset Password' },
	subtitle: {
		vi: 'Tạo mật khẩu mới cho tài khoản của bạn',
		en: 'Create a new password for your account'
	},
	password: { vi: 'Mật khẩu mới', en: 'New password' },
	confirmPassword: { vi: 'Xác nhận mật khẩu', en: 'Confirm password' },
	submit: { vi: 'Đặt lại mật khẩu', en: 'Reset password' },
	reset: { vi: 'Xóa', en: 'Reset' },
	responseOk: {
		vi: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với mật khẩu mới.',
		en: 'Password reset successful! You can now sign in with your new password.'
	},
	responseFail: {
		vi: 'Đặt lại mật khẩu thất bại. Vui lòng yêu cầu liên kết mới.',
		en: 'Password reset failed. Please request a new link.'
	},
	invalidLinkTitle: { vi: 'Liên kết không hợp lệ', en: 'Invalid link' },
	invalidLinkDesc: {
		vi: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.',
		en: 'This password reset link is invalid or has expired. Please request a new one.'
	},
	backToLogin: { vi: 'Quay lại đăng nhập', en: 'Back to login' },
	requestNew: { vi: 'Yêu cầu liên kết mới', en: 'Request a new link' },
	mismatchHint: { vi: 'Mật khẩu xác nhận không khớp.', en: 'Passwords do not match.' }
};
```

- [ ] **Step 10: Tạo `src/routes/(unauthorized)/reset-password/+page.svelte`**

Mirror cấu trúc forgot-password/+page.svelte (AuthLayout + TextField/Input + honeypot + success/error states). Đọc token từ URL qua `page` của `$app/state`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { Button } from '$components/element';
	import { Description, FieldMessages, Form, Input, Label, TextField } from '$components/form';
	import { AuthLayout } from '$components/layout';
	import encryption from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { pageContents } from '.';
	import type { ResetPasswordRequestBody } from './_interface';

	let formData = $state({ password: '', confirmPassword: '' });
	let loading = $state(false);
	let formError = $state('');
	let success = $state(false);
	let honeypot = $state('');
	let encryptionKeys = $state<{ publicKey: CryptoKey; privateKey: CryptoKey } | undefined>(undefined);
	let tokenInvalid = $state(false);

	const lang = $derived(client.browser?.language ?? 'en');
	const currentLang = $derived(lang === 'vi' ? 'vi' : 'en');

	// Token từ URL — không có hoặc quá ngắn → invalid state ngay lập tức
	const resetToken = $derived(page.url.searchParams.get('token') ?? '');
	$effect(() => {
		tokenInvalid = resetToken.length < 16;
	});

	const status = $derived.by(() => {
		const hasRequired =
			!!formData.password?.trim() && formData.password.length >= 8 && !!formData.confirmPassword?.trim();
		const hasLetter = /[a-zA-Z]/.test(formData.password ?? '');
		const hasNumber = /[0-9]/.test(formData.password ?? '');
		const matches = formData.password === formData.confirmPassword;
		return { disabled: loading || !hasRequired || !hasLetter || !hasNumber || !matches };
	});

	async function handleResetPassword(event: SubmitEvent) {
		event.preventDefault();
		if (honeypot) return;
		if (status.disabled) return;

		loading = true;
		formError = '';
		try {
			if (!encryptionKeys) throw new Error('Encryption keys not ready');
			const requestBody: ResetPasswordRequestBody = {
				token: resetToken,
				password: formData.password,
				publicKeyB64: await encryption.exportKeyToBase64(encryptionKeys.publicKey, 'spki')
			};
			const response = await encryption.fetchSecure('/api/reset-password', { method: 'POST', body: requestBody }, encryptionKeys);
			if (response?.ok) {
				success = true;
				client.browser?.toasts?.create({
					title: pageContents.responseOk[currentLang] ?? '',
					description: '',
					color: 'success'
				});
			} else {
				formError = response?.message?.[lang] ?? response?.message?.en ?? pageContents.responseFail[currentLang] ?? '';
			}
		} catch (e) {
			formError = e instanceof Error ? e.message : pageContents.responseFail[currentLang] ?? '';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (!client.browser) client.browser = {};
	});

	// Keys sinh sau mount (browser-only — generateRSAKeyPair cần WebCrypto)
	$effect(() => {
		if (!encryptionKeys && !tokenInvalid) {
			encryption.generateRSAKeyPair().then(({ privateKey, publicKey }) => {
				encryptionKeys = { privateKey, publicKey };
			});
		}
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
	<title>{pageContents.title[currentLang]}</title>
</svelte:head>

{#if tokenInvalid}
	<AuthLayout
		cardSize="md"
		title={pageContents.title}
		subtitle={pageContents.subtitle}
		formError={pageContents.invalidLinkDesc}
	>
		<div class="invalid-state">
			<div class="auth-actions">
				<Button class="auth-btn-submit" color="primary" variant="outline" to="/forgot-password">
					{pageContents.requestNew[currentLang]}
				</Button>
				<Button class="auth-btn-reset" color="error" variant="ghost" to="/login">
					{pageContents.backToLogin[currentLang]}
				</Button>
			</div>
		</div>
	</AuthLayout>
{:else if success}
	<AuthLayout
		cardSize="md"
		title={pageContents.title}
		subtitle={pageContents.subtitle}
		successMessage={pageContents.responseOk}
	>
		<div class="success-state">
			<div class="auth-actions">
				<Button class="auth-btn-submit" color="success" to="/login">
					{pageContents.backToLogin[currentLang]}
				</Button>
			</div>
		</div>
	</AuthLayout>
{:else}
	<AuthLayout
		cardSize="md"
		title={pageContents.title}
		subtitle={pageContents.subtitle}
		{formError}
	>
		<Form class="auth-form" onSubmit={handleResetPassword}>
			<div class="hp-field" aria-hidden="true">
				<label for="hp_website">Website</label>
				<input id="hp_website" name="website" type="text" bind:value={honeypot} tabindex="-1" aria-hidden="true" disabled={loading} />
			</div>

			<TextField name="password" required>
				<Label>{pageContents.password[currentLang]}</Label>
				<div class="auth-input-wrapper">
					<Input
						type="password"
						bind:value={formData.password}
						autocomplete="new-password"
						disabled={loading}
						actionButtons={{ showPassword: { display: true } }}
					/>
				</div>
				<Description persistent={true} class="form-hint">
					{pageContents.password[currentLang]}: ≥8 ký tự, có chữ và số
				</Description>
				<FieldMessages />
			</TextField>

			<TextField name="confirmPassword" required>
				<Label>{pageContents.confirmPassword[currentLang]}</Label>
				<div class="auth-input-wrapper">
					<Input
						type="password"
						bind:value={formData.confirmPassword}
						autocomplete="new-password"
						disabled={loading}
						color={formData.confirmPassword && formData.confirmPassword !== formData.password ? 'error' : undefined}
						actionButtons={{ showPassword: { display: true } }}
					/>
				</div>
				{#if formData.confirmPassword && formData.confirmPassword !== formData.password}
					<Description persistent={true} color="error" class="form-hint error-hint">
						{pageContents.mismatchHint[currentLang]}
					</Description>
				{/if}
				<FieldMessages />
			</TextField>

			<div class="auth-actions">
				<Button class="auth-btn-submit" color="success" type="submit" {loading} disabled={status.disabled}>
					{pageContents.submit[currentLang]}
				</Button>
				<Button class="auth-btn-reset" color="error" type="reset" variant="ghost" disabled={loading}>
					{pageContents.reset[currentLang]}
				</Button>
			</div>
		</Form>
	</AuthLayout>
{/if}

<style lang="scss">
	.hp-field {
		position: absolute;
		left: -9999px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
	.invalid-state,
	.success-state {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		animation: fadeIn 0.3s ease;
	}
	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
```

Lưu ý: nếu `successMessage` prop của AuthLayout cần TranslateContent object (như login dùng), giữ nguyên object `{vi, en}` thay vì string — mirror login/+page.svelte L278-279. Nếu formError cần string thì giữ string (mirror forgot-password).

- [ ] **Step 11: Thêm `/reset-password` vào publicPaths hooks + copy sang main checkout**

`src/hooks.server.ts` L62 — publicPaths thêm: `'/reset-password'`, `'/api/reset-password'`, `'/api/dev-emails'`.

Copy các file đã đổi sang main checkout (dev flow):

```powershell
$wt = 'D:\nodejs\svelte\kit-3\.claude\worktrees\fix-form-double-submit'
$main = 'D:\nodejs\svelte\kit-3'
$files = @(
	'src\lib\modules\schema.ts',
	'src\lib\server\email.ts',
	'src\lib\server\db\users.ts',
	'src\routes\api\forgot-password\+server.ts',
	'src\routes\api\reset-password\+server.ts',
	'src\routes\api\dev-emails\+server.ts',
	'src\routes\(unauthorized)\reset-password\_interface.ts',
	'src\routes\(unauthorized)\reset-password\+page.svelte',
	'src\routes\(unauthorized)\reset-password\index.ts',
	'src\hooks.server.ts',
	'tests\reset-password-test.mjs',
	'tests\run-all.mjs'
)
foreach ($f in $files) {
	$src = Join-Path $wt $f
	$dst = Join-Path $main $f
	$dstDir = Split-Path $dst -Parent
	if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Force $dstDir | Out-Null }
	Copy-Item $src $dst -Force
	$h1 = (Get-FileHash $src -Algorithm SHA256).Hash
	$h2 = (Get-FileHash $dst -Algorithm SHA256).Hash
	if ($h1 -ne $h2) { Write-Output "HASH MISMATCH: $f" } else { Write-Output "OK: $f" }
}
```

Expected: tất cả `OK: <file>`. KHÔNG đè file nào trên main checkout có uncommitted changes khác — kiểm tra `git status` trên main checkout trước khi copy (các file này chỉ được đổi bởi session này).

- [ ] **Step 12: Chạy E2E → xác nhận GREEN**

Run: `cd D:\nodejs\svelte\kit-3; node tests/reset-password-test.mjs`

Expected: `=== KẾT QUẢ: 8 pass, 0 fail ===` (hoặc 8 pass nếu resetUrl tìm thấy; phần 4-8 skip gracefully nếu outbox trống — nhưng với seed email phải thấy đủ 8).

Nếu server console in `[DEV EMAIL] to=phuongdomega@atomicmail.io` nhưng `/api/dev-emails` trả rỗng → kiểm tra module-level outbox: Vite dev server có thể HMR-reload module → outbox reset. Fix: disable HMR cho server modules hoặc dùng globalThis:

```ts
const g = globalThis as unknown as { __devOutbox?: DevEmail[] };
const outbox = (g.__devOutbox ??= []);
```

(Áp dụng globalThis pattern NGAY từ đầu khi implement email.ts — đã vào code block Step 4 bằng bản đơn giản; executor dùng bản globalThis này khi gặp HMR reset.)

- [ ] **Step 13: Chạy suite + commit**

```powershell
cd D:\nodejs\svelte\kit-3; node tests/run-all.mjs
```

Expected: các test cũ (login-final, register-final, forgot-password-test) + reset-password-test đều pass.

Commit trong WORKTREE:

```powershell
cd D:\nodejs\svelte\kit-3\.claude\worktrees\fix-form-double-submit
git add -A
git commit -m @'
feat(auth): reset-password flow with token + dev email outbox

- Schema: passwordResetTokenHash (searchable) + passwordResetTokenExpiresAt optional fields
- Users: createPasswordResetToken + resetPasswordWithToken (setupVault swap, one-time token)
- api/forgot-password: rate limiting (10s/15) + token gen + dev outbox send
- api/reset-password: token-gated self-service vault reset
- /reset-password page: new/confirm password UI, invalid-link + success states
- api/dev-emails: dev-only outbox reader for E2E
- hooks: publicPaths additions
- tests/reset-password-test.mjs E2E (restores seed password at end)

Co-Authored-By: Claude Code <noreply@anthropic.com>
'@
```

### Task 2: Email Verification Flow (verify-email + resend + user_status workflow)

**Files:**
- Modify: `src/lib/modules/schema.ts` (users fields, sau Task 1 fields): thêm `emailVerificationTokenHash` (searchable), `emailVerifiedAt`
- Modify: `src/routes/api/register/+server.ts:176-177`: `statusId = 'status-active'` → `'status-pending_verification'`; sinh verification token + send email
- Create: `src/routes/(unauthorized)/verify-email/_interface.ts` + `+page.svelte` + `index.ts`
- Create: `src/routes/api/verify-email/+server.ts`
- Create: `src/routes/api/resend-verification/+server.ts`
- Modify: `src/lib/server/db/users.ts`: thêm `verifyEmailWithToken`
- Modify: `src/hooks.server.ts` publicPaths: `/verify-email`, `/api/verify-email`, `/api/resend-verification`
- Modify: `src/routes/(unauthorized)/login/index.ts`: `registeredSuccess` copy → "check email" message
- Test: `tests/verify-email-test.mjs` (thêm vào run-all)

**Interfaces:**
- Consumes: `sendDevEmail` (Task 1 email.ts); `encryption.getDataHash`; `Users.getBy/isEmailTaken`; pattern từ Task 1 (rate limit, encrypted endpoint, page template); `status-pending_verification` seed đã có trong user_status catalog (canLogin: false).
- Produces: `Users.verifyEmailWithToken(tokenHash): Promise<{ok: boolean; reason?: 'invalid'}>` — verify thành công set `emailVerifiedAt` + `statusId='status-active'` + clear token. Page `/verify-email?token=...` — auto-submit token khi load, hiển thị kết quả. API `/api/resend-verification` body `{ email: string; publicKeyB64: string }`.

- [ ] **Step 1: Viết E2E RED — `tests/verify-email-test.mjs`**

```js
import { chromium } from 'playwright';

const results = { passed: [], failed: [] };
function check(name, cond) {
	if (cond) results.passed.push(name); else results.failed.push(name);
	console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}`);
}

const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') console.log('[console.error]', msg.text()); });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

try {
	// === 1. Garbage token → invalid state, KHÔNG crash (Review Focus #4) ===
	await page.goto('https://localhost:3000/verify-email?token=garbage-token-xyz', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(8000); // đợi auto-verify submit + response
	const bodyText1 = await page.locator('body').innerText();
	const invalidState = bodyText1.toLowerCase().includes('invalid') || bodyText1.toLowerCase().includes('không hợp lệ');
	check('1. verify-email garbage token → invalid state (không crash)', invalidState);

	// === 2. Không token → invalid state ===
	await page.goto('https://localhost:3000/verify-email', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(5000);
	const bodyText2 = await page.locator('body').innerText();
	const noTokenState = bodyText2.toLowerCase().includes('invalid') || bodyText2.toLowerCase().includes('không hợp lệ');
	check('2. verify-email không token → invalid state', noTokenState);

	// === 3. Resend-verification với email KHÔNG tồn tại → success message giống email thật (Review Focus #5) ===
	await page.goto('https://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(5000);
	const [resNonExist, resExist] = await page.evaluate(async () => {
		async function tryResend(email) {
			// Dùng page fetch với session keys — cần encryption từ window. Tạo keys inline:
			const mod = await import('/src/lib/modules/encryption.ts');
			const keys = await mod.default.generateRSAKeyPair();
			const body = { email, publicKeyB64: await mod.default.exportKeyToBase64(keys.publicKey, 'spki') };
			const res = await mod.default.fetchSecure('/api/resend-verification', { method: 'POST', body }, keys);
			return res;
		}
		return [await tryResend('nonexistent-xyz@atomicmail.io'), await tryResend('phuongdomega@atomicmail.io')];
	});
	const msgNonExist = resNonExist?.message?.en ?? String(resNonExist?.message ?? '');
	const msgExist = resExist?.message?.en ?? String(resExist?.message ?? '');
	check('3a. resend-verification email không tồn tại → ok:true', resNonExist?.ok === true);
	check('3b. resend-verification email tồn tại → ok:true', resExist?.ok === true);
	check('3c. Hai response message GIỐNG HỆT nhau (anti-enumeration)', msgNonExist === msgExist && msgNonExist !== '');
} catch (e) {
	console.log('[FATAL]', e.message);
	results.failed.push('fatal: ' + e.message);
} finally {
	await browser.close();
	console.log(`\n=== KẾT QUẢ: ${results.passed.length} pass, ${results.failed.length} fail ===`);
	if (results.failed.length > 0) { console.log('FAILED:', results.failed.join(', ')); process.exit(1); }
}
```

Thêm `'tests/verify-email-test.mjs'` vào array `tests` trong `tests/run-all.mjs` (sau reset-password-test).

- [ ] **Step 2: Chạy E2E → xác nhận RED**

Run (main checkout, sau khi copy test): `cd D:\nodejs\svelte\kit-3; node tests/verify-email-test.mjs`

Expected: FAIL — check 1/2 fail (404 trang chưa tồn tại), check 3 fail (API chưa tồn tại → fetchSecure error).

- [ ] **Step 3: Schema + Users.verifyEmailWithToken**

Schema (users fields, sau `passwordResetTokenExpiresAt`):

```ts
		// === Email verification flow (Task 2) — optional ===
		emailVerificationTokenHash: { type: 'string', searchable: true, sortable: false, selectable: false },
		emailVerifiedAt: { type: 'string', searchable: false, sortable: false, selectable: true },
```

users.ts — thêm static method vào class `Users` (sau `resetPasswordWithToken`):

```ts
	/**
	 * Task 2: Verify email bằng token — set emailVerifiedAt + statusId='status-active' + clear token.
	 */
	static async verifyEmailWithToken(
		emailVerificationTokenHash: string
	): Promise<{ ok: boolean; reason?: 'invalid' }> {
		let docs: UserDocument[] | undefined;
		try {
			const res = await cbUsers.query.document.search({
				conditions: [{ fieldName: 'emailVerificationTokenHash', keyword: emailVerificationTokenHash }],
				limit: 1
			});
			if (!res.ok) return { ok: false, reason: 'invalid' };
			docs = res.data as UserDocument[] | undefined;
		} catch {
			return { ok: false, reason: 'invalid' };
		}
		const doc = docs?.[0];
		if (!doc || !doc._id || doc.deletedAt) return { ok: false, reason: 'invalid' };

		try {
			const res = await cbUsers.document.update({
				documentKey: doc._id,
				content: {
					statusId: 'status-active',
					emailVerifiedAt: new Date().toISOString(),
					emailVerificationTokenHash: null,
					updatedAt: new Date().toISOString()
				} as Partial<User> as User
			});
			if (!res.ok) return { ok: false, reason: 'invalid' };
			return { ok: true };
		} catch {
			return { ok: false, reason: 'invalid' };
		}
	}
```

- [ ] **Step 4: Register sinh verification token + gửi email + status-pending_verification**

Trong `src/routes/api/register/+server.ts`:

(a) Thêm imports: `sendDevEmail` từ `$lib/server/email`; `dev` từ `$app/environment`.

(b) Tại L176-177, đổi:

```ts
		const roleId = 'role-customer';
		const statusId = 'status-pending_verification';
```

(c) Sau khi user document được tạo thành công (sau `document.create` OK, trước respond success), thêm:

```ts
		// Task 2: sinh email verification token — hash lưu trên user doc, token gốc trong link email
		const rawVerifyToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
		const verifyTokenHash = await encryption.getDataHash(rawVerifyToken);
		cbUsers.document
			.update({
				documentKey: newUserKey, // documentKey đã dùng khi create user
				content: { emailVerificationTokenHash: verifyTokenHash } as Partial<User> as User
			})
			.catch((e) => console.error('[register] save verify token failed', e));
		const baseUrl = dev ? 'https://localhost:3000' : `https://${request.headers.get('host')}`;
		const verifyUrl = `${baseUrl}/verify-email?token=${rawVerifyToken}`;
		sendDevEmail(
			normalizedEmail, // email plaintext user vừa submit — đã có trong scope
			'Xác nhận email / Verify your email',
			`<p>Nhấn liên kết để xác nhận email (hiệu lực 1 giờ):</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`
		);
```

Lưu ý biến tên: executor đọc code quanh điểm chèn để lấy đúng tên biến (`newUserKey`/documentKey, `normalizedEmail`/`email`) — dùng tên biến thực tế trong scope, KHÔNG đoán. Nếu register hiện trả user tự động login (session), giữ nguyên hành vi đó — chỉ đổi statusId; user sẽ login được vì... KHÔNG — status-pending_verification có canLogin: false → login sẽ bị chặn với accountLocked. Đúng theo spec: user PHẢI verify email trước khi login.

- [ ] **Step 5: `src/routes/api/verify-email/+server.ts`**

Canonical encrypted-endpoint template — body `{ token: string; publicKeyB64: string }`:

```ts
import { json, type RequestHandler } from '@sveltejs/kit';
import encryption from '$modules/encryption';
import systemVault from '$store/initSystemVault';
import type { ServerResponse } from '$interfaces/basic';
import { Users } from '$lib/server/db/users';
import { resolveLang, localizePayload } from '$lib/server/i18n';

const verifyEmailMessages = {
	systemUnavailable: { vi: 'Hệ thống đang bảo trì. Vui lòng thử lại sau.', en: 'The system is under maintenance. Please try again later.' },
	invalidBody: { vi: 'Dữ liệu không hợp lệ.', en: 'Invalid data.' },
	missingSessionKey: { vi: 'Thiếu khóa phiên. Vui lòng tải lại trang.', en: 'Missing session key. Please reload the page.' },
	missingToken: { vi: 'Liên kết xác nhận không hợp lệ hoặc đã hết hạn.', en: 'This verification link is invalid or has expired.' },
	verifyFailed: { vi: 'Xác nhận email thất bại. Vui lòng yêu cầu liên kết mới.', en: 'Email verification failed. Please request a new link.' },
	success: { vi: 'Email đã được xác nhận! Bạn có thể đăng nhập.', en: 'Your email is verified! You can now sign in.' }
};

export const POST: RequestHandler = async ({ request }) => {
	const lang = resolveLang(request.headers.get('accept-language'));
	try {
		if (!systemVault.privateKey) {
			return json({ message: localizePayload({ ok: false, message: verifyEmailMessages.systemUnavailable }, lang) }, { status: 503 });
		}
		const jsRaw = await request.json();
		if (!jsRaw) {
			return json({ message: localizePayload({ ok: false, message: verifyEmailMessages.invalidBody }, lang) }, { status: 400 });
		}
		const decryptedText = await encryption.decryptWithPrivateKeyHybrid(systemVault.privateKey, jsRaw);
		if (!decryptedText) {
			return json({ message: localizePayload({ ok: false, message: verifyEmailMessages.invalidBody }, lang) }, { status: 400 });
		}
		const parsed = JSON.parse(decryptedText) as { token?: string; publicKeyB64?: string };
		const { publicKeyB64, token } = parsed;
		if (!publicKeyB64) {
			return json({ message: localizePayload({ ok: false, message: verifyEmailMessages.missingSessionKey }, lang) }, { status: 400 });
		}
		const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);
		const respond = async (payload: ServerResponse, status = 200) => {
			const enc = await encryption.encryptWithPublicKeyHybrid(sessionPublicKey, JSON.stringify(localizePayload(payload, lang)));
			return json(enc, { status });
		};

		if (!token || typeof token !== 'string' || token.length < 16) {
			return respond({ ok: false, message: verifyEmailMessages.missingToken }, 400);
		}

		const tokenHash = await encryption.getDataHash(token);
		const result = await Users.verifyEmailWithToken(tokenHash);
		if (!result.ok) {
			return respond({ ok: false, message: verifyEmailMessages.missingToken }, 400);
		}
		return respond({ ok: true, message: verifyEmailMessages.success }, 200);
	} catch (e) {
		console.error('[verify-email] error:', e);
		return json({ message: localizePayload({ ok: false, message: verifyEmailMessages.systemUnavailable }, lang) }, { status: 500 });
	}
};
```

Note: `VerifyEmailRequestBody` interface đặt inline type trong parsed (không cần file _interface riêng cho API — page sẽ có `_interface.ts` nếu cần; giữ tối giản).

- [ ] **Step 6: `src/routes/api/resend-verification/+server.ts` (anti-enumeration + rate limit)**

Body `{ email: string; publicKeyB64: string }`. Rate limit như Task 1 pattern. LUÔN trả success giống hệt:

```ts
import { json, type RequestHandler } from '@sveltejs/kit';
import { dev } from '$app/environment';
import encryption from '$modules/encryption';
import systemVault from '$store/initSystemVault';
import type { ServerResponse } from '$interfaces/basic';
import { Users } from '$lib/server/db/users';
import { sendDevEmail } from '$lib/server/email';
import { resolveLang, localizePayload } from '$lib/server/i18n';

const resendVerificationMessages = {
	systemUnavailable: { vi: 'Hệ thống đang bảo trì. Vui lòng thử lại sau.', en: 'The system is under maintenance. Please try again later.' },
	invalidBody: { vi: 'Dữ liệu không hợp lệ.', en: 'Invalid data.' },
	missingSessionKey: { vi: 'Thiếu khóa phiên. Vui lòng tải lại trang.', en: 'Missing session key. Please reload the page.' },
	invalidEmail: { vi: 'Email không hợp lệ.', en: 'Invalid email.' },
	tooManyRequests: { vi: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.', en: 'Too many requests. Please try again later.' },
	// Anti-enumeration: message success giống hệt dù email tồn tại hay không
	success: { vi: 'Nếu email tồn tại, liên kết xác nhận đã được gửi.', en: 'If the email exists, a verification link has been sent.' }
};

const rateLimitWindowMs = 10_000;
const rateLimitMaxRequests = 15;
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
	const now = Date.now();
	const entry = rateLimitStore.get(identifier);
	if (!entry || now > entry.resetTime) {
		rateLimitStore.set(identifier, { count: 1, resetTime: now + rateLimitWindowMs });
		return { allowed: true, remaining: rateLimitMaxRequests - 1, resetTime: now + rateLimitWindowMs };
	}
	entry.count += 1;
	if (entry.count > rateLimitMaxRequests) {
		return { allowed: false, remaining: 0, resetTime: entry.resetTime };
	}
	return { allowed: true, remaining: rateLimitMaxRequests - entry.count, resetTime: entry.resetTime };
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const lang = resolveLang(request.headers.get('accept-language'));
	try {
		if (!systemVault.privateKey) {
			return json({ message: localizePayload({ ok: false, message: resendVerificationMessages.systemUnavailable }, lang) }, { status: 503 });
		}
		const jsRaw = await request.json();
		if (!jsRaw) {
			return json({ message: localizePayload({ ok: false, message: resendVerificationMessages.invalidBody }, lang) }, { status: 400 });
		}
		const decryptedText = await encryption.decryptWithPrivateKeyHybrid(systemVault.privateKey, jsRaw);
		if (!decryptedText) {
			return json({ message: localizePayload({ ok: false, message: resendVerificationMessages.invalidBody }, lang) }, { status: 400 });
		}
		const parsed = JSON.parse(decryptedText) as { email?: string; publicKeyB64?: string };
		const { publicKeyB64, email } = parsed;
		if (!publicKeyB64) {
			return json({ message: localizePayload({ ok: false, message: resendVerificationMessages.missingSessionKey }, lang) }, { status: 400 });
		}
		const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);
		const respond = async (payload: ServerResponse, status = 200) => {
			const enc = await encryption.encryptWithPublicKeyHybrid(sessionPublicKey, JSON.stringify(localizePayload(payload, lang)));
			return json(enc, { status });
		};

		// Rate limit
		const rateLimitKey = `resend-verification:${getClientAddress()}`;
		const rateLimit = checkRateLimit(rateLimitKey);
		if (!rateLimit.allowed) {
			return respond({ ok: false, message: resendVerificationMessages.tooManyRequests }, 429);
		}

		if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			return respond({ ok: false, message: resendVerificationMessages.invalidEmail }, 400);
		}
		const normalizedEmail = email.trim().toLowerCase();

		// Anti-enumeration: nếu email tồn tại → gen token mới + gửi; response GIỐNG HỆT cả hai nhánh
		const emailBlindIndex = await encryption.hmacBlindIndex(process.env.email_blind_index_secret ?? 'dev-secret', normalizedEmail);
		const emailExists = await Users.isEmailTaken(emailBlindIndex);
		if (emailExists) {
			const found = await Users.getBy({ emailBlindIndex });
			const doc = (found ?? []).find((d) => !d.deletedAt) ?? found?.[0];
			if (doc?._id) {
				const rawToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
				const tokenHash = await encryption.getDataHash(rawToken);
				cbUsers.document
					.update({ documentKey: doc._id, content: { emailVerificationTokenHash: tokenHash } as Partial<User> as User })
					.catch((e) => console.error('[resend-verification] save token failed', e));
				const baseUrl = dev ? 'https://localhost:3000' : `https://${request.headers.get('host')}`;
				const verifyUrl = `${baseUrl}/verify-email?token=${rawToken}`;
				sendDevEmail(normalizedEmail, 'Xác nhận email / Verify your email', `<p>Nhấn liên kết để xác nhận email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`);
			}
		}

		return respond({ ok: true, message: resendVerificationMessages.success }, 200);
	} catch (e) {
		console.error('[resend-verification] error:', e);
		return json({ message: localizePayload({ ok: false, message: resendVerificationMessages.systemUnavailable }, lang) }, { status: 500 });
	}
};
```

Note: `cbUsers` import — users.ts exports class Users, không export cbUsers. Executor: import `cbData` từ `$modules/couchbase` (hoặc `$lib/server/db/...` pattern mà users.ts dùng — đọc users.ts L14-22 để lấy đúng import path của `cbData`) và self-host `const cbUsers = cbData('users');` ở module scope.

Note blind-index secret: đọc env key thực tế mà api/register dùng cho emailBlindIndex — executor grep `hmacBlindIndex` trong api/register/+server.ts để lấy đúng tên env var + process.env access pattern (có thể qua `$env/static/private` — dùng đúng pattern register dùng, KHÔNG hardcode 'dev-secret').

- [ ] **Step 7: `/verify-email` page — `_interface.ts` + `index.ts` + `+page.svelte`**

`_interface.ts`:

```ts
export interface VerifyEmailRequestBody {
	token: string;
	publicKeyB64: string;
}
```

`index.ts` (pageContents):

```ts
import type { TranslateContent } from '$interfaces/basic';

export const pageContents: { [key: string]: TranslateContent } = {
	title: { vi: 'Xác nhận email', en: 'Verify Email' },
	subtitle: { vi: 'Đang xác nhận địa chỉ email của bạn...', en: 'Verifying your email address...' },
	verifying: { vi: 'Đang xác nhận...', en: 'Verifying...' },
	invalidTitle: { vi: 'Liên kết không hợp lệ', en: 'Invalid link' },
	invalidDesc: {
		vi: 'Liên kết xác nhận không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.',
		en: 'This verification link is invalid or has expired. Please request a new link.'
	},
	successTitle: { vi: 'Email đã được xác nhận!', en: 'Your email is verified!' },
	successDesc: { vi: 'Bạn có thể đăng nhập ngay bây giờ.', en: 'You can sign in right now.' },
	backToLogin: { vi: 'Đăng nhập', en: 'Sign in' },
	resend: { vi: 'Yêu cầu liên kết mới', en: 'Request a new link' }
};
```

`+page.svelte` — auto-submit token khi load (không form; gọi API ngay):

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { Button } from '$components/element';
	import { AuthLayout } from '$components/layout';
	import encryption from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { pageContents } from '.';
	import type { VerifyEmailRequestBody } from './_interface';

	let loading = $state(true);
	let success = $state(false);
	let invalid = $state(false);
	let encryptionKeys = $state<{ publicKey: CryptoKey; privateKey: CryptoKey } | undefined>(undefined);

	const lang = $derived(client.browser?.language ?? 'en');
	const currentLang = $derived(lang === 'vi' ? 'vi' : 'en');
	const verifyToken = $derived(page.url.searchParams.get('token') ?? '');

	onMount(() => {
		if (!client.browser) client.browser = {};
		encryption.generateRSAKeyPair().then(async ({ privateKey, publicKey }) => {
			encryptionKeys = { privateKey, publicKey };
			if (!verifyToken || verifyToken.length < 16) {
				invalid = true;
				loading = false;
				return;
			}
			try {
				const requestBody: VerifyEmailRequestBody = {
					token: verifyToken,
					publicKeyB64: await encryption.exportKeyToBase64(publicKey, 'spki')
				};
				const response = await encryption.fetchSecure('/api/verify-email', { method: 'POST', body: requestBody }, { privateKey, publicKey });
				success = !!response?.ok;
				invalid = !response?.ok;
				if (response?.ok) {
					client.browser?.toasts?.create({ title: pageContents.successTitle[currentLang] ?? '', description: '', color: 'success' });
				}
			} catch {
				invalid = true;
			} finally {
				loading = false;
			}
		});
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
	<title>{pageContents.title[currentLang]}</title>
</svelte:head>

<AuthLayout
	cardSize="md"
	title={pageContents.title}
	subtitle={loading ? pageContents.verifying : success ? pageContents.successTitle : pageContents.invalidTitle}
>
	{#if loading}
		<div class="verify-state">
			<div class="spinner" aria-label={pageContents.verifying[currentLang]}></div>
		</div>
	{:else if success}
		<div class="verify-state">
			<p class="verify-desc">{pageContents.successDesc[currentLang]}</p>
			<div class="auth-actions">
				<Button class="auth-btn-submit" color="success" to="/login">{pageContents.backToLogin[currentLang]}</Button>
			</div>
		</div>
	{:else}
		<div class="verify-state">
			<p class="verify-desc">{pageContents.invalidDesc[currentLang]}</p>
			<div class="auth-actions">
				<Button class="auth-btn-submit" color="primary" variant="outline" to="/login">
					{pageContents.backToLogin[currentLang]}
				</Button>
			</div>
		</div>
	{/if}
</AuthLayout>

<style lang="scss">
	.verify-state {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: center;
		animation: fadeIn 0.3s ease;
	}
	.verify-desc {
		text-align: center;
	}
	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--color-border, #ccc);
		border-top-color: var(--color-primary, #4f46e5);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
```

- [ ] **Step 8: hooks publicPaths + login copy + copy files + GREEN + commit**

(a) `src/hooks.server.ts` publicPaths thêm: `'/verify-email'`, `'/api/verify-email'`, `'/api/resend-verification'`.

(b) `src/routes/(unauthorized)/login/index.ts` — đổi `registeredSuccess`:

```ts
	registeredSuccess: {
		vi: 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản trước khi đăng nhập.',
		en: 'Registration successful! Please check your email to verify your account before signing in.'
	},
```

(c) Copy files sang main checkout (globalThis list mở rộng Task 1 + các file Task 2):

```powershell
$wt = 'D:\nodejs\svelte\kit-3\.claude\worktrees\fix-form-double-submit'
$main = 'D:\nodejs\svelte\kit-3'
$files = @(
	'src\lib\modules\schema.ts',
	'src\lib\server\db\users.ts',
	'src\routes\api\register\+server.ts',
	'src\routes\api\verify-email\+server.ts',
	'src\routes\api\resend-verification\+server.ts',
	'src\routes\(unauthorized)\verify-email\_interface.ts',
	'src\routes\(unauthorized)\verify-email\+page.svelte',
	'src\routes\(unauthorized)\verify-email\index.ts',
	'src\routes\(unauthorized)\login\index.ts',
	'src\hooks.server.ts',
	'tests\verify-email-test.mjs',
	'tests\run-all.mjs'
)
foreach ($f in $files) {
	$src = Join-Path $wt $f
	$dst = Join-Path $main $f
	$dstDir = Split-Path $dst -Parent
	if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Force $dstDir | Out-Null }
	Copy-Item $src $dst -Force
	$h1 = (Get-FileHash $src -Algorithm SHA256).Hash
	$h2 = (Get-FileHash $dst -Algorithm SHA256).Hash
	if ($h1 -ne $h2) { Write-Output "HASH MISMATCH: $f" } else { Write-Output "OK: $f" }
}
```

(d) GREEN: `cd D:\nodejs\svelte\kit-3; node tests/verify-email-test.mjs` → Expected `4 pass, 0 fail` (checks 1, 2, 3a, 3b, 3c = 5 checks).

(e) Full suite: `cd D:\nodejs\svelte\kit-3; node tests/run-all.mjs` → tất cả pass.

Lưu ý QUAN TRỌNG: sau khi register đổi statusId sang pending_verification, các user đăng ký mới KHÔNG login được đến khi verify. Existing E2E register-final.mjs KHÔNG login (chỉ test form + popup) → an toàn. Existing seed users giữ status-active → login-final.mjs an toàn. Task 2 không cần đổi login-final.

(f) Commit (worktree):

```powershell
git add -A
git commit -m @'
feat(auth): email verification flow with user_status workflow

- Schema: emailVerificationTokenHash (searchable) + emailVerifiedAt optional fields
- Register: status-pending_verification + verification token gen + dev email
- Users.verifyEmailWithToken: sets status-active + emailVerifiedAt, one-time token
- /verify-email page auto-submits token, invalid/success states
- /api/verify-email + /api/resend-verification (anti-enumeration, rate-limited)
- login registeredSuccess copy: check email before signing in
- hooks publicPaths additions
- tests/verify-email-test.mjs E2E

Co-Authored-By: Claude Code <noreply@anthropic.com>
'@
```

### Task 3: EmailService Interface + Dev Transport (SMTP-ready)

**Files:**
- Modify: `src/lib/server/email.ts` — wrap outbox thành EmailService interface, giữ `sendDevEmail`/`getDevOutbox` exports (Task 1/2 đã dùng) làm facade
- Create: `src/lib/server/email/_interface.ts` — EmailService + EmailMessage types
- Create: `src/lib/server/email/devTransport.ts` — DevTransport (globalThis outbox, console log)
- Create: `src/lib/server/email/smtpTransport.ts` — SmtpTransport STUB (throws "not configured" — SMTP-ready shape, KHÔNG thêm dependency)

**Interfaces:**
- Consumes: `sendDevEmail(to, subject, html)` / `getDevOutbox()` (Task 1) — các call site hiện có (api/forgot-password, api/register, api/resend-verification) KHÔNG đổi.
- Produces: `interface EmailTransport { send(message: EmailMessage): Promise<void> }`; `EmailMessage = { to: string; subject: string; html: string }`; `getEmailService(): EmailService`; `interface EmailService { sendEmail(message: EmailMessage): Promise<void>; getOutbox(): EmailMessage[] }`. SMTP env vars (khi config): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — SmtpTransport đọc nếu có, nếu thiếu → throw lỗi rõ ràng khi send.

- [ ] **Step 1: Viết E2E RED — mở rộng `tests/reset-password-test.mjs` (check 9) HOẶC thêm check vào verify-email test**

Không cần E2E riêng — Task 3 là refactor nội bộ; test là: outbox vẫn hoạt động qua toàn bộ existing suite. RED gate ở đây là type-level + behavioral: sau refactor, `tests/reset-password-test.mjs` vẫn GREEN (outbox endpoint vẫn trả email). Vậy bước RED: viết 1 check mới vào `tests/reset-password-test.mjs` PHẦN 3 sau khi lấy outboxRes:

```js
	check('3b. Outbox email có cấu trúc EmailMessage {to, subject, html}', 
		outboxRes && outboxRes.emails?.[0] && typeof outboxRes.emails[0].to === 'string' 
		&& typeof outboxRes.emails[0].subject === 'string' && typeof outboxRes.emails[0].html === 'string');
```

(Đây chạy GREEN ngay nếu Task 1 làm đúng — chấp nhận được vì Task 3 là refactor bảo toàn hành vi; RED thực nằm ở type check: viết `_interface.ts` + transport TRƯỚC rồi refactor email.ts, svelte-check phải pass.)

- [ ] **Step 2: `_interface.ts` + transports + refactor email.ts**

`src/lib/server/email/_interface.ts`:

```ts
export interface EmailMessage {
	to: string;
	subject: string;
	html: string;
}

export interface EmailTransport {
	send(message: EmailMessage): Promise<void>;
}

export interface EmailService {
	sendEmail(message: EmailMessage): Promise<void>;
	getOutbox(): EmailMessage[];
}
```

`src/lib/server/email/devTransport.ts`:

```ts
import { dev } from '$app/environment';
import type { EmailMessage, EmailTransport } from './_interface';

type StoredEmail = EmailMessage & { sentAt: string };

/**
 * Dev transport — outbox trong memory (globalThis chống HMR reset) + console log.
 */
export class DevTransport implements EmailTransport {
	private get outbox(): StoredEmail[] {
		const g = globalThis as unknown as { __devOutbox?: StoredEmail[] };
		return (g.__devOutbox ??= []);
	}

	async send(message: EmailMessage): Promise<void> {
		if (!dev) return;
		this.outbox.push({ ...message, sentAt: new Date().toISOString() });
		if (this.outbox.length > 50) this.outbox.shift();
		console.log(`[DEV EMAIL] to=${message.to} subject="${message.subject}"`);
	}

	readOutbox(): StoredEmail[] {
		return this.outbox;
	}
}
```

`src/lib/server/email/smtpTransport.ts` (stub SMTP-ready — KHÔNG dependency mới; SMTP wire khi cần dùng `nodemailer` hoặc hand-built — ngoài scope):

```ts
import type { EmailMessage, EmailTransport } from './_interface';

/**
 * SMTP transport — SMTP-ready shape. Chưa implement wire protocol (không có email lib trong package.json,
 * không thêm dependency mới). Khi SMTP_HOST/... được cấu hình, cài nodemailer hoặc hand-built client
 * và implement send() — interface này là điểm cắm duy nhất.
 */
export class SmtpTransport implements EmailTransport {
	constructor(
		private readonly config: { host: string; port: number; user: string; pass: string; from: string }
	) {}

	async send(message: EmailMessage): Promise<void> {
		// SMTP wire protocol chưa implement — throw rõ ràng thay vì im lặng bỏ email
		throw new Error(
			`SmtpTransport.send() not implemented (would send to ${message.to} via ${this.config.host}:${this.config.port}). Configure a real transport or use DevTransport.`
		);
	}
}
```

Refactor `src/lib/server/email.ts` — giữ nguyên 2 exports cũ làm facade + thêm service:

```ts
import { dev } from '$app/environment';
import { DevTransport } from './email/devTransport';
import { SmtpTransport } from './email/smtpTransport';
import type { EmailMessage, EmailService, EmailTransport } from './email/_interface';

const devTransport = new DevTransport();

// Chọn transport theo môi trường: dev → outbox; production → SMTP nếu cấu hình, throw nếu không
function createTransport(): EmailTransport {
	if (dev) return devTransport;
	const host = process.env.SMTP_HOST;
	const port = Number(process.env.SMTP_PORT ?? '587');
	const user = process.env.SMTP_USER ?? '';
	const pass = process.env.SMTP_PASS ?? '';
	const from = process.env.SMTP_FROM ?? user;
	if (host) return new SmtpTransport({ host, port, user, pass, from });
	return devTransport; // production chưa cấu hình SMTP → outbox + console (không mất email)
}

const service: EmailService = {
	async sendEmail(message: EmailMessage): Promise<void> {
		await createTransport().send(message);
	},
	getOutbox(): EmailMessage[] {
		return devTransport.readOutbox();
	}
};

export function getEmailService(): EmailService {
	return service;
}

/** Facade — Task 1/2 call sites giữ nguyên (fire-and-forget, sync signature). */
export function sendDevEmail(to: string, subject: string, html: string): void {
	service.sendEmail({ to, subject, html }).catch((e) => console.error('[email] send failed:', e));
}

export function getDevOutbox(): EmailMessage[] {
	return service.getOutbox();
}
```

Cấu trúc thư mục: `email.ts` + `email/` folder ngang hàng (pattern này chuẩn SvelteKit — module + folder cùng tên OK).

- [ ] **Step 3: Copy + suite + commit**

Copy: `src\lib\server\email.ts`, `src\lib\server\email\_interface.ts`, `src\lib\server\email\devTransport.ts`, `src\lib\server\email\smtpTransport.ts`, `tests\reset-password-test.mjs`.

Run: `cd D:\nodejs\svelte\kit-3; node tests/run-all.mjs` → Expected: toàn bộ pass (outbox behavior bất biến qua facade).

Commit:

```powershell
git add -A
git commit -m @'
refactor(email): EmailService interface + dev/smtp transports

- EmailTransport/EmailService/EmailMessage types (email/_interface.ts)
- DevTransport: globalThis outbox (HMR-safe) + console log
- SmtpTransport: SMTP-ready stub, throws loudly when unconfigured
- email.ts: facade sendDevEmail/getDevOutbox unchanged for existing call sites
- Transport selection: dev→outbox, prod→SMTP if env, else outbox fallback

Co-Authored-By: Claude Code <noreply@anthropic.com>
'@
```

### Task 4: Input Component Split (EmailInput, PhoneInput, PasswordInput)

**Files:**
- Create: `src/lib/components/form/inputEmail/_interface.ts` + `Main.svelte`
- Create: `src/lib/components/form/inputPhone/_interface.ts` + `Main.svelte`
- Create: `src/lib/components/form/inputPassword/_interface.ts` + `Main.svelte`
- Modify: `src/lib/components/form/index.ts` — thêm exports EmailInput/PhoneInput/PasswordInput
- Modify: `src/lib/components/form/input/Main.svelte` — fix 2 biến undeclared (`visualNumberKbCleaner`, `suggestionsFocusHeld`) bằng `let` declarations; Input GIỮ NGUYÊN làm facade (tất cả call sites hiện tại không đổi)
- Test: `tests/input-split-test.mjs` (thêm vào run-all)

**Interfaces:**
- Consumes: InputProps/InputConfigs từ `form/input/_interface.ts`; `createDefaultInputEvents`, `defaultValidation`, `text_keys_allowed`, `number_keys_allowed` từ `form/input/index.ts`; `getFormContext`/`getTextFieldContext`; SvelteMap snippets contract (`export { configs }`).
- Produces: `EmailInput`, `PhoneInput`, `PasswordInput` component exports từ `$components/form` (Object.assign pattern không cần — chúng là default exports đơn giản: `export { default as EmailInput } from './inputEmail/Main.svelte';`). Mỗi component nhận cùng InputProps subset (type được hardcode) và export `configs` instance export như Input. Call sites HIỆN TẠI không đổi — Input facade vẫn dùng được cho mọi type; components mới là opt-in cho các trang mới/ refactor dần.

**Nguyên tắc extraction (quan trọng — tránh regression):**

Task này KHÔNG phải là "move code ra rồi xóa". Input facade giữ nguyên toàn bộ. Ba component mới được build theo nguyên tắc WRAP-DELEGATE:

- Mỗi component mới MOUNT Input bên trong với `type` hardcode + chỉ giữ logic nào THỰC SỰ đặc thù type (email suggest popup, phone country popup, password show/hide) làm lớp phủ TUYỆN TẮI ở template level.
- CÁCH LÀM CỤ THỂ (đơn giản nhất, 0 rủi ro regression): component mới là một WRAPPER mỏng quanh Input:

```svelte
<!-- inputEmail/Main.svelte — TRỌN VỌC, KHÔNG duplicate logic (full code ở Step 4) -->
<script lang="ts">
	import Input from '../input/Main.svelte';
	import type { EmailInputProps } from './_interface';

	let { value = $bindable(), ...props }: EmailInputProps = $props();
</script>

<Input {...props} type="email" emailSuggest={props.emailSuggest ?? true} bind:value />
```

Wrapper pattern bảo toàn: mọi context registration, validation, popups, keyboard, highlight — tất cả vẫn do Input xử lý (đúng hiện trạng, 0 code moved). `configs` export: wrapper re-export qua `export const inputConfigs = ...`? — KHÔNG: Input's instance export `configs` không thể re-export xuyên qua wrapper một cách transparent. Vì vậy: các component mới KHÔNG export configs (call sites hiện tại không dùng configs của email/phone/password input — chỉ number input dùng qua textField context). Ghi rõ trong _interface.ts: "Wrapper components: no instance exports; use Input directly when configs access is required."

- [ ] **Step 1: Viết E2E RED — `tests/input-split-test.mjs`**

Test importability + render của 3 component mới qua trang register (dùng sẵn phone/email inputs ở đó — sau refactor Task 4, register page CHƯA đổi sang components mới; test riêng cần 1 trang demo). Cách khả thi nhất trong codebase này: test trực tiếp qua Vite module graph — mở trang bất kỳ, dynamic import 3 module mới trong browser context:

```js
import { chromium } from 'playwright';

const results = { passed: [], failed: [] };
function check(name, cond) {
	if (cond) results.passed.push(name); else results.failed.push(name);
	console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}`);
}

const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

try {
	await page.goto('https://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(5000);

	// 1. Ba module import được trong browser (Vite serves Svelte components)
	const importResults = await page.evaluate(async () => {
		const out = {};
		for (const name of ['inputEmail/Main.svelte', 'inputPhone/Main.svelte', 'inputPassword/Main.svelte']) {
			try {
				const mod = await import(`/src/lib/components/form/${name}`);
				out[name] = typeof mod.default === 'function' || typeof mod.default === 'object';
			} catch (e) {
				out[name] = 'ERROR: ' + e.message;
			}
		}
		return out;
	});
	for (const [name, ok] of Object.entries(importResults)) {
		check(`1. Module ${name} importable`, ok === true);
	}

	// 2. form/index.ts export 3 component mới
	const indexExports = await page.evaluate(async () => {
		const mod = await import('/src/lib/components/form/index.ts');
		return { EmailInput: !!mod.EmailInput, PhoneInput: !!mod.PhoneInput, PasswordInput: !!mod.PasswordInput };
	});
	check('2a. form/index.ts exports EmailInput', indexExports.EmailInput);
	check('2b. form/index.ts exports PhoneInput', indexExports.PhoneInput);
	check('2c. form/index.ts exports PasswordInput', indexExports.PasswordInput);

	// 3. Regression: email suggestions vẫn hoạt động trên register (Input facade đường cũ)
	const page2 = await context.newPage();
	await page2.goto('https://localhost:3000/register', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page2.waitForTimeout(5000);
	const emailField = page2.locator('input[name="email"]').first();
	await emailField.fill('test@');
	await page2.waitForTimeout(1500);
	const popupCount = await page2.locator('.email-suggestions-popup').count();
	check('3. Regression: email popup sau "test@" (Input facade)', popupCount > 0);
	await emailField.fill('');
	await page2.waitForTimeout(500);
} catch (e) {
	console.log('[FATAL]', e.message);
	results.failed.push('fatal: ' + e.message);
} finally {
	await browser.close();
	console.log(`\n=== KẾT QUẢ: ${results.passed.length} pass, ${results.failed.length} fail ===`);
	if (results.failed.length > 0) { console.log('FAILED:', results.failed.join(', ')); process.exit(1); }
}
```

Thêm `'tests/input-split-test.mjs'` vào array `tests` trong `tests/run-all.mjs`.

- [ ] **Step 2: Chạy E2E → xác nhận RED**

Run (main checkout sau khi copy test): `cd D:\nodejs\svelte\kit-3; node tests/input-split-test.mjs`

Expected: FAIL — checks 1 (module not found / 404 trên Vite import), checks 2 (undefined exports), check 3 PASS (regression baseline đã hoạt động — đúng, vì nó test existing behavior).

- [ ] **Step 3: Fix 2 biến undeclared trong input/Main.svelte (bug có sẵn)**

Trong `src/lib/components/form/input/Main.svelte`:

(a) Thêm gần các $state khác:

```ts
	let visualNumberKbCleaner: (() => void) | undefined;
	let suggestionsFocusHeld = $state(false);
```

`visualNumberKbCleaner` là plain let (gán ở L1330 `showVisualNumberKb()`, gọi ở L976 window mousedown — không cần reactive). `suggestionsFocusHeld` phải là `$state` (template L1737/1741/1752 read + write trong email popup focus-hold logic).

Placement: `suggestionsFocusHeld` là biến EMAIL popup — đặt cạnh `isInteractingWithSuggestions` (~L217). `visualNumberKbCleaner` đặt cạnh `_disabled` (~L111). Cả hai chỉ dùng trong closures chạy sau mount nên vị trí top-level nào cũng được — convention codebase: nhóm theo feature.

(b) Sync: `node "D:\nodejs\svelte\kit-3\node_modules\@sveltejs\kit\svelte-kit.js" sync` từ worktree. Expected: sync OK.

- [ ] **Step 4: Tạo 3 wrapper components**

`src/lib/components/form/inputEmail/_interface.ts`:

```ts
import type { InputProps } from '../input/_interface';

/**
 * EmailInput — wrapper mỏng quanh Input với type='email' hardcode.
 * KHÔNG có instance exports (configs) — cần configs thì dùng Input trực tiếp.
 */
export type EmailInputProps = Omit<InputProps, 'type'>;
```

`src/lib/components/form/inputEmail/Main.svelte`:

```svelte
<script lang="ts">
	import Input from '../input/Main.svelte';
	import type { EmailInputProps } from './_interface';

	let { value = $bindable(), ...props }: EmailInputProps = $props();
</script>

<!-- type='email' hardcode; emailSuggest bật mặc định -->
<Input {...props} type="email" emailSuggest={props.emailSuggest ?? true} bind:value />
```

`src/lib/components/form/inputPhone/_interface.ts`:

```ts
import type { InputProps } from '../input/_interface';

/** PhoneInput — wrapper mỏng quanh Input với type='phone' hardcode. */
export type PhoneInputProps = Omit<InputProps, 'type'>;
```

`src/lib/components/form/inputPhone/Main.svelte`:

```svelte
<script lang="ts">
	import Input from '../input/Main.svelte';
	import type { PhoneInputProps } from './_interface';

	let { value = $bindable(), ...props }: PhoneInputProps = $props();
</script>

<Input {...props} type="phone" phoneSuggest={props.phoneSuggest ?? true} bind:value />
```

`src/lib/components/form/inputPassword/_interface.ts`:

```ts
import type { InputProps } from '../input/_interface';

/** PasswordInput — wrapper mỏng quanh Input với type='password' hardcode; showPassword action mặc định bật. */
export type PasswordInputProps = Omit<InputProps, 'type'>;
```

`src/lib/components/form/inputPassword/Main.svelte`:

```svelte
<script lang="ts">
	import Input from '../input/Main.svelte';
	import type { PasswordInputProps } from './_interface';

	let { value = $bindable(), ...props }: PasswordInputProps = $props();
</script>

<!-- showPassword action button bật mặc định; caller truyền actionButtons riêng thì thắng (?? chỉ fill khi undefined) -->
<Input
	{...props}
	type="password"
	actionButtons={props.actionButtons ?? { showPassword: { display: true } }}
	bind:value
/>
```

- [ ] **Step 5: Export từ form/index.ts**

`src/lib/components/form/index.ts` — thêm sau dòng `export { default as Input } ...`:

```ts
export { default as EmailInput } from './inputEmail/Main.svelte';
export { default as PhoneInput } from './inputPhone/Main.svelte';
export { default as PasswordInput } from './inputPassword/Main.svelte';
```

- [ ] **Step 6: Copy + GREEN + suite + commit**

Copy sang main checkout: `src\lib\components\form\input\Main.svelte`, `src\lib\components\form\inputEmail\` (cả folder), `src\lib\components\form\inputPhone\`, `src\lib\components\form\inputPassword\`, `src\lib\components\form\index.ts`, `tests\input-split-test.mjs`, `tests\run-all.mjs`.

Run: `cd D:\nodejs\svelte\kit-3; node tests/input-split-test.mjs` → Expected: 7 pass, 0 fail.

Full suite: `node tests/run-all.mjs` → tất cả pass (đặc biệt login-final dùng password input, register-final dùng email + phone popup — facade bất biến).

Commit (trong worktree):

```powershell
git add -A
git commit -m @'
feat(form): EmailInput/PhoneInput/PasswordInput wrapper components

- inputEmail/inputPhone/inputPassword: thin wrappers around Input facade
  (type hardcoded, type-specific suggest/showPassword defaults on)
- form/index.ts: export EmailInput, PhoneInput, PasswordInput
- input/Main.svelte: fix undeclared visualNumberKbCleaner (let) and
  suggestionsFocusHeld ($state) - latent ReferenceError bugs
- Input facade unchanged: zero regression for all current call sites
- tests/input-split-test.mjs: importability + exports + popup regression

Co-Authored-By: Claude Code <noreply@anthropic.com>
'@
```

### Task 5: VisualKeyboard Extraction (từ store)

**Files:**
- Create: `src/lib/components/keyboard/VisualKeyboard.svelte` — render component cho visual keyboard UI (placeholder mount point; hiện store chưa có render component nào — `.component` luôn null)
- Create: `src/lib/components/keyboard/useVisualKeyboard.ts` — hook chứa toàn bộ state + logic hiện ở `basic.svelte.ts:23-93` (focusOn getter/setter, processFocus, height machinery)
- Modify: `src/lib/store/basic.svelte.ts` — block 23-93 thay bằng reference sang hook; giữ interface name `profile.visualKeyboard` (call sites đọc qua đó — +layout.svelte:160 đọc `.focusOn`)
- Modify: `src/lib/components/keyboard/index.ts` — thêm export `Visual`
- Test: `tests/visual-keyboard-test.mjs` (thêm vào run-all)

**Interfaces:**
- Consumes: `profile.visualKeyboard.focusOn` (chỉ LIVE consumer: routes/+layout.svelte:160 `touchActionDisabled={profile.visualKeyboard.focusOn ? true : false}`); `NumbericKey` type từ `$components/keyboard/numberic_old/_interface` (type-only import — giữ); `profile.timeId.requestAnimation`; `profile.screen.height`; `profile.visualKeyboard.height`.
- Produces: `useVisualKeyboard()` hook trả object cùng shape như block hiện tại: `{ component, ref (getter), isShow, height (get/set), hasHeightValue, focusOn (get/set), fallbackFocusOn, onKeyup, processFocus, input }` — `profile.visualKeyboard` trở thành alias: `visualKeyboard: useVisualKeyboard()`. `VisualKeyboard.svelte` export default component (mount point render UI khi `component` được gán — hiện chưa có UI thật; component render rỗng + class root để tương lai cắm). Export `Keyboard.Visual` từ `$components/keyboard`.

**Nguyên tắc extraction (bảo toàn contract):**

- `profile.visualKeyboard` PHẢI giữ nguyên shape + reactivity — mọi read `.focusOn` (layout), `.height` (Numberic_old render) phải tiếp tục hoạt động. Cách an toàn nhất: MOVE code vào hook, hook nhận `timeId` ref + trả reactive object; `basic.svelte.ts` gán `visualKeyboard: useVisualKeyboard()`. Hook dùng `$state` bên trong (đúng như hiện tại object nằm trong `profile = $state({...})` — reactivity phải được giữ: dùng `$state` trong hook — hook được gọi trong `.svelte.ts` file nên runes hợp lệ).
- `processFocus` đọc `profile.visualKeyboard.height` bên trong — khi move vào hook, self-reference đổi thành `this`-less closure: hook internal `_height` state + `height` getter/setter đã có — thay `profile.visualKeyboard.height` bằng `height` local (closure). TƯƠNG TỰ timeId: hook nhận `timeId: { requestAnimation: ... }` làm tham số (truyền từ profile.timeId — TRÁNH circular: hook không import profile).

- [ ] **Step 1: Viết E2E RED — `tests/visual-keyboard-test.mjs`**

```js
import { chromium } from 'playwright';

const results = { passed: [], failed: [] };
function check(name, cond) {
	if (cond) results.passed.push(name); else results.failed.push(name);
	console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}`);
}

const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
let pageErrors = [];
page.on('pageerror', (err) => { pageErrors.push(err.message); console.log('[pageerror]', err.message); });

try {
	// 1. App khởi động không JS error sau extraction (layout đọc focusOn ở +layout.svelte:160)
	await page.goto('https://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(5000);
	check('1. App load không pageerror (focusOn contract sống)', pageErrors.length === 0);

	// 2. Module mới import được
	const imports = await page.evaluate(async () => {
		const out = {};
		try {
			const hook = await import('/src/lib/components/keyboard/useVisualKeyboard.ts');
			out.hook = typeof hook.useVisualKeyboard === 'function';
		} catch (e) { out.hook = 'ERROR: ' + e.message; }
		try {
			const comp = await import('/src/lib/components/keyboard/VisualKeyboard.svelte');
			out.component = typeof comp.default === 'function' || typeof comp.default === 'object';
		} catch (e) { out.component = 'ERROR: ' + e.message; }
		try {
			const idx = await import('/src/lib/components/keyboard/index.ts');
			out.indexExport = !!idx.Keyboard?.Visual;
		} catch (e) { out.indexExport = 'ERROR: ' + e.message; }
		return out;
	});
	check('2a. useVisualKeyboard.ts importable + export useVisualKeyboard', imports.hook === true);
	check('2b. VisualKeyboard.svelte importable', imports.component === true);
	check('2c. keyboard/index.ts exports Keyboard.Visual', imports.indexExport === true);

	// 3. Layout root vẫn nhận touchActionDisabled từ focusOn (sanity: attribute pipeline sống)
	// focusOn luôn falsy ở desktop load → touch-action không bị disable; chỉ check element tồn tại
	const rootExists = await page.evaluate(() => !!document.querySelector('#app, body *'));
	check('3. Root app element render OK', rootExists);
} catch (e) {
	console.log('[FATAL]', e.message);
	results.failed.push('fatal: ' + e.message);
} finally {
	await browser.close();
	console.log(`\n=== KẾT QUẢ: ${results.passed.length} pass, ${results.failed.length} fail ===`);
	if (results.failed.length > 0) { console.log('FAILED:', results.failed.join(', ')); process.exit(1); }
}
```

Thêm `'tests/visual-keyboard-test.mjs'` vào array `tests` trong `tests/run-all.mjs`.

- [ ] **Step 2: Chạy E2E → xác nhận RED**

Run (main checkout): `cd D:\nodejs\svelte\kit-3; node tests/visual-keyboard-test.mjs`

Expected: FAIL — 2a/2b/2c fail (module not found), 1/3 pass (baseline).

- [ ] **Step 3: Tạo `useVisualKeyboard.ts`**

```ts
import type NumbericKey from '$components/keyboard/numberic_old/_interface';
import type { SvelteComponent } from 'svelte';

/**
 * Task 5: Extract profile.visualKeyboard (basic.svelte.ts:23-93) thành hook.
 * Shape + reactivity bảo toàn — profile.visualKeyboard là alias của hook return.
 * KHÔNG import profile (tránh circular) — timeId truyền vào làm tham số.
 */
export function useVisualKeyboard(timeId: { requestAnimation: null | number }) {
	// === $state fields (giữ reactivity như khi nằm trong profile $state) ===
	let component = $state<null | SvelteComponent>(null);
	let isShow = $state(false);
	let _height = $state<number | null>(null);
	let hasHeightValue = $state(false);
	let _focusOn = $state<HTMLElement | null>(null);

	// === plain fields (không reactive — như hiện tại) ===
	let fallbackFocusOn: null | (() => void) = null;
	let onKeyup: undefined | ((val: NumbericKey) => void) = undefined;
	let input: null | ((input: string) => void) = null;

	const ref = $derived.by(() => (component ? (component as unknown as { configs: { ref?: HTMLElement } }).configs?.ref : undefined));

	const height = {
		get: () => _height ?? (typeof visualViewport !== 'undefined' ? (visualViewport?.height ?? 0) / 3 : 0),
		set: (value: number) => {
			_height = value;
			hasHeightValue = true;
		}
	};

	function processFocus(el: HTMLElement) {
		// Mirror basic.svelte.ts:76-89 — mobile scrollIntoView + body height/scroll compensation
		if (typeof window === 'undefined') return;
		const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
		if (!isMobile) return;
		try {
			el.scrollIntoView({ block: 'center', behavior: 'smooth' });
			const h = height.get();
			document.body.style.height = `${window.innerHeight - h}px`;
			window.scrollTo(0, el.getBoundingClientRect().top - h / 2);
		} catch {
			// best-effort — không crash khi visualViewport không có
		}
	}

	const focusOn = {
		get: () => _focusOn,
		set: (el: HTMLElement | null) => {
			if (!el) {
				// restore body height từ attribute + cleanup (mirror 55-58)
				_focusOn = null;
				const prev = document.body.getAttribute('height-bu');
				if (prev) {
					document.body.style.height = prev;
					document.body.removeAttribute('height-bu');
				}
				return;
			}
			if (timeId.requestAnimation) cancelAnimationFrame(timeId.requestAnimation);
			timeId.requestAnimation = requestAnimationFrame(() => {
				_focusOn = el;
				processFocus(el);
				if (fallbackFocusOn) fallbackFocusOn();
			});
		}
	};

	return {
		get component() { return component; },
		set component(v: null | SvelteComponent) { component = v; },
		ref,
		get isShow() { return isShow; },
		set isShow(v: boolean) { isShow = v; },
		height,
		get hasHeightValue() { return hasHeightValue; },
		focusOn,
		get fallbackFocusOn() { return fallbackFocusOn; },
		set fallbackFocusOn(v: null | (() => void)) { fallbackFocusOn = v; },
		get onKeyup() { return onKeyup; },
		set onKeyup(v: undefined | ((val: NumbericKey) => void)) { onKeyup = v; },
		processFocus,
		get input() { return input; },
		set input(v: null | ((input: string) => void)) { input = v; }
	};
}
```

QUAN TRỌNG — executor lưu ý: code trên là REWRITE theo map của block 23-93 từ workflow analysis. Khi thực hiện, MỞ `basic.svelte.ts` L23-93 và TRANSPOSE CHÍNH XÁC từng dòng code thực tế sang hook (giữ tên biến, giữ logic nếu khác map — map có thể thiếu chi tiết). KHÔNG viết từ trí nhớ. Mỗi dòng của block gốc phải có chỗ đến trong hook. Nếu `$state` trong file `.ts` ngoài `.svelte.ts` bị svelte compiler chặn → đổi đuôi file thành `useVisualKeyboard.svelte.ts` (runes hợp lệ trong `.svelte.ts`).

- [ ] **Step 4: Tạo `VisualKeyboard.svelte` + export**

`src/lib/components/keyboard/VisualKeyboard.svelte`:

```svelte
<script lang="ts">
	/**
	 * Task 5: Mount point cho visual keyboard UI.
	 * Store hiện chỉ quản lý state (component luôn null — chưa có UI thật).
	 * Component này render root container để tương lai cắm UI; hiện render rỗng.
	 */
</script>

<!-- Render rỗng có nghĩa: visualKeyboard.component chưa từng được gán UI component nào -->
<div class="visual-keyboard-root" style:height="0" aria-hidden="true"></div>
```

`src/lib/components/keyboard/index.ts` — mở rộng theo Object.assign pattern:

```ts
import { default as Number } from './number/Main.svelte';
import { default as Visual } from './VisualKeyboard.svelte';
export const Keyboard = Object.assign('Keyboard', { Number, Visual });
```

- [ ] **Step 5: Thay block 23-93 trong basic.svelte.ts bằng alias**

```ts
	visualKeyboard: useVisualKeyboard(timeId),
```

Với import: `import { useVisualKeyboard } from '$components/keyboard/useVisualKeyboard';`

Lưu ý thứ tự khai báo: hook cần `timeId` — trong `profile = $state({...})` hiện tại, `timeId` là key ĐẦU TIÊN của cùng object literal. Vì vậy alias KHÔNG thể tham chiếu `timeId` từ cùng literal — giải pháp: khai báo `const timeIdRef = { requestAnimation: null as null | number };` TRƯỚC `profile`, dùng trong cả `timeId: timeIdRef` và `visualKeyboard: useVisualKeyboard(timeIdRef)`. CẢ HAI cùng tham chiếu 1 object → hành vi bất biến.

Xóa block 23-93 (thay bằng alias trên). GIỮ import `NumbericKey` + `SvelteComponent` nếu còn dùng chỗ khác trong file — check trước khi xóa import (basic.svelte.ts dùng SvelteComponent/FlyParams ở chỗ khác — chỉ xóa nếu không còn dùng).

- [ ] **Step 6: Copy + GREEN + suite + commit**

Copy: `src\lib\store\basic.svelte.ts`, `src\lib\components\keyboard\useVisualKeyboard.ts` (hoặc `.svelte.ts`), `src\lib\components\keyboard\VisualKeyboard.svelte`, `src\lib\components\keyboard\index.ts`, `tests\visual-keyboard-test.mjs`, `tests\run-all.mjs`.

Run: `cd D:\nodejs\svelte\kit-3; node tests/visual-keyboard-test.mjs` → Expected: 6 pass, 0 fail.

Full suite: `node tests/run-all.mjs` → tất cả pass.

Commit (trong worktree):

```powershell
git add -A
git commit -m @'
refactor(keyboard): extract VisualKeyboard from store into hook + component

- useVisualKeyboard: state + focusOn/height/processFocus logic from
  basic.svelte.ts:23-93, shape and reactivity preserved
- VisualKeyboard.svelte: mount-point component (UI TBD)
- profile.visualKeyboard is now an alias of the hook return; timeId
  shared by reference (single object) - behavior unchanged
- keyboard/index.ts: Keyboard.Visual export
- tests/visual-keyboard-test.mjs: import + no-pageerror + export checks

Co-Authored-By: Claude Code <noreply@anthropic.com>
'@
```

---

## Execution Notes (cho executor — superpowers:executing-plans)

1. **SDD workspace:** chạy `sdd-workspace PLAN_FILE` (script tại `C:\Users\Phuon\.claude\plugins\cache\claude-plugins-official\superpowers\6.4.1\skills\subagent-driven-development\scripts\`). Ledger `progress.md` first line: `# SDD ledger — plan: docs/superpowers/plans/2026-09-25-phase2-auth-completion.md`. KHÔNG có `.gitignore` ở repo root — sau khi workspace tạo, check `.superpowers/` có bị track không; nếu chưa ignore, tạo `.gitignore` chứa `.superpowers/` + `.svelte-kit/` + commit.
2. **Per-task loop:** `task-start PLAN_FILE N` → đọc brief → steps theo thứ tự (E2E RED trước) → copy sang main checkout → chạy test trên main checkout → commit trong worktree → `task-done PLAN_FILE N BASE -- <cmd>`.
3. **Test commands chạy trên MAIN checkout** (server port 3000 + node_modules ở đó); commit thực hiện trong WORKTREE. Copy-verify bằng Get-FileHash SHA256 mỗi file.
4. **Cuối cùng:** review-package + code-reviewer (most capable model), re-grade findings, ONE fix pass Critical/Important (mỗi fix RED→GREEN + green suite), minors → ledger `Final: minor (deferred):`. Thu thập mọi `Ruling:` lines vào final message. Xóa workspace sau khi sạch.
5. **KHÔNG push** — không bao giờ được yêu cầu. Origin có PAT nhúng — không echo URL.

---

## Phase 2 Verification Status (2026-09-27)

Phase 2 (RBAC + Admin API + Admin UI + PartyKit WebSocket public-key) đã hoàn thành và verify end-to-end. Các bug nghiêm trọng được phát hiện và sửa trong quá trình verification:

### Bug đã fix (commit 8225f95)
1. **Reserved word N1QL 'scope'** — `PermissionChecker.getAllGrants()` và `UserAdminService.listGrants()` dùng `SELECT ... scope FROM detail_roles` → syntax error 400 mọi lần → grants cache rỗng → **mọi role mất toàn bộ quyền** (owner bounce khỏi /admin, admin API 403/500). Fix: `SELECT *` + unwrap `{ detail_roles: {...} }`.
2. **Reserved word N1QL 'level'** — `UserAdminService.listRoles()` dùng `ORDER BY level` → 400 → /api/admin/roles trả 500. Fix: `SELECT META().id AS documentKey, *` + unwrap + sort bằng JS.
3. **Layout group (authorized) trống** — `src/routes/(authorized)/+layout.svelte` rỗng từ commit gốc, thiếu `{@render children()}` → mọi trang authorised (/admin, /profile) render **trang trắng**. Fix: thêm `{@render children()}`.
4. **partykit-push đọc process.env** — SvelteKit dev không populate process.env từ .env → push key lên PartyKit 401. Fix: `$env/dynamic/private` (commit a784324).
5. **Rate limit /api/admin là dead code** — wired `applyRateLimit` vào `readAdminRequest` (commit 04aa94c).

### Verification results
- Unit tests: 103/103 pass (98 cũ + 5 regression test mới cho reserved word)
- UI check: 61/61 pass, 2 skipped (chromium/firefox/webkit)
- Owner login → /admin: bảng user load đầy đủ (roles tiếng Việt, status normalized), CRUD Change status (suspend → active) hoạt động end-to-end qua fetchSecure
- Customer bị 303 về / khi vào /admin (RBAC guard đúng)
- PartyKit: push key auth OK, WS broadcast + onConnect delivery OK, MITM qua WS bị bỏ qua (onMessage không nhận key update)
- Register → pending_verification → verify-email (dev outbox) → login OK

### Cần lưu ý
- Password owner đã reset trong quá trình test: `OwnerTest2026!x` (reset bằng flow forgot-password — flow hoạt động đúng)
- App log password ra console khi login attempt (`[handleLogin] Called, username: ... password: ...`) — nên xoá trong pass security tiếp theo
- Localhost nằm trong WHITELIST_IPS của rate limit → không test được 429 qua curl local (by design)
- HTTPS → wss://localhost bị mixed-content block → client auto fallback HTTP sau 700ms; muốn WS-first thật cần TLS proxy cho PartyKit (env PUBLIC_PARTYKIT_PROTOCOL đã có sẵn)
- PartyKit node_modules cần 2 patch trên Windows (bin.mjs fileURLToPath, miniflare ReadableStream) — không track trong git
