import { s as systemVault } from "./initSystemVault.js";
function base64urlEncode(data) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(str.length + (4 - (str.length % 4 || 4)) % 4, "=");
  const binary = typeof atob !== "undefined" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function base64urlEncodeJson(obj) {
  return base64urlEncode(JSON.stringify(obj));
}
let serverKeyPair;
async function getServerKeyPair() {
  if (serverKeyPair) return serverKeyPair;
  serverKeyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify"
  ]);
  return serverKeyPair;
}
async function signAccessToken(payload) {
  const { privateKey } = systemVault;
  const header = { alg: "ES256", typ: "JWT" };
  const signingInput = `${base64urlEncodeJson(header)}.${base64urlEncodeJson(payload)}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64urlEncode(sig)}`;
}
async function verifyAccessToken(token) {
  const [encodedHeader, encodedPayload, encodedSig] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSig) throw new Error("Malformed token");
  const { publicKey } = await getServerKeyPair();
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    base64urlDecode(encodedSig).buffer,
    new TextEncoder().encode(signingInput)
  );
  if (!valid) throw new Error("Invalid token signature");
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(encodedPayload)));
  if (payload.exp && Date.now() / 1e3 > payload.exp) throw new Error("Token expired");
  return payload;
}
export {
  base64urlDecode as a,
  base64urlEncode as b,
  signAccessToken as s,
  verifyAccessToken as v
};
