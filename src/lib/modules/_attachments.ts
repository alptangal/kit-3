import type { BasicProps, EventDefault, EventListener } from '$components/interface';
import { SvelteMap } from 'svelte/reactivity';
import * as uuid from 'uuid';

export function handleEvents(events: BasicProps['events'][]) {
	return (element: HTMLElement) => {
		const stableEvents = events.map((event) => ({
			...event,
			event: event?.event.map((ev) => {
				const newEvent: EventListener = {};
				(Object.keys(ev) as (keyof typeof ev)[]).forEach((key) => {
					const val = ev[key as keyof EventListener] as EventDefault | undefined;
					if (val) {
						newEvent[key as keyof EventListener] = val.id ? val : { ...val, id: uuid.v7() }; // chỉ chạy 1 lần
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
						if (existing) {
							clearTimeout(existing.timeoutId);
						}
						timeoutId = setTimeout(async () => {
							callback = await eventInput.handler(event, { node: element });
							if (eventInput.id) {
								managers.set(eventInput.id, { ...managers.get(eventInput.id), callback });
							}
							resolve();
						}, eventInput.options?.delay ?? 0);
						if (eventInput.id) {
							managers.set(eventInput.id, { ...managers.get(eventInput.id), timeoutId });
						}
					} else {
						resolve();
					}
				});
			} else {
				callback = await eventInput.handler(event, { node: element });
				if (eventInput.id) {
					managers.set(eventInput.id, { ...managers.get(eventInput.id), callback });
				}
			}
		}
		stableEvents.forEach((eventObj) => {
			if (eventObj?.event) {
				eventObj.event.forEach((event) => {
					(Object.entries(event) as [keyof EventListener, EventDefault][]).forEach(
						async ([eventName, eventInput]) => {
							if (eventName == 'load') {
								await processEvent(eventInput);
							} else {
								(eventObj.target ?? element).addEventListener(
									eventName,
									processEvent.bind(null, eventInput)
								);
								if (eventInput.id) {
									managers.set(eventInput.id, {
										...managers.get(eventInput.id),
										eventListener: processEvent.bind(null, eventInput),
										eventName,
										target: eventObj.target ?? element
									});
								}
							}
						}
					);
				});
			}
		});
		return () => {
			managers.values().forEach(async (manager) => {
				clearTimeout(manager.timeoutId);
				if (typeof manager.callback == 'function') {
					await manager.callback();
				}
				if (manager.target && manager.eventName && manager.eventListener)
					manager.target.removeEventListener(manager.eventName, manager.eventListener);
			});
		};
	};
}
