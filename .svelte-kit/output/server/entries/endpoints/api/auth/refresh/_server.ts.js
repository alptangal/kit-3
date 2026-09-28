import { json } from "@sveltejs/kit";
import "../../../../../chunks/users.js";
import "../../../../../chunks/products.js";
import { c as cbData } from "../../../../../chunks/clients.js";
import { e as encryption } from "../../../../../chunks/encryption.js";
import "../../../../../chunks/initSystemVault.js";
import { b as base64urlEncode, a as base64urlDecode, s as signAccessToken } from "../../../../../chunks/jwt.js";
const cbRefreshTokens = cbData("refresh_tokens");
async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
function makeDocumentKey(familyId, generation) {
  return `refresh_token::${familyId}::${generation}`;
}
async function findRefreshToken(tokenValue) {
  try {
    const tokenHash = await hashToken(tokenValue);
    const res = await cbRefreshTokens.query.document.search({
      conditions: [{ fieldName: "tokenHash", keyword: tokenHash }],
      limit: 1
    });
    if (!res.ok || !res.data || res.data.length === 0) {
      return { success: false, messages: { vi: "Token không hợp lệ", en: "Invalid token" } };
    }
    const doc = res.data[0];
    if (doc.isRevoked) {
      return { success: false, messages: { vi: "Token đã bị thu hồi", en: "Token has been revoked" } };
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (doc.expiresAt < now) {
      return { success: false, messages: { vi: "Token đã hết hạn", en: "Token expired" } };
    }
    return { success: true, data: doc };
  } catch (e) {
    console.error("[findRefreshToken] error:", e);
    return { success: false, messages: { vi: "Lỗi tìm token", en: "Error finding token" } };
  }
}
async function rotateRefreshToken(oldTokenValue, newTokenData) {
  const oldTokenHash = await hashToken(oldTokenValue);
  const newTokenHash = await hashToken(newTokenData.token);
  try {
    const findRes = await cbRefreshTokens.query.document.search({
      conditions: [{ fieldName: "tokenHash", keyword: oldTokenHash }],
      limit: 1
    });
    if (!findRes.ok || !findRes.data || findRes.data.length === 0) {
      return { success: false, messages: { vi: "Token cũ không tồn tại", en: "Old token not found" } };
    }
    const oldDoc = findRes.data[0];
    if (oldDoc.isRevoked) {
      return { success: false, messages: { vi: "Token đã bị thu hồi", en: "Token already revoked" } };
    }
    const newGeneration = oldDoc.generation + 1;
    const revokeRes = await cbRefreshTokens.document.update({
      documentKey: oldDoc._id,
      content: {
        isRevoked: true,
        revokedAt: (/* @__PURE__ */ new Date()).toISOString(),
        revokedReason: "rotated"
      }
    });
    if (!revokeRes.ok) {
      return { success: false, messages: { vi: "Không thể thu hồi token cũ", en: "Failed to revoke old token" } };
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newDoc = {
      userId: newTokenData.userId,
      tokenHash: newTokenHash,
      familyId: oldDoc.familyId,
      generation: newGeneration,
      expiresAt: new Date(newTokenData.expiresAt * 1e3).toISOString(),
      isRevoked: false,
      revokedAt: null,
      revokedReason: null,
      deviceId: newTokenData.deviceId,
      deviceNameEncrypted: newTokenData.deviceName ? (await encryption.encryptData(
        await encryption.unlockVault("", {
          // placeholder, we need the DEK from somewhere
          dekIvB64: "",
          saltB64: "",
          wrappedDekB64: ""
        })
      )).ciphertextB64 : null,
      deviceTypeEncrypted: newTokenData.deviceType ? (await encryption.encryptData(
        await encryption.unlockVault("", {
          dekIvB64: "",
          saltB64: "",
          wrappedDekB64: ""
        })
      )).ciphertextB64 : null,
      ipAddress: newTokenData.ipAddress,
      userAgent: newTokenData.userAgent,
      lastUsedAt: now,
      usageCount: 1,
      refreshHistory: [
        ...oldDoc.refreshHistory || [],
        {
          refreshedAt: now,
          ipAddress: newTokenData.ipAddress,
          newTokenHash,
          generation: newGeneration
        }
      ],
      createdAt: now
    };
    const newDocKey = makeDocumentKey(oldDoc.familyId, newGeneration);
    const createRes = await cbRefreshTokens.document.create({
      documentKey: newDocKey,
      content: newDoc
    });
    if (!createRes.ok) {
      return { success: false, messages: { vi: "Không tạo được token mới", en: "Failed to create new token" } };
    }
    return {
      success: true,
      data: { ...newDoc, _id: newDocKey }
    };
  } catch (e) {
    console.error("[rotateRefreshToken] error:", e);
    return { success: false, messages: { vi: "Lỗi xoay vòng token", en: "Error rotating token" } };
  }
}
async function revokeRefreshToken(tokenValue, reason = "manual") {
  const tokenHash = await hashToken(tokenValue);
  try {
    const findRes = await cbRefreshTokens.query.document.search({
      conditions: [{ fieldName: "tokenHash", keyword: tokenHash }],
      limit: 1
    });
    if (!findRes.ok || !findRes.data || findRes.data.length === 0) {
      return { success: false, messages: { vi: "Token không tồn tại", en: "Token not found" } };
    }
    const doc = findRes.data[0];
    const res = await cbRefreshTokens.document.update({
      documentKey: doc._id,
      content: {
        isRevoked: true,
        revokedAt: (/* @__PURE__ */ new Date()).toISOString(),
        revokedReason: reason
      }
    });
    if (!res.ok) {
      return { success: false, messages: { vi: "Không thể thu hồi token", en: "Failed to revoke token" } };
    }
    return { success: true };
  } catch (e) {
    console.error("[revokeRefreshToken] error:", e);
    return { success: false, messages: { vi: "Lỗi thu hồi token", en: "Error revoking token" } };
  }
}
async function calculateJwkThumbprint(jwk) {
  const canonical = JSON.stringify({
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return base64urlEncode(digest);
}
const usedJti = /* @__PURE__ */ new Map();
function cleanupJti() {
  const now = Date.now();
  for (const [jti, exp] of usedJti) if (exp < now) usedJti.delete(jti);
}
function decodeJsonPart(b64url) {
  return JSON.parse(new TextDecoder().decode(base64urlDecode(b64url)));
}
async function verifyProofSignatureAndClaims(proof, htm, htu) {
  const parts = proof.split(".");
  if (parts.length !== 3) throw new Error("Invalid DPoP proof format");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart(encodedHeader);
  const payload = decodeJsonPart(encodedPayload);
  if (header.typ !== "dpop+jwt") throw new Error("Invalid typ");
  if (header.alg !== "ES256") throw new Error("Unsupported alg");
  if (!header.jwk) throw new Error("Missing jwk");
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    header.jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    base64urlDecode(encodedSignature).buffer,
    new TextEncoder().encode(signingInput)
  );
  if (!valid) throw new Error("Invalid signature");
  cleanupJti();
  if (typeof payload.jti !== "string" || usedJti.has(payload.jti)) {
    throw new Error("Replayed or missing jti");
  }
  usedJti.set(payload.jti, Date.now() + 12e4);
  const now = Math.floor(Date.now() / 1e3);
  if (typeof payload.iat !== "number" || Math.abs(now - payload.iat) > 60) {
    throw new Error("DPoP proof expired or iat invalid");
  }
  if (payload.htm !== htm || payload.htu !== htu) {
    throw new Error("htm/htu mismatch");
  }
  const jkt = await calculateJwkThumbprint(header.jwk);
  return { jkt, header, payload };
}
async function verifyDpopProofNoBinding(opts) {
  return verifyProofSignatureAndClaims(opts.proof, opts.htm, opts.htu);
}
const POST = async ({ request, url, cookies }) => {
  const refreshTokenValue = cookies.get("refreshToken");
  const proof = request.headers.get("DPoP");
  if (!refreshTokenValue) {
    return json({ error: "Missing refresh token" }, { status: 401 });
  }
  if (!proof) {
    return json(
      { error: "DPoP header required" },
      {
        status: 400,
        headers: { "DPoP-Nonce": crypto.randomUUID() }
      }
    );
  }
  const stored = await findRefreshToken(refreshTokenValue);
  if (!stored) {
    cookies.delete("refreshToken", { path: "/api/auth/refresh" });
    return json({ error: "Invalid refresh token" }, { status: 401 });
  }
  const now = Math.floor(Date.now() / 1e3);
  if (stored.expiresAt < now) {
    await revokeRefreshToken(refreshTokenValue);
    cookies.delete("refreshToken", { path: "/api/auth/refresh" });
    return json({ error: "Refresh token expired" }, { status: 401 });
  }
  let jkt;
  try {
    const result = await verifyDpopProofNoBinding({
      proof,
      htm: "POST",
      htu: url.origin + "/api/auth/refresh"
    });
    jkt = result.jkt;
  } catch (err) {
    return json(
      { error: "Invalid DPoP proof" },
      {
        status: 401,
        headers: { "DPoP-Nonce": crypto.randomUUID() }
      }
    );
  }
  if (jkt !== stored.jkt) {
    await revokeRefreshToken(refreshTokenValue);
    cookies.delete("refreshToken", { path: "/api/auth/refresh" });
    return json({ error: "Key mismatch — token has been revoked" }, { status: 401 });
  }
  const newRefreshTokenValue = crypto.randomUUID() + crypto.randomUUID();
  const rotated = await rotateRefreshToken(refreshTokenValue, {
    token: newRefreshTokenValue,
    userId: stored.userId,
    jkt,
    expiresAt: now + 30 * 86400
  });
  if (!rotated) {
    return json({ error: "Refresh token already used" }, { status: 401 });
  }
  const accessToken = await signAccessToken({
    sub: stored.userId,
    cnf: { jkt },
    iat: now,
    exp: now + 15 * 60
  });
  cookies.set("refreshToken", newRefreshTokenValue, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 30 * 86400
  });
  return json({ accessToken });
};
export {
  POST
};
