import { json } from "@sveltejs/kit";
import { e as encryption } from "../../../../chunks/encryption.js";
import { s as systemVault } from "../../../../chunks/initSystemVault.js";
import { U as Users } from "../../../../chunks/users.js";
import { r as resolveLang, l as localizePayload } from "../../../../chunks/i18n.js";
const verifyEmailMessages = {
  systemUnavailable: { vi: "Hệ thống đang bảo trì. Vui lòng thử lại sau.", en: "The system is under maintenance. Please try again later." },
  invalidBody: { vi: "Dữ liệu không hợp lệ.", en: "Invalid data." },
  missingSessionKey: { vi: "Thiếu khóa phiên. Vui lòng tải lại trang.", en: "Missing session key. Please reload the page." },
  missingToken: { vi: "Liên kết xác nhận không hợp lệ hoặc đã hết hạn.", en: "This verification link is invalid or has expired." },
  verifyFailed: { vi: "Xác nhận email thất bại. Vui lòng yêu cầu liên kết mới.", en: "Email verification failed. Please request a new link." },
  success: { vi: "Email đã được xác nhận! Bạn có thể đăng nhập.", en: "Your email is verified! You can now sign in." }
};
const POST = async ({ request }) => {
  const lang = resolveLang(request.headers.get("accept-language"));
  try {
    if (!systemVault.privateKey) {
      return json({ message: localizePayload({ ok: false, message: verifyEmailMessages.systemUnavailable }, lang) }, { status: 503 });
    }
    const jsRaw = await request.json();
    if (!jsRaw) {
      return json({ message: localizePayload({ ok: false, message: verifyEmailMessages.invalidBody }, lang) }, { status: 400 });
    }
    const decryptedText = await encryption.decryptWithPrivateKeyHybrid(systemVault.privateKey, jsRaw);
    if (!decryptedText) {
      return json({ message: localizePayload({ ok: false, message: verifyEmailMessages.invalidBody }, lang) }, { status: 400 });
    }
    const parsed = JSON.parse(decryptedText);
    const { publicKeyB64, token } = parsed;
    if (!publicKeyB64) {
      return json({ message: localizePayload({ ok: false, message: verifyEmailMessages.missingSessionKey }, lang) }, { status: 400 });
    }
    const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);
    const respond = async (payload, status = 200) => {
      const enc = await encryption.encryptWithPublicKeyHybrid(sessionPublicKey, JSON.stringify(localizePayload(payload, lang)));
      return json(enc, { status });
    };
    if (!token || typeof token !== "string" || token.length < 16) {
      return respond({ ok: false, message: verifyEmailMessages.missingToken }, 400);
    }
    const tokenHash = await encryption.getDataHash(token);
    const result = await Users.verifyEmailWithToken(tokenHash);
    if (!result.ok) {
      return respond({ ok: false, message: verifyEmailMessages.missingToken }, 400);
    }
    return respond({ ok: true, message: verifyEmailMessages.success }, 200);
  } catch (e) {
    console.error("[verify-email] error:", e);
    return json({ message: localizePayload({ ok: false, message: verifyEmailMessages.systemUnavailable }, lang) }, { status: 500 });
  }
};
export {
  POST
};
