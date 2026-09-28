import "clsx";
import { M as Main, i as iconify, j as Tooltip } from "../../../chunks/index.js";
import { M as Main$1 } from "../../../chunks/index4.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="me-294tl2">`);
    Main($$renderer2, {
      icon: iconify["search-rounded"],
      rounded: "full",
      variant: "outline",
      color: "info",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Button`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Tooltip($$renderer2, {
      children: ($$renderer3) => {
        Main($$renderer3, {
          icon: iconify["search-rounded"],
          rounded: "full",
          variant: "solid",
          color: "info",
          "aspect-square": true,
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Tooltip`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        Tooltip.Content($$renderer3, {
          class: "me-w32kfv",
          children: ($$renderer4) => {
            Tooltip.Arrow($$renderer4, {});
            $$renderer4.push(`<!----> hello this my world something here hello`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!---->`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Tooltip($$renderer2, {
      children: ($$renderer3) => {
        {
          let leading = function($$renderer4, data) {
            Main($$renderer4, {
              icon: iconify["search-rounded"],
              class: [...data?.defaultStyles ?? [], "me-cdhi2s"],
              "aspect-square": true,
              size: data?.size,
              events: [
                {
                  events: {
                    mousedown: {
                      handler(e) {
                        console.log(e);
                      },
                      options: { stopPropagation: true }
                    }
                  }
                }
              ]
            });
          };
          Main$1($$renderer3, {
            loading: true,
            variant: "primary",
            type: "number",
            actionButtons: { copy: { display: true }, paste: { display: true } },
            leading,
            $$slots: { leading: true }
          });
        }
        $$renderer3.push(`<!----> `);
        Tooltip.Content($$renderer3, {
          class: "me-w32kfv",
          children: ($$renderer4) => {
            Tooltip.Arrow($$renderer4, {});
            $$renderer4.push(`<!----> hello this my world something here hello111`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!---->`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    {
      let leading = function($$renderer3, data) {
        Main($$renderer3, {
          icon: iconify["search-rounded"],
          class: [...data?.defaultStyles ?? [], "me-cdhi2s"],
          "aspect-square": true,
          size: data?.size,
          events: [
            {
              events: {
                mousedown: {
                  handler(e) {
                    console.log(e);
                  },
                  options: { stopPropagation: true }
                }
              }
            }
          ]
        });
      };
      Main$1($$renderer2, {
        loading: true,
        variant: "primary",
        type: "number",
        actionButtons: { copy: { display: true }, paste: { display: true } },
        required: true,
        minNumber: "3",
        maxNumber: "99",
        name: "my name",
        validation: { operator: "or" },
        leading,
        $$slots: { leading: true }
      });
    }
    $$renderer2.push(`<!----></div>`);
  });
}
export {
  _page as default
};
