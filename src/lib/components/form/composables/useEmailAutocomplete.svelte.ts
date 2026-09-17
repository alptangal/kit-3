// composables/useEmailAutocomplete.svelte.ts
// Extracted from Input.svelte email suggest logic
// Spec: useEmailAutocomplete(value, domains?)
export function useEmailAutocomplete(
	getValue: () => string | undefined,
	domains?: string[],
	opts: {
		enabled?: () => boolean;
		getInputRef?: () => HTMLInputElement | undefined;
		getFocusState?: () => boolean;
		setValue?: (v: string) => void;
	} = {}
) {
	const defaultDomains = [
		'gmail.com',
		'outlook.com',
		'icloud.com',
		'atomicmail.com',
		'proton.me',
		'protonmail.com',
		'yahoo.com',
		'hotmail.com'
	];

	let dismissed = $state(false);
	let highlightedIndex = $state(0);
	let isInteracting = $state(false);
	let prevValue: string | undefined = undefined;

	const domainList = $derived(domains ?? defaultDomains);
	const enabled = $derived(opts.enabled ? opts.enabled() : true);

	const emailParts = $derived.by<{ prefix: string; query: string } | null>(() => {
		const v = getValue();
		if (!enabled || typeof v !== 'string') return null;
		const firstAt = v.indexOf('@');
		const lastAt = v.lastIndexOf('@');
		if (firstAt === -1 || firstAt !== lastAt) return null;
		return { prefix: v.slice(0, firstAt), query: v.slice(firstAt + 1).toLowerCase() };
	});

	const matchingDomains = $derived.by<string[]>(() => {
		if (!emailParts) return [];
		const { query } = emailParts;
		return domainList.filter((d) => {
			const lower = d.toLowerCase();
			return lower.startsWith(query) && lower !== query;
		});
	});

	$effect(() => {
		if (highlightedIndex >= matchingDomains.length) highlightedIndex = 0;
	});

	$effect(() => {
		const v = getValue();
		if (v !== prevValue) {
			prevValue = v;
			dismissed = false;
		}
	});

	const isFocused = $derived(!!opts.getFocusState?.());
	const isOpen = $derived(enabled && !dismissed && (isFocused || isInteracting) && emailParts !== null && matchingDomains.length > 0);

	function selectDomain(domain: string): string {
		if (!emailParts) return getValue() ?? '';
		const newVal = `${emailParts.prefix}@${domain}`;
		if (opts.setValue) opts.setValue(newVal);
		prevValue = newVal;
		dismissed = true;
		isInteracting = false;
		const ref = opts.getInputRef?.();
		if (ref) {
			requestAnimationFrame(() => {
				ref.focus();
				try {
					if (['text', 'search', 'url', 'tel', 'password'].includes(ref.type)) {
						ref.setSelectionRange(newVal.length, newVal.length);
					}
				} catch {}
			});
		}
		return newVal;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!enabled) return;
		if (isOpen && matchingDomains.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				e.stopPropagation();
				highlightedIndex = (highlightedIndex + 1) % matchingDomains.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				e.stopPropagation();
				highlightedIndex = (highlightedIndex - 1 + matchingDomains.length) % matchingDomains.length;
				return;
			}
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				e.stopPropagation();
				const chosen = matchingDomains[highlightedIndex] ?? matchingDomains[0];
				if (chosen) selectDomain(chosen);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				dismissed = true;
				return;
			}
		}
	}

	return {
		get dismissed() { return dismissed; },
		set dismissed(v: boolean) { dismissed = v; },
		get highlightedIndex() { return highlightedIndex; },
		set highlightedIndex(v: number) { highlightedIndex = v; },
		get isInteracting() { return isInteracting; },
		set isInteracting(v: boolean) { isInteracting = v; },
		get emailParts() { return emailParts; },
		get matchingDomains() { return matchingDomains; },
		get isOpen() { return isOpen; },
		selectDomain,
		handleKeydown
	};
}
