import { j as head, p as derived, h as escape_html, k as attr } from "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/index.js";
import { c as client } from "../../../../chunks/basic.svelte.js";
import "../../../../chunks/functions.js";
/* empty css                                                        */
import { A as AuthLayout } from "../../../../chunks/AuthLayout.js";
const pageContents = {
  title: { vi: "Xác nhận email", en: "Verify Email" },
  subtitle: { vi: "Đang xác nhận địa chỉ email của bạn...", en: "Verifying your email address..." },
  verifying: { vi: "Đang xác nhận...", en: "Verifying..." }
};
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const lang = derived(() => client.browser?.language ?? "en");
    const currentLang = derived(() => lang() === "vi" ? "vi" : "en");
    head("ys02gl", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(pageContents.title[lang()] ?? "Verify Email")}</title>`);
      });
      $$renderer3.push(`<meta name="description"${attr("content", pageContents.subtitle[lang()] ?? "")}/> <link rel="preconnect" href="https://fonts.googleapis.com"/> <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/> <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>`);
    });
    AuthLayout($$renderer2, {
      cardSize: "md",
      title: pageContents.title[lang()] ?? "",
      subtitle: pageContents.verifying[lang()] ?? "",
      children: ($$renderer3) => {
        {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="verify-state svelte-ys02gl"><div class="spinner svelte-ys02gl"${attr("aria-label", pageContents.verifying[currentLang()] ?? "")}></div></div>`);
        }
        $$renderer3.push(`<!--]-->`);
      }
    });
  });
}
export {
  _page as default
};
