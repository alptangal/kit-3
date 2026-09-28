import * as server from '../entries/pages/_layout.server.ts.js';

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export { server };
export const server_id = "src/routes/+layout.server.ts";
export const imports = ["_app/immutable/nodes/0.D7P-8jYg.js","_app/immutable/chunks/PPVm8Dsz.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/C2u_6wXe.js","_app/immutable/chunks/D-udZLY0.js","_app/immutable/chunks/DqxBhIOb.js","_app/immutable/chunks/C0Xf2en6.js","_app/immutable/chunks/CfNwEyU0.js","_app/immutable/chunks/DDhckrLN.js","_app/immutable/chunks/BbFZgtEI.js","_app/immutable/chunks/a_s_i6rM.js","_app/immutable/chunks/CglxFxAJ.js","_app/immutable/chunks/O7nlA-MD.js","_app/immutable/chunks/CSYh6393.js","_app/immutable/chunks/CUFBfsrQ.js","_app/immutable/chunks/BO42LuC1.js","_app/immutable/chunks/CbV6lp65.js","_app/immutable/chunks/FtqbYcpE.js"];
export const stylesheets = ["_app/immutable/assets/index.CkuVZ9nl.css","_app/immutable/assets/AppShell.Ci_jPbnS.css","_app/immutable/assets/0.DxXTd_3t.css"];
export const fonts = [];
