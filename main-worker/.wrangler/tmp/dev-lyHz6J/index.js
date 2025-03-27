var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../node_modules/uuid/dist/esm-browser/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
__name(unsafeStringify, "unsafeStringify");

// ../node_modules/uuid/dist/esm-browser/rng.js
var getRandomValues;
var rnds8 = new Uint8Array(16);
function rng() {
  if (!getRandomValues) {
    if (typeof crypto === "undefined" || !crypto.getRandomValues) {
      throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    }
    getRandomValues = crypto.getRandomValues.bind(crypto);
  }
  return getRandomValues(rnds8);
}
__name(rng, "rng");

// ../node_modules/uuid/dist/esm-browser/native.js
var randomUUID = typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto);
var native_default = { randomUUID };

// ../node_modules/uuid/dist/esm-browser/v4.js
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  options = options || {};
  const rnds = options.random ?? options.rng?.() ?? rng();
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
__name(v4, "v4");
var v4_default = v4;

// index.js
function addCorsHeaders(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}
__name(addCorsHeaders, "addCorsHeaders");
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") {
      return addCorsHeaders(new Response(null, { status: 204 }));
    }
    try {
      if (path === "/sve2" && method === "GET") {
        console.log("Received GET /sve2 request");
        const userEmail = url.searchParams.get("email");
        const apiToken = env.API_TOKEN;
        if (!apiToken) {
          console.error("Error in GET /sve2: Missing API token");
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Missing API token" }), { status: 500 })
          );
        }
        if (!userEmail) {
          console.error("Error in GET /sve2: Missing email parameter");
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Missing email parameter" }), { status: 400 })
          );
        }
        const db = env.vegvisr_org;
        try {
          const query = `
            SELECT user_id
            FROM config
            WHERE email = ?;
          `;
          const existingUser = await db.prepare(query).bind(userEmail).first();
          if (existingUser) {
            console.log(`User with email ${userEmail} already exists in the database`);
            return addCorsHeaders(
              new Response(JSON.stringify({ message: "User with this email already exists." }), {
                status: 200
              })
            );
          }
        } catch (dbError) {
          console.error("Error checking for existing user in database:", dbError);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Failed to check database for existing user." }), {
              status: 500
            })
          );
        }
        const apiUrl = `https://slowyou.io/api/reg-user-vegvisr?email=${encodeURIComponent(userEmail)}`;
        console.log("API URL:", apiUrl);
        console.log("Authorization Header:", `Bearer ${apiToken}`);
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiToken}`
          }
        });
        console.log("Response status:", response.status);
        const rawBody = await response.text();
        console.log("Raw response body:", rawBody);
        if (!response.ok) {
          console.error(`Error from external API: ${response.status} ${response.statusText}`);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: `Failed to register user. External API returned status ${response.status}.`
              }),
              { status: 500 }
            )
          );
        }
        let responseBody;
        try {
          responseBody = JSON.parse(rawBody);
        } catch (parseError) {
          console.error("Error parsing response body:", parseError);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Failed to parse response from external API." }), {
              status: 500
            })
          );
        }
        try {
          const userId = v4_default();
          const defaultData = '{"profile":{"username":"","email":"","bio":""},"settings":{"darkMode":false,"notifications":true,"theme":"dark"}}';
          const insertQuery = `
            INSERT INTO config (email, user_id, data)
            VALUES (?, ?, ?)
            ON CONFLICT(email) DO NOTHING;
          `;
          console.log(
            "Executing query:",
            insertQuery,
            "with parameters:",
            userEmail,
            userId,
            defaultData
          );
          await db.prepare(insertQuery).bind(userEmail, userId, defaultData).run();
          console.log(
            `Inserted record into database: email=${userEmail}, user_id=${userId}, data=${defaultData}`
          );
        } catch (dbError) {
          console.error("Error inserting record into database:", dbError);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Failed to insert record into database." }), {
              status: 500
            })
          );
        }
        return addCorsHeaders(
          new Response(JSON.stringify({ status: response.status, body: responseBody }), {
            status: 200
          })
        );
      }
      if (path === "/resend-verification" && method === "POST") {
        console.log("Received POST /resend-verification request");
        const requestBody = await request.json();
        const userEmail = requestBody.email;
        const apiToken = env.API_TOKEN;
        if (!apiToken) {
          console.error("Error in POST /resend-verification: Missing API token");
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Missing API token" }), { status: 500 })
          );
        }
        if (!userEmail) {
          console.error("Error in POST /resend-verification: Missing email parameter");
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Missing email parameter" }), { status: 400 })
          );
        }
        const apiUrl = `https://slowyou.io/api/resend-verification-email?email=${encodeURIComponent(
          userEmail
        )}`;
        console.log("API URL:", apiUrl);
        console.log("Authorization Header:", `Bearer ${apiToken}`);
        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiToken}`
            }
          });
          console.log("Response status:", response.status);
          const rawBody = await response.text();
          console.log("Raw response body:", rawBody);
          if (!response.ok) {
            console.error(`Error from external API: ${response.status} ${response.statusText}`);
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: `Failed to resend verification email. External API returned status ${response.status}.`
                }),
                { status: 500 }
              )
            );
          }
          return addCorsHeaders(
            new Response(JSON.stringify({ message: "Verification email resent successfully." }), {
              status: 200
            })
          );
        } catch (error) {
          console.error("Error calling external API:", error);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Failed to resend verification email." }), {
              status: 500
            })
          );
        }
      }
      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("Error in fetch handler:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }
};

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-LDA5OO/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = index_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-LDA5OO/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
