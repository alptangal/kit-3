import { b as attr_class, h as escape_html, g as ensure_array_like, t as stringify } from "./root.js";
/* empty css                                         */
function AuthPanelLeft($$renderer, $$props) {
  let { class: className = "", logo, headline, description, features } = $$props;
  $$renderer.push(`<div${attr_class(`auth-panel-left ${stringify(className)}`, "svelte-1f5rb6g")} aria-hidden="true"><div class="auth-panel-bg svelte-1f5rb6g"><div class="orb orb-1 svelte-1f5rb6g"></div> <div class="orb orb-2 svelte-1f5rb6g"></div> <div class="orb orb-3 svelte-1f5rb6g"></div> <div class="grid-overlay svelte-1f5rb6g"></div></div> <div class="panel-content svelte-1f5rb6g" style="view-transition-name: auth-panel-content;"><div class="brand-logo svelte-1f5rb6g" style="view-transition-name: auth-panel-logo;">`);
  if (logo) {
    $$renderer.push("<!--[0-->");
    logo($$renderer);
    $$renderer.push(`<!---->`);
  } else {
    $$renderer.push("<!--[-1-->");
    $$renderer.push(`<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" class="svelte-1f5rb6g"><circle cx="28" cy="28" r="26" fill="url(#panel-logo-grad)" class="svelte-1f5rb6g"></circle><path d="M20 28c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8" stroke="#fff" stroke-width="3" stroke-linecap="round" class="svelte-1f5rb6g"></path><circle cx="28" cy="28" r="3.5" fill="#fff" class="svelte-1f5rb6g"></circle><defs class="svelte-1f5rb6g"><linearGradient id="panel-logo-grad" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse" class="svelte-1f5rb6g"><stop stop-color="#818cf8" class="svelte-1f5rb6g"></stop><stop offset="1" stop-color="#a78bfa" class="svelte-1f5rb6g"></stop></linearGradient></defs></svg>`);
  }
  $$renderer.push(`<!--]--></div> `);
  if (headline || description) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<div class="panel-text svelte-1f5rb6g" style="view-transition-name: auth-panel-text;">`);
    if (typeof headline === "string") {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<h2 class="panel-headline svelte-1f5rb6g">${escape_html(headline)}</h2>`);
    } else if (headline) {
      $$renderer.push("<!--[1-->");
      $$renderer.push(`<h2 class="panel-headline svelte-1f5rb6g">`);
      headline($$renderer);
      $$renderer.push(`<!----></h2>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--> `);
    if (typeof description === "string") {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<p class="panel-desc svelte-1f5rb6g">${escape_html(description)}</p>`);
    } else if (description) {
      $$renderer.push("<!--[1-->");
      $$renderer.push(`<p class="panel-desc svelte-1f5rb6g">`);
      description($$renderer);
      $$renderer.push(`<!----></p>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--></div>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> `);
  if (features) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<ul class="panel-features svelte-1f5rb6g" style="view-transition-name: auth-panel-features;">`);
    if (Array.isArray(features)) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<!--[-->`);
      const each_array = ensure_array_like(features);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let feat = each_array[$$index];
        $$renderer.push(`<li class="svelte-1f5rb6g"><span class="feature-icon svelte-1f5rb6g">✦</span> <span class="svelte-1f5rb6g">${escape_html(feat)}</span></li>`);
      }
      $$renderer.push(`<!--]-->`);
    } else {
      $$renderer.push("<!--[-1-->");
      features($$renderer);
      $$renderer.push(`<!---->`);
    }
    $$renderer.push(`<!--]--></ul>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div></div>`);
}
function AuthLayout($$renderer, $$props) {
  let {
    class: className = "",
    cardSize = "md",
    title,
    subtitle,
    headline,
    description,
    features,
    formError,
    successMessage,
    leftLogo,
    header,
    footer,
    children
  } = $$props;
  $$renderer.push(`<div${attr_class(`auth-page ${stringify(className)}`, "svelte-ldx6xn")}>`);
  AuthPanelLeft($$renderer, { logo: leftLogo, headline, description, features });
  $$renderer.push(`<!----> <div class="auth-panel-right svelte-ldx6xn"><div${attr_class(`auth-card ${cardSize === "lg" ? "auth-card--lg" : ""}`, "svelte-ldx6xn")} style="view-transition-name: auth-card;">`);
  if (header) {
    $$renderer.push("<!--[0-->");
    header($$renderer);
    $$renderer.push(`<!---->`);
  } else if (title || subtitle) {
    $$renderer.push("<!--[1-->");
    $$renderer.push(`<div class="auth-header svelte-ldx6xn" style="view-transition-name: auth-header;"><div class="auth-logo-sm svelte-ldx6xn"><svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="svelte-ldx6xn"><circle cx="20" cy="20" r="18" fill="url(#auth-sm-grad)" class="svelte-ldx6xn"></circle><path d="M14 20c0-3.314 2.686-6 6-6s6 2.686 6 6-2.686 6-6 6" stroke="#fff" stroke-width="2.5" stroke-linecap="round" class="svelte-ldx6xn"></path><circle cx="20" cy="20" r="2.5" fill="#fff" class="svelte-ldx6xn"></circle><defs class="svelte-ldx6xn"><linearGradient id="auth-sm-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse" class="svelte-ldx6xn"><stop stop-color="#6366f1" class="svelte-ldx6xn"></stop><stop offset="1" stop-color="#8b5cf6" class="svelte-ldx6xn"></stop></linearGradient></defs></svg></div> `);
    if (title) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<h1 class="auth-title svelte-ldx6xn">${escape_html(title)}</h1>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--> `);
    if (subtitle) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<p class="auth-subtitle svelte-ldx6xn">${escape_html(subtitle)}</p>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--></div>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> `);
  if (successMessage) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<div class="auth-alert auth-alert--success svelte-ldx6xn" role="alert" aria-live="polite"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="alert-icon svelte-ldx6xn"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" class="svelte-ldx6xn"></path></svg> <span class="svelte-ldx6xn">${escape_html(successMessage)}</span></div>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> `);
  if (formError) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<div class="auth-alert auth-alert--error svelte-ldx6xn" role="alert" aria-live="assertive" aria-atomic="true"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="alert-icon svelte-ldx6xn"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" class="svelte-ldx6xn"></path></svg> <span class="svelte-ldx6xn">${escape_html(formError)}</span></div>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> `);
  children($$renderer);
  $$renderer.push(`<!----> `);
  if (footer) {
    $$renderer.push("<!--[0-->");
    footer($$renderer);
    $$renderer.push(`<!---->`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div></div></div>`);
}
export {
  AuthLayout as A
};
