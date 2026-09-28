import { h as escape_html } from "../../chunks/root.js";
import "clsx";
import { p as page } from "../../chunks/index2.js";
function _error($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<h1>${escape_html(page.status)}${escape_html(page.error?.message)}</h1>`);
  });
}
export {
  _error as default
};
