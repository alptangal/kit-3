var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import "clsx";
function useVisualKeyboard(options) {
  const timeId = { requestAnimation: null };
  let component = null;
  let isShow = false;
  let _height = null;
  let hasHeightValue = false;
  let _focusOn = null;
  let fallbackFocusOn = null;
  let onKeyup = void 0;
  let input = null;
  function getHeight() {
    return _height;
  }
  function processFocus(el) {
    if (options.getBrowserType()?.includes("mobile")) {
      const refRect = el.getBoundingClientRect();
      const bodyH = document.body.scrollHeight;
      setTimeout(
        () => {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        },
        options.getDelay()
      );
      if (getHeight() && window.innerHeight - refRect.bottom < getHeight() && bodyH - el.scrollTop < getHeight()) {
        document.body.setAttribute("height-bu", document.body.style.getPropertyValue("height"));
        document.body.style.height = `${document.body.offsetHeight + (getHeight() ?? 0 - (window.innerHeight - refRect.bottom))}px`;
        window.scrollTo({ top: document.body.offsetHeight, behavior: "smooth" });
      } else if (getHeight() && window.innerHeight - refRect.bottom < getHeight() && bodyH - el.scrollTop > getHeight()) {
        window.scrollTo({ top: el.scrollTop, behavior: "smooth" });
      }
    }
  }
  return {
    get component() {
      return component;
    },
    set component(v) {
      component = v;
    },
    // block gốc L25-28
    get ref() {
      if (component) return component.configs?.ref;
      return void 0;
    },
    get isShow() {
      return isShow;
    },
    set isShow(v) {
      isShow = v;
    },
    // block gốc L34-44 — accessor property: đọc trả number|null, ghi invoke setter
    get height() {
      return getHeight();
    },
    set height(val) {
      if (val && val > 0) {
        _height = val;
        hasHeightValue = true;
      }
    },
    get hasHeightValue() {
      return hasHeightValue;
    },
    // block gốc L45-64 — accessor property; inner timeId qua closure
    get focusOn() {
      return _focusOn;
    },
    set focusOn(el) {
      if (!el) {
        document.body.style.height = `${document.body.getAttribute("height-bu")}px`;
        document.body.removeAttribute("height-bu");
        _focusOn = null;
      } else {
        if (timeId.requestAnimation) {
          cancelAnimationFrame(timeId.requestAnimation);
        }
        timeId.requestAnimation = requestAnimationFrame(() => {
          _focusOn = el;
          processFocus(el);
          if (fallbackFocusOn) fallbackFocusOn();
        });
      }
    },
    get fallbackFocusOn() {
      return fallbackFocusOn;
    },
    set fallbackFocusOn(v) {
      fallbackFocusOn = v;
    },
    get onKeyup() {
      return onKeyup;
    },
    set onKeyup(v) {
      onKeyup = v;
    },
    processFocus,
    get input() {
      return input;
    },
    set input(v) {
      input = v;
    }
  };
}
function detectBrowserType(userAgent, maxTouchPoints = 0) {
  const ua = userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|ipod/.test(ua);
  if (/macintosh/.test(ua) && maxTouchPoints > 1) {
    return "mobile/ios";
  }
  if (isMobile) {
    if (/iphone|ipad|ipod/.test(ua)) {
      return "mobile/ios";
    }
    if (/android/.test(ua)) {
      return "mobile/android";
    }
  }
  if (/macintosh|mac os x/.test(ua) && !/mobile/.test(ua)) {
    return "desktop/mac";
  }
  if (/linux/.test(ua)) {
    if (/cros/.test(ua)) {
      return "desktop/chrome";
    }
    return "desktop/linux";
  }
  if (/windows/.test(ua)) {
    return "desktop/window";
  }
  return void 0;
}
function styleSynced(params, overwriteDefaultStyles = false) {
  const { defaultStyles, propStyles } = params;
  const _defaultStyles = typeof defaultStyles == "object" ? defaultStyles.filter((item) => !!item) : typeof defaultStyles == "string" ? [defaultStyles] : [];
  const _propsStyles = typeof propStyles == "object" ? propStyles.filter((item) => !!item) : typeof propStyles == "string" ? [propStyles] : [];
  if (overwriteDefaultStyles) {
    return [...new Set(_defaultStyles.flatMap((item) => item.trim().split(/\s+/).filter(Boolean)))];
  } else {
    return [
      ...new Set(_defaultStyles.flatMap((item) => item.trim().split(/\s+/).filter(Boolean))),
      ...new Set(_propsStyles.flatMap((item) => item.trim().split(/\s+/).filter(Boolean)))
    ];
  }
}
function convertToMiliseconds(input) {
  if (input) {
    return typeof input == "number" ? input : input.includes("ms") ? parseFloat(input) : parseFloat(input) * 1e3;
  }
  return void 0;
}
function convertToPixels(input) {
  if (input) {
    const baseFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return typeof input == "number" ? input : input.includes("px") ? parseFloat(input) : parseFloat(input) * baseFontSize;
  }
  return void 0;
}
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    method: options.method ?? "post",
    headers: { "Content-Type": "application/json", "Accept-Language": client.browser?.language ?? "en" },
    body: options.body ? JSON.stringify(options.body) : void 0
  });
  const data = await res.json().catch(() => void 0);
  if (!res.ok) {
    return {
      message: data?.message ?? `Request failed: ${res.status}`,
      data,
      status: res.status,
      ok: res.ok
    };
  }
  return { message: data?.message, data, status: res.status, ok: res.ok };
}
const SvelteSet = globalThis.Set;
const SvelteMap = globalThis.Map;
const profile = {
  timeId: { theme: { timeOut: null, requestAnimation: null } },
  visualKeyboard: useVisualKeyboard({
    getBrowserType: () => profile.browser.type,
    getDelay: () => profile.delay
  }),
  screen: { height: null, width: null },
  browser: {
    userAgent: void 0,
    get type() {
      if (profile.browser.userAgent) return detectBrowserType(profile.browser.userAgent);
      return void 0;
    }
  },
  _theme: null,
  get preferSchemaColor() {
    return "light";
  },
  get theme() {
    return "system";
  },
  set theme(val) {
    this._theme = val;
    localStorage.setItem("theme", val);
    profile.preferColor = val != "system" ? val : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", val);
    const startAt = performance.now();
    const duration = profile.delay ?? 300;
    function animationTheme() {
      const currentTime = performance.now();
      const percent = (currentTime - startAt) * 100 / duration;
      document.body.style.background = `radial-gradient(circle at ${profile.cursor.x}px ${profile.cursor.y}px, var(--background) ${Math.min(percent, 100)}%,var(--background-invert) )`;
      if (Math.min(percent, 100) == 100 && profile.timeId.theme.requestAnimation) {
        cancelAnimationFrame(profile.timeId.theme.requestAnimation);
      } else {
        profile.timeId.theme.requestAnimation = requestAnimationFrame(animationTheme);
      }
    }
    if (profile.timeId.theme.requestAnimation) cancelAnimationFrame(profile.timeId.theme.requestAnimation);
    profile.timeId.theme.requestAnimation = requestAnimationFrame(animationTheme);
    const themeMetaTag = document.getElementById("themeMetaTag");
    if (themeMetaTag) {
      requestAnimationFrame(() => {
        const bodyBackgroundColor = getComputedStyle(document.body).backgroundColor;
        themeMetaTag.setAttribute("content", bodyBackgroundColor);
      });
    }
  },
  preferColor: "dark",
  cursor: { x: 0, y: 0 },
  /** duration in miliseconds */
  delay: 300,
  transition: {
    classString: "transition-all ease-in-out",
    templates: {
      flyX: {
        x: 30,
        get duration() {
          return profile.delay;
        }
      },
      flyXReverse: {
        x: -30,
        get duration() {
          return profile.delay;
        }
      },
      flyY: {
        y: 30,
        get duration() {
          return profile.delay;
        }
      },
      flyYReverse: {
        y: -30,
        get duration() {
          return profile.delay;
        }
      },
      fade: {
        get duration() {
          return profile.delay;
        }
      }
    },
    get duration() {
      return profile.delay ?? 300;
    }
  },
  clipboard: {
    status: {
      get hasData() {
        return false;
      }
    },
    value: void 0
  },
  visualNodes: { input: { ref: void 0 } }
};
class User {
  constructor() {
    __publicField(this, "_browser");
    __publicField(this, "_user");
    __publicField(this, "_system");
    __publicField(this, "timeId");
    this._browser = {
      language: "en",
      duration: "300ms",
      get delay() {
        if (!this.duration) return 0;
        return typeof this.duration == "number" ? this.duration : typeof this.duration == "string" && this.duration.includes("ms") ? parseFloat(this.duration) : parseFloat(this.duration) * 10;
      },
      set delay(val) {
        this.duration = val;
      },
      get preferColor() {
        return "light";
      },
      layers: new SvelteMap(),
      transition: {
        fly: {
          get duration() {
            return convertToMiliseconds(client._browser?.duration ?? 300);
          },
          x: 30,
          y: 30
        },
        fade: {
          get duration() {
            return convertToMiliseconds(client._browser?.duration ?? 300);
          }
        }
      }
    };
    this.timeId = new SvelteMap();
  }
  get browser() {
    return this._browser;
  }
  set browser(meta) {
    this._browser = { ...this._browser, ...meta };
  }
  get user() {
    return this._user;
  }
  set user(meta) {
    if (meta) {
      this._user = { ...this._user, ...meta };
    } else {
      this._user = meta;
    }
  }
  get system() {
    return this._system;
  }
  set system(meta) {
    if (meta) {
      this._system = { ...this._system, ...meta };
    } else {
      this._system = meta;
    }
  }
  updateMetaBrowser(meta) {
    this._browser = { ...this._browser, ...meta };
    this.syncMetaTheme();
  }
  syncMetaTheme() {
    let themeChanged = false;
    if (this._browser && this._browser.theme && this._browser.theme != localStorage.getItem("theme")) {
      localStorage.setItem("theme", this._browser.theme);
      themeChanged = true;
    }
    if (!document.documentElement.getAttribute("data-theme") || !document.documentElement.getAttribute("data-prefer-color") || themeChanged) {
      if (!this._browser || !this._browser.theme) return;
      document.documentElement.setAttribute("data-theme", this._browser.theme);
      document.documentElement.setAttribute("data-prefer-color", this._browser.theme == "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" : this._browser.theme);
    }
  }
  createInputVisual() {
    if (this.browser?.visualInput) return this.browser.visualInput;
    const inputEl = document.createElement("input");
    inputEl.style.position = "fixed";
    inputEl.style.zIndex = "-1";
    inputEl.style.width = ".1px";
    inputEl.style.height = ".1px";
    inputEl.style.bottom = "0";
    inputEl.style.left = "0";
    document.body.appendChild(inputEl);
    if (!this.browser) this.browser = {};
    this.browser.visualInput = inputEl;
    return this.browser.visualInput;
  }
  async getVisualKeyboardMeta() {
    if (!this.browser?.visualInput) return void 0;
    if (this.browser.visualKeyboard) return this.browser.visualKeyboard;
    let result = false;
    function resize() {
      if (!visualViewport) return;
      if (!client.browser) client.browser = {};
      if (!client.browser.originalResolution) client.browser.originalResolution = { width: window.innerWidth, height: window.innerHeight };
      client.browser.visualKeyboard = {
        width: client.browser.originalResolution.width,
        height: client.browser.originalResolution.height - visualViewport.height
      };
      client.browser.visualInput?.blur();
      result = true;
      visualViewport?.removeEventListener("resize", resize);
    }
    visualViewport?.addEventListener("resize", resize);
    this.browser.visualInput.focus();
    return new Promise((resolve) => {
      function tes() {
        if (result) {
          resolve();
        } else {
          requestAnimationFrame(tes);
        }
      }
      tes();
    });
  }
}
const client = new User();
const basic_svelte = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  client,
  profile
}, Symbol.toStringTag, { value: "Module" }));
export {
  SvelteMap as S,
  convertToPixels as a,
  convertToMiliseconds as b,
  client as c,
  SvelteSet as d,
  apiFetch as e,
  basic_svelte as f,
  profile as p,
  styleSynced as s
};
