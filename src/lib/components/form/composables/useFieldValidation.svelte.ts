// useFieldValidation.svelte.ts — shared validation composable
// Supports ValidationCompact/ValidationFull, operator and/or, debounced processing
// Returns { validate, reset, isValid, messages, process, setValid }
import { SvelteMap } from 'svelte/reactivity';
import type { ValidationCompact, ValidationFull } from '../input/_interface';
import type { TranslateContent } from '$interfaces/basic';
import type { EventListener } from '$components/interface';

type ValidationEntry =
	| (ValidationCompact | ValidationFull)[]
	| { operator?: 'and' | 'or'; handles: (ValidationCompact | ValidationFull)[] };

export interface UseFieldValidationConfig {
	validation?: { [k in keyof EventListener]?: ValidationEntry } & { operator?: 'and' | 'or' };
	delay?: number;
	getValue?: () => string | boolean | undefined;
}

export function useFieldValidation(config: UseFieldValidationConfig = {}) {
	let delay = $derived(config.delay ?? 300);
	let globalOperator = $derived(config.validation?.operator ?? 'and');

	let process = $state<Map<keyof EventListener | 'required', boolean | 'pending'>>(new SvelteMap());
	let messages = $state<Map<string | ((o?: string | boolean) => boolean | Promise<boolean>), { content?: TranslateContent; kind: 'valid' | 'invalid' }>>(new SvelteMap());
	let loadingState = $state(false);
	let timeIds = new SvelteMap<string, ReturnType<typeof setTimeout>>();
	let resolver: (() => void) | undefined;
	let overrideValid = $state<boolean | 'pending' | undefined>(undefined);

	const isValid = $derived.by<boolean | 'pending' | undefined>(() => {
		if (overrideValid !== undefined) return overrideValid;
		if (!process.size) return undefined;
		const vals = [...process.values()];
		if (vals.some((r) => r === 'pending')) return 'pending';
		return globalOperator === 'and' ? vals.every((r) => r) : vals.some((r) => r);
	});

	async function validate(
		eventName: keyof EventListener | 'required',
		handles: (ValidationCompact | ValidationFull)[],
		operator: 'and' | 'or' = globalOperator
	): Promise<void> {
		if (!handles.length) return;
		const key = `validation-${String(eventName)}`;
		const prev = timeIds.get(key);
		if (prev) clearTimeout(prev);
		if (resolver) resolver();
		loadingState = true;
		process.set(eventName, 'pending');
		return new Promise<void>((resolve) => {
			resolver = resolve;
			const tid = setTimeout(async () => {
				const results = await Promise.all(
					handles.map(async (h) => {
						if (typeof h === 'function') {
							return await h(config.getValue?.() as string);
						} else {
							const r = await h.isValid(config.getValue?.() as string);
							const content = r ? h.message?.valid : h.message?.invalid;
							messages.set(h.isValid, { content, kind: r ? 'valid' : 'invalid' });
							return r;
						}
					})
				);
				process.set(eventName, operator === 'and' ? results.every(Boolean) : results.some(Boolean));
				loadingState = false;
				resolve();
			}, delay);
			timeIds.set(key, tid);
		});
	}

	// Debounced process for a named event using config.validation entry
	async function processEvent(eventName: keyof EventListener): Promise<void> {
		if (!config.validation) return;
		const entry = (config.validation as Record<string, unknown>)[eventName] as ValidationEntry | undefined;
		if (!entry) return;
		let handles: (ValidationCompact | ValidationFull)[];
		let op: 'and' | 'or' = globalOperator;
		if (Array.isArray(entry)) handles = entry;
		else if (entry && typeof entry === 'object' && 'handles' in entry) {
			handles = (entry as { handles: (ValidationCompact | ValidationFull)[] }).handles;
			op = (entry as { operator?: 'and' | 'or' }).operator ?? globalOperator;
		} else return;
		if (!handles.length) return;
		await validate(eventName, handles, op);
	}

	function reset() {
		for (const t of timeIds.values()) clearTimeout(t);
		timeIds.clear();
		process.clear();
		messages.clear();
		loadingState = false;
		overrideValid = undefined;
	}

	function setValid(v: boolean | 'pending' | undefined) {
		overrideValid = v;
		if (v !== undefined && v !== 'pending') {
			process.clear();
			process.set('required', v);
		} else if (v === undefined) process.clear();
		else if (v === 'pending') process.set('required', 'pending');
	}

	return {
		get isValid() { return isValid; },
		get messages() { return messages; },
		get process() { return process; },
		get loading() { return loadingState; },
		validate,
		reset,
		setValid,
		processEvent
	};
}
