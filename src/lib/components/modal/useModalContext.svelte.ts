import { getContext, setContext } from 'svelte';
import type {
	ModalConfigs,
	ModalContainerConfigs,
	ModalBodyConfigs,
	ModalHeaderConfigs,
	ModalFooterConfigs
} from './_interface';
import { client } from '$store/basic.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { fly, fade, slide } from 'svelte/transition';

// ---------------------------------------------------------------------------
// Context symbols – single source of truth (requirement #6)
// ---------------------------------------------------------------------------
const MODAL_CTX = Symbol('modal-context');
const MODAL_CONTAINER_CTX = Symbol('modal-container-context');

export function setModalContext(context: ModalConfigs) {
	setContext(MODAL_CTX, context);
}
export function getModalContext(): ModalConfigs | undefined {
	return getContext<ModalConfigs>(MODAL_CTX);
}
export function setModalContainerContext(context: ModalContainerConfigs) {
	setContext(MODAL_CONTAINER_CTX, context);
}
export function getModalContainerContext(): ModalContainerConfigs | undefined {
	return getContext<ModalContainerConfigs>(MODAL_CONTAINER_CTX);
}

export function useModalContext() {
	return {
		setModalContext,
		getModalContext,
		setModalContainerContext,
		getModalContainerContext,
		isTopLayer,
		getLayerIndex,
		getTotalLayers,
		createModalPortal,
		generateModalId,
		resolveTransition,
		modalTransition,
		getFocusableElements
	};
}

// ---------------------------------------------------------------------------
// Layer / stacking helpers  (requirement #5 – nested modals via client.browser.layers)
// ---------------------------------------------------------------------------
function sortedModalLayers(): [HTMLElement, number][] {
	const layers = client.browser?.layers;
	if (!layers) return [];
	return [...layers.entries()]
		.filter((e): e is [HTMLElement, number] => e[1] !== 'root')
		.sort((a, b) => (b[1] as number) - (a[1] as number));
}
export function isTopLayer(node: HTMLElement | undefined): boolean {
	if (!node) return false;
	const sorted = sortedModalLayers();
	if (sorted.length === 0) return true;
	return sorted[0]?.[0] === node;
}
export function getLayerIndex(node: HTMLElement | undefined): number {
	if (!node) return -1;
	return sortedModalLayers().findIndex(([el]) => el === node);
}
export function getTotalLayers(): number {
	return sortedModalLayers().length + 1;
}

// ---------------------------------------------------------------------------
// Portal helper  (requirement #3) – appends to body, SSR-safe
// ---------------------------------------------------------------------------
export interface PortalReturn {
	destroy: () => void;
}
export function createModalPortal(node: HTMLElement): PortalReturn {
	if (typeof document === 'undefined' || !node) return { destroy() {} };
	if (!client.browser) (client as unknown as Record<string, unknown>).browser = {} as typeof client.browser;
	if (!client.browser.layers) client.browser.layers = new SvelteMap();
	const layers = client.browser.layers;
	node.classList.add('layer');
	layers.set(node, performance.now());
	const rootEntry = [...layers.entries()].find(([, v]) => v === 'root');
	if (rootEntry) {
		const rootLayer = rootEntry[0] as HTMLElement;
		rootLayer.parentElement?.appendChild(node);
	} else if (document.body) {
		document.body.appendChild(node);
	}
	const destroy = () => {
		if (client.browser?.layers && node) client.browser.layers.delete(node);
		if (node.parentElement) node.remove();
	};
	return { destroy };
}

// ---------------------------------------------------------------------------
// ID helpers for ARIA (requirement #2)
// ---------------------------------------------------------------------------
let idCounter = 0;
export function generateModalId(prefix = 'modal'): string {
	idCounter += 1;
	return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Transition helper (requirement #7) – fly / slide / fade variants
// ---------------------------------------------------------------------------
export type ModalTransition = 'fly' | 'slide' | 'fade' | 'none';
export interface TransitionParams {
	duration?: number;
	x?: number;
	y?: number;
	delay?: number;
	opacity?: number;
}
export function resolveTransition(
	variant: ModalTransition | undefined,
	placement: string | undefined,
	browserTransition: typeof client.browser.transition | undefined
): { name: ModalTransition; params: TransitionParams } {
	const v: ModalTransition = variant ?? 'fly';
	if (v === 'none') return { name: 'none', params: {} };
	if (v === 'fade') {
		const base = browserTransition?.fade ?? {};
		return { name: 'fade', params: { duration: base.duration ?? 220 } };
	}
	if (v === 'slide') {
		const base = browserTransition?.fly ?? {};
		const duration = base.duration ?? 280;
		if (placement === 'top') return { name: 'fly', params: { y: -30, duration } };
		if (placement === 'bottom') return { name: 'fly', params: { y: 30, duration } };
		return { name: 'fly', params: { y: 20, duration } };
	}
	const base = browserTransition?.fly ?? {};
	const duration = base.duration ?? 300;
	if (placement === 'top') return { name: 'fly', params: { y: -30, duration } };
	if (placement === 'bottom') return { name: 'fly', params: { y: 30, duration } };
	return { name: 'fly', params: { y: 24, duration } };
}
export function modalTransition(node: Element, params: TransitionParams & { type?: ModalTransition }) {
	const { type = 'fly', ...rest } = params as TransitionParams & { type?: ModalTransition };
	if (type === 'fade') return fade(node, rest as never);
	if (type === 'slide') return slide(node, rest as never);
	if (type === 'none') return { duration: 0, tick: () => {} } as never;
	return fly(node, rest as never);
}

// ---------------------------------------------------------------------------
// Focus-trap helper (requirement #1)
// ---------------------------------------------------------------------------
const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
export function getFocusableElements(root: HTMLElement): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		(el) => el.offsetParent !== null || el === document.activeElement
	);
}

export type { ModalConfigs, ModalContainerConfigs, ModalBodyConfigs, ModalHeaderConfigs, ModalFooterConfigs };
