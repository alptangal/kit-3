import { j as head, h as escape_html, k as attr, p as derived, d as attr_style, t as stringify } from "../../../../chunks/root.js";
import { o as onDestroy, M as Main } from "../../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/state.svelte.js";
import { M as Main$4, C as Checkbox } from "../../../../chunks/index4.js";
import { M as Modal } from "../../../../chunks/index3.js";
import { c as client } from "../../../../chunks/basic.svelte.js";
import "../../../../chunks/functions.js";
/* empty css                                                        */
import { A as AuthLayout } from "../../../../chunks/AuthLayout.js";
import { isEqual } from "es-toolkit";
import { M as Main$1, a as Main$2, b as Main$3, c as Main$5 } from "../../../../chunks/Main.js";
import { M as Main$6 } from "../../../../chunks/Main2.js";
const pageContents = {
  title: {
    vi: "Tạo tài khoản mới",
    en: "Create an account"
  },
  subtitle: {
    vi: "Đăng ký nhanh chóng với công nghệ bảo mật mã hoá tiên tiến",
    en: "Sign up quickly with advanced end-to-end encryption"
  },
  welcomeHeadline: {
    vi: "Tham gia cùng chúng tôi!",
    en: "Join us today!"
  },
  welcomeDesc: {
    vi: "Bắt đầu trải nghiệm nền tảng quản lý chuyên nghiệp, bảo mật dữ liệu tuyệt đối.",
    en: "Start your journey with a professional, securely encrypted management platform."
  },
  features: [
    {
      vi: "Bảo mật Vault & E2E Encryption",
      en: "Vault & End-to-end Encryption"
    },
    {
      vi: "Kiến trúc dữ liệu phân tán chuẩn enterprise",
      en: "Enterprise distributed data architecture"
    },
    {
      vi: "Truy cập mọi lúc mọi nơi trên mọi thiết bị",
      en: "Access anytime, anywhere on any device"
    }
  ],
  textFields: {
    firstname: {
      en: "First name",
      vi: "Tên"
    },
    midname: {
      en: "Middle name",
      vi: "Tên đệm"
    },
    lastname: {
      en: "Last name",
      vi: "Họ"
    },
    username: {
      vi: "Tên đăng nhập",
      en: "Username"
    },
    email: {
      vi: "Địa chỉ Email",
      en: "Email address"
    },
    phone: {
      vi: "Số điện thoại",
      en: "Phone number"
    },
    password: {
      vi: "Mật khẩu",
      en: "Password"
    },
    confirmPassword: {
      en: "Confirm password",
      vi: "Xác nhận mật khẩu"
    }
  },
  hints: {
    passwordHint: {
      vi: "Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt",
      en: "Min 8 chars, uppercase, lowercase, number & special char"
    },
    usernameHint: {
      vi: "3-30 ký tự (chữ cái, số, dấu gạch ngang, gạch dưới)",
      en: "3-30 characters (alphanumeric, -, _)"
    },
    confirmPasswordHint: {
      vi: "Mật khẩu xác nhận phải khớp với mật khẩu ở trên",
      en: "Must match the password entered above"
    },
    phoneHint: {
      vi: "Tùy chọn - dùng để khôi phục tài khoản và nhận thông báo",
      en: "Optional - for account recovery and notifications"
    }
  },
  terms: {
    agreeLabel: {
      vi: "Tôi đồng ý với",
      en: "I agree to the"
    },
    linkText: {
      vi: "Điều khoản sử dụng & Chính sách bảo mật",
      en: "Terms of Service & Privacy Policy"
    },
    modalTitle: {
      vi: "Điều khoản Dịch vụ & Chính sách Bảo mật",
      en: "Terms of Service & Privacy Policy"
    },
    modalIntro: {
      vi: "Chào mừng bạn đến với hệ thống. Khi sử dụng dịch vụ, bạn đồng ý tuân thủ các quy tắc sau:",
      en: "Welcome to our platform. By accessing or using our services, you agree to the following terms:"
    },
    modalP1: {
      vi: "1. Bảo mật dữ liệu: Toàn bộ thông tin cá nhân và mật khẩu của bạn được mã hoá hai chiều bằng khoá mã hoá cá nhân (DEK) và KEK. Server không thể đọc mật khẩu gốc của bạn.",
      en: "1. Data Security: All your personal info and credentials are end-to-end encrypted using personal DEK/KEK vaults. The server never stores your plaintext password."
    },
    modalP2: {
      vi: "2. Quyền và nghĩa vụ: Bạn chịu trách nhiệm duy trì bảo mật thông tin đăng nhập và mọi hoạt động diễn ra dưới tài khoản của mình.",
      en: "2. Rights & Responsibilities: You are responsible for maintaining the confidentiality of your account credentials and all activities occurring under your account."
    },
    modalP3: {
      vi: "3. Cam kết dịch vụ: Chúng tôi nỗ lực cung cấp dịch vụ ổn định, an toàn và hỗ trợ nhanh chóng nhất cho mọi người dùng.",
      en: "3. Service Commitment: We strive to provide a reliable, highly available and secure environment for all registered users."
    },
    acceptBtn: {
      vi: "Tôi đồng ý",
      en: "I Accept"
    },
    declineBtn: {
      vi: "Từ chối",
      en: "Decline"
    }
  },
  buttons: {
    confirm: {
      en: "Create account",
      vi: "Đăng ký tài khoản"
    },
    reset: {
      en: "Reset form",
      vi: "Làm mới"
    }
  },
  hasAccount: {
    vi: "Đã có tài khoản?",
    en: "Already have an account?"
  },
  signIn: {
    vi: "Đăng nhập ngay",
    en: "Sign in now"
  },
  passwordStrength: {
    weak: { vi: "Yếu", en: "Weak" },
    fair: { vi: "Trung bình", en: "Fair" },
    good: { vi: "Tốt", en: "Good" },
    strong: { vi: "Rất mạnh", en: "Strong" }
  }
};
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let formData = {
      firstname: "",
      midname: "",
      lastname: "",
      username: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: ""
    };
    let agreeTerms = false;
    let loading = false;
    let formError = void 0;
    let showTermsModal = false;
    let honeypot = "";
    let previousSubmited = void 0;
    const lang = derived(() => client.browser?.language ?? "en");
    const currentLang = derived(() => lang() === "vi" ? "vi" : "en");
    let usernameStatus = {
      checking: false,
      checked: false,
      taken: false,
      available: false
    };
    let emailStatus = {
      checking: false,
      checked: false,
      taken: false,
      available: false
    };
    function estimatePasswordStrength(pwd, username, email) {
      if (!pwd) return { score: 0, label: "", percent: 0, color: "transparent" };
      const len = pwd.length;
      const weakResult = {
        score: 1,
        label: pageContents.passwordStrength.weak[lang()] ?? "Weak",
        percent: 25,
        color: "var(--error)"
      };
      if (len < 8) return weakResult;
      let rawScore = 0;
      if (len >= 8) rawScore += 1;
      if (len >= 12) rawScore += 1;
      if (len >= 16) rawScore += 1;
      let varieties = 0;
      if (/[a-z]/.test(pwd)) varieties++;
      if (/[A-Z]/.test(pwd)) varieties++;
      if (/\d/.test(pwd)) varieties++;
      if (/[^A-Za-z0-9\s]/.test(pwd)) varieties++;
      if (varieties >= 2) rawScore += 1;
      if (varieties >= 3) rawScore += 1;
      if (varieties >= 4) rawScore += 1;
      const lower = pwd.toLowerCase();
      const commonList = [
        "password",
        "123456",
        "12345678",
        "123456789",
        "qwerty",
        "abc123",
        "letmein",
        "admin",
        "welcome",
        "iloveyou",
        "monkey",
        "dragon",
        "111111",
        "123123",
        "qwerty123",
        "password1",
        "1234",
        "000000",
        "sunshine",
        "princess",
        "football",
        "654321",
        "starwars"
      ];
      const isCommon = commonList.some((c) => lower === c || lower.includes(c));
      if (isCommon) rawScore -= 2;
      const sequentialRe = /(?:012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|qwe|wer|ert|rty|tyu|yui|uio|asd|sdf|dfg|fgh|ghj|hjk|jkl|zxc|xcv|cvb|vbn|bnm)/i;
      if (sequentialRe.test(pwd)) rawScore -= 1;
      if (/(.)\1{2,}/.test(pwd)) rawScore -= 1;
      if (/(?:qwerty|asdf|zxcv|qaz|wsx|edc|qazwsx|1qaz|zaq1)/i.test(pwd)) rawScore -= 1;
      if (username && username.length >= 3 && lower.includes(username.toLowerCase())) rawScore -= 1;
      if (email) {
        const local = email.split("@")[0]?.toLowerCase();
        if (local && local.length >= 3 && lower.includes(local)) rawScore -= 1;
      }
      rawScore = Math.max(0, Math.min(rawScore, 6));
      if (rawScore <= 1) {
        return {
          score: 1,
          label: pageContents.passwordStrength.weak[lang()] ?? "Weak",
          percent: 25,
          color: "var(--error)"
        };
      } else if (rawScore === 2) {
        return {
          score: 2,
          label: pageContents.passwordStrength.fair[lang()] ?? "Fair",
          percent: 50,
          color: "var(--warning)"
        };
      } else if (rawScore <= 4) {
        return {
          score: 3,
          label: pageContents.passwordStrength.good[lang()] ?? "Good",
          percent: 75,
          color: "var(--primary)"
        };
      } else {
        return {
          score: 4,
          label: pageContents.passwordStrength.strong[lang()] ?? "Strong",
          percent: 100,
          color: "var(--success)"
        };
      }
    }
    const passwordStrength = derived(() => {
      return estimatePasswordStrength(formData.password, formData.username?.trim(), formData.email?.trim());
    });
    const confirmMatch = derived(() => {
      if (!formData.confirmPassword) return null;
      return formData.confirmPassword === formData.password;
    });
    const status = derived(() => {
      const current = {
        firstname: formData.firstname?.trim() ?? "",
        midname: formData.midname?.trim() || void 0,
        lastname: formData.lastname?.trim() ?? "",
        username: formData.username?.trim() ?? "",
        email: formData.email?.trim() ?? "",
        password: formData.password ?? ""
      };
      const hasRequired = !!current.firstname && !!current.lastname && !!current.username && !!current.email && !!current.password && formData.password.length >= 8 && formData.password === formData.confirmPassword && !usernameStatus.taken && !emailStatus.taken && !usernameStatus.checking && !emailStatus.checking && agreeTerms;
      const normalizeForCompare = (obj) => {
        if (!obj) return obj;
        const copy = { ...obj };
        if (copy["midname"] === void 0 || copy["midname"] === "") delete copy["midname"];
        return copy;
      };
      const isDuplicate = previousSubmited !== void 0 && isEqual(normalizeForCompare(current), normalizeForCompare(previousSubmited));
      return { disabled: !hasRequired || isDuplicate };
    });
    async function handleRegister() {
      if (honeypot.trim() !== "") {
        formError = lang() === "vi" ? "Yêu cầu bị từ chối" : "Request rejected";
        return;
      }
      if (status().disabled || true) return;
    }
    function handleReset() {
      formData.firstname = "";
      formData.midname = "";
      formData.lastname = "";
      formData.username = "";
      formData.email = "";
      formData.password = "";
      formData.confirmPassword = "";
      honeypot = "";
      agreeTerms = false;
      formError = void 0;
      previousSubmited = void 0;
      usernameStatus = {
        checking: false,
        checked: false,
        taken: false,
        available: false
      };
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
      head("jy9hkg", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>${escape_html(pageContents.title[lang()] ?? "Create an account")}</title>`);
        });
        $$renderer4.push(`<meta name="description"${attr("content", pageContents.subtitle[lang()] ?? "Sign up quickly with advanced end-to-end encryption")} class="svelte-jy9hkg"/> <link rel="preconnect" href="https://fonts.googleapis.com" class="svelte-jy9hkg"/> <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" class="svelte-jy9hkg"/> <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet" class="svelte-jy9hkg"/>`);
      });
      {
        let footer = function($$renderer4) {
          $$renderer4.push(`<div class="auth-divider svelte-jy9hkg"><span class="svelte-jy9hkg">${escape_html(pageContents.hasAccount[lang()] ?? "Already have an account?")}</span></div> <div class="auth-switch-link svelte-jy9hkg">`);
          Main($$renderer4, {
            variant: "link",
            color: "primary",
            class: "auth-switch-btn",
            to: "/login",
            children: ($$renderer5) => {
              $$renderer5.push(`<span class="svelte-jy9hkg">${escape_html(pageContents.signIn[lang()] ?? "Sign in now")}</span> <svg class="link-arrow svelte-jy9hkg" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M2 8a.75.75 0 01.75-.75h8.69L8.22 4.03a.75.75 0 011.06-1.06l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06-1.06l3.22-3.22H2.75A.75.75 0 012 8z" clip-rule="evenodd" class="svelte-jy9hkg"></path></svg>`);
            },
            $$slots: { default: true }
          });
          $$renderer4.push(`<!----></div>`);
        };
        AuthLayout($$renderer3, {
          cardSize: "lg",
          title: pageContents.title[lang()] ?? "Create an account",
          subtitle: pageContents.subtitle[lang()] ?? "Sign up quickly with advanced end-to-end encryption",
          headline: pageContents.welcomeHeadline[lang()] ?? "Join us today!",
          description: pageContents.welcomeDesc[lang()] ?? "Start your journey with a professional, securely encrypted management platform.",
          features: pageContents.features.map((feat) => feat[lang()] ?? feat.en),
          formError,
          footer,
          children: ($$renderer4) => {
            Main$1($$renderer4, {
              onSubmit: handleRegister,
              onReset: handleReset,
              children: ($$renderer5) => {
                $$renderer5.push(`<div class="visually-hidden svelte-jy9hkg" aria-hidden="true"><label for="hp_website" class="svelte-jy9hkg">Website</label> <input id="hp_website" name="website" type="text"${attr("value", honeypot)} autocomplete="off" tabindex="-1"${attr("disabled", loading, true)} class="svelte-jy9hkg"/></div> <fieldset class="name-fieldset svelte-jy9hkg"${attr("aria-label", lang() === "vi" ? "Họ và tên" : "Full name")}><div class="name-grid svelte-jy9hkg">`);
                Main$2($$renderer5, {
                  name: "lastname",
                  required: true,
                  children: ($$renderer6) => {
                    Main$3($$renderer6, {
                      children: ($$renderer7) => {
                        $$renderer7.push(`<!---->${escape_html(pageContents.textFields.lastname[lang()] ?? "Last name")}`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer6.push(`<!----> `);
                    Main$4($$renderer6, {
                      placeholder: { vi: "Nguyễn", en: "Doe" },
                      autocomplete: "family-name",
                      class: "name-input name-input-full",
                      disabled: loading,
                      get value() {
                        return formData.lastname;
                      },
                      set value($$value) {
                        formData.lastname = $$value;
                        $$settled = false;
                      }
                    });
                    $$renderer6.push(`<!----> `);
                    Main$5($$renderer6, {});
                    $$renderer6.push(`<!---->`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----> `);
                Main$2($$renderer5, {
                  name: "midname",
                  children: ($$renderer6) => {
                    Main$3($$renderer6, {
                      children: ($$renderer7) => {
                        $$renderer7.push(`<!---->${escape_html(pageContents.textFields.midname[lang()] ?? "Middle name")}`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer6.push(`<!----> `);
                    Main$4($$renderer6, {
                      placeholder: { vi: "Văn", en: "Middle" },
                      autocomplete: "additional-name",
                      class: "name-input",
                      disabled: loading,
                      get value() {
                        return formData.midname;
                      },
                      set value($$value) {
                        formData.midname = $$value;
                        $$settled = false;
                      }
                    });
                    $$renderer6.push(`<!----> `);
                    Main$5($$renderer6, {});
                    $$renderer6.push(`<!---->`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----> `);
                Main$2($$renderer5, {
                  name: "firstname",
                  required: true,
                  children: ($$renderer6) => {
                    Main$3($$renderer6, {
                      children: ($$renderer7) => {
                        $$renderer7.push(`<!---->${escape_html(pageContents.textFields.firstname[lang()] ?? "First name")}`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer6.push(`<!----> `);
                    Main$4($$renderer6, {
                      placeholder: { vi: "An", en: "John" },
                      autocomplete: "given-name",
                      class: "name-input name-input-full",
                      disabled: loading,
                      get value() {
                        return formData.firstname;
                      },
                      set value($$value) {
                        formData.firstname = $$value;
                        $$settled = false;
                      }
                    });
                    $$renderer6.push(`<!----> `);
                    Main$5($$renderer6, {});
                    $$renderer6.push(`<!---->`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----></div></fieldset> `);
                Main$2($$renderer5, {
                  name: "username",
                  required: true,
                  children: ($$renderer6) => {
                    Main$3($$renderer6, {
                      children: ($$renderer7) => {
                        $$renderer7.push(`<!---->${escape_html(pageContents.textFields.username[lang()] ?? "Username")}`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer6.push(`<!----> `);
                    {
                      let leading = function($$renderer7) {
                        $$renderer7.push(`<svg class="auth-input-icon svelte-jy9hkg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" class="svelte-jy9hkg"></path></svg>`);
                      };
                      Main$4($$renderer6, {
                        placeholder: { vi: "Nhập tên đăng nhập", en: "Enter username" },
                        autocomplete: "username",
                        loading: usernameStatus.checking,
                        disabled: loading,
                        color: usernameStatus.checked ? usernameStatus.taken ? "error" : "success" : void 0,
                        get value() {
                          return formData.username;
                        },
                        set value($$value) {
                          formData.username = $$value;
                          $$settled = false;
                        },
                        leading,
                        $$slots: { leading: true }
                      });
                    }
                    $$renderer6.push(`<!----> `);
                    if (usernameStatus.checked && usernameStatus.taken) {
                      $$renderer6.push("<!--[0-->");
                      Main$6($$renderer6, {
                        persistent: true,
                        color: "error",
                        class: "form-hint error-hint",
                        children: ($$renderer7) => {
                          $$renderer7.push(`<!---->${escape_html(usernameStatus.message?.[currentLang()] ?? "Username is already taken")}`);
                        },
                        $$slots: { default: true }
                      });
                    } else if (usernameStatus.checked && usernameStatus.available) {
                      $$renderer6.push("<!--[1-->");
                      Main$6($$renderer6, {
                        persistent: true,
                        color: "success",
                        class: "form-hint success-hint",
                        children: ($$renderer7) => {
                          $$renderer7.push(`<!---->${escape_html(usernameStatus.message?.[currentLang()] ?? "Username is available")}`);
                        },
                        $$slots: { default: true }
                      });
                    } else {
                      $$renderer6.push("<!--[-1-->");
                      Main$6($$renderer6, {
                        class: "form-hint",
                        children: ($$renderer7) => {
                          $$renderer7.push(`<!---->${escape_html(pageContents.hints.usernameHint[lang()])}`);
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
                $$renderer5.push(`<!----> `);
                Main$2($$renderer5, {
                  name: "email",
                  required: true,
                  children: ($$renderer6) => {
                    Main$3($$renderer6, {
                      children: ($$renderer7) => {
                        $$renderer7.push(`<!---->${escape_html(pageContents.textFields.email[lang()] ?? "Email")}`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer6.push(`<!----> `);
                    {
                      let leading = function($$renderer7) {
                        $$renderer7.push(`<svg class="auth-input-icon svelte-jy9hkg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" class="svelte-jy9hkg"></path><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" class="svelte-jy9hkg"></path></svg>`);
                      };
                      Main$4($$renderer6, {
                        type: "email",
                        inputmode: "email",
                        placeholder: { vi: "Nhập địa chỉ email", en: "Enter your email" },
                        autocomplete: "email",
                        loading: emailStatus.checking,
                        disabled: loading,
                        color: emailStatus.checked ? emailStatus.taken ? "error" : "success" : void 0,
                        get value() {
                          return formData.email;
                        },
                        set value($$value) {
                          formData.email = $$value;
                          $$settled = false;
                        },
                        leading,
                        $$slots: { leading: true }
                      });
                    }
                    $$renderer6.push(`<!----> `);
                    if (emailStatus.checked && emailStatus.taken) {
                      $$renderer6.push("<!--[0-->");
                      Main$6($$renderer6, {
                        persistent: true,
                        color: "error",
                        class: "form-hint error-hint",
                        children: ($$renderer7) => {
                          $$renderer7.push(`<!---->${escape_html(emailStatus.message?.[currentLang()] ?? "Email is already registered")}`);
                        },
                        $$slots: { default: true }
                      });
                    } else if (emailStatus.checked && emailStatus.available) {
                      $$renderer6.push("<!--[1-->");
                      Main$6($$renderer6, {
                        persistent: true,
                        color: "success",
                        class: "form-hint success-hint",
                        children: ($$renderer7) => {
                          $$renderer7.push(`<!---->${escape_html(emailStatus.message?.[currentLang()] ?? "Email is available")}`);
                        },
                        $$slots: { default: true }
                      });
                    } else {
                      $$renderer6.push("<!--[-1-->");
                      Main$5($$renderer6, {});
                    }
                    $$renderer6.push(`<!--]-->`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----> `);
                Main$2($$renderer5, {
                  name: "phone",
                  children: ($$renderer6) => {
                    Main$3($$renderer6, {
                      children: ($$renderer7) => {
                        $$renderer7.push(`<!---->${escape_html(pageContents.textFields.phone[lang()] ?? "Phone number")}`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer6.push(`<!----> `);
                    {
                      let leading = function($$renderer7) {
                        $$renderer7.push(`<svg class="auth-input-icon svelte-jy9hkg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" class="svelte-jy9hkg"></path></svg>`);
                      };
                      Main$4($$renderer6, {
                        type: "phone",
                        inputmode: "tel",
                        placeholder: {
                          vi: "Nhập số điện thoại (tùy chọn)",
                          en: "Enter phone number (optional)"
                        },
                        autocomplete: "tel",
                        disabled: loading,
                        phoneSuggest: true,
                        get value() {
                          return formData.phone;
                        },
                        set value($$value) {
                          formData.phone = $$value;
                          $$settled = false;
                        },
                        leading,
                        $$slots: { leading: true }
                      });
                    }
                    $$renderer6.push(`<!----> `);
                    Main$6($$renderer6, {
                      class: "form-hint",
                      children: ($$renderer7) => {
                        $$renderer7.push(`<!---->${escape_html(pageContents.hints.phoneHint[lang()] ?? "Optional - for account recovery and notifications")}`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer6.push(`<!----> `);
                    Main$5($$renderer6, {});
                    $$renderer6.push(`<!---->`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----> `);
                Main$2($$renderer5, {
                  name: "password",
                  required: true,
                  children: ($$renderer6) => {
                    Main$3($$renderer6, {
                      children: ($$renderer7) => {
                        $$renderer7.push(`<!---->${escape_html(pageContents.textFields.password[lang()] ?? "Password")}`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer6.push(`<!----> `);
                    {
                      let leading = function($$renderer7) {
                        $$renderer7.push(`<svg class="auth-input-icon svelte-jy9hkg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" class="svelte-jy9hkg"></path></svg>`);
                      };
                      Main$4($$renderer6, {
                        type: "password",
                        placeholder: { vi: "Nhập mật khẩu", en: "Enter your password" },
                        autocomplete: "new-password",
                        disabled: loading,
                        actionButtons: { showPassword: { display: true } },
                        get value() {
                          return formData.password;
                        },
                        set value($$value) {
                          formData.password = $$value;
                          $$settled = false;
                        },
                        leading,
                        $$slots: { leading: true }
                      });
                    }
                    $$renderer6.push(`<!----> `);
                    if (formData.password) {
                      $$renderer6.push("<!--[0-->");
                      $$renderer6.push(`<div class="strength-meter svelte-jy9hkg"${attr("aria-label", passwordStrength().label)} aria-live="polite"><div class="strength-bar-container svelte-jy9hkg"><div class="strength-bar-fill svelte-jy9hkg"${attr_style("", {
                        width: `${stringify(passwordStrength().percent)}%`,
                        "background-color": passwordStrength().color
                      })}></div></div> <span class="strength-label svelte-jy9hkg"${attr_style("", { color: passwordStrength().color })}>${escape_html(passwordStrength().label)}</span></div>`);
                    } else {
                      $$renderer6.push("<!--[-1-->");
                    }
                    $$renderer6.push(`<!--]--> `);
                    Main$6($$renderer6, {
                      class: "form-hint",
                      children: ($$renderer7) => {
                        $$renderer7.push(`<!---->${escape_html(pageContents.hints.passwordHint[lang()])}`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer6.push(`<!----> `);
                    Main$5($$renderer6, {});
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
                        $$renderer7.push(`<!---->${escape_html(pageContents.textFields.confirmPassword[lang()] ?? "Confirm password")}`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer6.push(`<!----> `);
                    {
                      let leading = function($$renderer7) {
                        $$renderer7.push(`<svg class="auth-input-icon svelte-jy9hkg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" class="svelte-jy9hkg"></path></svg>`);
                      };
                      Main$4($$renderer6, {
                        type: "password",
                        placeholder: { vi: "Nhập lại mật khẩu", en: "Confirm your password" },
                        autocomplete: "new-password",
                        disabled: loading,
                        color: confirmMatch() === false ? "error" : confirmMatch() === true ? "success" : void 0,
                        actionButtons: { showPassword: { display: true } },
                        get value() {
                          return formData.confirmPassword;
                        },
                        set value($$value) {
                          formData.confirmPassword = $$value;
                          $$settled = false;
                        },
                        leading,
                        $$slots: { leading: true }
                      });
                    }
                    $$renderer6.push(`<!----> `);
                    if (confirmMatch() === false) {
                      $$renderer6.push("<!--[0-->");
                      Main$6($$renderer6, {
                        persistent: true,
                        color: "error",
                        class: "form-hint error-hint",
                        children: ($$renderer7) => {
                          $$renderer7.push(`<!---->${escape_html(pageContents.hints.confirmPasswordHint[lang()] ?? "Passwords do not match")}`);
                        },
                        $$slots: { default: true }
                      });
                    } else if (confirmMatch() === true) {
                      $$renderer6.push("<!--[1-->");
                      Main$6($$renderer6, {
                        persistent: true,
                        color: "success",
                        class: "form-hint success-hint",
                        children: ($$renderer7) => {
                          $$renderer7.push(`<!---->${escape_html(lang() === "vi" ? "Mật khẩu khớp" : "Passwords match")}`);
                        },
                        $$slots: { default: true }
                      });
                    } else {
                      $$renderer6.push("<!--[-1-->");
                      Main$5($$renderer6, {});
                    }
                    $$renderer6.push(`<!--]-->`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----> <div class="terms-row svelte-jy9hkg">`);
                Checkbox($$renderer5, {
                  disabled: loading,
                  get checked() {
                    return agreeTerms;
                  },
                  set checked($$value) {
                    agreeTerms = $$value;
                    $$settled = false;
                  },
                  children: ($$renderer6) => {
                    $$renderer6.push(`<span class="terms-text svelte-jy9hkg">${escape_html(pageContents.terms.agreeLabel[lang()] ?? "I agree to the")} <button type="button" class="terms-link-btn svelte-jy9hkg"${attr("disabled", loading, true)}>${escape_html(pageContents.terms.linkText[lang()] ?? "Terms of Service")}</button></span>`);
                  },
                  $$slots: { default: true }
                });
                $$renderer5.push(`<!----></div> <div class="auth-actions svelte-jy9hkg">`);
                Main($$renderer5, {
                  class: "auth-btn-submit",
                  color: "success",
                  type: "submit",
                  loading,
                  disabled: status().disabled,
                  children: ($$renderer6) => {
                    $$renderer6.push(`<!---->${escape_html(pageContents.buttons.confirm[lang()] ?? "Create account")}`);
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
                    $$renderer6.push(`<!---->${escape_html(pageContents.buttons.reset[lang()] ?? "Reset")}`);
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
      $$renderer3.push(`<!----> `);
      Modal($$renderer3, {
        size: "md",
        isDimissable: true,
        get display() {
          return showTermsModal;
        },
        set display($$value) {
          showTermsModal = $$value;
          $$settled = false;
        },
        children: ($$renderer4) => {
          if (Modal.Container) {
            $$renderer4.push("<!--[-->");
            Modal.Container($$renderer4, {
              class: "terms-modal-box",
              children: ($$renderer5) => {
                if (Modal.Container.Header) {
                  $$renderer5.push("<!--[-->");
                  Modal.Container.Header($$renderer5, {
                    class: "terms-modal-header",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->${escape_html(pageContents.terms.modalTitle[lang()] ?? "Terms of Service")}`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push("<!--]-->");
                } else {
                  $$renderer5.push("<!--[!-->");
                  $$renderer5.push("<!--]-->");
                }
                $$renderer5.push(` `);
                if (Modal.Container.Body) {
                  $$renderer5.push("<!--[-->");
                  Modal.Container.Body($$renderer5, {
                    class: "terms-modal-body",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<p class="modal-intro svelte-jy9hkg">${escape_html(pageContents.terms.modalIntro[lang()])}</p> <div class="modal-clauses svelte-jy9hkg"><div class="clause-item svelte-jy9hkg"><p class="svelte-jy9hkg">${escape_html(pageContents.terms.modalP1[lang()])}</p></div> <div class="clause-item svelte-jy9hkg"><p class="svelte-jy9hkg">${escape_html(pageContents.terms.modalP2[lang()])}</p></div> <div class="clause-item svelte-jy9hkg"><p class="svelte-jy9hkg">${escape_html(pageContents.terms.modalP3[lang()])}</p></div></div>`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push("<!--]-->");
                } else {
                  $$renderer5.push("<!--[!-->");
                  $$renderer5.push("<!--]-->");
                }
                $$renderer5.push(` `);
                if (Modal.Container.Footer) {
                  $$renderer5.push("<!--[-->");
                  Modal.Container.Footer($$renderer5, {
                    class: "terms-modal-footer",
                    children: ($$renderer6) => {
                      Main($$renderer6, {
                        color: "success",
                        onClick: () => {
                          agreeTerms = true;
                          showTermsModal = false;
                        },
                        children: ($$renderer7) => {
                          $$renderer7.push(`<!---->${escape_html(pageContents.terms.acceptBtn[lang()] ?? "I Accept")}`);
                        },
                        $$slots: { default: true }
                      });
                      $$renderer6.push(`<!----> `);
                      Main($$renderer6, {
                        color: "default",
                        variant: "ghost",
                        onClick: () => {
                          showTermsModal = false;
                        },
                        children: ($$renderer7) => {
                          $$renderer7.push(`<!---->${escape_html(pageContents.terms.declineBtn[lang()] ?? "Decline")}`);
                        },
                        $$slots: { default: true }
                      });
                      $$renderer6.push(`<!---->`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push("<!--]-->");
                } else {
                  $$renderer5.push("<!--[!-->");
                  $$renderer5.push("<!--]-->");
                }
              },
              $$slots: { default: true }
            });
            $$renderer4.push("<!--]-->");
          } else {
            $$renderer4.push("<!--[!-->");
            $$renderer4.push("<!--]-->");
          }
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!---->`);
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
