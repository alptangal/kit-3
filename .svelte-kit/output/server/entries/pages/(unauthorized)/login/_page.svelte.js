import { j as head, h as escape_html, k as attr, p as derived } from "../../../../chunks/root.js";
import { o as onDestroy, M as Main$5 } from "../../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/state.svelte.js";
import { M as Main$3, C as Checkbox } from "../../../../chunks/index4.js";
import { c as client } from "../../../../chunks/basic.svelte.js";
import "../../../../chunks/functions.js";
/* empty css                                                          */
import { A as AuthLayout } from "../../../../chunks/AuthLayout.js";
import { isEqual } from "es-toolkit";
import { M as Main, a as Main$1, b as Main$2, c as Main$4 } from "../../../../chunks/Main.js";
const pageContents = {
  // ── Tiêu đề trang ──
  title: {
    vi: "Chào mừng trở lại",
    en: "Welcome back"
  },
  subtitle: {
    vi: "Đăng nhập vào tài khoản của bạn",
    en: "Sign in to your account"
  },
  // ── Nhãn trường nhập ──
  username: {
    vi: "Tên đăng nhập / Email",
    en: "Username / Email"
  },
  password: {
    vi: "Mật khẩu",
    en: "Password"
  },
  remember: {
    vi: "Ghi nhớ đăng nhập",
    en: "Remember me"
  },
  forgotPassword: {
    vi: "Quên mật khẩu?",
    en: "Forgot password?"
  },
  // ── Nút bấm ──
  login: {
    en: "Sign in",
    vi: "Đăng nhập"
  },
  reset: {
    en: "Reset",
    vi: "Đặt lại"
  },
  // ── Khu vực link đăng ký ──
  noAccount: {
    vi: "Chưa có tài khoản?",
    en: "Don't have an account?"
  },
  register: {
    vi: "Tạo tài khoản",
    en: "Create account"
  }
};
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const REMEMBER_STORAGE_KEY = "app:rememberedUsername";
    let usernameObj = { value: "" };
    let passwordObj = { value: "" };
    let rememberObj = { checked: false };
    let configs = {
      username: usernameObj,
      password: passwordObj,
      remember: rememberObj
    };
    let loading = false;
    let previousSubmited = void 0;
    let formError = void 0;
    const lang = derived(() => client.browser?.language ?? "en");
    const status = derived(() => {
      const currentSubmit = {
        username: configs.username.value?.trim() ?? "",
        password: configs.password.value ?? "",
        remember: configs.remember.checked
      };
      const hasRequired = !!currentSubmit.username && !!currentSubmit.password;
      const formValid = hasRequired;
      return {
        disabled: !hasRequired || !formValid || isEqual(currentSubmit, previousSubmited)
      };
    });
    function validateForm() {
      const raw = configs.username.value?.trim() ?? "";
      if (!raw) {
        return lang() === "vi" ? "Vui lòng nhập tên đăng nhập hoặc email" : "Please enter username or email";
      }
      if (raw.includes("@")) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
          return lang() === "vi" ? "Định dạng email không hợp lệ" : "Invalid email format";
        }
      } else {
        if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(raw)) {
          return lang() === "vi" ? "Tên đăng nhập từ 3-30 ký tự (chữ cái, số, gạch dưới, gạch ngang, dấu chấm)" : "Username must be 3-30 characters (letters, numbers, _, ., -)";
        }
      }
      if (!configs.password.value) {
        return lang() === "vi" ? "Vui lòng nhập mật khẩu" : "Please enter password";
      }
      if (configs.password.value.length < 8) {
        return lang() === "vi" ? "Mật khẩu phải chứa ít nhất 8 ký tự" : "Password must be at least 8 characters";
      }
      return void 0;
    }
    async function handleLogin() {
      console.log("[handleLogin] Called, username:", configs.username.value, "password:", configs.password.value);
      const validationError = validateForm();
      console.log("[handleLogin] validationError:", validationError);
      if (validationError) {
        formError = validationError;
        console.log("[handleLogin] formError set to:", formError);
        return;
      }
      return;
    }
    function handleReset() {
      usernameObj.value = "";
      passwordObj.value = "";
      rememberObj.checked = false;
      formError = void 0;
      previousSubmited = void 0;
      try {
        if (typeof localStorage !== "undefined") localStorage.removeItem(REMEMBER_STORAGE_KEY);
      } catch {
      }
    }
    onDestroy(() => {
    });
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("15hukzs", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>${escape_html(pageContents.title[lang()] ?? "Sign In")}</title>`);
        });
        $$renderer4.push(`<meta name="description"${attr("content", pageContents.subtitle[lang()] ?? "Sign in to your account")}/> <link rel="preconnect" href="https://fonts.googleapis.com"/> <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/> <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>`);
      });
      {
        let footer = function($$renderer4) {
          $$renderer4.push(`<div class="auth-divider"><span>${escape_html(pageContents.noAccount[lang()] ?? "Don't have an account?")}</span></div> <div class="auth-switch-link">`);
          Main$5($$renderer4, {
            variant: "link",
            color: "primary",
            class: "auth-switch-btn",
            to: "/register",
            children: ($$renderer5) => {
              $$renderer5.push(`<span>${escape_html(pageContents.register[lang()] ?? "Create account")}</span> <svg class="link-arrow" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M2 8a.75.75 0 01.75-.75h8.69L8.22 4.03a.75.75 0 011.06-1.06l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06-1.06l3.22-3.22H2.75A.75.75 0 012 8z" clip-rule="evenodd"></path></svg>`);
            },
            $$slots: { default: true }
          });
          $$renderer4.push(`<!----></div>`);
        };
        AuthLayout($$renderer3, {
          title: pageContents.title[lang()] ?? "Welcome back",
          subtitle: pageContents.subtitle[lang()] ?? "Sign in to your account",
          headline: lang() === "vi" ? "Chào mừng trở lại!" : "Welcome back!",
          description: lang() === "vi" ? "Đăng nhập để tiếp tục trải nghiệm dịch vụ của chúng tôi." : "Sign in to continue your seamless experience.",
          features: [
            lang() === "vi" ? "Bảo mật đầu cuối" : "End-to-end encryption",
            lang() === "vi" ? "Đăng nhập nhanh chóng" : "Lightning fast sign-in",
            lang() === "vi" ? "Bảo vệ tài khoản 24/7" : "24/7 account protection"
          ],
          successMessage: void 0,
          formError,
          footer,
          children: ($$renderer4) => {
            Main($$renderer4, {
              onSubmit: handleLogin,
              onReset: handleReset,
              children: ($$renderer5) => {
                Main$1($$renderer5, {
                  name: "username",
                  required: true,
                  children: ($$renderer6) => {
                    Main$2($$renderer6, {
                      children: ($$renderer7) => {
                        $$renderer7.push(`<!---->${escape_html(pageContents.username[lang()] ?? "Username / Email")}`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer6.push(`<!----> <div class="auth-input-wrapper"><svg class="auth-input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path></svg> `);
                    Main$3($$renderer6, {
                      type: "text",
                      placeholder: {
                        vi: "Nhập tên đăng nhập hoặc email",
                        en: "Enter username or email"
                      },
                      autocomplete: "username",
                      class: "auth-input",
                      emailSuggest: true,
                      get value() {
                        return configs.username.value;
                      },
                      set value($$value) {
                        configs.username.value = $$value;
                        $$settled = false;
                      }
                    });
                    $$renderer6.push(`<!----></div> `);
                    Main$4($$renderer6, {});
                    $$renderer6.push(`<!---->`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----> `);
                Main$1($$renderer5, {
                  name: "password",
                  required: true,
                  children: ($$renderer6) => {
                    Main$2($$renderer6, {
                      children: ($$renderer7) => {
                        $$renderer7.push(`<!---->${escape_html(pageContents.password[lang()] ?? "Password")}`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer6.push(`<!----> <div class="auth-input-wrapper"><svg class="auth-input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 002-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd"></path></svg> `);
                    Main$3($$renderer6, {
                      type: "password",
                      placeholder: { vi: "Nhập mật khẩu", en: "Enter your password" },
                      autocomplete: "current-password",
                      class: "auth-input",
                      actionButtons: { showPassword: { display: true } },
                      get value() {
                        return configs.password.value;
                      },
                      set value($$value) {
                        configs.password.value = $$value;
                        $$settled = false;
                      }
                    });
                    $$renderer6.push(`<!----></div> `);
                    Main$4($$renderer6, {});
                    $$renderer6.push(`<!---->`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----> <div class="login-options svelte-15hukzs">`);
                Checkbox($$renderer5, {
                  get checked() {
                    return configs.remember.checked;
                  },
                  set checked($$value) {
                    configs.remember.checked = $$value;
                    $$settled = false;
                  },
                  children: ($$renderer6) => {
                    Main$2($$renderer6, {
                      children: ($$renderer7) => {
                        $$renderer7.push(`<!---->${escape_html(pageContents.remember[lang()] ?? "Remember me")}`);
                      },
                      $$slots: { default: true }
                    });
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----> `);
                Main$5($$renderer5, {
                  variant: "link",
                  color: "default",
                  class: "login-forgot-link",
                  to: "/forgot-password",
                  children: ($$renderer6) => {
                    $$renderer6.push(`<!---->${escape_html(pageContents.forgotPassword[lang()] ?? "Forgot password?")}`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----></div> <div class="auth-actions">`);
                Main$5($$renderer5, {
                  class: "auth-btn-submit",
                  color: "success",
                  type: "submit",
                  loading,
                  disabled: status().disabled,
                  children: ($$renderer6) => {
                    $$renderer6.push(`<!---->${escape_html(pageContents.login[lang()] ?? "Sign in")}`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----> `);
                Main$5($$renderer5, {
                  class: "auth-btn-reset",
                  color: "error",
                  type: "reset",
                  variant: "ghost",
                  onClick: handleReset,
                  children: ($$renderer6) => {
                    $$renderer6.push(`<!---->${escape_html(pageContents.reset[lang()] ?? "Reset")}`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----></div>`);
              },
              $$slots: { default: true }
            });
          }
        });
      }
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
export {
  _page as default
};
