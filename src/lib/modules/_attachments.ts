import type { BasicProps, EventDefault, EventFull, EventListener } from '$components/interface';
import { SvelteMap } from 'svelte/reactivity';
import * as uuid from 'uuid';

export function handleEvents_old(events: BasicProps['events'][]) {
	return (element: HTMLElement) => {
		const stableEvents = events.map((event) => ({
			...event,
			event: event?.events.map((ev) => {
				const newEvent: EventListener = {};
				(Object.keys(ev) as (keyof typeof ev)[]).forEach((key) => {
					const val = ev[key as keyof EventListener] as EventDefault | undefined;
					if (val) {
						newEvent[key as keyof EventListener] =
							typeof val == 'object'
								? val.id
									? val
									: { ...val, id: uuid.v7() }
								: { handler: val, id: uuid.v7() };
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

		async function processEvent(eventInput: EventFull, event?: Event) {
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
						EventFull
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
export function handleEvents(events: BasicProps['events']) {
	return (rootNode: HTMLElement) => {
		try {
			if (!events) return;
			const eventsFormated = new Map<
				HTMLElement | Window | Document,
				{
					[k in keyof EventListener]: {
						[id: string]: EventFull & {
							callback?: () => void | Promise<void>;
							timeId?: NodeJS.Timeout;
						};
					};
				}
			>();
			events.forEach((eventObj) => {
				if (!eventObj) return;
				const target = eventObj?.target ?? rootNode;
				const currentEvents = eventsFormated.get(target) ?? {};
				const eventsHere = eventObj.events;

				(Object.entries(eventsHere) as [keyof EventListener, EventDefault][]).forEach(
					([eventName, data]) => {
						if (!data) return;
						if (!currentEvents[eventName]) currentEvents[eventName] = {};
						const id = uuid.v7();
						const options = typeof data == 'object' ? (data.options ?? {}) : {};
						const {
							passive,
							once,
							signal,
							capture,
							delay,
							stopPropagation,
							stopImmediatePropagation,
							preventDefault
						} = options;
						async function handler(
							e?: MouseEvent | KeyboardEvent | TouchEvent | Event,
							metaNode?: {
								node?:
									| HTMLElement
									| HTMLDivElement
									| HTMLInputElement
									| Body
									| Document
									| Window
									| VisualViewport;
							}
						) {
							if (currentEvents[eventName]) {
								if (preventDefault) e?.preventDefault();
								if (stopPropagation && e) e.stopPropagation();
								if (stopImmediatePropagation && e) e.stopImmediatePropagation();
								if (delay) {
									if (currentEvents[eventName][id].timeId)
										clearTimeout(currentEvents[eventName][id].timeId);
									currentEvents[eventName][id].timeId = setTimeout(async () => {
										const res =
											typeof data == 'object'
												? await data.handler(e, metaNode)
												: await data(e, metaNode);
										if (res && currentEvents[eventName]) {
											currentEvents[eventName][id].callback = res;
										}
									}, delay);
								} else {
									const res =
										typeof data == 'object'
											? await data.handler(e, metaNode)
											: await data(e, metaNode);
									if (res && currentEvents[eventName]) {
										currentEvents[eventName][id].callback = res;
									}
								}
							}
						}
						currentEvents[eventName][id] =
							typeof data == 'object' ? { ...data, handler } : { handler };
					}
				);
				eventsFormated.set(target, currentEvents);
			});
			if (!eventsFormated.size) return undefined;
			// const manageEvents = new Map<
			// 	HTMLElement | Window | Document,
			// 	{
			// 		[k in keyof EventListener]: {
			// 			[id: string]: {
			// 				handler: EventFull['handler'];
			// 				timeId?: NodeJS.Timeout;
			// 			};
			// 		};
			// 	}
			// >();
			[...eventsFormated.keys()].forEach((target) => {
				const value = eventsFormated.get(target);
				// if (!manageEvents.get(target)) manageEvents.set(target, {});
				if (value) {
					(
						Object.entries(value) as [
							keyof EventListener,
							{
								[id: string]: EventFull & {
									callback?: () => void | Promise<void>;
									timeId?: NodeJS.Timeout;
								};
							}
						][]
					).forEach(([eventName, callbackObj]) => {
						Object.entries(callbackObj).forEach(async ([callbackId, data]) => {
							const { handler, options } = data;
							if (eventName == 'load') {
								await handler(undefined, { node: target });
							} else {
								target.addEventListener(eventName, handler, options);
							}
						});
					});
				}
			});
			return () => {
				[...eventsFormated.keys()].forEach((target) => {
					const currentValue = eventsFormated.get(target);
					if (currentValue) {
						(
							Object.entries(currentValue) as [
								keyof EventListener,
								{
									[id: string]: EventFull & {
										callback?: () => void | Promise<void>;
										timeId?: NodeJS.Timeout;
									};
								}
							][]
						).forEach(([eventName, eventObj]) => {
							Object.entries(eventObj).forEach(([callbackId, data]) => {
								if (data.callback) {
									if (data.callback instanceof Promise)
										requestAnimationFrame(async () => {
											if (data.callback) await data.callback();
										});
									else {
										data.callback();
									}
								}
								if (data.timeId) clearTimeout(data.timeId);
								target.removeEventListener(eventName, data.handler);
							});
						});
					}
				});
			};
		} catch (e) {
			console.log(e);
		}
	};
}
