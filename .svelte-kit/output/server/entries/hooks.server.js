import { s as systemVault, i as initSystemVault } from "../chunks/initSystemVault.js";
import { g as couchbase, h as cb_organizationId, i as cb_api_key_secret, b as cb_scopeName, j as cb_bucketId, k as cb_clusterIdManagement, l as cb_projectId, m as collectionSchemas, c as cbData, a as cb_bucketName, n as email_owner, u as username_owner, p as password_owner } from "../chunks/clients.js";
import { e as encryption } from "../chunks/encryption.js";
import { v as verifyAccessToken } from "../chunks/jwt.js";
import { r as resolveLang, a as localize } from "../chunks/i18n.js";
const cbManagement = couchbase.managementData({
  apiKeySecret: cb_api_key_secret,
  organizationId: cb_organizationId
});
const collectionsApi = cbManagement.collections({
  projectId: cb_projectId,
  clusterId: cb_clusterIdManagement,
  bucketId: cb_bucketId,
  scopeName: cb_scopeName
});
async function initAllCollections() {
  const collectionSchemasHashed = await encryption.getDataHash(collectionSchemas);
  const res = await cbData("system").document.get({ documentKey: "initApp" });
  if (res.status == 404 || res.data?.collectionSchemasHashed != collectionSchemasHashed) {
    console.log("[initCollections] Starting...");
    const existing = await collectionsApi.list();
    const existingNames = new Set(
      existing?.data?.map((c) => c.name) ?? []
    );
    const collectionNames = Object.keys(collectionSchemas);
    for (const name of collectionNames) {
      if (existingNames.has(name)) {
        console.log(`[initCollections] Collection "${name}" already exists — skip`);
        continue;
      }
      try {
        await collectionsApi.create({ name });
        console.log(`[initCollections] Created collection "${name}"`);
      } catch (e) {
        console.error(`[initCollections] Failed to create collection "${name}":`, e);
        throw e;
      }
    }
    console.log("[initCollections] Done creating collections");
  } else {
    console.log("[initCollections] Done created collections");
  }
}
async function initAllIndexes() {
  const collectionSchemasHashed = await encryption.getDataHash(collectionSchemas);
  const res = await cbData("system").document.get({ documentKey: "initApp" });
  if (res.status == 404 || res.data?.collectionSchemasHashed != collectionSchemasHashed) {
    console.log("[initIndexes] Starting...");
    const collectionNames = Object.keys(collectionSchemas);
    for (const collectionName of collectionNames) {
      const fields = collectionSchemas[collectionName].fields;
      const searchableFields = Object.entries(fields).filter(([, def]) => def.searchable).map(([fieldName]) => fieldName);
      if (searchableFields.length === 0) continue;
      const client = cbData(collectionName);
      for (const fieldName of searchableFields) {
        const indexName = `idx_${collectionName}_${fieldName}`;
        try {
          const statement = `
					CREATE INDEX \`${indexName}\`
					ON \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`${collectionName}\`(\`${fieldName}\`)
				`;
          const res2 = await client.document.query({ statement });
          if (res2.ok) {
            console.log(`[initIndexes] Created index "${indexName}"`);
          } else {
            const msg = res2.message ?? "";
            if (msg.includes("already exists") || res2.status == 409) {
              console.log(`[initIndexes] Index "${indexName}" already exists — skip`);
            } else {
              throw new Error(msg);
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("already exists")) {
            console.log(`[initIndexes] Index "${indexName}" already exists — skip`);
          } else {
            console.error(`[initIndexes] Failed to create index "${indexName}":`, e);
            throw e;
          }
        }
      }
    }
    console.log("[initIndexes] Done creating indexes");
  } else {
    console.log("[initIndexes] Done created indexes");
  }
}
const cbRoles = cbData("name_roles");
const cbPermissions = cbData("permissions");
const cbDetailRoles = cbData("detail_roles");
const cbUserStatus = cbData("user_status");
async function seedIfNotExists(client, documentKey, content) {
  const existing = await client.document.get({ documentKey }).catch(() => null);
  if (existing?.ok) {
    console.log(`[seed] "${documentKey}" already exists — skip`);
    return;
  }
  const res = await client.document.create({ documentKey, content });
  if (!res.ok) {
    throw new Error(`[seed] Failed to create "${documentKey}": ${res.message}`);
  }
  console.log(`[seed] Created "${documentKey}"`);
}
async function seedRoles() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const roles = [
    { key: "role-owner", name: "owner", displayName: "Chủ cửa hàng", level: 100 },
    { key: "role-manager", name: "manager", displayName: "Quản lý", level: 50 },
    { key: "role-staff", name: "staff", displayName: "Nhân viên", level: 10 },
    { key: "role-customer", name: "customer", displayName: "Khách hàng", level: 0 }
  ];
  for (const r of roles) {
    await seedIfNotExists(cbRoles, r.key, {
      name: r.name,
      displayName: r.displayName,
      description: "",
      level: r.level,
      isSystem: true,
      createdAt: now,
      updatedAt: now
    });
  }
}
async function seedPermissions() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const permissions = [
    { key: "products:create", resource: "products", action: "create" },
    { key: "products:read", resource: "products", action: "read" },
    { key: "products:update", resource: "products", action: "update" },
    { key: "products:delete", resource: "products", action: "delete" },
    { key: "orders:create", resource: "orders", action: "create" },
    { key: "orders:read", resource: "orders", action: "read" },
    { key: "orders:update", resource: "orders", action: "update" },
    { key: "orders:refund", resource: "orders", action: "refund" },
    { key: "inventory:view", resource: "inventory", action: "read" },
    { key: "inventory:adjust", resource: "inventory", action: "update" },
    { key: "purchase_orders:create", resource: "purchase_orders", action: "create" },
    { key: "purchase_orders:approve", resource: "purchase_orders", action: "approve" },
    { key: "stock_transfers:create", resource: "stock_transfers", action: "create" },
    { key: "stock_transfers:approve", resource: "stock_transfers", action: "approve" },
    { key: "stock_takes:perform", resource: "stock_takes", action: "create" },
    { key: "suppliers:manage", resource: "suppliers", action: "manage" },
    { key: "users:manage", resource: "users", action: "manage" },
    { key: "reports:view", resource: "reports", action: "read" }
  ];
  for (const p of permissions) {
    await seedIfNotExists(cbPermissions, `perm-${p.key.replace(":", "-")}`, {
      ...p,
      description: "",
      createdAt: now
    });
  }
}
async function seedDetailRoles() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const grants = [
    // Owner — toàn quyền
    ...[
      "products:create",
      "products:read",
      "products:update",
      "products:delete",
      "orders:create",
      "orders:read",
      "orders:update",
      "orders:refund",
      "inventory:view",
      "inventory:adjust",
      "purchase_orders:create",
      "purchase_orders:approve",
      "stock_transfers:create",
      "stock_transfers:approve",
      "stock_takes:perform",
      "suppliers:manage",
      "users:manage",
      "reports:view"
    ].map((key) => ({ roleName: "owner", permissionKey: key, scope: "all" })),
    // Manager — quản lý trong phạm vi chi nhánh mình
    { roleName: "manager", permissionKey: "products:create", scope: "own_branch" },
    { roleName: "manager", permissionKey: "products:read", scope: "own_branch" },
    { roleName: "manager", permissionKey: "products:update", scope: "own_branch" },
    { roleName: "manager", permissionKey: "orders:read", scope: "own_branch" },
    { roleName: "manager", permissionKey: "orders:refund", scope: "own_branch" },
    { roleName: "manager", permissionKey: "inventory:view", scope: "own_branch" },
    { roleName: "manager", permissionKey: "inventory:adjust", scope: "own_branch" },
    { roleName: "manager", permissionKey: "purchase_orders:create", scope: "own_branch" },
    { roleName: "manager", permissionKey: "purchase_orders:approve", scope: "own_branch" },
    { roleName: "manager", permissionKey: "stock_transfers:create", scope: "own_branch" },
    { roleName: "manager", permissionKey: "stock_takes:perform", scope: "own_branch" },
    { roleName: "manager", permissionKey: "reports:view", scope: "own_branch" },
    // Manager cũng cần quản lý user trong chi nhánh mình (vd khoá/mở tài khoản staff) —
    // thiếu grant này thì UserAdminService.setStatus/setRole/delete/list sẽ luôn từ chối manager.
    { roleName: "manager", permissionKey: "users:manage", scope: "own_branch" },
    // Staff — thao tác cơ bản, phạm vi hẹp
    { roleName: "staff", permissionKey: "products:read", scope: "own_branch" },
    { roleName: "staff", permissionKey: "orders:create", scope: "own_records" },
    { roleName: "staff", permissionKey: "orders:read", scope: "own_branch" },
    { roleName: "staff", permissionKey: "inventory:view", scope: "own_branch" },
    { roleName: "staff", permissionKey: "stock_takes:perform", scope: "own_branch" },
    // Customer — chỉ tạo/xem đơn của chính mình
    { roleName: "customer", permissionKey: "orders:create", scope: "own_records" },
    { roleName: "customer", permissionKey: "orders:read", scope: "own_records" }
  ];
  for (const g of grants) {
    const key = `grant-${g.roleName}-${g.permissionKey.replace(":", "-")}`;
    await seedIfNotExists(cbDetailRoles, key, { ...g, createdAt: now });
  }
}
async function seedUserStatus() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const statuses = [
    { key: "status-active", name: "active", canLogin: true },
    { key: "status-suspended", name: "suspended", canLogin: false },
    { key: "status-banned", name: "banned", canLogin: false },
    { key: "status-pending_verification", name: "pending_verification", canLogin: false }
  ];
  for (const s of statuses) {
    await seedIfNotExists(cbUserStatus, s.key, {
      name: s.name,
      description: "",
      canLogin: s.canLogin,
      createdAt: now,
      updatedAt: now
    });
  }
}
async function seedAllCatalogData() {
  const collectionSchemasHashed = await encryption.getDataHash(collectionSchemas);
  const res = await cbData("system").document.get({ documentKey: "initApp" });
  if (res.status == 404 || res.data?.initApp?.collectionSchemasHashed != collectionSchemasHashed) {
    console.log("[seed] Starting catalog seed...");
    await seedRoles();
    await seedPermissions();
    await seedDetailRoles();
    await seedUserStatus();
    await createAdminAccount({
      username: username_owner,
      password: password_owner,
      email: email_owner
    });
    const initAppContent = {
      initApp: {
        status: "success",
        collectionSchemasHashed,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
    if (res.status == 404) {
      await cbData("system").document.create({
        documentKey: "initApp",
        content: initAppContent
      });
    } else {
      await cbData("system").document.update({
        documentKey: "initApp",
        content: initAppContent
      });
    }
    console.log("[seed] Done seeding catalog data");
  } else {
    console.log("[seed] Catalog already up to date — skip");
  }
}
async function createAdminAccount(data) {
  const collectionName = "users";
  const { username, email, password } = data;
  const documentKey = `${collectionName}-${username}`;
  if (!systemVault.indexKey) {
    throw new Error("[seed] Cannot create admin account: systemVault.indexKey chưa được khởi tạo");
  }
  const cbUser = cbData(collectionName);
  const normalizedEmail = email.trim().toLowerCase();
  const emailBlindIndex = await encryption.hmacBlindIndex(systemVault.indexKey, normalizedEmail);
  const existing = await cbUser.document.get({ documentKey });
  if (existing.ok && existing.data) {
    console.log(`[seed] "${collectionName}-administrator" already exists — skip`);
    return;
  }
  const { dek, storageRecord } = await encryption.setupVault(password);
  const emailEncrypted = JSON.stringify(await encryption.encryptData(dek, normalizedEmail));
  const normalizedUsername = username.trim().toLowerCase();
  const usernameBlindIndex = await encryption.hmacBlindIndex(
    systemVault.indexKey,
    normalizedUsername
  );
  const phoneBlindIndex = await encryption.hmacBlindIndex(systemVault.indexKey, "");
  const phoneEncrypted = JSON.stringify(await encryption.encryptData(dek, ""));
  const profileEncrypted = JSON.stringify(await encryption.encryptData(dek, JSON.stringify({})));
  const userDoc = {
    firstname: "Administrator",
    lastname: null,
    midname: null,
    description: "",
    // Đồng bộ với schema mới: roleId/statusId trỏ tới catalog thay vì hardcode string
    statusId: "status-active",
    roleId: "role-owner",
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
    // branchId / customerTierEncrypted CỐ Ý bỏ trống — owner không gắn với 1 chi nhánh
    // cụ thể và không phải customer, nên 2 field này giờ là optional trong schema
    // (xem ghi chú trong collectionSchemas.users).
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    deletedAt: null
  };
  const rs = await cbUser.document.create({
    documentKey,
    content: userDoc
  });
  if (rs.ok) {
    console.log(`[seed] "${collectionName}-administrator" created succesful`);
  } else {
    throw new Error(
      `[seed] "${collectionName}-administrator" create failed: ${rs.message ?? rs.status}`
    );
  }
}
async function initApp() {
  console.log("=== App initialization started ===");
  await initSystemVault();
  console.log("[initApp] Vault ready");
  await initAllCollections();
  await initAllIndexes();
  await seedAllCatalogData();
  console.log("=== App initialization completed ===");
}
if (!globalThis.__appInitialized) {
  globalThis.__appInitialized = true;
  globalThis.__initPromise = (async () => {
    await initApp();
    await initSystemVault();
  })();
}
async function ensureInitialized() {
  if (globalThis.__initPromise) {
    await globalThis.__initPromise;
  }
}
async function getUserFromToken(token) {
  try {
    const payload = await verifyAccessToken(token);
    const user = {
      firstName: payload.username,
      lastName: "",
      dob: "",
      region: "South-Eastern Asia",
      country: "VN",
      gender: "Male",
      phone: "",
      email: "",
      username: payload.username,
      password: "",
      // Don't expose password
      role: payload.roleId.includes("owner") ? "admin" : payload.roleId.includes("manager") ? "staff" : "customer"
    };
    return user;
  } catch (error) {
    console.error("[hooks.server] Token verification failed:", error);
    return void 0;
  }
}
const handle = async ({ event, resolve }) => {
  await ensureInitialized();
  if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
    return new Response("Service unavailable — system initializing", { status: 503 });
  }
  const token = event.cookies.get("session");
  event.locals.user = token ? await getUserFromToken(token) : void 0;
  const { pathname } = event.url;
  const publicPaths = ["/login", "/register", "/forgot-password", "/api/encryption", "/api/login", "/api/register", "/api/forgot-password", "/reset-password", "/api/reset-password", "/api/dev-emails", "/verify-email", "/api/verify-email", "/api/resend-verification", "/ui", "/api/health", "/api/test"];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));
  const isApiRoute = pathname.startsWith("/api/");
  if (!isPublicPath && !isApiRoute && !event.locals.user) {
    const redirectUrl = encodeURIComponent(pathname + event.url.search);
    return new Response(null, {
      status: 303,
      headers: { location: `/login?redirect=${redirectUrl}` }
    });
  }
  if (isApiRoute && !isPublicPath && !event.locals.user) {
    const lang = resolveLang(event.request.headers.get("accept-language"));
    return new Response(JSON.stringify({
      message: localize({ vi: "Phiên đăng nhập đã hết hạn", en: "Session expired" }, lang),
      ok: false
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  return resolve(event);
};
const handleError = ({ error }) => {
  import("fs").then((fs) => {
    const errorMessage = error instanceof Error ? error.stack ?? error.message : String(error);
    fs.writeFileSync("d:/nodejs/svelte/kit-3/last_ssr_error.log", errorMessage);
  });
  return {
    message: error instanceof Error ? error.message : "Unknown error"
  };
};
export {
  handle,
  handleError
};
