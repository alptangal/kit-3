import type { BasicProps, EventDefault, EventListener } from '$components/interface';
import { SvelteMap } from 'svelte/reactivity';
import * as uuid from 'uuid';

export function handleEvents(events: BasicProps['events'][]) {
	return (element: HTMLElement) => {
		const stableEvents = events.map((event) => ({
			...event,
			event: event?.events.map((ev) => {
				const newEvent: EventListener = {};
				(Object.keys(ev) as (keyof typeof ev)[]).forEach((key) => {
					const val = ev[key as keyof EventListener] as EventDefault | undefined;
					if (val) {
						newEvent[key as keyof EventListener] = val.id ? val : { ...val, id: uuid.v7() };
					}
				});
				return newEvent;
			})
		}));

		const managers = new SvelteMap<
			string,
			{
				timeoutId?: NodeJS.Timeout;
				callback?: (() => void | Promise<void>) | void | Promise<void>;
				eventName?: keyof EventListener;
				eventListener?: () => void | Promise<void>;
				target?: HTMLElement | Document | Window;
			}
		>();

		async function processEvent(eventInput: EventDefault, event?: Event) {
			let timeoutId: NodeJS.Timeout;
			let callback: (() => void | Promise<void>) | void | Promise<void>;
			if (eventInput.options?.stopPropagation && event) event.stopPropagation();
			if (eventInput.options?.delay) {
				await new Promise<void>((resolve) => {
					if (eventInput.id) {
						const existing = managers.get(eventInput.id);
						if (existing) clearTimeout(existing.timeoutId);
						timeoutId = setTimeout(async () => {
							callback = await eventInput.handler(event, { node: element });
							if (eventInput.id)
								managers.set(eventInput.id, { ...managers.get(eventInput.id), callback });
							resolve();
						}, eventInput.options?.delay ?? 0);
						managers.set(eventInput.id, { ...managers.get(eventInput.id), timeoutId });
					} else {
						resolve();
					}
				});
			} else {
				callback = await eventInput.handler(event, { node: element });
				if (eventInput.id)
					managers.set(eventInput.id, { ...managers.get(eventInput.id), callback });
			}
		}

		// ✅ Chỉ một loop duy nhất
		async function setupEvents() {
			for (const eventObj of stableEvents) {
				if (!eventObj?.event) continue;
				for (const event of eventObj.event) {
					for (const [eventName, eventInput] of Object.entries(event) as [
						keyof EventListener,
						EventDefault
					][]) {
						if (eventName === 'load') {
							await processEvent(eventInput);
						} else {
							const boundHandler = processEvent.bind(null, eventInput);
							const id = eventInput.id ?? uuid.v7();
							(eventObj.target ?? element).addEventListener(eventName, boundHandler);
							managers.set(id, {
								eventListener: boundHandler,
								eventName,
								target: eventObj.target ?? element
							});
						}
					}
				}
			}
		}
		setupEvents();

		return async () => {
			for (const manager of managers.values()) {
				clearTimeout(manager.timeoutId);
				if (typeof manager.callback == 'function') await manager.callback();
				if (manager.target && manager.eventName && manager.eventListener)
					manager.target.removeEventListener(manager.eventName, manager.eventListener);
			}
		};
	};
}
