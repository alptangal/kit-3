import { json } from "@sveltejs/kit";
import { e as encryption } from "../../../../chunks/encryption.js";
import { s as systemVault } from "../../../../chunks/initSystemVault.js";
import { U as Users } from "../../../../chunks/users.js";
import { r as resolveLang, l as localizePayload } from "../../../../chunks/i18n.js";
const resetPasswordMessages = {
  systemUnavailable: {
    vi: "Hệ thống đang bảo trì. Vui lòng thử lại sau.",
    en: "The system is under maintenance. Please try again later."
  },
  missingSessionKey: {
    vi: "Thiếu khóa phiên. Vui lòng tải lại trang.",
    en: "Missing session key. Please reload the page."
  },
  invalidBody: {
    vi: "Dữ liệu không hợp lệ.",
    en: "Invalid data."
  },
  missingToken: {
    vi: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.",
    en: "This password reset link is invalid or has expired."
  },
  invalidPassword: {
    vi: "Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số.",
    en: "Password must be at least 8 characters with letters and numbers."
  },
  resetFailed: {
    vi: "Đặt lại mật khẩu thất bại. Vui lòng yêu cầu liên kết mới.",
    en: "Password reset failed. Please request a new link."
  },
  tokenExpired: {
    vi: "Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu liên kết mới.",
    en: "This password reset link has expired. Please request a new one."
  },
  success: {
    vi: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với mật khẩu mới.",
    en: "Password reset successful! You can now sign in with your new password."
  }
};
const POST = async ({ request }) => {
  const lang = resolveLang(request.headers.get("accept-language"));
  try {
    if (!systemVault?.privateKey) {
      return json(
        { message: localizePayload({ ok: false, message: resetPasswordMessages.systemUnavailable }, lang) },
        { status: 503 }
      );
    }
    const jsRaw = await request.json();
    if (!jsRaw) {
      return json(
        { message: localizePayload({ ok: false, message: resetPasswordMessages.invalidBody }, lang) },
        { status: 400 }
      );
    }
    const decryptedText = await encryption.decryptWithPrivateKeyHybrid(systemVault.privateKey, jsRaw);
    if (!decryptedText) {
      return json(
        { message: localizePayload({ ok: false, message: resetPasswordMessages.invalidBody }, lang) },
        { status: 400 }
      );
    }
    const parsed = JSON.parse(decryptedText);
    const { publicKeyB64, token, password } = parsed;
    if (!publicKeyB64) {
      return json(
        { message: localizePayload({ ok: false, message: resetPasswordMessages.missingSessionKey }, lang) },
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
    if (!token || typeof token !== "string" || token.length < 16) {
      return respond({ ok: false, message: resetPasswordMessages.missingToken }, 400);
    }
    if (!password || typeof password !== "string" || password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return respond({ ok: false, message: resetPasswordMessages.invalidPassword }, 400);
    }
    const tokenHash = await encryption.getDataHash(token);
    const result = await Users.resetPasswordWithToken(tokenHash, password);
    if (!result.ok) {
      if (result.reason === "expired") {
        return respond({ ok: false, message: resetPasswordMessages.tokenExpired }, 400);
      }
      return respond({ ok: false, message: resetPasswordMessages.missingToken }, 400);
    }
    return respond({ ok: true, message: resetPasswordMessages.success }, 200);
  } catch (e) {
    console.error("[reset-password] error:", e);
    return json(
      { message: localizePayload({ ok: false, message: resetPasswordMessages.systemUnavailable }, lang) },
      { status: 500 }
    );
  }
};
export {
  POST
};
