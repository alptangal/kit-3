import { e as encryption } from "../../../../../chunks/encryption.js";
import { s as systemVault } from "../../../../../chunks/initSystemVault.js";
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body.encryptedSessionKeyB64 || !body.ivB64 || !body.ciphertextB64)
      throw new Error(JSON.stringify({ message: "Decryption failed cuz broken data" }));
    if (!systemVault || !systemVault.privateKey)
      return new Response(JSON.stringify({ message: "System crash" }));
    const data = await encryption.decryptWithPrivateKeyHybrid(systemVault.privateKey, body);
    return new Response(data);
  } catch (e) {
    console.error("Decrypt failed:", e);
    return new Response(JSON.stringify({ message: "Decryption failed" }), { status: 400 });
  }
};
export {
  POST
};
