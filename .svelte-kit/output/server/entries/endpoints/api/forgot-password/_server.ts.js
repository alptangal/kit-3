import { e as encryption } from "../../../../chunks/encryption.js";
import { s as systemVault } from "../../../../chunks/initSystemVault.js";
import { json } from "@sveltejs/kit";
import { U as Users } from "../../../../chunks/users.js";
import { b as browser } from "../../../../chunks/false.js";
import { r as resolveLang, l as localizePayload } from "../../../../chunks/i18n.js";
import { s as sendDevEmail } from "../../../../chunks/email.js";
const rateLimitWindowMs = 1e4;
const rateLimitMaxRequests = 15;
const rateLimitStore = /* @__PURE__ */ new Map();
function checkRateLimit(identifier) {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + rateLimitWindowMs });
    return { allowed: true, remaining: rateLimitMaxRequests - 1, resetTime: now + rateLimitWindowMs };
  }
  entry.count += 1;
  if (entry.count > rateLimitMaxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }
  return { allowed: true, remaining: rateLimitMaxRequests - entry.count, resetTime: entry.resetTime };
}
const forgotPasswordMessages = {
  systemUnavailable: {
    vi: "Hệ thống đang khởi tạo kho mã hoá — vui lòng thử lại sau",
    en: "Service unavailable — system initializing"
  },
  missingSessionKey: {
    vi: "Thiếu khoá phiên client (public key)",
    en: "Missing session public key"
  },
  missingEmail: {
    vi: "Vui lòng nhập địa chỉ email",
    en: "Please enter your email address"
  },
  invalidEmail: {
    vi: "Định dạng email không hợp lệ",
    en: "Invalid email format"
  },
  emailNotRegistered: {
    vi: "Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi",
    en: "If the email exists, a password reset link has been sent"
  },
  sendFailed: {
    vi: "Gửi email thất bại, vui lòng thử lại sau",
    en: "Failed to send email, please try again later"
  },
  tooManyRequests: {
    vi: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
    en: "Too many requests. Please try again later."
  },
  success: {
    vi: "Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi",
    en: "If the email exists, a password reset link has been sent"
  }
};
const POST = async ({ request, getClientAddress }) => {
  const lang = resolveLang(request.headers.get("accept-language"));
  try {
    if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
      return json(
        localizePayload({ message: forgotPasswordMessages.systemUnavailable, ok: false }, lang),
        { status: 503 }
      );
    }
    const jsRaw = await request.json();
    const decryptedText = await encryption.decryptWithPrivateKeyHybrid(
      systemVault.privateKey,
      jsRaw
    );
    if (!decryptedText) {
      return json({ message: "Decryption returned empty", ok: false }, { status: 400 });
    }
    const dataDecrypted = JSON.parse(decryptedText);
    const { publicKeyB64, email } = dataDecrypted;
    if (!publicKeyB64) {
      return json(
        localizePayload({ message: forgotPasswordMessages.missingSessionKey, ok: false }, lang),
        { status: 400 }
      );
    }
    const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);
    const respond = async (payload, status = 200) => {
      const enc = await encryption.encryptWithPublicKeyHybrid(
        sessionPublicKey,
        JSON.stringify(localizePayload(payload, lang))
      );
      return json(enc, { status });
    };
    const rateLimitKey = `forgot-password:${getClientAddress()}`;
    const rateLimit = checkRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return respond({ ok: false, message: forgotPasswordMessages.tooManyRequests }, 429);
    }
    if (!email?.trim()) {
      return respond({ message: forgotPasswordMessages.missingEmail, ok: false }, 400);
    }
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return respond({ message: forgotPasswordMessages.invalidEmail, ok: false }, 400);
    }
    const emailBlindIndex = await encryption.hmacBlindIndex(systemVault.indexKey, normalizedEmail);
    const emailExists = await Users.isEmailTaken(emailBlindIndex);
    if (emailExists) {
      const found = Users.onlyActive(await Users.getBy({ emailBlindIndex }));
      const doc = found?.[0];
      if (doc?._id) {
        const rawToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
        const tokenHash = await encryption.getDataHash(rawToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1e3).toISOString();
        const saved = await Users.createPasswordResetToken(doc._id, tokenHash, expiresAt);
        if (saved) {
          const baseUrl = browser ? "https://localhost:3000" : `https://${request.headers.get("host")}`;
          const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
          const html = `<p>Nhấn vào liên kết để đặt lại mật khẩu (hiệu lực 1 giờ):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`;
          sendDevEmail(normalizedEmail, "Đặt lại mật khẩu / Password Reset", html);
        }
      }
    }
    return respond(
      {
        ok: true,
        message: forgotPasswordMessages.success
      },
      200
    );
  } catch (e) {
    console.error("[POST /api/forgot-password]", e);
    return json(
      { message: e instanceof Error ? e.message : String(e), ok: false },
      { status: 500 }
    );
  }
};
export {
  POST
};
