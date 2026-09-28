import { json } from "@sveltejs/kit";
import { d as cbVault, e as cb_document_id_rsa_key_vault } from "../../../../../chunks/clients.js";
const vaultsCollection = cbVault("vaults");
const GET = async () => {
  const response = await vaultsCollection.document.get({
    documentKey: cb_document_id_rsa_key_vault
  });
  if (response.status >= 400)
    return json({ message: response.message }, { status: response.status });
  if (response.ok && response.data) {
    const publicKeyB64 = response.data["publicKeyB64"];
    return json({
      data: {
        publicKeyB64
      }
    });
  }
  return json({
    message: "System crash"
  });
};
const POST = ({ params }) => {
  return new Response(JSON.stringify(""));
};
export {
  GET,
  POST
};
