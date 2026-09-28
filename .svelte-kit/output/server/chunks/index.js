import { l as ssr_context, m as lifecycle_function_unavailable, o as attributes, p as derived, a as setContext, q as getContext, e as element, f as bind_props, b as attr_class, c as clsx, k as attr, d as attr_style, i as spread_props, h as escape_html } from "./root.js";
import { c as client, s as styleSynced, a as convertToPixels, b as convertToMiliseconds, S as SvelteMap } from "./basic.svelte.js";
import "clsx";
import { g as generateIcon, c as checkIconState } from "./functions.js";
import { i as initial_base, b as base } from "./server.js";
import { r as resolve_route, a as add_data_suffix } from "./routing.js";
import "./exports.js";
import { try_get_request_store } from "@sveltejs/kit/internal/server";
import "@sveltejs/kit/internal";
import "./utils.js";
import "./state.svelte.js";
function html(value) {
  var html2 = String(value ?? "");
  var open = "<!---->";
  return open + html2 + "<!---->";
}
function onDestroy(fn) {
  /** @type {SSRContext} */
  ssr_context.r.on_destroy(fn);
}
function mount() {
  lifecycle_function_unavailable("mount");
}
function unmount() {
  lifecycle_function_unavailable("unmount");
}
function Icon($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const iconState = {
      // Last icon name
      name: "",
      // Loading status
      loading: null,
      // Destroyed status
      destroyed: false
    };
    const { $$slots, $$events, ...props } = $$props;
    let iconData = derived(() => {
      return checkIconState(props.icon, iconState, loaded, props.onload);
    });
    let data = derived(() => {
      const generatedData = iconData() ? generateIcon(iconData().data, props) : null;
      if (generatedData && iconData().classes && props["class"] === void 0) {
        generatedData.attributes["class"] = (typeof props["class"] === "string" ? props["class"] + " " : "") + iconData().classes.join(" ");
      }
      return generatedData;
    });
    function loaded() {
    }
    onDestroy(() => {
      iconState.destroyed = true;
      if (iconState.loading) {
        iconState.loading.abort();
        iconState.loading = null;
      }
    });
    if (data()) {
      $$renderer2.push("<!--[0-->");
      if (data().svg) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<svg${attributes({ ...data().attributes }, void 0, void 0, void 0, 3)}>${html(data().body)}</svg>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span${attributes({ ...data().attributes })}></span>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
const iconify = {
  "close-rounded": "material-symbols-light:close-rounded",
  "content-copy-outline-rounded": "material-symbols-light:content-copy-outline-rounded",
  "content-paste-rounded": "material-symbols-light:content-paste-rounded",
  "check-rounded": "material-symbols-light:check-rounded",
  "dangerous-outline-rounded": "material-symbols-light:dangerous-outline-rounded",
  "password-2-off-rounded": "material-symbols-light:password-2-off-rounded",
  "password-2-rounded": "material-symbols-light:password-2-rounded",
  "search-rounded": "material-symbols-light:search-rounded",
  "info-i-rounded": "material-symbols-light:info-i-rounded"
};
function resolve(id, params) {
  if (!id.startsWith("/")) {
    throw new Error(
      `Cannot use \`resolve(...)\` with a non-absolute pathname or route ID (got "${id}"). \`resolve\` is only for internal pathnames and route IDs; external URLs should be used directly.`
    );
  }
  const resolved = resolve_route(
    id,
    /** @type {Record<string, string>} */
    params
  );
  {
    const store = try_get_request_store();
    if (store && !store.state.prerendering?.fallback) {
      const pathname = store.event.isDataRequest ? add_data_suffix(store.event.url.pathname) : store.event.url.pathname;
      const after_base = pathname.slice(initial_base.length);
      const segments = after_base.split("/").slice(2);
      const prefix = segments.map(() => "..").join("/") || ".";
      return prefix + resolved;
    }
  }
  return base + resolved;
}
const TooltipCtx = /* @__PURE__ */ Symbol("tooltip-ctx");
function setToolTipCtx(ctx) {
  setContext(TooltipCtx, ctx);
}
function getTooltipCtx() {
  return getContext(TooltipCtx);
}
function Main$b($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const OFFSET = 10;
    let { children, disabled = void 0, $$slots, $$events, ...props } = $$props;
    let configs = {
      status: {},
      get style() {
        const defaultStyles = ["tooltip-root", `size-${this.size}`];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get size() {
        return props.size ?? client.browser?.size ?? "md";
      },
      get delay() {
        return convertToMiliseconds(props.delay) ?? client.browser?.delay ?? 300;
      },
      get offset() {
        return convertToPixels(props.offset) ?? OFFSET;
      },
      get rounded() {
        return props.rounded ?? this.size ?? client.browser?.size ?? "md";
      },
      actionButtons: {
        info: {
          get style() {
            const defaultStyles = ["tooltip-info", "p-0!"];
            return styleSynced({ defaultStyles });
          },
          get event() {
            return void 0;
          }
        }
      }
    };
    let contentMeta = {};
    let arrowMeta = {};
    setToolTipCtx({
      get size() {
        return configs.size;
      },
      get ref() {
        return configs.ref?.firstElementChild;
      },
      get status() {
        return configs.status;
      },
      get delay() {
        return configs.delay;
      },
      get offset() {
        return configs.offset;
      },
      get contentMeta() {
        return contentMeta;
      },
      get rounded() {
        return configs.rounded;
      },
      updateContentMeta(data) {
        contentMeta = data;
      },
      get arrowMeta() {
        return arrowMeta;
      },
      updateArrowMeta(data) {
        arrowMeta = data;
      }
    });
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-1ha9pw0")}`);
      },
      () => {
        children?.($$renderer2);
        $$renderer2.push(`<!----> `);
        if (client.browser?.isMobile && !props.actionButtons?.info?.hide) {
          $$renderer2.push("<!--[0-->");
          Main$1($$renderer2, {
            class: configs.actionButtons.info.style,
            icon: iconify["info-i-rounded"],
            events: configs.actionButtons.info.event,
            size: "xs",
            rounded: "full",
            color: "info",
            actived: configs.actionButtons.info.actived,
            variant: "soft"
          });
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
    );
    bind_props($$props, { disabled });
  });
}
function Main$a($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, disabled = void 0, $$slots, $$events, ...props } = $$props;
    let configs = {
      get style() {
        const defaultStyles = [
          "tooltip-content",
          `size-${this.size}`,
          `rounded-${this.rounded}`
        ];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get size() {
        return props.size ?? tooltipCtx?.size ?? client.browser?.size ?? "md";
      },
      get rounded() {
        return props.rounded ?? tooltipCtx?.rounded ?? this.size;
      }
    };
    const tooltipCtx = getTooltipCtx();
    if (tooltipCtx?.status?.hover) {
      $$renderer2.push("<!--[0-->");
      element(
        $$renderer2,
        props.as ?? "div",
        () => {
          $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-1z0smom")}`);
        },
        () => {
          children?.($$renderer2);
          $$renderer2.push(`<!---->`);
        }
      );
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { disabled });
  });
}
function Main$9($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...props } = $$props;
    const tooltipCtx = getTooltipCtx();
    let configs = {
      get size() {
        return props.size ?? tooltipCtx?.contentMeta?.size ?? tooltipCtx?.size ?? "md";
      },
      get color() {
        return props.color ?? "default";
      },
      get style() {
        const defaultStyles = [
          "tooltip-arrow",
          `color-${this.color}`,
          `size-${this.size}`,
          tooltipCtx?.contentMeta?.position ? `position-${tooltipCtx.contentMeta.position}` : void 0
        ];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      }
    };
    if (tooltipCtx?.contentMeta?.position) {
      $$renderer2.push("<!--[0-->");
      element($$renderer2, props.as ?? "div", () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-1t3x1iy")}`);
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
const key$1 = /* @__PURE__ */ Symbol("toast-wrapper-context");
function setToastWrapperContext(context) {
  setContext(key$1, context);
}
function getToastWrapperContext() {
  return getContext(key$1);
}
const key = /* @__PURE__ */ Symbol("toast-context");
function setToastContext(context) {
  setContext(key, context);
}
function getToastContext() {
  return getContext(key);
}
function getClient() {
  const { client: client2 } = require("$store/basic.svelte");
  return client2;
}
function createToast(data) {
  const client2 = getClient();
  if (!client2.browser) {
    client2.browser = {};
  }
  if (!client2.browser.toasts) {
    client2.browser.toasts = {
      children: /* @__PURE__ */ new Map(),
      create(toastData) {
        const id = toastData.id ?? crypto.randomUUID();
        const showCloseButton = toastData.showCloseButton ?? true;
        this.children.set(id, { ...toastData, id, showCloseButton });
        return id;
      },
      remove(key2) {
        this.children.delete(key2);
      }
    };
  }
  return client2.browser.toasts.create(data);
}
const toast = {
  success: (title, description, options = {}) => {
    return createToast({ ...options, title, description, color: "success" });
  },
  error: (title, description, options = {}) => {
    return createToast({ ...options, title, description, color: "error" });
  },
  warning: (title, description, options = {}) => {
    return createToast({ ...options, title, description, color: "warning" });
  },
  info: (title, description, options = {}) => {
    return createToast({ ...options, title, description, color: "info" });
  },
  default: (title, description, options = {}) => {
    return createToast({ ...options, title, description, color: "default" });
  },
  remove: (id) => {
    const client2 = getClient();
    client2.browser?.toasts?.remove?.(id);
  }
};
function Main$8($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    let configs = {
      status: {},
      get id() {
        return props.id;
      },
      get disabled() {
        return toastWrapperContext?.disabled ?? props.disabled;
      },
      get color() {
        return props.color ?? "default";
      },
      get size() {
        return props.size ?? toastWrapperContext?.size ?? client.browser?.size ?? "md";
      },
      get style() {
        const defaultStyles = [
          "toast-root",
          `color-${this.color}`,
          `size-${this.size}`,
          this.disabled ? "disabled" : void 0
        ];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get duration() {
        if (props.duration == "infinite") return "infinite";
        return convertToMiliseconds(props.duration) ?? 300;
      },
      get offset() {
        return props.offset ?? 10;
      },
      get position() {
        return props.position ?? "bottom";
      },
      get event() {
        const defaultEvents = [
          {
            events: {
              load(_, data) {
                if (client.browser?.toasts?.children && data?.node instanceof HTMLElement && client.browser.toasts.ref && props.id) {
                  if (!configs.timeId) configs.timeId = new SvelteMap();
                  const timeName = "processingDuration";
                  const startAt = performance.now();
                  [...client.browser.toasts.ref.children].findIndex((children2) => children2.isSameNode(data.node));
                  const initValue = client.browser.toasts.children.get(props.id);
                  if (initValue) {
                    client.browser.toasts.children.set(props.id, {
                      ...initValue,
                      ref: data.node,
                      position: configs.position,
                      offset: configs.offset
                    });
                  }
                  if (typeof configs.duration == "number") {
                    const processingDuration = () => {
                      if (configs.duration == "infinite") return;
                      const currentTime = performance.now();
                      if (currentTime - startAt >= configs.duration) {
                        if (client.browser?.toasts?.remove && props.id) {
                          client.browser.toasts.remove(props.id);
                        }
                      } else {
                        if (!configs.timeId) configs.timeId = new SvelteMap();
                        configs.timeId.set(timeName, requestAnimationFrame(processingDuration));
                      }
                    };
                    configs.timeId.set(timeName, requestAnimationFrame(processingDuration));
                  }
                }
              },
              mouseenter() {
                configs.status.hover = true;
              },
              mouseleave() {
                configs.status.hover = false;
              }
            }
          }
        ];
        const propEvents = props.events ?? [];
        return [...defaultEvents, ...propEvents];
      }
    };
    const toastWrapperContext = getToastWrapperContext();
    setToastContext(configs);
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-sn94ls")}${attr("data-position", configs.position)}${attr_style("", { "--offset": `${configs.offset}px` })}`);
      },
      () => {
        children?.($$renderer2);
        $$renderer2.push(`<!---->`);
      }
    );
  });
}
function Main$7($$renderer) {
}
function Main$6($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    let configs = {
      get style() {
        const defaultStyles = ["toast-content-root"];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      }
    };
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style))}`);
      },
      () => {
        children?.($$renderer2);
        $$renderer2.push(`<!---->`);
      }
    );
  });
}
function Main$5($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...props } = $$props;
    element($$renderer2, props.as ?? "div", void 0, () => {
      Main($$renderer2, { icon: props.icon });
    });
  });
}
function Main$4($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    let configs = {
      get style() {
        const defaultStyles = ["toast-content-title-root", `color-${this.color}`];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get color() {
        return props.color ?? toastContext?.color ?? "default";
      }
    };
    const toastContext = getToastContext();
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-fnm967")}`);
      },
      () => {
        children?.($$renderer2);
        $$renderer2.push(`<!---->`);
      }
    );
  });
}
const sizeIndex = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl"
];
function Main$3($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    let configs = {
      get style() {
        const defaultStyles = [
          "description-root",
          `size-${this.size}`,
          `color-description-${this.color}`
        ];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get color() {
        return props.color ?? "default";
      },
      get size() {
        if (props.size) return props.size;
        const parentSize = toastContext?.size ?? client.browser?.size ?? "md";
        const defaultSize = sizeIndex[sizeIndex.indexOf(parentSize) - 1];
        return defaultSize;
      }
    };
    const toastContext = getToastContext();
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-1lwzu97")}`);
      },
      () => {
        children?.($$renderer2);
        $$renderer2.push(`<!---->`);
      }
    );
  });
}
function Main$2($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...props } = $$props;
    let configs = {
      get size() {
        return props.size ?? toastContext?.size ?? client.browser?.size ?? "md";
      },
      get color() {
        return props.color ?? "error";
      },
      get disabled() {
        return props.disabled ?? toastContext?.disabled;
      },
      get style() {
        const defaultStyles = ["toast-close", "p-0! h-fit"];
        const propsClass = typeof props.class == "string" ? [props.class] : Array.isArray(props.class) ? [...props.class] : typeof props.class == "object" ? [
          ...typeof props.class.root == "object" ? props.class.root : [props.class.root]
        ] : [];
        return styleSynced({ defaultStyles, propStyles: propsClass }, props.overwriteDefaultStyles);
      },
      get variant() {
        return props.variant ?? "solid";
      },
      get event() {
        const defaultEvent = [
          {
            events: {
              mousedown() {
                if (client.browser?.toasts && toastContext?.id) client.browser.toasts.remove(toastContext.id);
              }
            }
          }
        ];
        return [...defaultEvent];
      }
    };
    const toastContext = getToastContext();
    if (toastContext?.status.hover) {
      $$renderer2.push("<!--[0-->");
      Main$1($$renderer2, spread_props([
        configs,
        {
          events: configs.event,
          icon: iconify["close-rounded"],
          class: configs.style
        }
      ]));
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
const NAME$1 = /* @__PURE__ */ Symbol("form-context");
function getFormContext() {
  return getContext(NAME$1);
}
function setFormContext(context) {
  setContext(NAME$1, context);
}
function Main$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    const formContext = getFormContext();
    const onClickHandler = derived(() => props.onclick ?? props.onClick);
    const styleDerived = derived(() => {
      const defaultStyles = [
        "button-root",
        `variant-${// Reset button enabled khi:
        // 1. Có bất kỳ field nào thay đổi dữ liệu (kể cả khi form có prop data)
        // 2. Hoặc 1 element đang áp dụng validation và focus sau đó blur (touched hoặc có validation messages/process)
        // Disabled khi form không có thay đổi dữ liệu và chưa có validation blur
        // Submit: disabled khi validation không hợp lệ
        // Submit: disabled khi form pristine VÀ không có dữ liệu ban đầu từ props
        variantDerived()}`,
        `size-${sizeDerived()}`,
        props["aspect-square"] ? "aspect-square" : void 0,
        props.rounded ? `rounded-${props.rounded}` : void 0,
        disabledDerived() ? "disabled" : void 0,
        loadingDerived() ? "loading" : void 0,
        !props.transitionDisabled ? "transition" : void 0,
        `color-${colorDerived()}`,
        configs.status?.tap || props.actived ? `button-tapped` : void 0,
        // Nếu có `to`, render dạng thẻ <a>
        // Tính href cho thẻ <a>
        // tooltipDerived không set làm native `title` để tránh double tooltip
        tooltipDerived() ? "has_tooltip" : void 0
      ];
      const propStyles = typeof props.class == "object" && !Array.isArray(props.class) ? props.class.root : props.class;
      return styleSynced({ defaultStyles, propStyles }, props.overwriteDefaultStyles);
    });
    const loadingDerived = derived(() => {
      if (props.loading) return props.loading;
      if (
        // Reset button enabled khi:
        // 1. Có bất kỳ field nào thay đổi dữ liệu (kể cả khi form có prop data)
        // 2. Hoặc 1 element đang áp dụng validation và focus sau đó blur (touched hoặc có validation messages/process)
        // Disabled khi form không có thay đổi dữ liệu và chưa có validation blur
        // Submit: disabled khi validation không hợp lệ
        // Submit: disabled khi form pristine VÀ không có dữ liệu ban đầu từ props
        typeDerived() === "submit" && formContext?.loading
      ) return formContext.loading;
      return void 0;
    });
    const disabledDerived = derived(() => {
      if (props.disabled) return props.disabled;
      if (formContext) {
        if (
          // Reset button enabled khi:
          // 1. Có bất kỳ field nào thay đổi dữ liệu (kể cả khi form có prop data)
          // 2. Hoặc 1 element đang áp dụng validation và focus sau đó blur (touched hoặc có validation messages/process)
          // Disabled khi form không có thay đổi dữ liệu và chưa có validation blur
          // Submit: disabled khi validation không hợp lệ
          // Submit: disabled khi form pristine VÀ không có dữ liệu ban đầu từ props
          typeDerived() === "reset"
        ) {
          if (formContext.disabled) return true;
          if (formContext.childrens?.size) {
            const hasAnyDirty = [...formContext.childrens.values()].some((child) => {
              const c = child;
              const inp = c["children"]?.input;
              const isChanged = c["status"]?.changed === true;
              const isTouched = c["status"]?.touched === true;
              const hasInpMsg = Boolean(inp?.validation?.messages?.size);
              const hasInpProc = Boolean(inp?.validation?.process?.size);
              const hasCMsg = Boolean(c["validation"]?.messages?.size);
              if (isChanged || isTouched || hasInpMsg || hasInpProc || hasCMsg) {
                return true;
              }
              return false;
            });
            return !hasAnyDirty;
          }
          return true;
        }
        if (formContext.loading || formContext.disabled) return true;
        if (
          // Submit: disabled khi validation không hợp lệ
          // Submit: disabled khi form pristine VÀ không có dữ liệu ban đầu từ props
          typeDerived() === "submit"
        ) {
          if (!formContext.validation.isValid) return true;
          if (formContext.childrens?.size) {
            const allPristine = [...formContext.childrens.values()].every((child) => !child.status.changed);
            if (allPristine) {
              const hasInitialData = formContext.data != null || [...formContext.childrens.values()].some((child) => {
                if ("initialValue" in child) {
                  const val = child.initialValue;
                  return val !== void 0 && val !== "";
                }
                if ("checked" in child) return child.checked !== void 0;
                return false;
              });
              return !hasInitialData;
            }
          }
        }
      }
      return false;
    });
    const typeDerived = derived(() => props.type ?? "button");
    const variantDerived = derived(() => props.variant ?? "solid");
    const sizeDerived = derived(() => props.size ?? formContext?.size ?? client.browser?.size ?? "md");
    const colorDerived = derived(() => props.color ?? "default");
    const loadingSpinnerDerived = derived(() => props.loadingSpinner ?? true);
    const tagDerived = derived(() => {
      if (props.as) return props.as;
      if (props.to) return "a";
      return "button";
    });
    const hrefDerived = derived(() => {
      if (!props.to) return void 0;
      try {
        return resolve(props.to);
      } catch {
        return props.to;
      }
    });
    const delayDerived = derived(() => {
      if (!props.delay) return client.browser?.delay ?? 300;
      if (props.delay == "none") return void 0;
      return typeof props.delay == "number" ? props.delay : props.delay.includes("ms") ? parseFloat(props.delay) : parseFloat(props.delay) * 1e3;
    });
    const transitionDurationDerived = derived(() => {
      if (!props.transitionDuration) return client.browser?.delay ?? 300;
      return typeof props.transitionDuration == "number" ? props.transitionDuration : props.transitionDuration.includes("ms") ? parseFloat(props.transitionDuration) : parseFloat(props.transitionDuration) * 1e3;
    });
    const loadingDurationDerived = derived(() => {
      if (!props.loadingDuration) return (client.browser?.delay ?? 300) * 10;
      return typeof props.loadingDuration == "number" ? props.loadingDuration : props.loadingDuration.includes("ms") ? parseFloat(props.loadingDuration) : parseFloat(props.loadingDuration) * 1e3;
    });
    const debounceDerived = derived(() => props.debounce);
    const longPressDurationDerived = derived(() => props.longPressDuration ?? 500);
    const rippleDerived = derived(() => props.ripple ?? false);
    const tooltipDerived = derived(() => props.tooltip);
    const ariaLabelDerived = derived(() => props["aria-label"] ?? props.tooltip);
    const shortcutDerived = derived(() => props.shortcut ? Array.isArray(props.shortcut) ? props.shortcut.map((s) => s.toLowerCase()) : [props.shortcut.toLowerCase()] : void 0);
    function handleNavigationClick(e) {
      if (!props.to) return;
      return;
    }
    function spawnRipple(e, node) {
      const rect = node.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height) * 2;
      ripple.className = "button-ripple";
      ripple.style.cssText = `
			width:${size}px; height:${size}px;
			left:${e.clientX - rect.left - size / 2}px;
			top:${e.clientY - rect.top - size / 2}px;
		`;
      node.appendChild(ripple);
      const tid = setTimeout(() => ripple.remove(), 600);
      return () => {
        clearTimeout(tid);
        ripple.remove();
      };
    }
    const eventDerived = derived(() => {
      const defaultEvent = {
        events: {
          load(e, data) {
            const node = data?.node;
            if (!(node instanceof HTMLElement)) return;
            if (shortcutDerived()?.length) {
              const handleKey = (ev) => {
                if (disabledDerived() || loadingDerived()) return;
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT" || activeEl.isContentEditable)) {
                  return;
                }
                const key2 = ev.key.toLowerCase();
                if (shortcutDerived().includes(key2)) {
                  ev.preventDefault();
                  node.click();
                }
              };
              window.addEventListener("keydown", handleKey);
              return () => window.removeEventListener("keydown", handleKey);
            }
          },
          pointerdown: {
            handler(e) {
              if (disabledDerived() || loadingDerived()) return;
              if (delayDerived()) {
                if (!configs.status) configs.status = {};
                if (!configs.timeId) configs.timeId = /* @__PURE__ */ new Map();
                const prevTap = configs.timeId.get("animation-tap");
                if (prevTap) clearTimeout(prevTap);
                configs.status.tap = true;
              }
              if (rippleDerived() && configs.ref) {
                spawnRipple(e, configs.ref);
              }
              if (props.onLongPress) {
                if (!configs.status) configs.status = {};
                if (!configs.timeId) configs.timeId = /* @__PURE__ */ new Map();
                const prevLp = configs.timeId.get("long-press");
                if (prevLp) clearTimeout(prevLp);
                configs.status.pointerStartX = e.clientX;
                configs.status.pointerStartY = e.clientY;
                configs.timeId.set("long-press", setTimeout(
                  async () => {
                    if (!configs.status) configs.status = {};
                    configs.status.longPress = true;
                    configs.status.longPressFired = true;
                    await props.onLongPress(e);
                    if (configs.status) configs.status.longPress = false;
                  },
                  longPressDurationDerived()
                ));
              }
            },
            options: {}
          },
          pointermove: {
            handler(e) {
              if (disabledDerived() || loadingDerived()) return;
              const lpId = configs.timeId?.get("long-press");
              if (lpId && configs.status?.pointerStartX !== void 0 && configs.status?.pointerStartY !== void 0) {
                const pe = e;
                const deltaX = Math.abs(pe.clientX - configs.status.pointerStartX);
                const deltaY = Math.abs(pe.clientY - configs.status.pointerStartY);
                if (deltaX > 10 || deltaY > 10) {
                  clearTimeout(lpId);
                  configs.timeId?.delete("long-press");
                  if (configs.status) {
                    configs.status.pointerStartX = void 0;
                    configs.status.pointerStartY = void 0;
                  }
                }
              }
            },
            options: {}
          },
          pointerup: {
            handler() {
              if (delayDerived() && configs.status?.tap) {
                if (!configs.timeId) configs.timeId = /* @__PURE__ */ new Map();
                configs.timeId.set("animation-tap", setTimeout(
                  () => {
                    if (configs.status) configs.status.tap = false;
                  },
                  delayDerived()
                ));
              }
              const lpId = configs.timeId?.get("long-press");
              if (lpId) {
                clearTimeout(lpId);
                configs.timeId?.delete("long-press");
              }
              if (configs.status) {
                configs.status.longPress = false;
                configs.status.pointerStartX = void 0;
                configs.status.pointerStartY = void 0;
              }
            },
            options: {}
          },
          pointerleave: {
            handler() {
              if (configs.status?.tap) {
                configs.status.tap = false;
                const prevTap = configs.timeId?.get("animation-tap");
                if (prevTap) clearTimeout(prevTap);
              }
              const lpId = configs.timeId?.get("long-press");
              if (lpId) {
                clearTimeout(lpId);
                configs.timeId?.delete("long-press");
              }
              if (configs.status) {
                configs.status.longPress = false;
                configs.status.pointerStartX = void 0;
                configs.status.pointerStartY = void 0;
              }
            },
            options: {}
          },
          click: {
            handler: async (e, data) => {
              if (tagDerived() === "a" && props.to) {
                const mouseEvent = e;
                if (mouseEvent) {
                  handleNavigationClick();
                  if (mouseEvent.button === 0 && !mouseEvent.metaKey && !mouseEvent.ctrlKey && !mouseEvent.shiftKey && !mouseEvent.altKey) {
                    return;
                  }
                }
              }
              if (loadingDerived() || disabledDerived()) return;
              if (configs.status?.longPressFired) {
                configs.status.longPressFired = false;
                return;
              }
              if (debounceDerived()) {
                if (configs.status?.debouncing) return;
                if (!configs.status) configs.status = {};
                if (!configs.timeId) configs.timeId = /* @__PURE__ */ new Map();
                configs.status.debouncing = true;
                configs.timeId.set("debounce", setTimeout(
                  () => {
                    if (configs.status) configs.status.debouncing = false;
                  },
                  debounceDerived()
                ));
              }
              if (props.confirmText) {
                const confirmed = window.confirm(props.confirmText);
                if (!confirmed) return;
              }
              if (typeDerived() === "reset" && formContext?.childrens?.size) {
                [...formContext.childrens.values()].forEach((field) => {
                  field.reset();
                });
                if (formContext.onReset) formContext.onReset();
              }
              if (typeDerived() === "submit" && formContext) {
                formContext.disabled = true;
                formContext.loading = true;
              }
              try {
                if (onClickHandler() && e instanceof MouseEvent) await onClickHandler()(e);
              } finally {
                if (typeDerived() === "submit" && formContext) {
                  formContext.loading = false;
                  formContext.disabled = false;
                }
              }
            },
            options: {}
          }
        }
      };
      return [{ events: defaultEvent.events }, ...props.events ?? []];
    });
    let configs = {
      status: {},
      get style() {
        return styleDerived();
      },
      get loading() {
        return loadingDerived();
      },
      get disabled() {
        return disabledDerived();
      },
      get type() {
        return typeDerived();
      },
      get variant() {
        return variantDerived();
      },
      get size() {
        return sizeDerived();
      },
      get color() {
        return colorDerived();
      },
      get delay() {
        return delayDerived();
      },
      get transitionDuration() {
        return transitionDurationDerived();
      },
      get loadingDuration() {
        return loadingDurationDerived();
      },
      get event() {
        return eventDerived();
      }
    };
    element(
      $$renderer2,
      tagDerived(),
      () => {
        $$renderer2.push(`${attr("type", tagDerived() === "button" ? configs.type : void 0)}${attr("href", tagDerived() === "a" ? hrefDerived() : void 0)}${attr("target", props.to ? props.target ?? "_self" : void 0)}${attr("rel", props.to && props.target === "_blank" ? props.rel ?? "noopener noreferrer" : props.rel)}${attr_class(clsx(configs.style), "svelte-e3zcdb")}${attr("disabled", tagDerived() === "button" ? disabledDerived() || void 0 : void 0, true)}${attr("aria-disabled", disabledDerived() || loadingDerived() ? "true" : void 0)}${attr("aria-busy", loadingDerived() ? "true" : void 0)}${attr("data-tap", configs.status?.tap)}${attr("data-long-press", configs.status?.longPress)}${attr("aria-label", ariaLabelDerived())}${attr_style("", {
          "--transition-duration": `${configs.transitionDuration}ms`,
          "--loading-duration": `${configs.loadingDuration}ms`
        })}`);
      },
      () => {
        if (loadingDerived() && loadingSpinnerDerived()) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="button-spinner svelte-e3zcdb" aria-hidden="true"></span>`);
        } else if (typeof props.icon == "string") {
          $$renderer2.push("<!--[1-->");
          Main($$renderer2, { icon: props.icon, size: props.size });
        } else if (typeof props.icon == "object" && props.icon.leading) {
          $$renderer2.push("<!--[2-->");
          Main($$renderer2, { icon: props.icon.leading, size: props.size });
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (children) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="button-render svelte-e3zcdb">`);
          children?.($$renderer2);
          $$renderer2.push(`<!----></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (typeof props.icon == "object" && props.icon.trailing) {
          $$renderer2.push("<!--[0-->");
          Main($$renderer2, { icon: props.icon.trailing, size: props.size });
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (tooltipDerived()) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="button-tooltip svelte-e3zcdb" role="tooltip">${escape_html(tooltipDerived())}</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
    );
    bind_props($$props, { configs });
  });
}
const NAME = /* @__PURE__ */ Symbol("textfield-context");
function setTextFieldContext(context) {
  setContext(NAME, context);
}
function getTextFieldContext() {
  return getContext(NAME);
}
const CONTEXT = /* @__PURE__ */ Symbol("search-main-context");
function setSearchMainContext(ctx) {
  setContext(CONTEXT, ctx);
}
function getSearchMainContext() {
  return getContext(CONTEXT);
}
function Main($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...props } = $$props;
    let configs = {
      get size() {
        return props.size ?? searchMainCtx?.size ?? textfieldCtx?.size ?? formCtx?.size ?? client.browser?.size ?? "md";
      },
      get style() {
        const defaultStyles = ["icon"];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      event: [
        {
          events: {
            load: {
              handler() {
                if (props.onLoad) props.onLoad({
                  ref: configs.ref,
                  get width() {
                    return this.ref?.offsetWidth;
                  },
                  get height() {
                    return this.ref?.offsetHeight;
                  }
                });
              }
            }
          }
        }
      ]
    };
    const textfieldCtx = getTextFieldContext();
    const formCtx = getFormContext();
    const searchMainCtx = getSearchMainContext();
    onDestroy(() => {
      if (props.onDestroy) props.onDestroy({ ref: configs.ref });
    });
    element(
      $$renderer2,
      props.as ?? "span",
      () => {
        $$renderer2.push(`${attr("data-size", configs.size)}${attr_class(clsx(configs.style))}`);
      },
      () => {
        Icon($$renderer2, { icon: props.icon });
      }
    );
    bind_props($$props, { configs });
  });
}
const Tooltip = Object.assign(Main$b, {
  Content: Main$a,
  Arrow: Main$9
});
const ToastContentReAssign = Object.assign(Main$6, {
  Title: Main$4,
  Description: Main$3
});
const Toast = Object.assign(Main$8, {
  Action: Main$7,
  Content: ToastContentReAssign,
  Indicator: Main$5,
  Close: Main$2
});
export {
  Icon as I,
  Main$1 as M,
  Toast as T,
  setSearchMainContext as a,
  Main as b,
  getFormContext as c,
  getTextFieldContext as d,
  setFormContext as e,
  setTextFieldContext as f,
  getSearchMainContext as g,
  sizeIndex as h,
  iconify as i,
  Tooltip as j,
  mount as m,
  onDestroy as o,
  setToastWrapperContext as s,
  toast as t,
  unmount as u
};
