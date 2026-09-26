//$lib/server/partykit-push.ts

/**
 * Push public key của system vault sang PartyKit (room "server-keys") khi SvelteKit boot.
 * PartyKit lưu key vào Durable Object và broadcast cho mọi WS client đang kết nối.
 *
 * Bảo mật: request mang Bearer PARTYKIT_INTERNAL_TOKEN — PartyKit từ chối (401) nếu
 * sai token, nên kẻ tấn công không thể đẩy key giả để khiến client mã hoá cho key của nó.
 *
 * Module CHỈ chạy server-side (được import bởi initSystemVault) — không dùng được ở browser.
 */

const DEFAULT_PUSH_URL = 'http://localhost:1999/party/server-keys';
const DEFAULT_TOKEN = 'dev-insecure-token-change-me';

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POST {publicKeyB64} lên PartyKit. Retry exponential backoff (1s, 2s, 4s, 8s, 16s)
 * vì partykit dev có thể chưa kịp khởi động khi vite boot. Không bao giờ throw —
 * caller (initSystemVault) gọi fire-and-forget.
 */
export async function pushPublicKeyToPartyKit(
	publicKeyB64: string,
	options?: { maxRetries?: number; initialBackoffMs?: number }
): Promise<void> {
	const url = process.env.PARTYKIT_PUSH_URL ?? DEFAULT_PUSH_URL;
	const token = process.env.PARTYKIT_INTERNAL_TOKEN ?? DEFAULT_TOKEN;
	const maxRetries = options?.maxRetries ?? MAX_RETRIES;
	const initialBackoffMs = options?.initialBackoffMs ?? INITIAL_BACKOFF_MS;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const res = await fetch(url, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${token}`
				},
				body: JSON.stringify({ publicKeyB64 })
			});

			if (res.ok) {
				console.log(`[partykit-push] public key pushed (attempt ${attempt})`);
				return;
			}

			// 401/403: token sai — retry cũng vô nghĩa, nhưng vẫn log rõ ràng
			if (res.status === 401 || res.status === 403) {
				console.error(
					`[partykit-push] rejected with ${res.status} — check PARTYKIT_INTERNAL_TOKEN matches partykit/.env`
				);
				return;
			}

			console.warn(`[partykit-push] attempt ${attempt}: status ${res.status}`);
		} catch (e) {
			// PartyKit chưa khởi động / network lỗi — log nhẹ rồi thử lại
			console.warn(`[partykit-push] attempt ${attempt} failed: ${e instanceof Error ? e.message : e}`);
		}

		if (attempt < maxRetries) {
			await sleep(initialBackoffMs * 2 ** (attempt - 1));
		}
	}

	console.error('[partykit-push] gave up after max retries — clients will use HTTP fallback for public key');
}
