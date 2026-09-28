import { a as setContext, q as getContext, e as element, b as attr_class, c as clsx, k as attr } from "../../../chunks/root.js";
import { c as client, s as styleSynced, S as SvelteMap } from "../../../chunks/basic.svelte.js";
import { M as MessageComponent } from "../../../chunks/MessageComponent.js";
import { omit } from "es-toolkit/compat";
import "clsx";
import { g as getSearchMainContext, a as setSearchMainContext, b as Main$6 } from "../../../chunks/index.js";
import { M as Modal } from "../../../chunks/index3.js";
import "../../../chunks/state.svelte.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
const NAV_MAIN_CTX = /* @__PURE__ */ Symbol("nav-main-ctx");
function setNavigationMainCtx(context) {
  setContext(NAV_MAIN_CTX, context);
}
function getNavigationMainCtx() {
  return getContext(NAV_MAIN_CTX);
}
function Main$5($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const NAME_COMP = { en: "Navigator", vi: "Thanh điều hướng" };
    const MESSAGE_ERROR = {
      main: {
        en: "Not enough data for component ",
        vi: "Lỗi nghiêm trọng do không đủ dữ liệu cung cấp cho component"
      }
    };
    let { children, $$slots, $$events, ...props } = $$props;
    let configs = {
      get style() {
        const defaultStyles = ["nav-main-root"];
        return styleSynced({ defaultStyles });
      },
      childrens: void 0
    };
    setNavigationMainCtx({
      get childrens() {
        return configs.childrens;
      },
      addNode(data) {
        if (!configs.childrens) configs.childrens = new SvelteMap();
        configs.childrens.set(data.position, omit(data, ["position"]));
        return configs.childrens;
      }
    });
    if (children) {
      $$renderer2.push("<!--[0-->");
      element(
        $$renderer2,
        props.as ?? "nav",
        () => {
          $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-itj0d1")}`);
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
        description: MESSAGE_ERROR.main[client.browser?.language ?? "en"] ?? ""
      });
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function Main$4($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    getNavigationMainCtx();
    let configs = {
      get style() {
        return styleSynced({});
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
function Main$3($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    element($$renderer2, props.as ?? "div", void 0, () => {
      children?.($$renderer2);
      $$renderer2.push(`<!---->`);
    });
  });
}
function Main$2($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    element($$renderer2, props.as ?? "div", void 0, () => {
      children?.($$renderer2);
      $$renderer2.push(`<!---->`);
    });
  });
}
const NavigationMenu = Object.assign(Main$5, {
  left: Main$4,
  center: Main$3,
  right: Main$2
});
function Main$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...props } = $$props;
    let searchMainCtx = getSearchMainContext();
    let configs = {
      get size() {
        return props.size ?? searchMainCtx?.size ?? client.browser?.size;
      }
    };
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr("data-size", configs.size)}`);
      },
      () => {
        $$renderer2.push(`control`);
      }
    );
  });
}
function Main($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    [
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
      "8xl",
      "9xl"
    ].reduce(
      (obj, key, idx) => {
        return { ...obj, [key]: { min: { w: 50 * (idx + 1) + 50 } } };
      },
      {}
    );
    let configs = {
      status: {
        loaded: false,
        hover: false,
        focus: false,
        get direction() {
          return props.direction ?? client.browser?.direction ?? "ltr";
        }
      },
      _mode: void 0,
      get mode() {
        return this._mode ?? props.mode;
      },
      set mode(val) {
        this._mode = val;
      },
      value: void 0,
      get style() {
        const defaultStyles = ["search-main-root"];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get size() {
        return props.size ?? "md";
      },
      modal: { status: { display: false } }
    };
    setSearchMainContext({
      get size() {
        return configs.size;
      },
      get status() {
        return configs.status;
      },
      childrens: configs.childrens,
      insertNode(data) {
        if (!data.ref) return;
        if (!configs.childrens) configs.childrens = /* @__PURE__ */ new Map();
        configs.childrens.set(data.ref, data);
      },
      onKeyup(value) {
        configs.value = value;
      },
      onKeydown(value) {
        configs.value = value;
      },
      onBlur(value) {
        configs.value = value;
      },
      onFocus(value) {
        configs.value = value;
      },
      onEnter(value) {
        configs.value = value;
      },
      onChange(value) {
        configs.value = value;
      },
      onClear(value) {
        configs.value = value;
      }
    });
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-1kdupuf")}${attr("data-size", configs.size)}${attr("data-hover", configs.status?.hover)}${attr("data-direction", configs.status?.direction ?? "ltr")}`);
      },
      () => {
        if (configs.mode == "normal" || !configs.mode) {
          $$renderer2.push("<!--[0-->");
          children?.($$renderer2);
          $$renderer2.push(`<!---->`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<div>compact</div>`);
        }
        $$renderer2.push(`<!--]--> `);
        Modal($$renderer2, {
          display: configs.modal?.status?.display,
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->hello`);
          },
          $$slots: { default: true }
        });
        $$renderer2.push(`<!---->`);
      }
    );
  });
}
const SearchMain = Object.assign(Main, {
  Control: Main$1,
  Icon: Main$6
});
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data, children } = $$props;
    let configs = {
      get style() {
        const defaultStyles = [];
        return styleSynced({ defaultStyles });
      }
    };
    $$renderer2.push(`<div${attr_class(clsx(configs.style))}>`);
    NavigationMenu($$renderer2, {
      children: ($$renderer3) => {
        if (NavigationMenu.left) {
          $$renderer3.push("<!--[-->");
          NavigationMenu.left($$renderer3, {
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->left`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push("<!--]-->");
        } else {
          $$renderer3.push("<!--[!-->");
          $$renderer3.push("<!--]-->");
        }
        $$renderer3.push(` `);
        if (NavigationMenu.center) {
          $$renderer3.push("<!--[-->");
          NavigationMenu.center($$renderer3, {
            children: ($$renderer4) => {
              SearchMain($$renderer4, {
                class: "me-u2x0rl",
                children: ($$renderer5) => {
                  if (SearchMain.Control) {
                    $$renderer5.push("<!--[-->");
                    SearchMain.Control($$renderer5, {});
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                },
                $$slots: { default: true }
              });
            },
            $$slots: { default: true }
          });
          $$renderer3.push("<!--]-->");
        } else {
          $$renderer3.push("<!--[!-->");
          $$renderer3.push("<!--]-->");
        }
        $$renderer3.push(` `);
        if (NavigationMenu.right) {
          $$renderer3.push("<!--[-->");
          NavigationMenu.right($$renderer3, {
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->right`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push("<!--]-->");
        } else {
          $$renderer3.push("<!--[!-->");
          $$renderer3.push("<!--]-->");
        }
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    children($$renderer2);
    $$renderer2.push(`<!----></div>`);
  });
}
export {
  _layout as default
};
