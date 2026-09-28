import { e as element, b as attr_class, c as clsx, k as attr, g as ensure_array_like, h as escape_html, d as attr_style, f as bind_props, p as derived, u as run, a as setContext, q as getContext } from "./root.js";
import { m as mount, u as unmount, c as getFormContext, d as getTextFieldContext, o as onDestroy, M as Main$5, i as iconify } from "./index.js";
import { c as client, s as styleSynced, S as SvelteMap, b as convertToMiliseconds } from "./basic.svelte.js";
import "clsx";
let hostComponent = null;
let hostContainer = null;
let refCount = 0;
let timeId;
function ensureKeyboardHost(target, currentIndexCursor) {
  if (typeof document === "undefined") return () => {
  };
  if (timeId) cancelAnimationFrame(timeId);
  let released = false;
  refCount++;
  timeId = requestAnimationFrame(() => {
    if (released) return;
    if (!hostComponent) {
      hostContainer = document.createElement("div");
      hostContainer.setAttribute("data-keyboard-host", "");
      document.body.appendChild(hostContainer);
      hostComponent = mount();
    }
  });
  return () => {
    if (released) return;
    released = true;
    refCount--;
    if (refCount <= 0 && hostComponent) {
      unmount();
      hostContainer?.remove();
      hostComponent = null;
      hostContainer = null;
      refCount = 0;
    }
  };
}
function Main$4($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      value = void 0,
      disabled = void 0,
      $$slots,
      $$events,
      ...props
    } = $$props;
    let _initialValue = value;
    const inputId = derived(() => props.id ?? (textFieldContext?.name ? `field-${textFieldContext.name}` : void 0));
    const typeDerived = derived(() => props.type ?? "text");
    const sizeDerived = derived(() => props.size ?? textFieldContext?.size ?? formContext?.size ?? client.browser?.size ?? "md");
    const roundedDerived = derived(() => props.rounded ?? sizeDerived());
    const styleDerived = derived(() => {
      const defaultStyles = [
        "input-root",
        `size-${sizeDerived()}`,
        configs.status.focus ? "focus" : void 0,
        `variant-${variantDerived()}`,
        // Ưu tiên props.color nếu được set explicitly
        // Khi đang loading (realtime check) → trả về default (màu trung tính)
        // Check both external loading prop and internal validation loading state
        // Trường rỗng chưa từng validate (chưa blur nên chưa có process) → màu trung tính,
        // tránh hiển thị error đỏ ngay khi mount (regression: color-error mặc định)
        // Visual number keyboard cleanup — gán ở showVisualNumberKb(), gọi ở window mousedown (không cần reactive)
        disabledDerived() ? "disabled" : void 0,
        `rounded-${roundedDerived()}`,
        props.loading ? "loading" : void 0,
        `color-${colorDerived()}`,
        configs.status.hover || textFieldContext?.status.hover ? "hover" : void 0
      ];
      return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
    });
    const delayDerived = derived(() => client.browser?.delay ?? 300);
    const durationDerived = derived(() => client.browser?.delay ?? 300);
    const variantDerived = derived(() => props.variant ?? "secondary");
    const placeholderDerived = derived(() => {
      if (!props.placeholder) return void 0;
      if (typeof props.placeholder === "string") return props.placeholder;
      const currentLang = client.browser?.language ?? "en";
      const text = props.placeholder[currentLang] ?? props.placeholder.en ?? props.placeholder.vi;
      return text ? text : void 0;
    });
    const maxLengthDerived = derived(() => {
      if (props.maxLength) return typeof props.maxLength == "number" ? props.maxLength : parseFloat(props.maxLength);
      return void 0;
    });
    const maxNumberDerived = derived(() => {
      return typeof props.maxNumber == "number" ? props.maxNumber : props.maxNumber ? parseFloat(props.maxNumber) : void 0;
    });
    const minNumberDerived = derived(() => {
      return typeof props.minNumber == "number" ? props.minNumber : props.minNumber ? parseFloat(props.minNumber) : void 0;
    });
    const colorDerived = derived(() => {
      if (props.color) return props.color;
      if (props.loading || configs?.loading) return "default";
      if (props.validation || // Trường rỗng chưa từng validate (chưa blur nên chưa có process) → màu trung tính,
      // tránh hiển thị error đỏ ngay khi mount (regression: color-error mặc định)
      requiredDerived() || typeDerived() == "email") {
        const isValid = configs?.validation?.isValid;
        if (isValid == "pending") return "default";
        if (!isValid && !configs?.validation?.process && !value) return "default";
        return isValid ? "success" : "error";
      }
      return "default";
    });
    const requiredDerived = derived(() => props.required ?? textFieldContext?.required);
    let _disabled = void 0;
    const disabledDerived = derived(() => {
      if (disabled) return disabled;
      return _disabled ?? formContext?.disabled;
    });
    const nameDerived = derived(() => props.name ?? textFieldContext?.name);
    const clearDisplayDerived = derived(() => props.actionButtons?.clear?.display ?? true);
    const copyDisplayDerived = derived(() => props.actionButtons?.copy?.display ?? false);
    const pasteDisplayDerived = derived(() => props.actionButtons?.paste?.display ?? false);
    const showPasswordDisplayDerived = derived(() => props.actionButtons?.showPassword?.display ?? true);
    const highlightDerived = derived(() => props.highlight);
    const caseSensitiveDerived = derived(() => props.caseSensitive ?? false);
    const highlightSegmentsDerived = derived(() => {
      if (!highlightDerived() || !value) return void 0;
      const flag = caseSensitiveDerived() ? "" : "i";
      let regex;
      try {
        regex = new RegExp(highlightDerived().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), `g${flag}`);
      } catch {
        return void 0;
      }
      const segments = [];
      let lastIndex = 0;
      for (const match of value.matchAll(regex)) {
        if (match.index > lastIndex) {
          segments.push({ text: value.slice(lastIndex, match.index), isMatch: false });
        }
        segments.push({ text: match[0], isMatch: true });
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < value.length) {
        segments.push({ text: value.slice(lastIndex), isMatch: false });
      }
      return segments;
    });
    let emailHighlightedIndex = 0;
    const defaultPopularEmailDomains = [
      "gmail.com",
      "outlook.com",
      "icloud.com",
      "atomicmail.com",
      "proton.me",
      "protonmail.com",
      "yahoo.com",
      "hotmail.com"
    ];
    const emailSuggestEnabled = derived(() => props.emailSuggest ?? typeDerived() === "email");
    const emailDomainsDerived = derived(() => props.emailDomains ?? defaultPopularEmailDomains);
    const emailPartsDerived = derived(() => {
      if (!emailSuggestEnabled() || typeof value !== "string") {
        return null;
      }
      const firstAt = value.indexOf("@");
      const lastAt = value.lastIndexOf("@");
      if (firstAt === -1 || firstAt !== lastAt) {
        return null;
      }
      const prefix = value.slice(0, firstAt);
      if (prefix.length < 1) {
        return null;
      }
      const query = value.slice(firstAt + 1).toLowerCase();
      return { prefix, query };
    });
    const matchingEmailDomains = derived(() => {
      if (!emailPartsDerived()) return [];
      const { query } = emailPartsDerived();
      return emailDomainsDerived().filter((domain) => {
        const lower = domain.toLowerCase();
        return lower.startsWith(query) && lower !== query;
      });
    });
    let isInteractingWithSuggestions = false;
    const isFocused = derived(() => !!(configs?.status?.focus || configs?.input?.status?.focus));
    const emailSuggestionsOpen = derived(() => emailSuggestEnabled() && true && (isFocused() || isInteractingWithSuggestions) && emailPartsDerived() !== null && matchingEmailDomains().length > 0);
    let phoneHighlightedIndex = 0;
    const defaultPhoneCountryCodes = [
      {
        code: "+1",
        name: "United States",
        format: "(XXX) XXX-XXXX",
        mask: "(###) ###-####",
        example: "+1 (555) 123-4567"
      },
      {
        code: "+44",
        name: "United Kingdom",
        format: "XXXX XXXXXXX",
        mask: "#### #######",
        example: "+44 7911 123456"
      },
      {
        code: "+84",
        name: "Vietnam",
        format: "XX XXXX XXXX",
        mask: "## #### ####",
        example: "+84 90 123 4567"
      },
      {
        code: "+86",
        name: "China",
        format: "XXX XXXX XXXX",
        mask: "### #### ####",
        example: "+86 138 1234 5678"
      },
      {
        code: "+81",
        name: "Japan",
        format: "XX XXXX XXXX",
        mask: "## #### ####",
        example: "+81 90 1234 5678"
      },
      {
        code: "+82",
        name: "South Korea",
        format: "XX XXXX XXXX",
        mask: "## #### ####",
        example: "+82 10 1234 5678"
      },
      {
        code: "+65",
        name: "Singapore",
        format: "XXXX XXXX",
        mask: "#### ####",
        example: "+65 8123 4567"
      },
      {
        code: "+60",
        name: "Malaysia",
        format: "XX XXXX XXXX",
        mask: "## #### ####",
        example: "+60 12 345 6789"
      },
      {
        code: "+66",
        name: "Thailand",
        format: "XX XXXX XXXX",
        mask: "## #### ####",
        example: "+66 81 234 5678"
      },
      {
        code: "+62",
        name: "Indonesia",
        format: "XX XXXX XXXX",
        mask: "## #### ####",
        example: "+62 812 345 6789"
      },
      {
        code: "+63",
        name: "Philippines",
        format: "XXX XXX XXXX",
        mask: "### ### ####",
        example: "+63 917 123 4567"
      },
      {
        code: "+91",
        name: "India",
        format: "XXXXX XXXXX",
        mask: "##### #####",
        example: "+91 98765 43210"
      },
      {
        code: "+49",
        name: "Germany",
        format: "XXXX XXXXXXX",
        mask: "#### #######",
        example: "+49 170 1234567"
      },
      {
        code: "+33",
        name: "France",
        format: "XX XX XX XX XX",
        mask: "## ## ## ## ##",
        example: "+33 6 12 34 56 78"
      },
      {
        code: "+39",
        name: "Italy",
        format: "XXX XXXXXXX",
        mask: "### #######",
        example: "+39 320 1234567"
      },
      {
        code: "+34",
        name: "Spain",
        format: "XXX XX XX XX",
        mask: "### ## ## ##",
        example: "+34 600 12 34 56"
      },
      {
        code: "+55",
        name: "Brazil",
        format: "XX XXXXX XXXX",
        mask: "## ##### ####",
        example: "+55 11 91234 5678"
      },
      {
        code: "+7",
        name: "Russia",
        format: "XXX XXX XX XX",
        mask: "### ### ## ##",
        example: "+7 916 123 45 67"
      },
      {
        code: "+27",
        name: "South Africa",
        format: "XX XXX XXXX",
        mask: "## ### ####",
        example: "+27 82 123 4567"
      },
      {
        code: "+61",
        name: "Australia",
        format: "X XXXX XXXX",
        mask: "# #### ####",
        example: "+61 412 345 678"
      }
    ];
    const phoneSuggestEnabled = derived(() => props.phoneSuggest ?? typeDerived() === "phone");
    const phoneCountryCodesDerived = derived(() => props.phoneCountryCodes ?? defaultPhoneCountryCodes);
    const phonePartsDerived = derived(() => {
      if (!phoneSuggestEnabled() || typeof value !== "string") {
        return null;
      }
      const digitsOnly = value.replace(/\D/g, "");
      if (!digitsOnly) return null;
      if (digitsOnly.length >= 1) {
        return { digitsOnly, query: digitsOnly };
      }
      return null;
    });
    const matchingPhoneCountries = derived(() => {
      if (!phonePartsDerived()) return [];
      const { query, digitsOnly } = phonePartsDerived();
      return phoneCountryCodesDerived().filter((country) => {
        const countryCodeDigits = country.code.replace(/\D/g, "");
        return countryCodeDigits.startsWith(query) && digitsOnly.length <= countryCodeDigits.length;
      });
    });
    let isInteractingWithPhoneSuggestions = false;
    const phoneSuggestionsOpen = derived(() => phoneSuggestEnabled() && true && (isFocused() || isInteractingWithPhoneSuggestions) && phonePartsDerived() !== null && matchingPhoneCountries().length > 0);
    function getCountryFlag(countryCode) {
      const code = countryCode.replace("+", "");
      const countryFlags = {
        "1": "🇺🇸",
        // US/Canada
        "44": "🇬🇧",
        // UK
        "84": "🇻🇳",
        // Vietnam
        "86": "🇨🇳",
        // China
        "81": "🇯🇵",
        // Japan
        "82": "🇰🇷",
        // South Korea
        "65": "🇸🇬",
        // Singapore
        "60": "🇲🇾",
        // Malaysia
        "66": "🇹🇭",
        // Thailand
        "62": "🇮🇩",
        // Indonesia
        "63": "🇵🇭",
        // Philippines
        "91": "🇮🇳",
        // India
        "49": "🇩🇪",
        // Germany
        "33": "🇫🇷",
        // France
        "39": "🇮🇹",
        // Italy
        "34": "🇪🇸",
        // Spain
        "55": "🇧🇷",
        // Brazil
        "7": "🇷🇺",
        // Russia
        "27": "🇿🇦",
        // South Africa
        "61": "🇦🇺"
        // Australia
      };
      return countryFlags[code] || "🌐";
    }
    let passwordStatus = {
      _showing: void 0,
      get showing() {
        if (this._showing == void 0) return props.showPassword;
        return this._showing;
      },
      set showing(v) {
        this._showing = v;
      }
    };
    let configs = {
      status: {
        get changed() {
          return (_initialValue ?? "") !== (configs.value ?? "");
        }
      },
      get type() {
        return typeDerived();
      },
      get size() {
        return sizeDerived();
      },
      get rounded() {
        return roundedDerived();
      },
      get style() {
        return styleDerived();
      },
      get delay() {
        return delayDerived();
      },
      get duration() {
        return durationDerived();
      },
      get variant() {
        return variantDerived();
      },
      get maxLength() {
        return maxLengthDerived();
      },
      get maxNumber() {
        return maxNumberDerived();
      },
      get minNumber() {
        return minNumberDerived();
      },
      get color() {
        return colorDerived();
      },
      get required() {
        return requiredDerived();
      },
      get _disabled() {
        return _disabled;
      },
      set _disabled(v) {
        _disabled = v;
      },
      get disabled() {
        return disabledDerived();
      },
      set disabled(v) {
        _disabled = v;
      },
      get name() {
        return nameDerived();
      },
      get highlight() {
        return highlightDerived();
      },
      get caseSensitive() {
        return caseSensitiveDerived();
      },
      validation: {
        get isValid() {
          if (!props.validation && !configs.required && configs.type !== "email") return true;
          if (configs.validation.process) {
            const operator = props.validation?.operator ?? "and";
            const results = [...configs.validation.process.values()];
            if (results.some((rs) => rs == "pending")) return "pending";
            return operator == "and" ? results.every((rs) => rs) : results.some((rs) => rs);
          }
          if (configs.required) {
            const val = configs.value ?? "";
            return val.trim().length > 0;
          }
          return true;
        }
      },
      get event() {
        if (this.disabled) return [];
        const defaultValidators = getDefaultValidators();
        const hasCustomValidation = !!props.validation;
        const hasDefaultValidation = defaultValidators.length > 0;
        if (!hasCustomValidation && !hasDefaultValidation) {
          return [{ events: buildCoreEvents() }, ...props.events ?? []];
        }
        if (!hasCustomValidation) {
          return [
            {
              events: {
                async blur() {
                  if (textFieldContext) textFieldContext.status.touched = true;
                  if (!configs.validation.process) configs.validation.process = new SvelteMap();
                  const operator = "and";
                  await processingValidation("blur", defaultValidators, operator);
                }
              }
            },
            { events: buildCoreEvents() },
            ...props.events ?? []
          ];
        }
        const globalOperator = props.validation?.operator ?? "and";
        const validationEntries = props.validation ? Object.entries(props.validation).filter(([key]) => key !== "operator" && !["keyup", "keydown"].includes(key)) : [];
        const hasBlurEntry = validationEntries.some(([key]) => key === "blur");
        if (defaultValidators.length > 0 && !hasBlurEntry) {
          validationEntries.push(["blur", []]);
        }
        const validationEvents = validationEntries.length > 0 ? {
          events: Object.fromEntries(validationEntries.map(([eventName, data]) => {
            return [
              eventName,
              async () => {
                const evName = eventName;
                if (evName === "blur" && textFieldContext) {
                  textFieldContext.status.touched = true;
                }
                if (!configs.validation.process) {
                  configs.validation.process = new SvelteMap();
                }
                let dataArr;
                let operator = globalOperator;
                if (Array.isArray(data)) {
                  dataArr = data;
                } else if (typeof data === "object" && data != null) {
                  operator = data.operator ?? globalOperator;
                  dataArr = data.handles;
                } else {
                  dataArr = [];
                }
                const finalHandles = evName === "blur" && defaultValidators.length > 0 ? [...dataArr, ...defaultValidators] : dataArr;
                if (finalHandles.length === 0) return;
                await processingValidation(evName, finalHandles, operator);
              }
            ];
          }))
        } : null;
        return [
          validationEvents,
          { events: buildCoreEvents() },
          ...props.events ?? []
        ];
      },
      placeholder: {
        get value() {
          if (!props.placeholder) return { vi: "", en: "" };
          if (typeof props.placeholder === "string") return { vi: props.placeholder, en: props.placeholder };
          return props.placeholder;
        },
        get event() {
          if (configs.disabled) return [];
          return [
            {
              events: {
                mousedown() {
                  configs.focus();
                }
              }
            }
          ];
        }
      },
      input: {
        status: {},
        text: {
          get event() {
            if (configs.disabled) return [];
            return [
              props.validation ? {
                events: Object.fromEntries(Object.entries(props.validation).filter(([eventName, _]) => ["keyup", "keydown"].includes(eventName)).map(([eventName, data]) => {
                  return [
                    eventName,
                    async () => {
                      const evName = eventName;
                      if (evName !== "operator") {
                        if (!configs.validation.process) configs.validation.process = new SvelteMap();
                        if (typeof data == "object" && Array.isArray(data)) {
                          const operator = props.validation?.operator ?? "and";
                          await processingValidation(evName, data, operator);
                        } else if (typeof data == "object") {
                          const operator = data.operator ?? props.validation?.operator ?? "and";
                          await processingValidation(evName, data.handles, operator);
                        }
                      }
                    }
                  ];
                }))
              } : { events: {} },
              {
                events: {
                  load(e, data) {
                    if (data?.node instanceof HTMLInputElement) {
                      if (!configs.timeId) configs.timeId = /* @__PURE__ */ new Map();
                      const name = "timeout-get-size-input";
                      const timeId2 = configs.timeId.get(name);
                      if (timeId2) clearTimeout(timeId2);
                      configs.timeId.set(name, setTimeout(
                        () => {
                          if (data.node instanceof HTMLInputElement) {
                            const rect = data.node.getBoundingClientRect();
                            if (data.node.offsetWidth) configs.maskValue.width = rect.width;
                            if (data.node.offsetHeight) configs.maskValue.height = rect.height;
                          }
                        },
                        configs.duration
                      ));
                    }
                  },
                  keydown(e) {
                    const event = e;
                    if (event && configs.maxLength && configs.type == "text" && value?.length == configs.maxLength && !text_keys_allowed.includes(event.key.toLowerCase())) {
                      event.preventDefault();
                    }
                  }
                }
              },
              ...createDefaultInputEvents(run(() => value), configs, textFieldContext, formContext) ?? []
            ];
          },
          get style() {
            const defaultStyles = ["input-editor"];
            return styleSynced({ defaultStyles });
          }
        },
        password: {
          get showPassword() {
            return passwordStatus.showing;
          },
          status: passwordStatus,
          get style() {
            return configs.input.text.style;
          },
          get event() {
            if (configs.disabled) return [];
            return [
              props.validation ? {
                events: Object.fromEntries(Object.entries(props.validation).filter(([eventName, _]) => ["keyup", "keydown"].includes(eventName)).map(([eventName, data]) => {
                  return [
                    eventName,
                    async () => {
                      const evName = eventName;
                      if (evName == "operator") ;
                      else {
                        if (!configs.validation.process) configs.validation.process = new SvelteMap();
                        if (typeof data == "object" && Array.isArray(data)) {
                          const operator = props.validation?.operator ?? "and";
                          await processingValidation(evName, data, operator);
                        } else if (typeof data == "object") {
                          const operator = data.operator ?? props.validation?.operator ?? "and";
                          await processingValidation(evName, data.handles, operator);
                        }
                      }
                    }
                  ];
                }))
              } : { events: {} },
              ...createDefaultInputEvents(run(() => value), configs, textFieldContext, formContext) ?? []
            ];
          }
        },
        email: {
          get style() {
            return configs.input.text.style;
          },
          get event() {
            if (configs.disabled) return [];
            return configs.input.text.event;
          }
        },
        phone: {
          get style() {
            return configs.input.text.style;
          },
          get event() {
            if (configs.disabled) return [];
            return configs.input.text.event;
          }
        },
        number: {
          get style() {
            return [...configs.input.text.style ?? [], "input-editor-number"];
          },
          get event() {
            return void 0;
          }
        },
        currency: {}
      },
      maskValue: {
        get style() {
          const defaultStyles = ["input-mask", ...configs.input.text?.style ?? []];
          return styleSynced({ defaultStyles });
        },
        get event() {
          if (configs.disabled) return [];
          return [
            {
              events: {
                async load(e, data) {
                  if (data?.node instanceof HTMLElement) {
                    data.node.style.width = `${configs.maskValue.width}px`;
                    data.node.style.height = `${configs.maskValue.height}px`;
                    data.node.scrollTo({ left: data.node.scrollWidth, behavior: "smooth" });
                    if (value && configs.type == "number") {
                      if (!configs.timeId) configs.timeId = /* @__PURE__ */ new Map();
                      const name = "timeout-calculate";
                      const timeId2 = configs.timeId.get(name);
                      if (timeId2) {
                        clearTimeout(timeId2);
                      }
                      configs.timeId.set(name, setTimeout(
                        () => {
                          if (value) {
                            const rs = calculatorString(value);
                            if (rs && rs.toString() !== value) {
                              value = rs.toString();
                            }
                          }
                        },
                        configs.delay
                      ));
                    }
                  }
                  return () => {
                    requestAnimationFrame(() => {
                      const ref = configs.input[configs.type].ref;
                      if (ref) {
                        ref.focus();
                        configs.ref?.classList.add("animation-bounce");
                        setTimeout(
                          () => {
                            configs.ref?.classList.remove("animation-bounce");
                          },
                          configs.duration
                        );
                      }
                    });
                  };
                }
              }
            }
          ];
        }
      },
      actionButtons: {
        clear: {
          get display() {
            return clearDisplayDerived();
          },
          event: [
            {
              events: {
                mousedown: {
                  handler() {
                    if (configs.type == "password") {
                      configs.input.password.value = "";
                    }
                    value = "";
                    configs.status.currentCursor = 0;
                    onFocus();
                  },
                  options: {}
                }
              }
            }
          ],
          get ref() {
            const component = configs.actionButtons.clear.component;
            if (component && component.configs) return component.configs.ref;
            return void 0;
          }
        },
        copy: {
          get display() {
            return copyDisplayDerived();
          },
          status: {},
          event: [
            {
              events: {
                async mousedown() {
                  if (!value) return;
                  const date = /* @__PURE__ */ new Date();
                  localStorage.setItem("clipboard", JSON.stringify({ [`${date.getTime()}`]: value }));
                  if (!client.browser) client.browser = {};
                  if (!client.browser?.clipboard) client.browser.clipboard = /* @__PURE__ */ new Map();
                  client.browser.clipboard.set(date.getTime(), value);
                  configs.actionButtons.copy.status.copied = true;
                  if (!configs.timeId) configs.timeId = /* @__PURE__ */ new Map();
                  const name = "timeout-copy";
                  const timeId2 = configs.timeId.get(name);
                  if (timeId2) clearTimeout(timeId2);
                  configs.timeId.set(name, setTimeout(
                    () => {
                      configs.actionButtons.copy.status.copied = false;
                    },
                    configs.duration
                  ));
                  return () => {
                    if (configs.timeId) {
                      const timeId3 = configs.timeId.get(name);
                      if (timeId3) clearTimeout(timeId3);
                    }
                  };
                }
              }
            }
          ]
        },
        paste: {
          get display() {
            return pasteDisplayDerived();
          },
          status: {},
          event: [
            {
              events: {
                async load() {
                },
                async mousedown() {
                  if (!client.browser?.clipboard) return;
                  const lastTime = [...client.browser.clipboard.keys()].sort((timeA, timeB) => timeB - timeA)[0];
                  if (!lastTime) return;
                  const clipboard = client.browser.clipboard.get(lastTime);
                  if (!clipboard) return;
                  value = clipboard.slice(0, configs.maxLength ? configs.maxLength : -1);
                  if (configs.type == "password") configs.input.password.value = value;
                  configs.actionButtons.paste.status.pasted = true;
                  if (!configs.timeId) configs.timeId = /* @__PURE__ */ new Map();
                  const name = "timeout-paste";
                  const timeId2 = configs.timeId.get(name);
                  if (timeId2) clearTimeout(timeId2);
                  configs.timeId.set(name, setTimeout(
                    () => {
                      configs.actionButtons.paste.status.pasted = false;
                    },
                    configs.duration
                  ));
                  return () => {
                    if (configs.timeId) {
                      const timeId3 = configs.timeId.get(name);
                      if (timeId3) clearTimeout(timeId3);
                    }
                  };
                }
              }
            }
          ]
        },
        showPassword: {
          get display() {
            return showPasswordDisplayDerived();
          },
          status: passwordStatus,
          event: [
            {
              events: {
                mousedown(e) {
                  e.preventDefault();
                },
                click() {
                  const newShowing = !passwordStatus.showing;
                  passwordStatus.showing = newShowing;
                  if (newShowing) {
                    configs.input.password.value = value;
                  }
                  requestAnimationFrame(() => {
                    if (configs.input.password.ref) {
                      configs.input.password.ref.setSelectionRange(configs.status.currentCursor ?? 1, configs.status.currentCursor ?? 1);
                    }
                  });
                }
              }
            }
          ]
        }
      },
      leading: {
        get style() {
          const defaultStyles = ["input-leading input-snippet"];
          return styleSynced({ defaultStyles });
        }
      },
      trailing: {
        get style() {
          const defaultStyles = ["input-trailing input-snippet"];
          return styleSynced({ defaultStyles });
        }
      },
      focus() {
        if (client.browser?.isMobile) {
          if (!client.browser.visualInput) client.createInputVisual();
          if (client.browser.visualInput) {
            client.browser.visualInput.focus();
          }
        }
        configs.status.focus = true;
        requestAnimationFrame(() => {
          const type = configs.type === "password" || configs.type === "email" || configs.type === "phone" ? configs.type : "text";
          const ref = configs.input[type]?.ref;
          if (ref && typeof ref.focus === "function" && document.activeElement !== ref) {
            ref.focus();
          }
        });
      },
      reset() {
        value = _initialValue;
        if (configs.type == "password") configs.input.password.value = _initialValue;
        configs.validation.process = void 0;
        configs.validation.messages = void 0;
        if (configs.timeId) {
          for (const id of configs.timeId.values()) clearTimeout(id);
          configs.timeId.clear();
        }
        configs.loading = false;
        configs.status.focus = false;
        configs.input.status.focus = false;
        if (configs.ref) {
          configs.ref.classList.remove("validation-loading");
        }
      }
    };
    const formContext = getFormContext();
    const textFieldContext = getTextFieldContext();
    function onFocus() {
      requestAnimationFrame(() => {
        configs.input.text?.ref?.focus();
      });
    }
    let resolver;
    async function processingValidation(eventName, handles, operator) {
      if (!props.validation && !configs.required && configs.type !== "email") return;
      if (!configs.validation.messages) configs.validation.messages = new SvelteMap();
      if (!configs.timeId) configs.timeId = /* @__PURE__ */ new Map();
      const name = `timeout-validation-${eventName}`;
      const timeId2 = configs.timeId.get(name);
      if (timeId2) clearTimeout(timeId2);
      if (resolver) {
        resolver();
      }
      return new Promise((resolve) => {
        resolver = resolve;
        if (!configs.timeId) configs.timeId = /* @__PURE__ */ new Map();
        configs.timeId.set(name, setTimeout(
          async () => {
            if (!configs.validation.process) configs.validation.process = new SvelteMap();
            configs.validation.process.set(eventName, "pending");
            configs.loading = true;
            if (configs.ref) {
              configs.ref.classList.add("validation-loading");
            }
            const promises = await Promise.all(handles.map(async (validateHandler) => {
              if (!configs.validation.messages) configs.validation.messages = new SvelteMap();
              let result;
              let isValid;
              if (typeof validateHandler == "function") {
                isValid = validateHandler;
                result = await isValid(run(() => value));
              } else {
                isValid = validateHandler.isValid;
                result = await isValid(run(() => value));
                const content = result ? validateHandler.message?.valid : validateHandler.message?.invalid;
                const kind = result ? "valid" : "invalid";
                configs.validation.messages.set(isValid, { content, kind });
              }
              return result;
            }));
            configs.validation.process.set(eventName, operator == "and" ? promises.every((isValid) => isValid) : promises.some((isValid) => isValid));
            const overallValid = operator == "and" ? promises.every((isValid) => isValid) : promises.some((isValid) => isValid);
            configs.validation.isValid = overallValid;
            if (configs.ref && configs.validation.isValid != "pending") {
              configs.ref.classList.remove("validation-loading");
            }
            configs.loading = false;
            resolve();
          },
          configs.delay
        ));
      });
    }
    function showVisualNumberKb() {
      ({
        ref: configs.input.number.ref,
        maxLength: configs.maxLength
      });
      ensureKeyboardHost();
    }
    function calculatorString(input) {
      let calculated;
      try {
        calculated = Function(`'use strict'; return (${input?.toString().replaceAll("x", "*").replaceAll(":", "/")})`)();
        configs.previousValue = calculated.toString();
        return calculated;
      } catch (e) {
        return configs.previousValue ? parseFloat(configs.previousValue) : void 0;
      }
    }
    function buildCoreEvents() {
      return {
        async load() {
          if (client.browser?.isMobile && !client.browser.visualInput) {
            client.createInputVisual();
          }
          let clipboardRaw;
          clipboardRaw = localStorage.getItem("clipboard");
          if (!clipboardRaw) return;
          if (!client.browser) client.browser = {};
          if (!client.browser.clipboard) client.browser.clipboard = /* @__PURE__ */ new Map();
          try {
            const [time, content] = Object.entries(JSON.parse(clipboardRaw))[0];
            client.browser.clipboard.set(parseFloat(time), content);
          } catch (e) {
            console.log(e);
          }
        },
        mousedown: {
          async handler(e) {
            configs.status.mousePos = { clientX: e.clientX, clientY: e.clientY };
            const target = e.target;
            const type = configs.type;
            const ref = configs.input[type]?.ref;
            if (target !== ref) {
              e.preventDefault();
            }
            if (e.detail == 1) {
              if (configs.type === "number" && client.browser?.isMobile && !client.browser?.visualKeyboard) {
                if (!client.browser?.visualInput) client.createInputVisual();
                await client.getVisualKeyboardMeta();
                requestAnimationFrame(() => showVisualNumberKb());
              } else {
                if (configs.status.focus) {
                  if (target !== ref) {
                    const name = "animation-bounce";
                    if (!configs.timeId) configs.timeId = /* @__PURE__ */ new Map();
                    const timeId2 = configs.timeId.get(name);
                    if (timeId2) clearTimeout(timeId2);
                    configs.timeId.set(name, setTimeout(
                      () => {
                        configs.ref?.classList.add("animation-bounce");
                        setTimeout(() => configs.ref?.classList.remove("animation-bounce"), configs.duration);
                      },
                      configs.delay
                    ));
                  }
                } else {
                  configs.focus();
                  if (configs.type === "number" && client.browser?.isMobile) {
                    requestAnimationFrame(() => showVisualNumberKb());
                  }
                }
              }
            } else {
              configs.status.selectAll = true;
            }
          },
          options: { stopPropagation: true }
        },
        keydown: {
          handler(e) {
            const type = configs.type;
            const ref = configs.input[type]?.ref;
            if ((e.key === "Enter" || e.key === " ") && ref && !configs.status.focus) {
              e.preventDefault();
              configs.focus();
            }
          }
        }
      };
    }
    function getDefaultValidators() {
      const validators = [];
      if (configs.required) {
        validators.push(defaultValidation.required(configs.name));
      }
      if (configs.type === "number") {
        if (configs.minNumber != null && defaultValidation.minNumber) {
          validators.push(defaultValidation.minNumber(configs.minNumber, configs.name));
        }
        if (configs.maxNumber != null && defaultValidation.maxNumber) {
          validators.push(defaultValidation.maxNumber(configs.maxNumber, configs.name));
        }
      } else if (configs.type === "email" && defaultValidation.isEmail) {
        validators.push(defaultValidation.isEmail(configs.name));
      }
      return validators;
    }
    onDestroy(() => {
      value = void 0;
      if (configs.type == "password") configs.input.password.value = void 0;
      [...configs.timeId?.values() ?? []].forEach((time) => {
        clearTimeout(time);
      });
      configs.timeId?.clear();
    });
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-1f2hha7")}${attr_style("", { "--duration": `${configs.duration}ms` })}`);
      },
      () => {
        if (props.leading) {
          $$renderer2.push("<!--[0-->");
          props.leading($$renderer2, {
            defaultStyles: configs.leading.style,
            get size() {
              return configs.size;
            }
          });
          $$renderer2.push(`<!---->`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (configs.type == "number") {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div${attr_class(clsx(configs.input.number.style), "svelte-1f2hha7")}><input type="text"${attr("value", value)} class="me-7sa9mj svelte-1f2hha7"${attr("placeholder", placeholderDerived())}${attr("readonly", client.browser?.isMobile, true)}${attr("inputmode", client.browser?.isMobile ? "none" : void 0)}${attr("id", inputId())}/> `);
          if (client.browser?.isMobile) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="input-visual-cursor svelte-1f2hha7"></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<div class="input-highlight-wrapper svelte-1f2hha7">`);
          if (highlightSegmentsDerived() && configs.type !== "password") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="input-highlight-layer svelte-1f2hha7" aria-hidden="true"><!--[-->`);
            const each_array = ensure_array_like(highlightSegmentsDerived());
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let seg = each_array[$$index];
              if (seg.isMatch) {
                $$renderer2.push("<!--[0-->");
                $$renderer2.push(`<mark class="input-highlight-mark svelte-1f2hha7">${escape_html(seg.text)}</mark>`);
              } else {
                $$renderer2.push("<!--[-1-->");
                $$renderer2.push(`<span class="svelte-1f2hha7">${escape_html(seg.text)}</span>`);
              }
              $$renderer2.push(`<!--]-->`);
            }
            $$renderer2.push(`<!--]--> ​</div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <input${attr("type", configs.type == "password" ? configs.input.password.showPassword ? "text" : "password" : configs.type == "email" || configs.type == "phone" ? configs.type : "text")}${attr("value", value)}${attr_class(
            clsx([
              ...configs.input[configs.type == "password" || configs.type == "email" || configs.type == "phone" ? configs.type : "text"].style ?? [],
              highlightSegmentsDerived() && configs.type !== "password" ? "input-transparent-text" : "",
              "me-7sa9mj",
              configs.actionButtons.clear.display && value || configs.actionButtons.copy.display || configs.type == "password" ? "me-o4tgjg" : ""
            ]),
            "svelte-1f2hha7"
          )}${attr("placeholder", placeholderDerived())}${attr("autocomplete", props.autocomplete ?? "off")}${attr("inputmode", props.inputmode)}${attr("name", nameDerived())}${attr("id", inputId())}/></div>`);
        }
        $$renderer2.push(`<!--]--> `);
        if (configs.maxLength && configs.type == "text") {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="input-max-length svelte-1f2hha7">${escape_html(value?.length ?? 0)}/${escape_html(configs.maxLength)}</div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <div class="input-group-actions svelte-1f2hha7">`);
        if (!value && client.browser?.clipboard?.size && configs.actionButtons.paste.display) {
          $$renderer2.push("<!--[0-->");
          Main$5($$renderer2, {
            icon: configs.actionButtons.copy.status.copied ? iconify["check-rounded"] : iconify["content-paste-rounded"],
            class: "me-memfg7 input-paste",
            size: "xs",
            "aspect-square": true,
            color: "success",
            events: configs.actionButtons.paste.event,
            disabled: configs.actionButtons.paste.status.pasted
          });
        } else if (value) {
          $$renderer2.push("<!--[1-->");
          if (configs.actionButtons.clear.display) {
            $$renderer2.push("<!--[0-->");
            if (configs.loading) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<div class="me-memfg7 input-loading-indicator svelte-1f2hha7" aria-live="polite" aria-label="Validating..."><svg class="spinner svelte-1f2hha7" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" class="svelte-1f2hha7"></circle><path d="M12 2C12 2 12 4 12 4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="12 24" stroke-dashoffset="0" class="svelte-1f2hha7"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" class="svelte-1f2hha7"></animateTransform></path></svg></div>`);
            } else {
              $$renderer2.push("<!--[-1-->");
              Main$5($$renderer2, {
                icon: iconify["close-rounded"],
                size: "xs",
                "aspect-square": true,
                events: configs.actionButtons.clear.event,
                class: "me-memfg7 input-clear",
                color: "error",
                variant: "ghost"
              });
            }
            $$renderer2.push(`<!--]-->`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (configs.actionButtons.copy.display) {
            $$renderer2.push("<!--[0-->");
            Main$5($$renderer2, {
              icon: configs.actionButtons.copy.status.copied ? iconify["check-rounded"] : iconify["content-copy-outline-rounded"],
              class: "me-memfg7 input-copy",
              size: "xs",
              "aspect-square": true,
              color: "success",
              events: configs.actionButtons.copy.event,
              disabled: configs.actionButtons.copy.status.copied || value == client.browser?.clipboard?.get([...client.browser?.clipboard?.keys() ?? []].sort((timeA, timeB) => timeB - timeA)[0])
            });
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]-->`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (configs.type == "password") {
          $$renderer2.push("<!--[0-->");
          Main$5($$renderer2, {
            icon: configs.input.password.showPassword ? iconify["password-2-off-rounded"] : iconify["password-2-rounded"],
            class: "me-memfg7",
            events: configs.actionButtons.showPassword.event,
            size: "xs",
            "aspect-square": true
          });
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> `);
        if (props.trailing) {
          $$renderer2.push("<!--[0-->");
          props.trailing($$renderer2, {
            defaultStyles: configs.trailing.style,
            get size() {
              return configs.size;
            }
          });
          $$renderer2.push(`<!---->`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (emailSuggestionsOpen() && matchingEmailDomains().length > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="email-suggestions-popup svelte-1f2hha7" role="listbox" aria-label="Email domain suggestions" tabindex="0"><div class="email-suggestions-header svelte-1f2hha7"><span class="svelte-1f2hha7">Gợi ý domain</span></div> <div class="email-suggestions-list svelte-1f2hha7"><!--[-->`);
          const each_array_1 = ensure_array_like(matchingEmailDomains());
          for (let idx = 0, $$length = each_array_1.length; idx < $$length; idx++) {
            let domain = each_array_1[idx];
            $$renderer2.push(`<button type="button" role="option"${attr("aria-selected", emailHighlightedIndex === idx)}${attr_class(`email-suggestion-item ${emailHighlightedIndex === idx ? "active" : ""}`, "svelte-1f2hha7")}><span class="email-suggestion-icon svelte-1f2hha7">@</span> <span class="email-suggestion-text svelte-1f2hha7"><span class="email-suggestion-prefix svelte-1f2hha7">${escape_html(emailPartsDerived()?.prefix ?? "")}@</span> <span class="email-suggestion-match svelte-1f2hha7">${escape_html(emailPartsDerived()?.query ?? "")}</span> <span class="email-suggestion-rest svelte-1f2hha7">${escape_html(domain.slice(emailPartsDerived()?.query.length ?? 0))}</span></span> `);
            if (emailHighlightedIndex === idx) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<span class="email-suggestion-hint svelte-1f2hha7">Tab ↵</span>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--></button>`);
          }
          $$renderer2.push(`<!--]--></div></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (phoneSuggestionsOpen() && matchingPhoneCountries().length > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="phone-suggestions-popup svelte-1f2hha7" role="listbox" aria-label="Phone country code suggestions" tabindex="0"><div class="phone-suggestions-header svelte-1f2hha7"><span class="svelte-1f2hha7">Chọn mã quốc gia</span></div> <div class="phone-suggestions-list svelte-1f2hha7"><!--[-->`);
          const each_array_2 = ensure_array_like(matchingPhoneCountries());
          for (let idx = 0, $$length = each_array_2.length; idx < $$length; idx++) {
            let country = each_array_2[idx];
            $$renderer2.push(`<button type="button" role="option"${attr("aria-selected", phoneHighlightedIndex === idx)}${attr_class(`phone-suggestion-item ${phoneHighlightedIndex === idx ? "active" : ""}`, "svelte-1f2hha7")}><span class="phone-suggestion-flag svelte-1f2hha7">${escape_html(getCountryFlag(country.code))}</span> <span class="phone-suggestion-info svelte-1f2hha7"><span class="phone-suggestion-code svelte-1f2hha7">${escape_html(country.code)}</span> <span class="phone-suggestion-name svelte-1f2hha7">${escape_html(country.name)}</span></span> <span class="phone-suggestion-format svelte-1f2hha7">${escape_html(country.format)}</span> `);
            if (phoneHighlightedIndex === idx) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<span class="phone-suggestion-hint svelte-1f2hha7">Tab ↵</span>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--></button>`);
          }
          $$renderer2.push(`<!--]--></div></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
    );
    bind_props($$props, { value, disabled, configs });
  });
}
const text_keys_allowed = [
  "arrowleft",
  "arrowright",
  "arrowup",
  "arrowdown",
  "backspace",
  "delete",
  "home"
];
const defaultValidation = {
  required: (fieldName) => {
    return {
      isValid(input) {
        if (input?.length) return true;
        return false;
      },
      message: {
        invalid: {
          en: `${fieldName ?? "this field"} is required`,
          vi: `${fieldName ?? "Trường này"} là bắt buộc`
        },
        valid: {
          en: `${fieldName ?? "this field"} is valid`,
          vi: `${fieldName ?? "Trường này"} hợp lệ`
        }
      }
    };
  },
  minNumber(minValue, fieldName) {
    return {
      isValid(input) {
        if (input && parseFloat(input) >= minValue) return true;
        return false;
      },
      message: {
        invalid: {
          en: `${fieldName ?? "this field"} is required min number=${minValue}`
        },
        valid: {
          en: `${fieldName ?? "this field"} is valid min number=${minValue}`
        }
      }
    };
  },
  maxNumber(maxValue, fieldName) {
    return {
      isValid(input) {
        if (input && parseFloat(input) <= maxValue) return true;
        return false;
      },
      message: {
        invalid: {
          en: `${fieldName ?? "this field"} is required max number=${maxValue}`
        },
        valid: {
          en: `${fieldName ?? "this field"} is valid max number=${maxValue}`
        }
      }
    };
  },
  isEmail(fieldName) {
    return {
      isValid(input) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (input && emailRegex.test(input)) return true;
        return false;
      },
      message: {
        invalid: {
          en: `${fieldName ?? "this field"} must be an email`
        },
        valid: {
          en: `${fieldName ?? "this field"} is valid email`
        }
      }
    };
  }
};
function createDefaultInputEvents(value, configs, textFieldContext, formContext) {
  return [
    {
      events: {
        mousedown(e, data) {
          const event = e;
          const target = data?.node;
          if (event.detail == 2 && value?.length) {
            configs.status.selectAll = true;
            if (target instanceof HTMLInputElement && value?.length) {
              try {
                if (["text", "search", "url", "tel", "password"].includes(target.type)) {
                  target.setSelectionRange(0, value.length);
                } else {
                  target.select();
                }
              } catch (e2) {
              }
            }
          }
        },
        focus(e) {
          configs.input.status.focus = true;
          configs.status.focus = true;
          requestAnimationFrame(() => {
            configs.ref?.classList.add("animation-bounce");
            setTimeout(() => {
              configs.ref?.classList.remove("animation-bounce");
            }, configs.duration ?? 300);
          });
        },
        blur() {
          configs.input.status.focus = false;
          configs.status.focus = false;
          if (textFieldContext) textFieldContext.status.selectAll = false;
        },
        keydown(e) {
          const event = e;
          if (event.key.toLowerCase() == "enter" && textFieldContext?.onEnter) {
            textFieldContext.onEnter();
            if (!formContext?.validation.isValid) {
              event.preventDefault();
            }
          } else if (event.key == "a" && event.ctrlKey) {
            configs.status.selectAll = true;
          } else if (event.key.toLowerCase() == "tab" && textFieldContext?.onTab) {
            textFieldContext.onTab();
          }
        }
      }
    }
  ];
}
function Main$3($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, checked = void 0, $$slots, $$events, ...props } = $$props;
    const formContext = getFormContext();
    let _initialChecked = void 0;
    let configs = {
      get previousValue() {
        if (_initialChecked === void 0) {
          const name = props.name;
          const data = formContext?.data;
          if (data && name && name in data) {
            _initialChecked = Boolean(data[name]);
          } else {
            _initialChecked = checked;
          }
        }
        return _initialChecked;
      },
      status: {
        get changed() {
          return Boolean(checked) !== Boolean(configs.previousValue);
        }
      },
      get style() {
        const defaultStyles = [
          "checkbox-root",
          `size-${this.size}`,
          `color-${this.color}`,
          this.disabled ? "disabled" : void 0,
          checked ? "has-value" : void 0
        ];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get size() {
        return props.size ?? formContext?.size ?? client.browser?.size ?? "md";
      },
      get color() {
        if (props.color) return props.color;
        if (this.required && configs.status.changed) {
          return configs.validation.isValid == true ? "success" : "error";
        }
        return "default";
      },
      get disabled() {
        return props.disabled ?? formContext?.disabled;
      },
      get checked() {
        return checked;
      },
      get duration() {
        return convertToMiliseconds(props.duration) ?? convertToMiliseconds(client.browser?.duration) ?? 300;
      },
      get delay() {
        return convertToMiliseconds(props.delay);
      },
      get required() {
        return props.required;
      },
      get event() {
        if (this.disabled) return void 0;
        const defaultEvents = [
          {
            events: {
              mousedown: {
                handler(e, data) {
                  if (configs.disabled) return;
                  if (data?.node instanceof HTMLElement) {
                    checked = !checked;
                  }
                },
                options: {
                  get delay() {
                    return configs.delay;
                  }
                }
              }
            }
          }
        ];
        const propEvents = props.events ?? [];
        return [...defaultEvents, ...propEvents];
      },
      children: {},
      validation: {
        _isValid: void 0,
        get isValid() {
          if (configs.required) {
            if (this._isValid === void 0) return "pending";
            return this._isValid;
          }
          return void 0;
        },
        set isValid(v) {
          this._isValid = v;
        },
        messages: new SvelteMap()
      },
      reset() {
        const initialValue = _initialChecked ?? (() => {
          const name = props.name;
          const data = formContext?.data;
          if (data && name && name in data) {
            return Boolean(data[name]);
          }
          return checked;
        })();
        checked = initialValue;
        _initialChecked = initialValue;
        configs.validation.messages = void 0;
        configs.validation.isValid = void 0;
        if (configs.timeId) {
          for (const id of configs.timeId.values()) clearTimeout(id);
          configs.timeId.clear();
        }
      }
    };
    setCheckboxContext(configs);
    onDestroy(() => {
      [...configs.timeId?.values() ?? []].forEach((time) => {
        clearTimeout(time);
        cancelAnimationFrame(time);
      });
      configs.timeId?.clear();
    });
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-1dp7xdy")}`);
      },
      () => {
        children?.($$renderer2);
        $$renderer2.push(`<!---->`);
      }
    );
    bind_props($$props, { checked });
  });
}
function Main$2($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    let configs = {
      get style() {
        const defaultStyles = ["checkbox-indicator-checked", `color-${this.color}`];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get color() {
        return props.color ?? checkboxIndicatorContext?.color ?? "default";
      }
    };
    const checkboxIndicatorContext = getCheckboxIndicatorContext();
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-16dovby")}`);
      },
      () => {
        if (children) {
          $$renderer2.push("<!--[0-->");
          children($$renderer2);
          $$renderer2.push(`<!---->`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<svg class="me-c0c0xo check-draw svelte-16dovby" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="4 12 9 17 20 6" stroke-linecap="round" stroke-linejoin="round" pathLength="1" class="check-draw svelte-16dovby" stroke="white" stroke-width="2"></polyline></svg>`);
        }
        $$renderer2.push(`<!--]-->`);
      }
    );
  });
}
function Main$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, $$slots, $$events, ...props } = $$props;
    element($$renderer2, props.as ?? "div", void 0, () => {
      $$renderer2.push(`uncheck`);
    });
  });
}
const Checkbox = Object.assign(Main$3, {
  Indicator: Object.assign(Main, { Checked: Main$2, Unchecked: Main$1 })
});
const NAME$1 = /* @__PURE__ */ Symbol("checkbox-indicator-context");
function setCheckboxIndicatorContext(context) {
  setContext(NAME$1, context);
}
function getCheckboxIndicatorContext() {
  return getContext(NAME$1);
}
function Main($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children, checked = void 0, $$slots, $$events, ...props } = $$props;
    let configs = {
      get style() {
        const defaultStyles = [
          "checkbox-indicator-root",
          `size-${this.size}`,
          `color-${this.color}`,
          `rounded-${this.rounded}`
        ];
        return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
      },
      get checked() {
        return checked ?? checkboxContext?.checked;
      },
      get size() {
        return props.size ?? checkboxContext?.size ?? "md";
      },
      get color() {
        return props.color ?? checkboxContext?.color ?? "default";
      },
      get duration() {
        return convertToMiliseconds(props.duration) ?? checkboxContext?.duration ?? convertToMiliseconds(client.browser?.duration) ?? 300;
      },
      get rounded() {
        return props.rounded ?? this.size;
      },
      get event() {
        return [{ events: {} }];
      }
    };
    const checkboxContext = getCheckboxContext();
    if (checkboxContext) {
      checkboxContext.children.indicator = configs;
    }
    setCheckboxIndicatorContext(configs);
    onDestroy(() => {
      if (checkboxContext && checkboxContext.children.indicator === configs) {
        checkboxContext.children.indicator = void 0;
      }
    });
    element(
      $$renderer2,
      props.as ?? "div",
      () => {
        $$renderer2.push(`${attr_class(clsx(configs.style), "svelte-nqczho")}`);
      },
      () => {
        if (children) {
          $$renderer2.push("<!--[0-->");
          children($$renderer2);
          $$renderer2.push(`<!---->`);
        } else if (configs.checked) {
          $$renderer2.push("<!--[1-->");
          if (Checkbox.Indicator.Checked) {
            $$renderer2.push("<!--[-->");
            Checkbox.Indicator.Checked($$renderer2, {});
            $$renderer2.push("<!--]-->");
          } else {
            $$renderer2.push("<!--[!-->");
            $$renderer2.push("<!--]-->");
          }
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
    );
    bind_props($$props, { checked });
  });
}
const NAME = /* @__PURE__ */ Symbol("checkbox-context");
function setCheckboxContext(context) {
  setContext(NAME, context);
}
function getCheckboxContext() {
  return getContext(NAME);
}
export {
  Checkbox as C,
  Main$4 as M,
  Main$3 as a,
  getCheckboxContext as g
};
