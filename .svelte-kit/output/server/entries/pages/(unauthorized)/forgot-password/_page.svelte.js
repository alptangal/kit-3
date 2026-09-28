import { j as head, h as escape_html, k as attr, p as derived } from "../../../../chunks/root.js";
import { g as goto } from "../../../../chunks/client.js";
import { o as onDestroy, M as Main$6 } from "../../../../chunks/index.js";
import { M as Main$3 } from "../../../../chunks/index4.js";
import { c as client } from "../../../../chunks/basic.svelte.js";
import "../../../../chunks/functions.js";
/* empty css                                                        */
import { A as AuthLayout } from "../../../../chunks/AuthLayout.js";
import { M as Main, a as Main$1, b as Main$2, c as Main$5 } from "../../../../chunks/Main.js";
import { M as Main$4 } from "../../../../chunks/Main2.js";
const pageContents = {
  // ── Tiêu đề trang ──
  title: {
    vi: "Quên mật khẩu",
    en: "Forgot password"
  },
  subtitle: {
    vi: "Nhập email để nhận liên kết đặt lại mật khẩu",
    en: "Enter your email to receive a password reset link"
  },
  // ── Nhãn trường nhập ──
  email: {
    vi: "Địa chỉ Email",
    en: "Email address"
  },
  // ── Nút bấm ──
  submit: {
    vi: "Gửi liên kết đặt lại",
    en: "Send reset link"
  },
  reset: {
    vi: "Đặt lại",
    en: "Reset"
  },
  backToLogin: {
    vi: "Quay lại đăng nhập",
    en: "Back to login"
  },
  // ── Thông báo thành công ──
  successTitle: {
    vi: "Kiểm tra email của bạn",
    en: "Check your email"
  },
  successDesc: {
    vi: "Chúng tôi đã gửi liên kết đặt lại mật khẩu đến địa chỉ email của bạn. Vui lòng kiểm tra hộp thư đến (và thư rác).",
    en: "We have sent a password reset link to your email address. Please check your inbox (and spam folder)."
  }
};
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let formData = { email: "" };
    let loading = false;
    let formError = void 0;
    let success = false;
    let honeypot = "";
    const lang = derived(() => client.browser?.language ?? "en");
    const currentLang = derived(() => lang() === "vi" ? "vi" : "en");
    let emailStatus = {
      checking: false,
      checked: false,
      taken: false,
      available: false
    };
    const status = derived(() => {
      const hasRequired = !!formData.email?.trim() && formData.email.length >= 3;
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email?.trim() ?? "");
      const emailAvailable = emailStatus.checked && emailStatus.taken;
      const notChecking = !emailStatus.checking;
      return {
        disabled: !hasRequired || !isValidEmail || !emailAvailable || !notChecking
      };
    });
    async function handleForgotPassword() {
      if (honeypot.trim() !== "") {
        formError = lang() === "vi" ? "Yêu cầu bị từ chối" : "Request rejected";
        return;
      }
      if (status().disabled || true) return;
    }
    function handleReset() {
      formData.email = "";
      honeypot = "";
      formError = void 0;
      success = false;
      emailStatus = {
        checking: false,
        checked: false,
        taken: false,
        available: false
      };
    }
    onDestroy(() => {
    });
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("hto1fa", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>${escape_html(pageContents.title[lang()] ?? "Forgot password")}</title>`);
        });
        $$renderer4.push(`<meta name="description"${attr("content", pageContents.subtitle[lang()] ?? "Enter your email to receive a password reset link")}/> <link rel="preconnect" href="https://fonts.googleapis.com"/> <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/> <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>`);
      });
      {
        let footer = function($$renderer4) {
          $$renderer4.push(`<div class="auth-divider"><span>${escape_html(lang() === "vi" ? "Nhớ mật khẩu?" : "Remember password?")}</span></div> <div class="auth-switch-link">`);
          Main$6($$renderer4, {
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
          title: pageContents.title[lang()] ?? "Forgot password",
          subtitle: pageContents.subtitle[lang()] ?? "Enter your email to receive a password reset link",
          headline: lang() === "vi" ? "Đặt lại mật khẩu" : "Reset your password",
          description: lang() === "vi" ? "Nhập địa chỉ email đã đăng ký để nhận liên kết đặt lại mật khẩu." : "Enter your registered email address to receive a password reset link.",
          features: [
            lang() === "vi" ? "Liên kết an toàn, hết hạn sau 1 giờ" : "Secure link, expires in 1 hour",
            lang() === "vi" ? "Không tiết lộ thông tin tài khoản" : "No account information disclosed",
            lang() === "vi" ? "Hỗ trợ 24/7 qua email" : "24/7 email support"
          ],
          formError,
          footer,
          children: ($$renderer4) => {
            if (!success) {
              $$renderer4.push("<!--[0-->");
              Main($$renderer4, {
                onSubmit: handleForgotPassword,
                onReset: handleReset,
                children: ($$renderer5) => {
                  $$renderer5.push(`<div class="hp-field svelte-hto1fa" aria-hidden="true"><label for="hp_website" class="svelte-hto1fa">Website</label> <input id="hp_website" name="website" type="text"${attr("value", honeypot)} autocomplete="off" tabindex="-1" aria-hidden="true"${attr("disabled", loading, true)} class="svelte-hto1fa"/></div> `);
                  Main$1($$renderer5, {
                    name: "email",
                    required: true,
                    children: ($$renderer6) => {
                      Main$2($$renderer6, {
                        children: ($$renderer7) => {
                          $$renderer7.push(`<!---->${escape_html(pageContents.email[lang()] ?? "Email")}`);
                        },
                        $$slots: { default: true }
                      });
                      $$renderer6.push(`<!----> <div class="auth-input-wrapper"><svg class="auth-input-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z"></path><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z"></path></svg> `);
                      Main$3($$renderer6, {
                        type: "email",
                        inputmode: "email",
                        placeholder: { vi: "Nhập địa chỉ email", en: "Enter your email" },
                        autocomplete: "email",
                        loading: emailStatus.checking,
                        disabled: loading,
                        color: emailStatus.checked ? emailStatus.taken ? "success" : "error" : void 0,
                        class: `auth-input ${emailStatus.checked ? emailStatus.taken ? "confirm-match" : "confirm-mismatch" : ""}`,
                        actionButtons: { showPassword: { display: false } },
                        get value() {
                          return formData.email;
                        },
                        set value($$value) {
                          formData.email = $$value;
                          $$settled = false;
                        }
                      });
                      $$renderer6.push(`<!----></div> `);
                      if (emailStatus.checked && emailStatus.taken) {
                        $$renderer6.push("<!--[0-->");
                        Main$4($$renderer6, {
                          persistent: true,
                          color: "success",
                          class: "form-hint success-hint",
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->${escape_html(emailStatus.message?.[currentLang()] ?? "Email is registered")}`);
                          },
                          $$slots: { default: true }
                        });
                      } else if (emailStatus.checked && emailStatus.available) {
                        $$renderer6.push("<!--[1-->");
                        Main$4($$renderer6, {
                          persistent: true,
                          color: "error",
                          class: "form-hint error-hint",
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->${escape_html(emailStatus.message?.[currentLang()] ?? "Email is not registered")}`);
                          },
                          $$slots: { default: true }
                        });
                      } else {
                        $$renderer6.push("<!--[-1-->");
                        Main$4($$renderer6, {
                          class: "form-hint",
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->${escape_html(lang() === "vi" ? "Nhập email đã đăng ký để nhận liên kết đặt lại" : "Enter your registered email to receive reset link")}`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Main$5($$renderer6, {});
                        $$renderer6.push(`<!---->`);
                      }
                      $$renderer6.push(`<!--]-->`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> <div class="auth-actions">`);
                  Main$6($$renderer5, {
                    class: "auth-btn-submit",
                    color: "success",
                    type: "submit",
                    loading,
                    disabled: status().disabled,
                    onClick: handleForgotPassword,
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->${escape_html(pageContents.submit[lang()] ?? "Send reset link")}`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Main$6($$renderer5, {
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
            } else {
              $$renderer4.push("<!--[-1-->");
            }
            $$renderer4.push(`<!--]--> `);
            if (success) {
              $$renderer4.push("<!--[0-->");
              $$renderer4.push(`<div class="success-state svelte-hto1fa" style="text-align: center; padding: 2rem 0;"><div class="success-icon" style="width: 64px; height: 64px; margin: 0 auto 1.5rem; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 32px; height: 32px;"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg></div> <h2 class="success-title" style="font-size: 1.5rem; font-weight: 700; color: var(--foreground, #f4f4f5); margin: 0 0 0.75rem;">${escape_html(pageContents.successTitle[lang()] ?? "Check your email")}</h2> <p class="success-desc" style="color: var(--foreground-400, #71717a); line-height: 1.6; margin: 0 0 2rem;">${escape_html(pageContents.successDesc[lang()] ?? "We have sent a password reset link to your email address. Please check your inbox (and spam folder).")}</p> <div class="auth-actions" style="justify-content: center;">`);
              Main$6($$renderer4, {
                variant: "link",
                color: "primary",
                class: "auth-switch-btn",
                onClick: () => goto(),
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->${escape_html(pageContents.backToLogin[lang()] ?? "Back to login")}<svg class="link-arrow" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M2 8a.75.75 0 01.75-.75h8.69L8.22 4.03a.75.75 0 011.06-1.06l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06-1.06l3.22-3.22H2.75A.75.75 0 012 8z" clip-rule="evenodd"></path></svg>`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----></div></div>`);
            } else {
              $$renderer4.push("<!--[-1-->");
            }
            $$renderer4.push(`<!--]-->`);
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
