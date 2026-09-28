import { a as setContext, q as getContext, e as element, b as attr_class, c as clsx, k as attr, f as bind_props } from "./root.js";
import { o as onDestroy, M as Main$5, i as iconify } from "./index.js";
import { c as client, S as SvelteMap, s as styleSynced } from "./basic.svelte.js";
import "clsx";
const MODAL_CTX = /* @__PURE__ */ Symbol("modal-context");
const MODAL_CONTAINER_CTX = /* @__PURE__ */ Symbol("modal-container-context");
function setModalContext(context) {
  setContext(MODAL_CTX, context);
}
function getModalContext() {
  return getContext(MODAL_CTX);
}
function setModalContainerContext(context) {
  setContext(MODAL_CONTAINER_CTX, context);
}
function getModalContainerContext() {
  return getContext(MODAL_CONTAINER_CTX);
}
function sortedModalLayers() {
  const layers = client.browser?.layers;
  if (!layers) return [];
  return [...layers.entries()].filter((e) => e[1] !== "root").sort((a, b) => b[1] - a[1]);
}
function isTopLayer(node) {
  if (!node) return false;
  const sorted = sortedModalLayers();
  if (sorted.length === 0) return true;
  return sorted[0]?.[0] === node;
}
function createModalPortal(node) {
  if (typeof document === "undefined" || !node) return { destroy() {
  } };
  if (!client.browser) client.browser = {};
  if (!client.browser.layers) client.browser.layers = new SvelteMap();
  const layers = client.browser.layers;
  node.classList.add("layer");
  layers.set(node, performance.now());
  const rootEntry = [...layers.entries()].find(([, v]) => v === "root");
  if (rootEntry) {
    const rootLayer = rootEntry[0];
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
let idCounter = 0;
function generateModalId(prefix = "modal") {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
function getFocusableElements(root) {
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => el.offsetParent !== null || el === document.activeElement);
}
function Main$4($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    const modalContext = getModalContext();
    let configs = {
      get size() {
        return props.size ?? modalContext?.size ?? client.browser?.size ?? "md";
      },
      get style() {
        const defaultStyles = [
          "modal-container-root",
          `size-${this.size}`,
          `placement-${this.placement}`
        ];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get placement() {
        return props.placement ?? modalContext?.placement ?? "center";
      },
      children: {}
    };
    if (modalContext) {
      modalContext.children.container = configs;
    }
    setModalContainerContext(configs);
    onDestroy(() => {
      if (modalContext?.children.container === configs) {
        modalContext.children.container = void 0;
      }
    });
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-1bpkwa1")}`);
      },
      () => {
        children?.($$renderer2);
        $$renderer2.push(`<!---->`);
      }
    );
  });
}
function Main$3($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, display = void 0, $$slots, $$events, ...props } = $$props;
    const ariaIds = {
      modalId: generateModalId("modal"),
      headerId: generateModalId("modal-header"),
      bodyId: generateModalId("modal-body"),
      footerId: generateModalId("modal-footer")
    };
    let configs = {
      _display: void 0,
      get display() {
        return this._display;
      },
      set display(v) {
        this._display = v;
        display = v;
      },
      get size() {
        return props.size ?? client.browser?.size ?? "md";
      },
      get placement() {
        return props.placement ?? "center";
      },
      get variant() {
        return props.variant ?? "blur";
      },
      get isDimissable() {
        return props.isDimissable ?? false;
      },
      get transitionType() {
        return props.transitionType ?? "fly";
      },
      get style() {
        const defaultStyles = ["modal-root", `size-${this.size}`, `variant-${this.variant}`];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get event() {
        const defaultEvents = [
          {
            events: {
              load(_evt, data) {
                const node = data?.node;
                if (node instanceof HTMLElement) {
                  const portal = createModalPortal(node);
                  configs._portalDestroy = portal.destroy;
                  requestAnimationFrame(() => activateFocusTrap());
                }
                return () => {
                  deactivateFocusTrap(false);
                  const destroy = configs._portalDestroy;
                  destroy?.();
                };
              },
              keydown(e) {
                const event = e;
                if (event.key === "Escape" && configs.isDimissable) {
                  if (!isTopLayer(configs.ref)) return;
                  event.stopPropagation();
                  configs.display = false;
                }
              },
              mousedown(e) {
                const event = e;
                const target = event.target;
                if (configs.isDimissable) {
                  if (target === configs.ref || !configs.children.container?.ref?.contains(target)) {
                    if (!isTopLayer(configs.ref)) return;
                    configs.display = false;
                  }
                }
              }
            }
          }
        ];
        return [...defaultEvents ?? [], ...props.events ?? []];
      },
      children: {},
      ariaIds
    };
    let triggerElement = null;
    let trapCleanup = null;
    function activateFocusTrap() {
      if (!configs.ref || typeof document === "undefined") return;
      triggerElement = document.activeElement;
      const focusables = getFocusableElements(configs.ref);
      if (focusables.length) {
        focusables[0].focus();
      } else {
        if (!configs.ref.hasAttribute("tabindex")) configs.ref.setAttribute("tabindex", "-1");
        configs.ref.focus();
      }
      const handleTab = (e) => {
        if (e.key !== "Tab") return;
        if (!isTopLayer(configs.ref)) return;
        const els = getFocusableElements(configs.ref);
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
      configs.ref.addEventListener("keydown", handleTab);
      trapCleanup = () => configs.ref?.removeEventListener("keydown", handleTab);
    }
    function deactivateFocusTrap(restore = true) {
      trapCleanup?.();
      trapCleanup = null;
      if (restore && triggerElement && typeof triggerElement.focus === "function") {
        try {
          triggerElement.focus();
        } catch {
        }
      }
      triggerElement = null;
    }
    setModalContext(configs);
    onDestroy(() => {
      deactivateFocusTrap(false);
      const destroy = configs._portalDestroy;
      destroy?.();
    });
    if (display) {
      $$renderer2.push("<!--[0-->");
      element(
        $$renderer2,
        props.as ?? "div",
        () => {
          $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-5e3si1")} role="dialog" aria-modal="true"${attr("aria-labelledby", ariaIds.headerId)}${attr("aria-describedby", ariaIds.bodyId)}${attr("id", ariaIds.modalId)}`);
        },
        () => {
          $$renderer2.push(`<div class="me-i6cmy0">`);
          children?.($$renderer2);
          $$renderer2.push(`<!----></div>`);
        }
      );
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { display });
  });
}
function Main$2($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    let modalContainerContext = getModalContainerContext();
    let modalContext = getModalContext();
    let configs = {
      get style() {
        const defaultStyles = [
          "modal-header-root",
          children ? "justify-between" : "justify-end"
        ];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      actionButton: {
        close: {
          get display() {
            return props.actionButtons?.close?.display ?? true;
          },
          get size() {
            if (modalContext?.size == "full") return "9xl";
            return modalContext?.size ?? client.browser?.size ?? "md";
          },
          get event() {
            const defaultEvents = [
              {
                events: {
                  mousedown() {
                    if (modalContext) modalContext.display = false;
                  }
                }
              }
            ];
            return defaultEvents;
          }
        }
      }
    };
    if (modalContainerContext) {
      modalContainerContext.children.header = configs;
    }
    element(
      $$renderer2,
      props.as ?? "header",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-1p8vtbd")}`);
      },
      () => {
        children?.($$renderer2);
        $$renderer2.push(`<!----> `);
        if (configs.actionButton.close?.display) {
          $$renderer2.push("<!--[0-->");
          Main$5($$renderer2, {
            icon: iconify["close-rounded"],
            size: configs.actionButton.close.size,
            events: configs.actionButton.close.event,
            color: "error",
            variant: "outline",
            class: "me-rz57b9",
            "aria-label": "Close modal"
          });
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
    );
  });
}
function Main$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    const modalContainerContext = getModalContainerContext();
    let configs = {
      get style() {
        const defaultStyles = ["modal-body-root"];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      }
    };
    if (modalContainerContext) {
      modalContainerContext.children.body = configs;
    }
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style))} role="document"`);
      },
      () => {
        children?.($$renderer2);
        $$renderer2.push(`<!---->`);
      }
    );
  });
}
function Main($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    const modalContainerContext = getModalContainerContext();
    let configs = {
      get style() {
        const defaultStyles = ["modal-footer-root"];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      }
    };
    if (modalContainerContext) {
      modalContainerContext.children.footer = configs;
    }
    element(
      $$renderer2,
      props.as ?? "footer",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-n092nz")}`);
      },
      () => {
        children?.($$renderer2);
        $$renderer2.push(`<!---->`);
      }
    );
  });
}
const Modal = Object.assign(Main$3, {
  Container: Object.assign(Main$4, { Header: Main$2, Body: Main$1, Footer: Main })
});
export {
  Modal as M,
  Main$4 as a,
  Main$2 as b,
  Main$1 as c,
  Main as d
};
