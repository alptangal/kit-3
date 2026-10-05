// src/lib/components/element/avatar/_context.ts
// Tách context ra file leaf (KHÔNG import .svelte) để tránh circular import khi
// sub-component (Image/Fallback) đọc qua barrel — mirror dropdown-menu/_context.ts.
import { getContext, setContext } from 'svelte';
import type { AvatarConfigs } from './_interface';

const AVATAR_CTX = Symbol('avatar-context');

export function setAvatarContext(context: AvatarConfigs) {
	setContext(AVATAR_CTX, context);
}

export function getAvatarContext(): AvatarConfigs | undefined {
	return getContext(AVATAR_CTX);
}
