<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { client } from '$store/basic.svelte';
	import { handleEvents } from '$modules/_attachments';
	import { styleSynced } from '$modules';
	import {
		setModalContext,
		createModalPortal,
		generateModalId,
		resolveTransition,
		modalTransition,
		getFocusableElements,
		isTopLayer
	} from './useModalContext.svelte';
	import { releaseModalContainter } from './utils';
	import type { ModalConfigs, ModalProps } from './_interface';

	let { children, display = $bindable(), ...props }: ModalProps = $props();

	// Unique IDs for ARIA (requirement #2) — stored in configs so Header/Body can reference
	const ariaIds = {
		modalId: generateModalId('modal'),
		headerId: generateModalId('modal-header'),
		bodyId: generateModalId('modal-body'),
		footerId: generateModalId('modal-footer')
	};

	let configs: ModalConfigs = $state({
		_display: undefined as undefined | boolean,
		get display() {
			return this._display;
		},
		set display(v) {
			this._display = v;
			display = v;
		},
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		get placement() {
			return props.placement ?? 'center';
		},
		get variant() {
			return props.variant ?? 'blur';
		},
		get isDimissable() {
			return props.isDimissable ?? false;
		},
		get transitionType() {
			return (props.transitionType as ModalConfigs['transitionType']) ?? 'fly';
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'modal-root',
				`size-${this.size}`,
				`variant-${this.variant}`
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get event() {
			const defaultEvents = [
				{
					events: {
						load(_evt: unknown, data: unknown) {
							const node = (data as { node?: unknown })?.node;
							if (node instanceof HTMLElement) {
								const portal = createModalPortal(node);
								(configs as unknown as Record<string, unknown>)._portalDestroy = portal.destroy;
								// Activate focus trap after portal mount
								requestAnimationFrame(() => activateFocusTrap());
							}
							return () => {
								deactivateFocusTrap(false);
								const destroy = (configs as unknown as Record<string, unknown>)._portalDestroy as
									| (() => void)
									| undefined;
								destroy?.();
							};
						},
						keydown(e: unknown) {
							const event = e as KeyboardEvent;
							if (event.key === 'Escape' && configs.isDimissable) {
								// Only topmost modal handles Escape (requirement #5)
								if (!isTopLayer(configs.ref)) return;
								event.stopPropagation();
								configs.display = false;
							}
						},
						mousedown(e: unknown) {
							const event = e as MouseEvent;
							const target = event.target as HTMLElement;
							if (configs.isDimissable) {
								if (target === configs.ref || !configs.children.container?.ref?.contains(target)) {
									// Only top layer responds to backdrop click
									if (!isTopLayer(configs.ref)) return;
									configs.display = false;
								}
							}
						}
					}
				}
			] as unknown as ModalProps['events'];
			return [...(defaultEvents ?? []), ...(props.events ?? [])];
		},
		children: {},
		ariaIds
	});

	// ------------------------------------------------------------------
	// Focus trap (requirement #1)
	// ------------------------------------------------------------------
	let triggerElement: HTMLElement | null = null;
	let trapCleanup: (() => void) | null = null;

	function activateFocusTrap() {
		if (!configs.ref || typeof document === 'undefined') return;
		// Save trigger to restore on close
		triggerElement = document.activeElement as HTMLElement | null;

		const focusables = getFocusableElements(configs.ref);
		if (focusables.length) {
			focusables[0].focus();
		} else {
			// Make container focusable and focus it
			if (!configs.ref.hasAttribute('tabindex')) configs.ref.setAttribute('tabindex', '-1');
			configs.ref.focus();
		}

		const handleTab = (e: KeyboardEvent) => {
			if (e.key !== 'Tab') return;
			if (!isTopLayer(configs.ref)) return;
			const els = getFocusableElements(configs.ref!);
			if (!els.length) return;
			const first = els[0];
			const last = els[els.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};

		configs.ref.addEventListener('keydown', handleTab);
		trapCleanup = () => configs.ref?.removeEventListener('keydown', handleTab);
	}

	function deactivateFocusTrap(restore = true) {
		trapCleanup?.();
		trapCleanup = null;
		if (restore && triggerElement && typeof triggerElement.focus === 'function') {
			// Only restore if focus is still inside modal or on body
			try {
				triggerElement.focus();
			} catch {
				/* ignore */
			}
		}
		triggerElement = null;
	}

	// Restore focus when display becomes false (covers programmatic close + backdrop + Escape)
	$effect(() => {
		if (!display && triggerElement) {
			// Delay to let transition finish before restoring
			const t = setTimeout(() => deactivateFocusTrap(true), 0);
			return () => clearTimeout(t);
		}
	});

	// ------------------------------------------------------------------
	// Layer stacking animation for size="full" (kept from original)
	// ------------------------------------------------------------------
	$effect(() => {
		if (client.browser?.layers?.size && configs.size == 'full') {
			const totalLayers = client.browser.layers.size + 1;
			const sortedEntries = [...client.browser.layers.entries()]
				.filter((entry): entry is [HTMLElement, number] => entry[1] != 'root')
				.sort((a, b) => (b[1] as number) - (a[1] as number));
			let i = 0;
			for (const entry of sortedEntries) {
				const node = entry[0];
				if (node) {
					node.style.transform = `scale(${(100 - i) / 100})`;
					node.style.position = 'absolute';
					node.style.zIndex = `${totalLayers - i}`;
					node.style.transformOrigin = 'top';
				}
				i += 2;
			}
			const rootEntry = [...client.browser.layers.entries()].find(([, v]) => v == 'root');
			if (rootEntry) {
				const rootLayer = rootEntry[0] as HTMLElement;
				if (totalLayers <= 2) {
					['transform', 'top', 'transform-origin', 'z-index'].forEach((pr) =>
						rootLayer.style.removeProperty(pr)
					);
				} else {
					rootLayer.style.transform = `scale(${(100 - i) / 100})`;
					rootLayer.style.top = '0px';
					rootLayer.style.transformOrigin = 'top';
				}
			}
			let a = 0;
			for (const entry of sortedEntries.reverse()) {
				const node = entry[0];
				if (node) {
					node.style.top = `${(a + 1) * 10}px`;
				}
				a++;
			}
		}
	});

	setModalContext(configs);

	// Auto-container creation when children are not wrapped in Modal.Container
	let autoContainer: (() => void) | undefined;

	$effect(() => {
		if (!configs.children.container && configs.ref && children) {
			const cleanup = releaseModalContainter(configs);
			if (cleanup) autoContainer = cleanup;
		}
	});
	$effect(() => {
		if (!display && autoContainer) {
			autoContainer();
			autoContainer = undefined;
			configs.children.container = undefined;
			configs.ref = undefined;
		}
	});

	onMount(() => {
		configs.display = display;
	});

	onDestroy(() => {
		autoContainer?.();
		deactivateFocusTrap(false);
		const destroy = (configs as unknown as Record<string, unknown>)._portalDestroy as
			| (() => void)
			| undefined;
		destroy?.();
	});

	let resolvedTransition = $derived(
		resolveTransition(configs.transitionType, configs.placement, client.browser?.transition)
	);
</script>

{#if display}
	<svelte:element
		this={props.as ?? 'div'}
		bind:this={configs.ref}
		class={configs.style}
		transition:modalTransition={{ ...resolvedTransition.params, type: resolvedTransition.name }}
		{@attach handleEvents(configs.event)}
		role="dialog"
		aria-modal="true"
		aria-labelledby={ariaIds.headerId}
		aria-describedby={ariaIds.bodyId}
		id={ariaIds.modalId}
	>
		<div class="contents" bind:this={configs.children.contentWrapper}>{@render children?.()}</div>
	</svelte:element>
{/if}

<style lang="scss">
	@use '$styles/sizes.scss';
	.modal-root {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100dvh;
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.65);
		box-sizing: border-box;
		padding: 1rem;
		overflow: hidden;

		&.variant-blur {
			-webkit-backdrop-filter: blur(8px);
			backdrop-filter: blur(8px);
		}

		&.variant-transparent {
			background: transparent;
		}

		&.variant-opaque {
			background: rgba(0, 0, 0, 0.8);
		}

		.contents {
			display: contents;
		}
	}
</style>
