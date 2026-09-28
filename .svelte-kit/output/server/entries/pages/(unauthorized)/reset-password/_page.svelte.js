import { j as head, h as escape_html, k as attr, p as derived } from "../../../../chunks/root.js";
import { g as goto } from "../../../../chunks/client.js";
import { p as page } from "../../../../chunks/index2.js";
import { M as Main } from "../../../../chunks/index.js";
import { M as Main$4 } from "../../../../chunks/index4.js";
import { c as client } from "../../../../chunks/basic.svelte.js";
import "../../../../chunks/functions.js";
/* empty css                                                          */
import { A as AuthLayout } from "../../../../chunks/AuthLayout.js";
import { M as Main$1, a as Main$2, b as Main$3, c as Main$6 } from "../../../../chunks/Main.js";
import { M as Main$5 } from "../../../../chunks/Main2.js";
const pageContents = {
  title: { vi: "Đặt lại mật khẩu", en: "Reset Password" },
  subtitle: {
    vi: "Tạo mật khẩu mới cho tài khoản của bạn",
    en: "Create a new password for your account"
  },
  password: { vi: "Mật khẩu mới", en: "New password" },
  confirmPassword: { vi: "Xác nhận mật khẩu", en: "Confirm password" },
  submit: { vi: "Đặt lại mật khẩu", en: "Reset password" },
  reset: { vi: "Xóa", en: "Reset" },
  invalidLinkTitle: { vi: "Liên kết không hợp lệ", en: "Invalid link" },
  invalidLinkDesc: {
    vi: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.",
    en: "This password reset link is invalid or has expired. Please request a new one."
  },
  backToLogin: { vi: "Quay lại đăng nhập", en: "Back to login" },
  requestNew: { vi: "Yêu cầu liên kết mới", en: "Request a new link" },
  mismatchHint: { vi: "Mật khẩu xác nhận không khớp.", en: "Passwords do not match." }
};
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let formData = { password: "", confirmPassword: "" };
    let loading = false;
    let formError = void 0;
    let honeypot = "";
    const lang = derived(() => client.browser?.language ?? "en");
    const resetToken = derived(() => page.url.searchParams.get("token") ?? "");
    const tokenInvalid = derived(() => resetToken().length < 32);
    const status = derived(() => {
      const hasRequired = !!formData.password?.trim() && formData.password.length >= 8 && !!formData.confirmPassword?.trim();
      const hasLetter = /[a-zA-Z]/.test(formData.password ?? "");
      const hasNumber = /[0-9]/.test(formData.password ?? "");
      const matches = formData.password === formData.confirmPassword;
      return {
        disabled: !hasRequired || !hasLetter || !hasNumber || !matches
      };
    });
    async function handleResetPassword() {
      if (honeypot.trim() !== "") return;
      if (status().disabled || true) return;
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("1318c12", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>${escape_html(pageContents.title[lang()] ?? "Reset password")}</title>`);
        });
        $$renderer4.push(`<meta name="description"${attr("content", pageContents.subtitle[lang()] ?? "Create a new password for your account")}/> <link rel="preconnect" href="https://fonts.googleapis.com"/> <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/> <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>`);
      });
      if (tokenInvalid()) {
        $$renderer3.push("<!--[0-->");
        AuthLayout($$renderer3, {
          cardSize: "md",
          title: pageContents.invalidLinkTitle[lang()] ?? "Invalid link",
          subtitle: pageContents.subtitle[lang()] ?? "",
          formError: pageContents.invalidLinkDesc[lang()] ?? "",
          children: ($$renderer4) => {
            $$renderer4.push(`<div class="invalid-state svelte-1318c12"><div class="auth-actions" style="justify-content: center;">`);
            Main($$renderer4, {
              class: "auth-btn-submit",
              color: "primary",
              variant: "outline",
              onClick: () => goto(),
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->${escape_html(pageContents.requestNew[lang()] ?? "Request a new link")}`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Main($$renderer4, {
              class: "auth-btn-reset",
              color: "error",
              variant: "ghost",
              onClick: () => goto(),
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->${escape_html(pageContents.backToLogin[lang()] ?? "Back to login")}`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----></div></div>`);
          }
        });
      } else {
        $$renderer3.push("<!--[-1-->");
        {
          let footer = function($$renderer4) {
            $$renderer4.push(`<div class="auth-divider"><span>${escape_html(lang() === "vi" ? "Nhớ mật khẩu?" : "Remember password?")}</span></div> <div class="auth-switch-link">`);
            Main($$renderer4, {
              variant: "link",
              color: "primary",
              class: "auth-switch-btn",
              to: "/login",
              children: ($$renderer5) => {
                $$renderer5.push(`<span>${escape_html(pageContents.backToLogin[lang()] ?? "Back to login")}</span> <svg class="link-arrow" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M2 8a.75.75 0 01.75-.75h8.69L8.22 4.03a.75.75 0 011.06-1.06l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06-1.06l3.22-3.22H2.75A.75.75 0 012 8z" clip-rule="evenodd"></path></svg>`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----></div>`);
          };
          AuthLayout($$renderer3, {
            cardSize: "md",
            title: pageContents.title[lang()] ?? "Reset password",
            subtitle: pageContents.subtitle[lang()] ?? "",
            formError,
            footer,
            children: ($$renderer4) => {
              Main$1($$renderer4, {
                onSubmit: handleResetPassword,
                children: ($$renderer5) => {
                  $$renderer5.push(`<div class="hp-field svelte-1318c12" aria-hidden="true"><label for="hp_website" class="svelte-1318c12">Website</label> <input id="hp_website" name="website" type="text"${attr("value", honeypot)} autocomplete="off" tabindex="-1" aria-hidden="true"${attr("disabled", loading, true)} class="svelte-1318c12"/></div> `);
                  Main$2($$renderer5, {
                    name: "password",
                    required: true,
                    children: ($$renderer6) => {
                      Main$3($$renderer6, {
                        children: ($$renderer7) => {
                          $$renderer7.push(`<!---->${escape_html(pageContents.password[lang()] ?? "New password")}`);
                        },
                        $$slots: { default: true }
                      });
                      $$renderer6.push(`<!----> <div class="auth-input-wrapper">`);
                      Main$4($$renderer6, {
                        type: "password",
                        autocomplete: "new-password",
                        disabled: loading,
                        actionButtons: { showPassword: { display: true } },
                        get value() {
                          return formData.password;
                        },
                        set value($$value) {
                          formData.password = $$value;
                          $$settled = false;
                        }
                      });
                      $$renderer6.push(`<!----></div> `);
                      Main$5($$renderer6, {
                        persistent: true,
                        class: "form-hint",
                        children: ($$renderer7) => {
                          $$renderer7.push(`<!---->${escape_html(lang() === "vi" ? "Ít nhất 8 ký tự, gồm chữ và số" : "At least 8 characters with letters and numbers")}`);
                        },
                        $$slots: { default: true }
                      });
                      $$renderer6.push(`<!----> `);
                      Main$6($$renderer6, {});
                      $$renderer6.push(`<!---->`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Main$2($$renderer5, {
                    name: "confirmPassword",
                    required: true,
                    children: ($$renderer6) => {
                      Main$3($$renderer6, {
                        children: ($$renderer7) => {
                          $$renderer7.push(`<!---->${escape_html(pageContents.confirmPassword[lang()] ?? "Confirm password")}`);
                        },
                        $$slots: { default: true }
                      });
                      $$renderer6.push(`<!----> <div class="auth-input-wrapper">`);
                      Main$4($$renderer6, {
                        type: "password",
                        autocomplete: "new-password",
                        disabled: loading,
                        color: formData.confirmPassword && formData.confirmPassword !== formData.password ? "error" : void 0,
                        actionButtons: { showPassword: { display: true } },
                        get value() {
                          return formData.confirmPassword;
                        },
                        set value($$value) {
                          formData.confirmPassword = $$value;
                          $$settled = false;
                        }
                      });
                      $$renderer6.push(`<!----></div> `);
                      if (formData.confirmPassword && formData.confirmPassword !== formData.password) {
                        $$renderer6.push("<!--[0-->");
                        Main$5($$renderer6, {
                          persistent: true,
                          color: "error",
                          class: "form-hint error-hint",
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->${escape_html(pageContents.mismatchHint[lang()] ?? "Passwords do not match.")}`);
                          },
                          $$slots: { default: true }
                        });
                      } else {
                        $$renderer6.push("<!--[-1-->");
                      }
                      $$renderer6.push(`<!--]--> `);
                      Main$6($$renderer6, {});
                      $$renderer6.push(`<!---->`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> <div class="auth-actions">`);
                  Main($$renderer5, {
                    class: "auth-btn-submit",
                    color: "success",
                    type: "submit",
                    loading,
                    disabled: status().disabled,
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->${escape_html(pageContents.submit[lang()] ?? "Reset password")}`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Main($$renderer5, {
                    class: "auth-btn-reset",
                    color: "error",
                    type: "reset",
                    variant: "ghost",
                    disabled: loading,
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
      $$renderer3.push(`<!--]-->`);
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
