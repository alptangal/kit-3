import { e as encryption } from "../../../../chunks/encryption.js";
import { s as systemVault } from "../../../../chunks/initSystemVault.js";
import { json } from "@sveltejs/kit";
import { U as Users } from "../../../../chunks/users.js";
import { b as browser } from "../../../../chunks/false.js";
import { r as resolveLang, l as localizePayload } from "../../../../chunks/i18n.js";
const POST = async ({ request, getClientAddress, cookies }) => {
  const lang = resolveLang(request.headers.get("accept-language"));
  try {
    if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
      return json({ message: "Service unavailable — system initializing" }, { status: 503 });
    }
    const jsRaw = await request.json();
    const decryptedText = await encryption.decryptWithPrivateKeyHybrid(
      systemVault.privateKey,
      jsRaw
    );
    if (!decryptedText) {
      return json({ message: "Decryption returned empty" }, { status: 400 });
    }
    const dataDecrypted = JSON.parse(decryptedText);
    const { publicKeyB64 } = dataDecrypted;
    if (!publicKeyB64) {
      return json({ message: "Missing session public key" }, { status: 400 });
    }
    const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);
    const respond = async (payload, status = 200) => {
      const enc = await encryption.encryptWithPublicKeyHybrid(
        sessionPublicKey,
        JSON.stringify(localizePayload(payload, lang))
      );
      return json(enc, { status });
    };
    const { password, username, remember } = dataDecrypted;
    if (!username || !password) {
      return respond(
        {
          message: {
            vi: "Không để trống tên đăng nhập hoặc mật khẩu",
            en: "Username and password are required"
          },
          ok: false
        },
        400
      );
    }
    const normalizedInput = username.trim().toLowerCase();
    const usernameBlindIndex = await encryption.hmacBlindIndex(
      systemVault.indexKey,
      normalizedInput
    );
    const emailBlindIndex = await encryption.hmacBlindIndex(systemVault.indexKey, normalizedInput);
    let clientIp;
    try {
      clientIp = getClientAddress ? getClientAddress() : void 0;
    } catch {
      clientIp = void 0;
    }
    const loginResult = await Users.login(
      {
        usernameBlindIndex,
        emailBlindIndex,
        password
      },
      clientIp
    );
    if (!loginResult.success) {
      return respond(
        {
          message: loginResult.messages,
          ok: false
        },
        401
      );
    }
    const userInstance = loginResult.user;
    const userDocKey = userInstance.getDocumentKey();
    const sessionData = {
      userId: userDocKey,
      username: userInstance.user.firstname,
      roleId: userInstance.user.roleId,
      // Thêm timestamp để có thể kiểm tra thời hạn phía server nếu cần
      issuedAt: Date.now()
    };
    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString("base64");
    const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
    cookies.set("session", sessionToken, {
      path: "/",
      httpOnly: true,
      // Không cho JS đọc cookie
      sameSite: "lax",
      // Bảo vệ CSRF cơ bản
      secure: !browser,
      // Chỉ gửi qua HTTPS trong production
      maxAge
    });
    return respond(
      {
        message: { vi: "Đăng nhập thành công", en: "Login successful" },
        ok: true,
        data: {
          user: {
            firstname: userInstance.user.firstname,
            lastname: userInstance.user.lastname,
            roleId: userInstance.user.roleId,
            statusId: userInstance.user.statusId
          }
        }
      },
      200
    );
  } catch (e) {
    console.error("[POST /api/login]", e);
    return json(
      { message: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
};
export {
  POST
};
