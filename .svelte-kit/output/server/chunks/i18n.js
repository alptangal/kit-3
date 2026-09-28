function resolveLang(acceptLanguage) {
  const first = (acceptLanguage ?? "").split(",")[0]?.trim() ?? "";
  const primary = first.split(";")[0]?.split("-")[0]?.toLowerCase() ?? "";
  return primary || "en";
}
function localize(content, lang) {
  if (!content) return content;
  if (content[lang] !== void 0) return { [lang]: content[lang] };
  if (content.en !== void 0) return { en: content.en };
  return content;
}
function localizePayload(payload, lang) {
  if (!payload || typeof payload !== "object") return payload;
  const result = { ...payload };
  if (result.message && typeof result.message === "object") {
    result.message = localize(result.message, lang);
  }
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (value && typeof value === "object" && !Array.isArray(value) && value.message && typeof value.message === "object") {
      result[key] = { ...value, message: localize(value.message, lang) };
    }
  }
  return result;
}
export {
  localize as a,
  localizePayload as l,
  resolveLang as r
};
