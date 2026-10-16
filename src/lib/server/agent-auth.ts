// $lib/server/agent-auth.ts
// Xác thực CHO /api/agent/* — chấp nhận 2 phương thức (theo thứ tự):
// 1. Session cookie (hooks đã parse locals.user) → getActorContext chuẩn như admin route.
// 2. Authorization: Bearer sk-... (Secret Key API — raw key ngoài, DB chỉ lưu hash)
//    → ApiKeyService.verify → ActorContext của user sở hữu key → PermissionChecker như session.
//
// Route dùng: const actor = await requireAgentActor(event); — null → trả 401 JSON.

import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getActorContext } from '$lib/server/admin/api';
import { ApiKeyService, apiKeyMessages } from '$lib/server/db/api-keys';
import { resolveLang, localize } from '$lib/server/i18n';
import type { ActorContext } from '$lib/server/db/users';

/** Bóc Bearer token từ header Authorization (chỉ scheme 'Bearer'). */
export function extractBearerToken(request: Request): string | undefined {
	const header = request.headers.get('authorization');
	if (!header) return undefined;
	const match = /^Bearer\s+(.+)$/i.exec(header.trim());
	return match?.[1]?.trim() || undefined;
}

/**
 * Xác thực request /api/agent/*: session HOẶC Bearer sk-...
 * Trả ActorContext hoặc null (caller trả 401).
 */
export async function requireAgentActor(event: RequestEvent): Promise<ActorContext | null> {
	// 1) Session cookie — đường chuẩn
	const sessionActor = await getActorContext(event.locals);
	if (sessionActor) return sessionActor;

	// 2) Bearer Secret Key
	const bearer = extractBearerToken(event.request);
	if (!bearer) return null;
	return ApiKeyService.verify(bearer);
}

/** 401 JSON chuẩn cho route agent khi requireAgentActor trả null. */
export function agentUnauthorized(event: RequestEvent) {
	const lang = resolveLang(event.request.headers.get('accept-language'));
	return json(
		{
			ok: false,
			message: localize(apiKeyMessages.invalid, lang)
		},
		{ status: 401 }
	);
}
