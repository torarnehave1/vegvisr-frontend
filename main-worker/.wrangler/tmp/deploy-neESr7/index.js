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
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
