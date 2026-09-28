import { a as setContext, e as element, b as attr_class, c as clsx, d as attr_style, f as bind_props, g as ensure_array_like, h as escape_html, i as spread_props, j as head, k as attr } from "../../chunks/root.js";
import { c as client, s as styleSynced, p as profile, S as SvelteMap } from "../../chunks/basic.svelte.js";
import { o as onDestroy, s as setToastWrapperContext, T as Toast, M as Main$2 } from "../../chunks/index.js";
import { M as MessageComponent } from "../../chunks/MessageComponent.js";
import "clsx";
/* empty css                                                    */
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/state.svelte.js";
const favicon = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='107'%20height='128'%20viewBox='0%200%20107%20128'%3e%3ctitle%3esvelte-logo%3c/title%3e%3cpath%20d='M94.157%2022.819c-10.4-14.885-30.94-19.297-45.792-9.835L22.282%2029.608A29.92%2029.92%200%200%200%208.764%2049.65a31.5%2031.5%200%200%200%203.108%2020.231%2030%2030%200%200%200-4.477%2011.183%2031.9%2031.9%200%200%200%205.448%2024.116c10.402%2014.887%2030.942%2019.297%2045.791%209.835l26.083-16.624A29.92%2029.92%200%200%200%2098.235%2078.35a31.53%2031.53%200%200%200-3.105-20.232%2030%2030%200%200%200%204.474-11.182%2031.88%2031.88%200%200%200-5.447-24.116'%20style='fill:%23ff3e00'/%3e%3cpath%20d='M45.817%20106.582a20.72%2020.72%200%200%201-22.237-8.243%2019.17%2019.17%200%200%201-3.277-14.503%2018%2018%200%200%201%20.624-2.435l.49-1.498%201.337.981a33.6%2033.6%200%200%200%2010.203%205.098l.97.294-.09.968a5.85%205.85%200%200%200%201.052%203.878%206.24%206.24%200%200%200%206.695%202.485%205.8%205.8%200%200%200%201.603-.704L69.27%2076.28a5.43%205.43%200%200%200%202.45-3.631%205.8%205.8%200%200%200-.987-4.371%206.24%206.24%200%200%200-6.698-2.487%205.7%205.7%200%200%200-1.6.704l-9.953%206.345a19%2019%200%200%201-5.296%202.326%2020.72%2020.72%200%200%201-22.237-8.243%2019.17%2019.17%200%200%201-3.277-14.502%2017.99%2017.99%200%200%201%208.13-12.052l26.081-16.623a19%2019%200%200%201%205.3-2.329%2020.72%2020.72%200%200%201%2022.237%208.243%2019.17%2019.17%200%200%201%203.277%2014.503%2018%2018%200%200%201-.624%202.435l-.49%201.498-1.337-.98a33.6%2033.6%200%200%200-10.203-5.1l-.97-.294.09-.968a5.86%205.86%200%200%200-1.052-3.878%206.24%206.24%200%200%200-6.696-2.485%205.8%205.8%200%200%200-1.602.704L37.73%2051.72a5.42%205.42%200%200%200-2.449%203.63%205.79%205.79%200%200%200%20.986%204.372%206.24%206.24%200%200%200%206.698%202.486%205.8%205.8%200%200%200%201.602-.704l9.952-6.342a19%2019%200%200%201%205.295-2.328%2020.72%2020.72%200%200%201%2022.237%208.242%2019.17%2019.17%200%200%201%203.277%2014.503%2018%2018%200%200%201-8.13%2012.053l-26.081%2016.622a19%2019%200%200%201-5.3%202.328'%20style='fill:%23fff'/%3e%3c/svg%3e";
const defaultContainer = {
  class: ["w-full h-full"]
};
const CONTEXT = /* @__PURE__ */ Symbol("container-ctx");
function setContainerContext(ctx) {
  setContext(CONTEXT, ctx);
}
function Main$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const NAME_COMP = {
      vi: "Container",
      get en() {
        return this.vi;
      }
    };
    const MESSAGE_ERRORS = { main: { vi: "chưa có nội dung", en: "No data" } };
    let { children, $$slots, $$events, ...props } = $$props;
    let configs = {
      get duration() {
        let d = props.transitionDuration ?? client.browser?.duration ?? 300;
        d = typeof d == "number" ? d : parseFloat(d);
        return d;
      },
      ref: void 0,
      get event() {
        const defaultEvents = [
          {
            events: {
              load: {
                handler() {
                  if (props.portal) {
                    if (props.portal instanceof HTMLElement && configs.ref) {
                      props.portal.append(configs.ref);
                    } else {
                      const portal = document.getElementById(props.portal);
                      if (portal && configs.ref) {
                        portal.append(configs.ref);
                      }
                    }
                  }
                },
                options: {}
              },
              click: { handler() {
              }, options: { delay: 3e3 } }
            }
          }
        ];
        return [...defaultEvents, ...props.events ?? []];
      }
    };
    setContainerContext({
      get size() {
        return props.size ?? client.browser?.size ?? "md";
      }
    });
    onDestroy(() => {
      if (props.portal && configs.ref) {
        if (props.portal instanceof HTMLElement) {
          props.portal.removeChild(configs.ref);
        } else {
          const portal = document.getElementById(props.portal);
          if (portal && portal.contains(configs.ref)) {
            portal.removeChild(configs.ref);
          }
        }
      }
    });
    if (children) {
      $$renderer2.push("<!--[0-->");
      element(
        $$renderer2,
        props.as ?? "div",
        () => {
          $$renderer2.push(`${attr_class(clsx(props.overwriteDefaultStyles ? props.class : [
            ...typeof defaultContainer.class == "object" ? defaultContainer.class ?? [] : typeof defaultContainer.class == "string" ? [defaultContainer.class] : [],
            ...typeof props.class == "object" ? props.class ?? [] : typeof props.class == "string" ? [props.class] : []
          ]))}${attr_style("", {
            "touch-action": props.touchActionDisabled ? "none" : "auto",
            width: typeof props.width == "number" ? `${props.width}px` : props.width ?? "auto",
            height: typeof props.height == "number" ? `${props.height}px` : props.height ?? "auto",
            "transition-duration": "var(--transition-duration)",
            "--transition-duration": props.transitionEnabled ? `${configs.duration}ms` : void 0
          })}`);
        },
        () => {
          children($$renderer2);
          $$renderer2.push(`<!---->`);
        }
      );
    } else {
      $$renderer2.push("<!--[-1-->");
      MessageComponent($$renderer2, {
        nameComponent: NAME_COMP[client.browser?.language ?? "en"] ?? "",
        color: "danger",
        description: MESSAGE_ERRORS.main[client.browser?.language ?? "en"] ?? ""
      });
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { configs });
  });
}
function Main($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...props } = $$props;
    let configs = {
      get disabled() {
        return props.disabled;
      },
      get size() {
        return props.size ?? client.browser?.size ?? "md";
      },
      get style() {
        const defaultStyles = ["toast-wrapper"];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get event() {
        const defaultEvents = [
          {
            events: {
              load(_, data) {
                if (data?.node instanceof HTMLElement && client.browser?.toasts && !client.browser.toasts.ref) {
                  document.body.appendChild(data.node);
                  client.browser.toasts.ref = data.node;
                }
              }
            }
          }
        ];
        const propEvents = props.events ?? [];
        return [...defaultEvents, ...propEvents];
      }
    };
    setToastWrapperContext(configs);
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style))}`);
      },
      () => {
        $$renderer2.push(`<!--[-->`);
        const each_array = ensure_array_like([...client.browser?.toasts?.children?.values() ?? []]);
        for (let _ = 0, $$length = each_array.length; _ < $$length; _++) {
          let children = each_array[_];
          Toast($$renderer2, {
            duration: children.duration,
            id: children.id,
            position: children.position,
            color: children.color,
            offset: children.offset,
            disabled: children.disabled,
            children: ($$renderer3) => {
              if (children.indicator) {
                $$renderer3.push("<!--[0-->");
                if (Toast.Indicator) {
                  $$renderer3.push("<!--[-->");
                  Toast.Indicator($$renderer3, { icon: children.indicator });
                  $$renderer3.push("<!--]-->");
                } else {
                  $$renderer3.push("<!--[!-->");
                  $$renderer3.push("<!--]-->");
                }
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--> `);
              if (Toast.Content) {
                $$renderer3.push("<!--[-->");
                Toast.Content($$renderer3, {
                  children: ($$renderer4) => {
                    if (Toast.Content.Title) {
                      $$renderer4.push("<!--[-->");
                      Toast.Content.Title($$renderer4, {
                        children: ($$renderer5) => {
                          $$renderer5.push(`<!---->${escape_html(children.title)}`);
                        },
                        $$slots: { default: true }
                      });
                      $$renderer4.push("<!--]-->");
                    } else {
                      $$renderer4.push("<!--[!-->");
                      $$renderer4.push("<!--]-->");
                    }
                    $$renderer4.push(` `);
                    if (children.description) {
                      $$renderer4.push("<!--[0-->");
                      if (Toast.Content.Description) {
                        $$renderer4.push("<!--[-->");
                        Toast.Content.Description($$renderer4, {
                          children: ($$renderer5) => {
                            $$renderer5.push(`<!---->Hello description`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer4.push("<!--]-->");
                      } else {
                        $$renderer4.push("<!--[!-->");
                        $$renderer4.push("<!--]-->");
                      }
                    } else {
                      $$renderer4.push("<!--[-1-->");
                    }
                    $$renderer4.push(`<!--]-->`);
                  },
                  $$slots: { default: true }
                });
                $$renderer3.push("<!--]-->");
              } else {
                $$renderer3.push("<!--[!-->");
                $$renderer3.push("<!--]-->");
              }
              $$renderer3.push(` `);
              if (children.showCloseButton) {
                $$renderer3.push("<!--[0-->");
                if (Toast.Close) {
                  $$renderer3.push("<!--[-->");
                  Toast.Close($$renderer3, {});
                  $$renderer3.push("<!--]-->");
                } else {
                  $$renderer3.push("<!--[!-->");
                  $$renderer3.push("<!--]-->");
                }
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--> `);
              if (children.action) {
                $$renderer3.push("<!--[0-->");
                Main$2($$renderer3, spread_props([children.action]));
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]-->`);
            },
            $$slots: { default: true }
          });
        }
        $$renderer2.push(`<!--]-->`);
      }
    );
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data, children } = $$props;
    let configs = {
      event: [
        {
          events: {
            load(_, data2) {
              if (data2?.node instanceof HTMLElement) {
                if (!client.browser) client.browser = {};
                client.browser.layers = new SvelteMap();
                client.browser.layers.set(data2.node, "root");
              }
            }
          }
        }
      ]
    };
    onDestroy(() => {
    });
    head("12qhfyh", $$renderer2, ($$renderer3) => {
      $$renderer3.push(`<link rel="icon"${attr("href", favicon)} class="svelte-12qhfyh"/> <meta name="theme-color" id="themeMetaTag" content="#defaultColor" class="svelte-12qhfyh"/>`);
    });
    Main$1($$renderer2, {
      touchActionDisabled: profile.visualKeyboard.focusOn ? true : false,
      transitionEnabled: true,
      width: profile.browser.dimensions?.width ?? 0,
      height: profile.browser.dimensions?.height ?? 0,
      class: "me-jwwv8c",
      events: configs.event,
      children: ($$renderer3) => {
        children($$renderer3);
        $$renderer3.push(`<!---->`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Main($$renderer2, {});
    $$renderer2.push(`<!---->`);
  });
}
export {
  _layout as default
};
