import { e as encryption } from "../../../../chunks/encryption.js";
import { json } from "@sveltejs/kit";
import { c as cbData } from "../../../../chunks/clients.js";
import { s as systemVault } from "../../../../chunks/initSystemVault.js";
import { U as Users } from "../../../../chunks/users.js";
import { r as resolveLang, l as localizePayload } from "../../../../chunks/i18n.js";
import { s as sendDevEmail } from "../../../../chunks/email.js";
import { b as browser } from "../../../../chunks/false.js";
const collectionName = "users";
const cbUsers = cbData(collectionName);
cbData("name_roles");
cbData("user_status");
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,30}$/;
const PHONE_REGEX = /^\+?[0-9][0-9\s\-]{5,20}$/;
const registerMessages = {
  systemUnavailable: {
    vi: "Hệ thống đang khởi tạo kho mã hoá — vui lòng thử lại sau",
    en: "Service unavailable — system initializing"
  },
  missingSessionKey: {
    vi: "Thiếu khoá phiên client (public key)",
    en: "Missing session public key"
  },
  missingFields: {
    vi: "Vui lòng điền đầy đủ các thông tin bắt buộc",
    en: "Please fill in all required fields"
  },
  invalidEmail: {
    vi: "Định dạng email không hợp lệ",
    en: "Invalid email format"
  },
  invalidUsername: {
    vi: "Tên đăng nhập từ 3-30 ký tự (chữ cái, số, gạch dưới, gạch ngang)",
    en: "Username must be 3-30 characters (letters, numbers, underscores, dashes)"
  },
  passwordLength: {
    vi: `Mật khẩu phải chứa ít nhất ${MIN_PASSWORD_LENGTH} ký tự`,
    en: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  },
  emailTaken: {
    vi: "Email này đã được đăng ký",
    en: "Email is already registered"
  },
  usernameTaken: {
    vi: "Tên đăng nhập này đã được sử dụng",
    en: "Username is already taken"
  },
  invalidPhone: {
    vi: "Số điện thoại không hợp lệ",
    en: "Invalid phone number"
  },
  phoneTaken: {
    vi: "Số điện thoại này đã được sử dụng",
    en: "Phone number is already taken"
  },
  createFailed: {
    vi: "Tạo tài khoản thất bại, vui lòng thử lại sau",
    en: "Failed to create user account"
  },
  success: {
    vi: "Đăng ký tài khoản thành công",
    en: "Registration successful"
  }
};
const POST = async ({ request }) => {
  const lang = resolveLang(request.headers.get("accept-language"));
  try {
    if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
      return json(
        localizePayload({ message: registerMessages.systemUnavailable, ok: false }, lang),
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
    const { publicKeyB64 } = dataDecrypted;
    if (!publicKeyB64) {
      return json(
        localizePayload({ message: registerMessages.missingSessionKey, ok: false }, lang),
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
    const { email, firstname, lastname, midname, password, username, phone } = dataDecrypted;
    if (!email || !username || !password || !firstname || !lastname) {
      return respond({ message: registerMessages.missingFields, ok: false }, 400);
    }
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedPhone = (phone ?? "").trim();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return respond({ message: registerMessages.invalidEmail, ok: false }, 400);
    }
    if (!USERNAME_REGEX.test(normalizedUsername)) {
      return respond({ message: registerMessages.invalidUsername, ok: false }, 400);
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return respond({ message: registerMessages.passwordLength, ok: false }, 400);
    }
    if (normalizedPhone && !PHONE_REGEX.test(normalizedPhone)) {
      return respond({ message: registerMessages.invalidPhone, ok: false }, 400);
    }
    const [emailBlindIndex, usernameBlindIndex, phoneBlindIndex] = await Promise.all([
      encryption.hmacBlindIndex(systemVault.indexKey, normalizedEmail),
      encryption.hmacBlindIndex(systemVault.indexKey, normalizedUsername),
      encryption.hmacBlindIndex(systemVault.indexKey, normalizedPhone)
    ]);
    const [emailTaken, usernameTaken, phoneTaken] = await Promise.all([
      Users.isEmailTaken(emailBlindIndex),
      Users.isUsernameTaken(usernameBlindIndex),
      normalizedPhone ? Users.isPhoneTaken(phoneBlindIndex) : Promise.resolve(false)
    ]);
    if (emailTaken) {
      return respond({ message: registerMessages.emailTaken, ok: false }, 409);
    }
    if (usernameTaken) {
      return respond({ message: registerMessages.usernameTaken, ok: false }, 409);
    }
    if (phoneTaken) {
      return respond({ message: registerMessages.phoneTaken, ok: false }, 409);
    }
    const { dek, storageRecord } = await encryption.setupVault(password);
    const [emailEncrypted, phoneEncrypted, profileEncrypted] = await Promise.all([
      encryption.encryptData(dek, normalizedEmail).then((r) => JSON.stringify(r)),
      encryption.encryptData(dek, normalizedPhone).then((r) => JSON.stringify(r)),
      encryption.encryptData(dek, JSON.stringify({})).then((r) => JSON.stringify(r))
    ]);
    const roleId = "role-customer";
    const statusId = "status-pending_verification";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newKey = `${collectionName}::${crypto.randomUUID()}`;
    const userDoc = {
      firstname: firstname.trim(),
      midname: midname ? midname.trim() : null,
      lastname: lastname.trim(),
      description: "",
      roleId,
      statusId,
      emailBlindIndex,
      emailEncrypted,
      phoneBlindIndex,
      phoneEncrypted,
      usernameBlindIndex,
      profileEncrypted,
      vaultSaltB64: storageRecord.saltB64,
      vaultDekIvB64: storageRecord.dekIvB64,
      vaultWrappedDekB64: storageRecord.wrappedDekB64,
      authMethod: "password",
      webauthnCredentials: [],
      webauthnUserHandle: crypto.randomUUID(),
      mfaEnabled: false,
      lastLoginAt: null,
      lastLoginIp: null,
      remember: false,
      branchId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    const createUserRes = await cbUsers.document.create({
      documentKey: newKey,
      content: userDoc
    });
    if (!createUserRes.ok) {
      return respond({ message: registerMessages.createFailed, ok: false }, 500);
    }
    const rawVerifyToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const verifyTokenHash = await encryption.getDataHash(rawVerifyToken);
    cbUsers.document.update({
      documentKey: newKey,
      content: { emailVerificationTokenHash: verifyTokenHash }
    }).catch((e) => console.error("[register] save verify token failed", e));
    const baseUrl = browser ? "https://localhost:3000" : `https://${request.headers.get("host")}`;
    const verifyUrl = `${baseUrl}/verify-email?token=${rawVerifyToken}`;
    sendDevEmail(
      normalizedEmail,
      "Xác nhận email / Verify your email",
      `<p>Nhấn liên kết để xác nhận email (hiệu lực 1 giờ):</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`
    );
    return respond(
      {
        ok: true,
        message: registerMessages.success,
        data: { authMethod: "password" }
      },
      200
    );
  } catch (e) {
    console.error("[POST /api/register]", e);
    return json(
      { message: e instanceof Error ? e.message : String(e), ok: false },
      { status: 500 }
    );
  }
};
export {
  POST
};
