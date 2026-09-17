// composables/useMessageDisplay.svelte.ts
// Shared message display pattern for FieldMessages and Description
import { client } from '$store/basic.svelte';
import type { TranslateContent } from '$interfaces/basic';
import { getTextFieldContext } from '../textField';
import { getCheckboxContext } from '../checkbox';

export interface MessageEntry {
	content?: TranslateContent;
	kind: 'valid' | 'invalid';
}
export type MessagesMap = Map<string | ((output?: string | boolean) => boolean | Promise<boolean>), MessageEntry>;

export function useMessageDisplay(options: { showValid?: boolean; persistent?: boolean; autoHide?: boolean } = {}) {
	const textFieldContext = getTextFieldContext();
	const checkboxContext = getCheckboxContext();

	const rawMessages = $derived<MessagesMap | undefined>(
		(textFieldContext?.children?.input?.validation.messages as MessagesMap | undefined) ??
			(checkboxContext?.validation.messages as MessagesMap | undefined)
	);

	const allWithContent = $derived.by(() => {
		const msgs = [...(rawMessages ?? [])].map(([, v]) => v as MessageEntry).filter((m) => !!m.content);
		return msgs;
	});

	const hasInvalid = $derived(allWithContent.some((m) => m.kind === 'invalid'));
	const hasAnyMessages = $derived(allWithContent.length > 0);

	// FieldMessages: show invalid always, valid only if showValid
	const visibleMessages = $derived.by<MessageEntry[]>(() => {
		if (hasInvalid) return allWithContent.filter((m) => m.kind === 'invalid');
		if (options.showValid) return allWithContent.filter((m) => m.kind === 'valid');
		return [];
	});

	// Description: hide when there are messages unless persistent or !autoHide
	const shouldRenderDescription = $derived.by(() => {
		if (options.persistent || options.autoHide === false) return true;
		return !hasAnyMessages;
	});

	function formatContent(entry: MessageEntry): string {
		const lang = client.browser?.language ?? 'en';
		const c = entry.content as TranslateContent | string | undefined;
		if (!c) return '';
		if (typeof c === 'string') return c;
		return (c as TranslateContent)[lang] ?? (c as TranslateContent).en ?? (c as TranslateContent).vi ?? '';
	}

	return {
		get rawMessages() {
			return rawMessages;
		},
		get allWithContent() {
			return allWithContent;
		},
		get hasInvalid() {
			return hasInvalid;
		},
		get hasAnyMessages() {
			return hasAnyMessages;
		},
		get visibleMessages() {
			return visibleMessages;
		},
		get shouldRenderDescription() {
			return shouldRenderDescription;
		},
		formatContent
	};
}
