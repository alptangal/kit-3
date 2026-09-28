import { e as element, b as attr_class, c as clsx, h as escape_html } from "./root.js";
import { s as styleSynced } from "./basic.svelte.js";
import { I as Icon, i as iconify } from "./index.js";
function MessageComponent($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    let configs = {
      get style() {
        let defaultStyle = ["font-bold flex items-end gap-2"];
        switch (props.color) {
          case "default":
            defaultStyle = [...defaultStyle, "text-[hsl(var(--default))]"];
            break;
          case "accent":
            defaultStyle = [...defaultStyle, "text-[hsl(var(--accent))]"];
            break;
          case "danger":
            defaultStyle = [...defaultStyle, "text-[hsl(var(--danger))]"];
            break;
          case "warning":
            defaultStyle = [...defaultStyle, "text-[hsl(var(--warning))]"];
            break;
          case "success":
            defaultStyle = [...defaultStyle, "text-[hsl(var(--success))]"];
            break;
        }
        return styleSynced({ defaultStyles: defaultStyle, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      name: {
        get style() {
          return styleSynced(
            {
              defaultStyles: ["flex items-center text-2xl"],
              propStyles: props.nameComponentClass
            },
            props.overwriteDefaultStyles
          );
        }
      },
      description: {
        get style() {
          return styleSynced({ defaultStyles: [""], propStyles: props.descriptionClass }, props.overwriteDefaultStyles);
        }
      }
    };
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style))}`);
      },
      () => {
        if (typeof children == "function") {
          $$renderer2.push("<!--[0-->");
          children($$renderer2);
          $$renderer2.push(`<!---->`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<div${attr_class(clsx(configs.name.style))}>`);
          Icon($$renderer2, { icon: iconify["dangerous-outline-rounded"] });
          $$renderer2.push(`<!---->${escape_html(props.nameComponent)}</div> `);
          if (props.description) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div${attr_class(clsx(configs.description.style))}>${escape_html(props.description)}</div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]-->`);
        }
        $$renderer2.push(`<!--]-->`);
      }
    );
  });
}
export {
  MessageComponent as M
};
