const GET = async () => {
  return new Response(
    JSON.stringify({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime()
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
