import { json } from "@sveltejs/kit";
import { r as readAdminRequest, a as respondEncrypted, g as getActorContext, s as statusForServiceFailure } from "../../../../../../chunks/api.js";
import { P as ProductAdminService } from "../../../../../../chunks/products.js";
const POST = async (event) => {
  const { locals } = event;
  try {
    const read = await readAdminRequest(event);
    if (!read.ok) return read.response;
    const { lang, publicKeyB64 } = read;
    const respond = (payload, status = 200) => respondEncrypted(publicKeyB64, payload, lang, status);
    const actor = await getActorContext(locals);
    if (!actor) {
      return respond(
        { ok: false, message: { vi: "Phiên đăng nhập đã hết hạn", en: "Session expired" } },
        401
      );
    }
    const result = await ProductAdminService.create(actor, read.data);
    if (!result.success) {
      return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
    }
    return respond({
      ok: true,
      message: result.messages,
      data: { documentKey: result.documentKey }
    });
  } catch (e) {
    console.error("[POST /api/admin/products/create]", e);
    return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
  }
};
export {
  POST
};
