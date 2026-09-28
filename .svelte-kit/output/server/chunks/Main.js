import { e as element, b as attr_class, c as clsx, k as attr, p as derived, g as ensure_array_like, h as escape_html } from "./root.js";
import { s as styleSynced, c as client, d as SvelteSet, e as apiFetch } from "./basic.svelte.js";
import { e as encryption } from "./encryption.js";
import { e as setFormContext, d as getTextFieldContext, c as getFormContext, f as setTextFieldContext, h as sizeIndex } from "./index.js";
import { g as getCheckboxContext } from "./index4.js";
function Main$3($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    let submitting = false;
    let configs = {
      // Initialize childrens as SvelteSet for reactivity
      childrens: new SvelteSet(),
      _loading: void 0,
      get loading() {
        if (!configs.childrens?.size) return false;
        const someFieldLoading = [...configs.childrens.values()].some((children2) => children2.loading);
        if (someFieldLoading) return someFieldLoading;
        return this._loading;
      },
      set loading(v) {
        this._loading = v;
      },
      get style() {
        const defaultStyles = ["form-root", `size-${this.size}`];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get method() {
        return props.method ?? "get";
      },
      get size() {
        return props.size ?? client.browser?.size ?? "md";
      },
      get action() {
        return props.action ?? "#";
      },
      get encryptDisabled() {
        return props.encryptDisabled;
      },
      get data() {
        return props.data;
      },
      status: {
        get changed() {
          if (!configs.childrens?.size) return false;
          return [...configs.childrens.values()].some((children2) => children2.status?.changed === true);
        }
      },
      get event() {
        const defaultEvents = [
          {
            events: {
              submit: {
                async handler(e) {
                  const event = e;
                  event.preventDefault();
                  if (submitting) return;
                  configs.disabled = true;
                  configs.loading = true;
                  submitting = true;
                  try {
                    if (props.onSubmit) await props.onSubmit();
                  } finally {
                    configs.disabled = false;
                    configs.loading = false;
                    submitting = false;
                  }
                  const hasAction = configs.action && configs.action !== "#";
                  if (!hasAction || !configs.validation.isValid) return;
                  const jsonData = {};
                  [...configs.childrens?.values() ?? []].forEach((children2) => {
                    if ("checked" in children2) {
                      if (children2.name) jsonData[children2.name] = children2.checked;
                    } else if ("value" in children2) {
                      if (children2.name) jsonData[children2.name] = children2.value;
                    }
                  });
                  let res;
                  if (configs.encryptDisabled) {
                    res = await apiFetch(configs.action, { method: configs.method, body: jsonData });
                  } else {
                    res = await encryption.fetchSecure(configs.action, { method: configs.method, body: jsonData });
                  }
                  if (res.ok) {
                    configs.reset();
                    if (props.onReset) props.onReset();
                  }
                  configs.disabled = false;
                  configs.loading = false;
                  if (props.onResponse) props.onResponse();
                }
              },
              reset: {
                handler(e) {
                  e.preventDefault();
                  configs.reset();
                }
              }
            }
          }
        ];
        return defaultEvents;
      },
      validation: {
        get isValid() {
          if (configs.childrens?.size) {
            const childrenArray = [...configs.childrens.values()];
            const validatedChildren = childrenArray.filter((child) => child.validation && child.validation.isValid !== void 0);
            if (validatedChildren.length === 0) return true;
            return validatedChildren.every((children2) => children2.validation?.isValid === true && children2.loading != true && children2.validation?.isValid != "pending");
          }
          return true;
        }
      },
      reset() {
        if (configs.childrens?.size) {
          [...configs.childrens.values()].forEach((children2) => children2.reset());
        }
        if (props.onReset) props.onReset();
      },
      get onReset() {
        return props.onReset;
      },
      get onSubmit() {
        return props.onSubmit;
      },
      get onResponse() {
        return props.onResponse;
      }
    };
    setFormContext(configs);
    element(
      $$renderer2,
      props.as ?? "form",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-gcbo3d")}${attr("method", configs.method)}`);
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
    let { children, $$slots, $$events, ...props } = $$props;
    const textFieldContext = getTextFieldContext();
    const checkboxContext = getCheckboxContext();
    const forId = derived(() => props.for ?? (textFieldContext?.name ? `field-${textFieldContext.name}` : void 0));
    let configs = {
      get style() {
        const defaultStyles = ["label-root", `size-${this.size}`, `color-${this.color}`];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get color() {
        if (props.color) return props.color;
        if (textFieldContext?.children?.input?.color) {
          const inputColor = textFieldContext.children.input.color;
          if (inputColor !== "default") return inputColor;
        }
        const childInput = textFieldContext?.children?.input;
        if (childInput?.validation) {
          const validation = childInput.validation;
          const isValid = validation.isValid;
          const process = validation.process;
          if (process && process.size > 0) {
            if (isValid == "pending") return "default";
            return isValid ? "success" : "error";
          }
          return "default";
        }
        if (checkboxContext?.required) {
          if (typeof checkboxContext?.validation?.isValid == "boolean") return checkboxContext.validation.isValid ? "success" : "error";
          return "default";
        }
        return "default";
      },
      get size() {
        return props.size ?? textFieldContext?.size ?? checkboxContext?.size ?? client.browser?.size ?? "md";
      }
    };
    element(
      $$renderer2,
      props.as ?? "label",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-rfl4zh")}${attr("for", forId())}`);
      },
      () => {
        children?.($$renderer2);
        $$renderer2.push(`<!----> `);
        if (!props.hiddenRequiredIndicator && (textFieldContext?.required || checkboxContext?.required)) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="me-08bccu">*</span>`);
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
    let configs = {
      // initialValue nằm trong $state → getter changed reactive với nó
      // Capture initial value at creation time (mount) from the bound value or formContext.data
      initialValue: /* @__PURE__ */ (() => {
        return void 0;
      })(),
      status: {
        touched: false,
        get changed() {
          return (configs.initialValue ?? "") !== (configs.value ?? "");
        }
      },
      get size() {
        return props.size ?? formContext?.size ?? client.browser?.size ?? "md";
      },
      get style() {
        const defaultStyles = [
          "textField-root",
          configs.status.hover ? "hover" : void 0,
          this.disabled ? "disabled" : void 0
        ];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get name() {
        return props.name;
      },
      get required() {
        return props.required;
      },
      get disabled() {
        return props.disabled ?? formContext?.disabled ?? void 0;
      },
      get loading() {
        return props.loading ?? formContext?.loading ?? false;
      },
      get event() {
        if (this.disabled) return [];
        const eventDefault = [
          {
            events: {
              mouseover() {
                configs.status.hover = true;
              },
              mouseleave() {
                configs.status.hover = false;
              },
              mousedown(e) {
                const event = e;
                const target = event.target;
                if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
                  event.preventDefault();
                }
                if (event.detail == 1) {
                  if (!configs.status.focus) {
                    configs.status.selectAll = false;
                    if (configs.children?.input) configs.children.input.focus();
                  }
                } else if (event.detail == 2 && configs.value?.length) {
                  configs.status.selectAll = true;
                  if (configs.children?.input) configs.children.input.focus();
                }
              }
            }
          }
        ];
        return eventDefault;
      },
      setValue(input) {
        configs.previousValue = configs.value;
        configs.value = input;
      },
      onEnter() {
        if (formContext && (formContext.childrens?.size ?? 0) > 1 && formContext.ref) {
          const fields = [...formContext.ref.querySelectorAll(".textField-root")].filter((children2) => [...children2.classList].includes("textField-root"));
          const currentIndex = fields.findIndex((field) => field === configs.ref);
          if (formContext.childrens?.size) {
            [...formContext.childrens.values()].forEach((children2) => {
              if (children2.ref == fields[currentIndex < fields.length - 1 ? currentIndex + 1 : 0] && children2.focus) {
                requestAnimationFrame(() => {
                  if (children2.focus) children2.focus();
                });
              }
            });
          }
        }
      },
      get onTab() {
        return this.onEnter;
      },
      focus() {
        if (configs.children?.input?.focus) configs.children.input.focus();
      },
      validation: {
        setValid(v) {
          if (!configs.validation) return;
          configs.validation.isValid = v;
        },
        get isValid() {
          return configs.children?.input?.validation?.isValid ?? void 0;
        }
      },
      reset() {
        configs.status.touched = false;
        if (configs.children?.input) configs.children.input.reset();
        configs.value = configs.initialValue;
        configs.previousValue = configs.initialValue;
        if (configs.validation) configs.validation.isValid = void 0;
      }
    };
    const formContext = getFormContext();
    setTextFieldContext(configs);
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-1n2jt10")}`);
      },
      () => {
        children?.($$renderer2);
        $$renderer2.push(`<!---->`);
      }
    );
  });
}
function useMessageDisplay(optionsGetter) {
  const textFieldContext = getTextFieldContext();
  const checkboxContext = getCheckboxContext();
  const showValid = derived(() => optionsGetter().showValid ?? false);
  const persistent = derived(() => optionsGetter().persistent ?? false);
  const autoHide = derived(() => optionsGetter().autoHide ?? true);
  const rawMessages = derived(() => textFieldContext?.children?.input?.validation.messages ?? checkboxContext?.validation.messages);
  const allWithContent = derived(() => {
    const msgs = [...rawMessages() ?? []].map(([, v]) => v).filter((m) => !!m.content);
    return msgs;
  });
  const hasInvalid = derived(() => allWithContent().some((m) => m.kind === "invalid"));
  const hasAnyMessages = derived(() => allWithContent().length > 0);
  const visibleMessages = derived(() => {
    if (hasInvalid()) return allWithContent().filter((m) => m.kind === "invalid");
    if (showValid()) return allWithContent().filter((m) => m.kind === "valid");
    return [];
  });
  const shouldRenderDescription = derived(() => {
    if (persistent() || autoHide() === false) return true;
    return !hasAnyMessages();
  });
  function formatContent(entry) {
    const lang = client.browser?.language ?? "en";
    const c = entry.content;
    if (!c) return "";
    if (typeof c === "string") return c;
    return c[lang] ?? c.en ?? c.vi ?? "";
  }
  return {
    get rawMessages() {
      return rawMessages();
    },
    get allWithContent() {
      return allWithContent();
    },
    get hasInvalid() {
      return hasInvalid();
    },
    get hasAnyMessages() {
      return hasAnyMessages();
    },
    get visibleMessages() {
      return visibleMessages();
    },
    get shouldRenderDescription() {
      return shouldRenderDescription();
    },
    formatContent
  };
}
function Main($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...props } = $$props;
    const textFieldContext = getTextFieldContext();
    getCheckboxContext();
    const showValid = derived(() => props.showValid ?? false);
    const messageDisplay = useMessageDisplay(() => ({ showValid: showValid() }));
    let configs = {
      get size() {
        if (props.size) return props.size;
        const textFieldSize = textFieldContext?.size ?? client.browser?.size ?? "md";
        const sizeIdx = sizeIndex.indexOf(textFieldSize);
        const defaultSize = sizeIndex[Math.max(0, sizeIdx - 1)];
        return defaultSize;
      },
      get style() {
        const defaultStyles = ["fieldMessages-root", `size-${this.size}`];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      }
    };
    const visibleMessages = derived(() => messageDisplay.visibleMessages);
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-78kk2z")}`);
      },
      () => {
        $$renderer2.push(`<!--[-->`);
        const each_array = ensure_array_like(visibleMessages());
        for (let key = 0, $$length = each_array.length; key < $$length; key++) {
          let item = each_array[key];
          $$renderer2.push(`<p${attr_class(clsx(item.kind), "svelte-78kk2z")}>${escape_html(messageDisplay.formatContent(item))}</p>`);
        }
        $$renderer2.push(`<!--]-->`);
      }
    );
  });
}
export {
  Main$3 as M,
  Main$1 as a,
  Main$2 as b,
  Main as c,
  useMessageDisplay as u
};
