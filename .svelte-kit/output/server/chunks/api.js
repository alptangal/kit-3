import { json } from "@sveltejs/kit";
import { e as encryption } from "./encryption.js";
import { s as systemVault } from "./initSystemVault.js";
import { r as resolveLang, l as localizePayload } from "./i18n.js";
import { U as Users, a as adminMessages, b as authMessages } from "./users.js";
import { c as cbData } from "./clients.js";
const rateLimitStore = /* @__PURE__ */ new Map();
const ENDPOINT_CONFIGS = {
  "/api/login": { maxRequests: 5, windowMs: 6e4 },
  // 5 req/min
  "/api/register": { maxRequests: 3, windowMs: 6e4 },
  // 3 req/min
  // Admin API — prefix '/api/admin' khớp mọi route /api/admin/** qua prefix matching
  // trong getConfig() (không đụng '/api/login' và '/api/register' vì chúng không
  // nằm dưới prefix này)
  "/api/admin": { maxRequests: 60, windowMs: 6e4 }
  // 60 req/min
};
const WHITELIST_PATHS = [
  "/api/health",
  "/api/health/",
  "/api/encryption/public-key",
  "/api/encryption/public-key/"
];
const WHITELIST_IPS = [
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1"
  // IPv6 mapped IPv4
];
function isWhitelistedPath(pathname) {
  if (WHITELIST_PATHS.some((p) => pathname === p || pathname.startsWith(p))) {
    return true;
  }
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i.test(pathname)) {
    return true;
  }
  return false;
}
function isWhitelistedIP(ip) {
  const normalizedIp = ip.replace(/^::ffff:/, "");
  return WHITELIST_IPS.includes(normalizedIp);
}
function getConfig(pathname) {
  if (ENDPOINT_CONFIGS[pathname]) {
    return ENDPOINT_CONFIGS[pathname];
  }
  for (const [endpoint, config] of Object.entries(ENDPOINT_CONFIGS)) {
    if (pathname.startsWith(endpoint)) {
      return config;
    }
  }
  return null;
}
function generateKey(ip, endpoint) {
  return `${ip}:${endpoint}`;
}
function checkRateLimit(ip, pathname) {
  const config = getConfig(pathname);
  if (!config) {
    return {
      allowed: true,
      remaining: Infinity,
      resetTime: Date.now() + 6e4
    };
  }
  const key = generateKey(ip, pathname);
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs
    };
  }
  if (now - entry.windowStart >= config.windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs
    };
  }
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.windowStart + config.windowMs - now) / 1e3);
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
      resetTime: entry.windowStart + config.windowMs
    };
  }
  entry.count++;
  rateLimitStore.set(key, entry);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.windowStart + config.windowMs
  };
}
function getClientIp(request, getClientAddress) {
  if (getClientAddress) {
    try {
      const ip = getClientAddress();
      if (ip) return ip;
    } catch {
    }
  }
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}
async function applyRateLimit(request, getClientAddress, pathname) {
  if (isWhitelistedPath(pathname)) {
    return null;
  }
  const clientIp = getClientIp(request, getClientAddress);
  if (isWhitelistedIP(clientIp)) {
    return null;
  }
  const result = checkRateLimit(clientIp, pathname);
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", getConfig(pathname)?.maxRequests.toString() ?? "0");
  headers.set("X-RateLimit-Remaining", result.remaining.toString());
  headers.set("X-RateLimit-Reset", Math.ceil(result.resetTime / 1e3).toString());
  if (!result.allowed) {
    headers.set("Retry-After", result.retryAfter?.toString() ?? "60");
    return new Response(
      JSON.stringify({
        message: {
          vi: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
          en: "Too many requests. Please try again later."
        },
        ok: false
      }),
      {
        status: 429,
        headers,
        statusText: "Too Many Requests"
      }
    );
  }
  request.rateLimit = result;
  return null;
}
const cbRoles = cbData("name_roles");
async function readAdminRequest(event) {
  const lang = resolveLang(event.request.headers.get("accept-language"));
  const rateLimited = await applyRateLimit(
    event.request,
    event.getClientAddress,
    event.url.pathname
  );
  if (rateLimited) return { ok: false, response: rateLimited };
  if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
    return {
      ok: false,
      response: json(
        localizePayload(
          {
            ok: false,
            message: {
              vi: "Hệ thống đang khởi tạo kho mã hoá — vui lòng thử lại sau",
              en: "Service unavailable — system initializing"
            }
          },
          lang
        ),
        { status: 503 }
      )
    };
  }
  let jsRaw;
  try {
    jsRaw = await event.request.json();
  } catch {
    return {
      ok: false,
      response: json({ message: "Invalid JSON body", ok: false }, { status: 400 })
    };
  }
  let decryptedText;
  try {
    decryptedText = await encryption.decryptWithPrivateKeyHybrid(
      systemVault.privateKey,
      jsRaw
    );
  } catch {
    return {
      ok: false,
      response: json({ message: "Decryption failed", ok: false }, { status: 400 })
    };
  }
  if (!decryptedText) {
    return {
      ok: false,
      response: json({ message: "Decryption returned empty", ok: false }, { status: 400 })
    };
  }
  const dataDecrypted = JSON.parse(decryptedText);
  if (!dataDecrypted.publicKeyB64) {
    return {
      ok: false,
      response: json(
        localizePayload(
          {
            ok: false,
            message: {
              vi: "Thiếu khoá phiên client (public key)",
              en: "Missing session public key"
            }
          },
          lang
        ),
        { status: 400 }
      )
    };
  }
  return { ok: true, data: dataDecrypted, lang, publicKeyB64: dataDecrypted.publicKeyB64 };
}
async function respondEncrypted(sessionPublicKeyB64, payload, lang, status = 200) {
  const sessionPublicKey = await encryption.importPublicKey(sessionPublicKeyB64);
  const enc = await encryption.encryptWithPublicKeyHybrid(
    sessionPublicKey,
    JSON.stringify(localizePayload(payload, lang))
  );
  return json(enc, { status });
}
async function getActorContext(locals) {
  const sessionUser = locals.user;
  if (!sessionUser?.userId) return null;
  let roleName = sessionUser.roleName;
  if (!roleName && sessionUser.roleId) {
    try {
      const res = await cbRoles.document.get({ documentKey: sessionUser.roleId });
      if (res.ok && res.data) {
        roleName = res.data.name ?? void 0;
      }
    } catch {
    }
  }
  if (!roleName) return null;
  let branchId = sessionUser.branchId;
  if (branchId === void 0) {
    try {
      const target = await Users.getById(sessionUser.userId);
      branchId = target?.user.branchId ?? void 0;
    } catch {
      branchId = void 0;
    }
  }
  return { userId: sessionUser.userId, roleName, branchId };
}
function statusForServiceFailure(messages) {
  if (messages === adminMessages.notFound) return 404;
  if (messages === adminMessages.permissionDenied) return 403;
  if (messages === adminMessages.userAlreadyDeleted || messages === adminMessages.userNotDeleted || messages === authMessages.emailTaken || messages === authMessages.usernameTaken) {
    return 409;
  }
  if (messages === adminMessages.vaultUninitialized) return 503;
  return 400;
}
export {
  respondEncrypted as a,
  getActorContext as g,
  readAdminRequest as r,
  statusForServiceFailure as s
};
