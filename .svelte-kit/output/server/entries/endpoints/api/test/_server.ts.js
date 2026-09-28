const GET = async () => {
  return new Response(
    JSON.stringify({
      status: "ok",
      message: "Test endpoint working",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
};
export {
  GET
};
