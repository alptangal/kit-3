import { e as element, b as attr_class, c as clsx, p as derived } from "./root.js";
import { s as styleSynced, c as client } from "./basic.svelte.js";
import { d as getTextFieldContext, h as sizeIndex } from "./index.js";
import { g as getCheckboxContext } from "./index4.js";
import { u as useMessageDisplay } from "./Main.js";
function Main($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    const textFieldContext = getTextFieldContext();
    const checkboxContext = getCheckboxContext();
    const persistent = derived(() => props.persistent ?? false);
    const autoHide = derived(() => props.autoHide ?? true);
    const messageDisplay = useMessageDisplay(() => ({
      showValid: false,
      persistent: persistent(),
      autoHide: autoHide()
    }));
    const shouldRender = derived(() => messageDisplay.shouldRenderDescription);
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
        const parentSize = textFieldContext?.size ?? checkboxContext?.size ?? client.browser?.size ?? "md";
        const defaultSize = sizeIndex[sizeIndex.indexOf(parentSize) - 1];
        return defaultSize;
      }
    };
    if (shouldRender()) {
      $$renderer2.push("<!--[0-->");
      element(
        $$renderer2,
        props.as ?? "div",
        () => {
          $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-1ji8qrd")}`);
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
  });
}
export {
  Main as M
};
