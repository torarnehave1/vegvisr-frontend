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

// ../node_modules/jose/dist/webapi/lib/buffer_utils.js
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var MAX_INT32 = 2 ** 32;
function concat(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0);
  const buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers) {
    buf.set(buffer, i);
    i += buffer.length;
  }
  return buf;
}
__name(concat, "concat");

// ../node_modules/jose/dist/webapi/lib/base64.js
function encodeBase64(input) {
  if (Uint8Array.prototype.toBase64) {
    return input.toBase64();
  }
  const CHUNK_SIZE = 32768;
  const arr = [];
  for (let i = 0; i < input.length; i += CHUNK_SIZE) {
    arr.push(String.fromCharCode.apply(null, input.subarray(i, i + CHUNK_SIZE)));
  }
  return btoa(arr.join(""));
}
__name(encodeBase64, "encodeBase64");
function decodeBase64(encoded) {
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(encoded);
  }
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
__name(decodeBase64, "decodeBase64");

// ../node_modules/jose/dist/webapi/util/base64url.js
function decode(input) {
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(typeof input === "string" ? input : decoder.decode(input), {
      alphabet: "base64url"
    });
  }
  let encoded = input;
  if (encoded instanceof Uint8Array) {
    encoded = decoder.decode(encoded);
  }
  encoded = encoded.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  try {
    return decodeBase64(encoded);
  } catch {
    throw new TypeError("The input to be decoded is not correctly encoded.");
  }
}
__name(decode, "decode");
function encode(input) {
  let unencoded = input;
  if (typeof unencoded === "string") {
    unencoded = encoder.encode(unencoded);
  }
  if (Uint8Array.prototype.toBase64) {
    return unencoded.toBase64({ alphabet: "base64url", omitPadding: true });
  }
  return encodeBase64(unencoded).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
__name(encode, "encode");

// ../node_modules/jose/dist/webapi/util/errors.js
var JOSEError = class extends Error {
  static {
    __name(this, "JOSEError");
  }
  static code = "ERR_JOSE_GENERIC";
  code = "ERR_JOSE_GENERIC";
  constructor(message2, options) {
    super(message2, options);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
};
var JOSENotSupported = class extends JOSEError {
  static {
    __name(this, "JOSENotSupported");
  }
  static code = "ERR_JOSE_NOT_SUPPORTED";
  code = "ERR_JOSE_NOT_SUPPORTED";
};
var JWSInvalid = class extends JOSEError {
  static {
    __name(this, "JWSInvalid");
  }
  static code = "ERR_JWS_INVALID";
  code = "ERR_JWS_INVALID";
};
var JWTInvalid = class extends JOSEError {
  static {
    __name(this, "JWTInvalid");
  }
  static code = "ERR_JWT_INVALID";
  code = "ERR_JWT_INVALID";
};

// ../node_modules/jose/dist/webapi/lib/crypto_key.js
function unusable(name, prop = "algorithm.name") {
  return new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`);
}
__name(unusable, "unusable");
function isAlgorithm(algorithm, name) {
  return algorithm.name === name;
}
__name(isAlgorithm, "isAlgorithm");
function getHashLength(hash) {
  return parseInt(hash.name.slice(4), 10);
}
__name(getHashLength, "getHashLength");
function getNamedCurve(alg) {
  switch (alg) {
    case "ES256":
      return "P-256";
    case "ES384":
      return "P-384";
    case "ES512":
      return "P-521";
    default:
      throw new Error("unreachable");
  }
}
__name(getNamedCurve, "getNamedCurve");
function checkUsage(key, usage) {
  if (usage && !key.usages.includes(usage)) {
    throw new TypeError(`CryptoKey does not support this operation, its usages must include ${usage}.`);
  }
}
__name(checkUsage, "checkUsage");
function checkSigCryptoKey(key, alg, usage) {
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512": {
      if (!isAlgorithm(key.algorithm, "HMAC"))
        throw unusable("HMAC");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "RS256":
    case "RS384":
    case "RS512": {
      if (!isAlgorithm(key.algorithm, "RSASSA-PKCS1-v1_5"))
        throw unusable("RSASSA-PKCS1-v1_5");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "PS256":
    case "PS384":
    case "PS512": {
      if (!isAlgorithm(key.algorithm, "RSA-PSS"))
        throw unusable("RSA-PSS");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "Ed25519":
    case "EdDSA": {
      if (!isAlgorithm(key.algorithm, "Ed25519"))
        throw unusable("Ed25519");
      break;
    }
    case "ES256":
    case "ES384":
    case "ES512": {
      if (!isAlgorithm(key.algorithm, "ECDSA"))
        throw unusable("ECDSA");
      const expected = getNamedCurve(alg);
      const actual = key.algorithm.namedCurve;
      if (actual !== expected)
        throw unusable(expected, "algorithm.namedCurve");
      break;
    }
    default:
      throw new TypeError("CryptoKey does not support this operation");
  }
  checkUsage(key, usage);
}
__name(checkSigCryptoKey, "checkSigCryptoKey");

// ../node_modules/jose/dist/webapi/lib/invalid_key_input.js
function message(msg, actual, ...types) {
  types = types.filter(Boolean);
  if (types.length > 2) {
    const last = types.pop();
    msg += `one of type ${types.join(", ")}, or ${last}.`;
  } else if (types.length === 2) {
    msg += `one of type ${types[0]} or ${types[1]}.`;
  } else {
    msg += `of type ${types[0]}.`;
  }
  if (actual == null) {
    msg += ` Received ${actual}`;
  } else if (typeof actual === "function" && actual.name) {
    msg += ` Received function ${actual.name}`;
  } else if (typeof actual === "object" && actual != null) {
    if (actual.constructor?.name) {
      msg += ` Received an instance of ${actual.constructor.name}`;
    }
  }
  return msg;
}
__name(message, "message");
var invalid_key_input_default = /* @__PURE__ */ __name((actual, ...types) => {
  return message("Key must be ", actual, ...types);
}, "default");
function withAlg(alg, actual, ...types) {
  return message(`Key for the ${alg} algorithm must be `, actual, ...types);
}
__name(withAlg, "withAlg");

// ../node_modules/jose/dist/webapi/lib/is_key_like.js
function isCryptoKey(key) {
  return key?.[Symbol.toStringTag] === "CryptoKey";
}
__name(isCryptoKey, "isCryptoKey");
function isKeyObject(key) {
  return key?.[Symbol.toStringTag] === "KeyObject";
}
__name(isKeyObject, "isKeyObject");
var is_key_like_default = /* @__PURE__ */ __name((key) => {
  return isCryptoKey(key) || isKeyObject(key);
}, "default");

// ../node_modules/jose/dist/webapi/lib/is_disjoint.js
var is_disjoint_default = /* @__PURE__ */ __name((...headers) => {
  const sources = headers.filter(Boolean);
  if (sources.length === 0 || sources.length === 1) {
    return true;
  }
  let acc;
  for (const header of sources) {
    const parameters = Object.keys(header);
    if (!acc || acc.size === 0) {
      acc = new Set(parameters);
      continue;
    }
    for (const parameter of parameters) {
      if (acc.has(parameter)) {
        return false;
      }
      acc.add(parameter);
    }
  }
  return true;
}, "default");

// ../node_modules/jose/dist/webapi/lib/is_object.js
function isObjectLike(value) {
  return typeof value === "object" && value !== null;
}
__name(isObjectLike, "isObjectLike");
var is_object_default = /* @__PURE__ */ __name((input) => {
  if (!isObjectLike(input) || Object.prototype.toString.call(input) !== "[object Object]") {
    return false;
  }
  if (Object.getPrototypeOf(input) === null) {
    return true;
  }
  let proto = input;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(input) === proto;
}, "default");

// ../node_modules/jose/dist/webapi/lib/check_key_length.js
var check_key_length_default = /* @__PURE__ */ __name((alg, key) => {
  if (alg.startsWith("RS") || alg.startsWith("PS")) {
    const { modulusLength } = key.algorithm;
    if (typeof modulusLength !== "number" || modulusLength < 2048) {
      throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
    }
  }
}, "default");

// ../node_modules/jose/dist/webapi/lib/jwk_to_key.js
function subtleMapping(jwk) {
  let algorithm;
  let keyUsages;
  switch (jwk.kty) {
    case "RSA": {
      switch (jwk.alg) {
        case "PS256":
        case "PS384":
        case "PS512":
          algorithm = { name: "RSA-PSS", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RS256":
        case "RS384":
        case "RS512":
          algorithm = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RSA-OAEP":
        case "RSA-OAEP-256":
        case "RSA-OAEP-384":
        case "RSA-OAEP-512":
          algorithm = {
            name: "RSA-OAEP",
            hash: `SHA-${parseInt(jwk.alg.slice(-3), 10) || 1}`
          };
          keyUsages = jwk.d ? ["decrypt", "unwrapKey"] : ["encrypt", "wrapKey"];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "EC": {
      switch (jwk.alg) {
        case "ES256":
          algorithm = { name: "ECDSA", namedCurve: "P-256" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ES384":
          algorithm = { name: "ECDSA", namedCurve: "P-384" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ES512":
          algorithm = { name: "ECDSA", namedCurve: "P-521" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: "ECDH", namedCurve: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "OKP": {
      switch (jwk.alg) {
        case "Ed25519":
        case "EdDSA":
          algorithm = { name: "Ed25519" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    default:
      throw new JOSENotSupported('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
  }
  return { algorithm, keyUsages };
}
__name(subtleMapping, "subtleMapping");
var jwk_to_key_default = /* @__PURE__ */ __name(async (jwk) => {
  if (!jwk.alg) {
    throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
  }
  const { algorithm, keyUsages } = subtleMapping(jwk);
  const keyData = { ...jwk };
  delete keyData.alg;
  delete keyData.use;
  return crypto.subtle.importKey("jwk", keyData, algorithm, jwk.ext ?? (jwk.d ? false : true), jwk.key_ops ?? keyUsages);
}, "default");

// ../node_modules/jose/dist/webapi/lib/validate_crit.js
var validate_crit_default = /* @__PURE__ */ __name((Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) => {
  if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0) {
    throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
  }
  if (!protectedHeader || protectedHeader.crit === void 0) {
    return /* @__PURE__ */ new Set();
  }
  if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input !== "string" || input.length === 0)) {
    throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  }
  let recognized;
  if (recognizedOption !== void 0) {
    recognized = new Map([...Object.entries(recognizedOption), ...recognizedDefault.entries()]);
  } else {
    recognized = recognizedDefault;
  }
  for (const parameter of protectedHeader.crit) {
    if (!recognized.has(parameter)) {
      throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
    }
    if (joseHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" is missing`);
    }
    if (recognized.get(parameter) && protectedHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
    }
  }
  return new Set(protectedHeader.crit);
}, "default");

// ../node_modules/jose/dist/webapi/lib/is_jwk.js
function isJWK(key) {
  return is_object_default(key) && typeof key.kty === "string";
}
__name(isJWK, "isJWK");
function isPrivateJWK(key) {
  return key.kty !== "oct" && typeof key.d === "string";
}
__name(isPrivateJWK, "isPrivateJWK");
function isPublicJWK(key) {
  return key.kty !== "oct" && typeof key.d === "undefined";
}
__name(isPublicJWK, "isPublicJWK");
function isSecretJWK(key) {
  return key.kty === "oct" && typeof key.k === "string";
}
__name(isSecretJWK, "isSecretJWK");

// ../node_modules/jose/dist/webapi/lib/normalize_key.js
var cache;
var handleJWK = /* @__PURE__ */ __name(async (key, jwk, alg, freeze = false) => {
  cache ||= /* @__PURE__ */ new WeakMap();
  let cached = cache.get(key);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const cryptoKey = await jwk_to_key_default({ ...jwk, alg });
  if (freeze)
    Object.freeze(key);
  if (!cached) {
    cache.set(key, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
}, "handleJWK");
var handleKeyObject = /* @__PURE__ */ __name((keyObject, alg) => {
  cache ||= /* @__PURE__ */ new WeakMap();
  let cached = cache.get(keyObject);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const isPublic = keyObject.type === "public";
  const extractable = isPublic ? true : false;
  let cryptoKey;
  if (keyObject.asymmetricKeyType === "x25519") {
    switch (alg) {
      case "ECDH-ES":
      case "ECDH-ES+A128KW":
      case "ECDH-ES+A192KW":
      case "ECDH-ES+A256KW":
        break;
      default:
        throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, isPublic ? [] : ["deriveBits"]);
  }
  if (keyObject.asymmetricKeyType === "ed25519") {
    if (alg !== "EdDSA" && alg !== "Ed25519") {
      throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, [
      isPublic ? "verify" : "sign"
    ]);
  }
  if (keyObject.asymmetricKeyType === "rsa") {
    let hash;
    switch (alg) {
      case "RSA-OAEP":
        hash = "SHA-1";
        break;
      case "RS256":
      case "PS256":
      case "RSA-OAEP-256":
        hash = "SHA-256";
        break;
      case "RS384":
      case "PS384":
      case "RSA-OAEP-384":
        hash = "SHA-384";
        break;
      case "RS512":
      case "PS512":
      case "RSA-OAEP-512":
        hash = "SHA-512";
        break;
      default:
        throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    if (alg.startsWith("RSA-OAEP")) {
      return keyObject.toCryptoKey({
        name: "RSA-OAEP",
        hash
      }, extractable, isPublic ? ["encrypt"] : ["decrypt"]);
    }
    cryptoKey = keyObject.toCryptoKey({
      name: alg.startsWith("PS") ? "RSA-PSS" : "RSASSA-PKCS1-v1_5",
      hash
    }, extractable, [isPublic ? "verify" : "sign"]);
  }
  if (keyObject.asymmetricKeyType === "ec") {
    const nist = /* @__PURE__ */ new Map([
      ["prime256v1", "P-256"],
      ["secp384r1", "P-384"],
      ["secp521r1", "P-521"]
    ]);
    const namedCurve = nist.get(keyObject.asymmetricKeyDetails?.namedCurve);
    if (!namedCurve) {
      throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    if (alg === "ES256" && namedCurve === "P-256") {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDSA",
        namedCurve
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (alg === "ES384" && namedCurve === "P-384") {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDSA",
        namedCurve
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (alg === "ES512" && namedCurve === "P-521") {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDSA",
        namedCurve
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (alg.startsWith("ECDH-ES")) {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDH",
        namedCurve
      }, extractable, isPublic ? [] : ["deriveBits"]);
    }
  }
  if (!cryptoKey) {
    throw new TypeError("given KeyObject instance cannot be used for this algorithm");
  }
  if (!cached) {
    cache.set(keyObject, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
}, "handleKeyObject");
var normalize_key_default = /* @__PURE__ */ __name(async (key, alg) => {
  if (key instanceof Uint8Array) {
    return key;
  }
  if (isCryptoKey(key)) {
    return key;
  }
  if (isKeyObject(key)) {
    if (key.type === "secret") {
      return key.export();
    }
    if ("toCryptoKey" in key && typeof key.toCryptoKey === "function") {
      try {
        return handleKeyObject(key, alg);
      } catch (err) {
        if (err instanceof TypeError) {
          throw err;
        }
      }
    }
    let jwk = key.export({ format: "jwk" });
    return handleJWK(key, jwk, alg);
  }
  if (isJWK(key)) {
    if (key.k) {
      return decode(key.k);
    }
    return handleJWK(key, key, alg, true);
  }
  throw new Error("unreachable");
}, "default");

// ../node_modules/jose/dist/webapi/lib/check_key_type.js
var tag = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag], "tag");
var jwkMatchesOp = /* @__PURE__ */ __name((alg, key, usage) => {
  if (key.use !== void 0) {
    let expected;
    switch (usage) {
      case "sign":
      case "verify":
        expected = "sig";
        break;
      case "encrypt":
      case "decrypt":
        expected = "enc";
        break;
    }
    if (key.use !== expected) {
      throw new TypeError(`Invalid key for this operation, its "use" must be "${expected}" when present`);
    }
  }
  if (key.alg !== void 0 && key.alg !== alg) {
    throw new TypeError(`Invalid key for this operation, its "alg" must be "${alg}" when present`);
  }
  if (Array.isArray(key.key_ops)) {
    let expectedKeyOp;
    switch (true) {
      case (usage === "sign" || usage === "verify"):
      case alg === "dir":
      case alg.includes("CBC-HS"):
        expectedKeyOp = usage;
        break;
      case alg.startsWith("PBES2"):
        expectedKeyOp = "deriveBits";
        break;
      case /^A\d{3}(?:GCM)?(?:KW)?$/.test(alg):
        if (!alg.includes("GCM") && alg.endsWith("KW")) {
          expectedKeyOp = usage === "encrypt" ? "wrapKey" : "unwrapKey";
        } else {
          expectedKeyOp = usage;
        }
        break;
      case (usage === "encrypt" && alg.startsWith("RSA")):
        expectedKeyOp = "wrapKey";
        break;
      case usage === "decrypt":
        expectedKeyOp = alg.startsWith("RSA") ? "unwrapKey" : "deriveBits";
        break;
    }
    if (expectedKeyOp && key.key_ops?.includes?.(expectedKeyOp) === false) {
      throw new TypeError(`Invalid key for this operation, its "key_ops" must include "${expectedKeyOp}" when present`);
    }
  }
  return true;
}, "jwkMatchesOp");
var symmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage) => {
  if (key instanceof Uint8Array)
    return;
  if (isJWK(key)) {
    if (isSecretJWK(key) && jwkMatchesOp(alg, key, usage))
      return;
    throw new TypeError(`JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present`);
  }
  if (!is_key_like_default(key)) {
    throw new TypeError(withAlg(alg, key, "CryptoKey", "KeyObject", "JSON Web Key", "Uint8Array"));
  }
  if (key.type !== "secret") {
    throw new TypeError(`${tag(key)} instances for symmetric algorithms must be of type "secret"`);
  }
}, "symmetricTypeCheck");
var asymmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage) => {
  if (isJWK(key)) {
    switch (usage) {
      case "decrypt":
      case "sign":
        if (isPrivateJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation be a private JWK`);
      case "encrypt":
      case "verify":
        if (isPublicJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation be a public JWK`);
    }
  }
  if (!is_key_like_default(key)) {
    throw new TypeError(withAlg(alg, key, "CryptoKey", "KeyObject", "JSON Web Key"));
  }
  if (key.type === "secret") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithms must not be of type "secret"`);
  }
  if (key.type === "public") {
    switch (usage) {
      case "sign":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm signing must be of type "private"`);
      case "decrypt":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm decryption must be of type "private"`);
      default:
        break;
    }
  }
  if (key.type === "private") {
    switch (usage) {
      case "verify":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm verifying must be of type "public"`);
      case "encrypt":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm encryption must be of type "public"`);
      default:
        break;
    }
  }
}, "asymmetricTypeCheck");
var check_key_type_default = /* @__PURE__ */ __name((alg, key, usage) => {
  const symmetric = alg.startsWith("HS") || alg === "dir" || alg.startsWith("PBES2") || /^A(?:128|192|256)(?:GCM)?(?:KW)?$/.test(alg) || /^A(?:128|192|256)CBC-HS(?:256|384|512)$/.test(alg);
  if (symmetric) {
    symmetricTypeCheck(alg, key, usage);
  } else {
    asymmetricTypeCheck(alg, key, usage);
  }
}, "default");

// ../node_modules/jose/dist/webapi/lib/subtle_dsa.js
var subtle_dsa_default = /* @__PURE__ */ __name((alg, algorithm) => {
  const hash = `SHA-${alg.slice(-3)}`;
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512":
      return { hash, name: "HMAC" };
    case "PS256":
    case "PS384":
    case "PS512":
      return { hash, name: "RSA-PSS", saltLength: parseInt(alg.slice(-3), 10) >> 3 };
    case "RS256":
    case "RS384":
    case "RS512":
      return { hash, name: "RSASSA-PKCS1-v1_5" };
    case "ES256":
    case "ES384":
    case "ES512":
      return { hash, name: "ECDSA", namedCurve: algorithm.namedCurve };
    case "Ed25519":
    case "EdDSA":
      return { name: "Ed25519" };
    default:
      throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  }
}, "default");

// ../node_modules/jose/dist/webapi/lib/get_sign_verify_key.js
var get_sign_verify_key_default = /* @__PURE__ */ __name(async (alg, key, usage) => {
  if (key instanceof Uint8Array) {
    if (!alg.startsWith("HS")) {
      throw new TypeError(invalid_key_input_default(key, "CryptoKey", "KeyObject", "JSON Web Key"));
    }
    return crypto.subtle.importKey("raw", key, { hash: `SHA-${alg.slice(-3)}`, name: "HMAC" }, false, [usage]);
  }
  checkSigCryptoKey(key, alg, usage);
  return key;
}, "default");

// ../node_modules/jose/dist/webapi/lib/epoch.js
var epoch_default = /* @__PURE__ */ __name((date) => Math.floor(date.getTime() / 1e3), "default");

// ../node_modules/jose/dist/webapi/lib/secs.js
var minute = 60;
var hour = minute * 60;
var day = hour * 24;
var week = day * 7;
var year = day * 365.25;
var REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
var secs_default = /* @__PURE__ */ __name((str) => {
  const matched = REGEX.exec(str);
  if (!matched || matched[4] && matched[1]) {
    throw new TypeError("Invalid time period format");
  }
  const value = parseFloat(matched[2]);
  const unit = matched[3].toLowerCase();
  let numericDate;
  switch (unit) {
    case "sec":
    case "secs":
    case "second":
    case "seconds":
    case "s":
      numericDate = Math.round(value);
      break;
    case "minute":
    case "minutes":
    case "min":
    case "mins":
    case "m":
      numericDate = Math.round(value * minute);
      break;
    case "hour":
    case "hours":
    case "hr":
    case "hrs":
    case "h":
      numericDate = Math.round(value * hour);
      break;
    case "day":
    case "days":
    case "d":
      numericDate = Math.round(value * day);
      break;
    case "week":
    case "weeks":
    case "w":
      numericDate = Math.round(value * week);
      break;
    default:
      numericDate = Math.round(value * year);
      break;
  }
  if (matched[1] === "-" || matched[4] === "ago") {
    return -numericDate;
  }
  return numericDate;
}, "default");

// ../node_modules/jose/dist/webapi/lib/jwt_claims_set.js
function validateInput(label, input) {
  if (!Number.isFinite(input)) {
    throw new TypeError(`Invalid ${label} input`);
  }
  return input;
}
__name(validateInput, "validateInput");
var JWTClaimsBuilder = class {
  static {
    __name(this, "JWTClaimsBuilder");
  }
  #payload;
  constructor(payload) {
    if (!is_object_default(payload)) {
      throw new TypeError("JWT Claims Set MUST be an object");
    }
    this.#payload = structuredClone(payload);
  }
  data() {
    return encoder.encode(JSON.stringify(this.#payload));
  }
  get iss() {
    return this.#payload.iss;
  }
  set iss(value) {
    this.#payload.iss = value;
  }
  get sub() {
    return this.#payload.sub;
  }
  set sub(value) {
    this.#payload.sub = value;
  }
  get aud() {
    return this.#payload.aud;
  }
  set aud(value) {
    this.#payload.aud = value;
  }
  set jti(value) {
    this.#payload.jti = value;
  }
  set nbf(value) {
    if (typeof value === "number") {
      this.#payload.nbf = validateInput("setNotBefore", value);
    } else if (value instanceof Date) {
      this.#payload.nbf = validateInput("setNotBefore", epoch_default(value));
    } else {
      this.#payload.nbf = epoch_default(/* @__PURE__ */ new Date()) + secs_default(value);
    }
  }
  set exp(value) {
    if (typeof value === "number") {
      this.#payload.exp = validateInput("setExpirationTime", value);
    } else if (value instanceof Date) {
      this.#payload.exp = validateInput("setExpirationTime", epoch_default(value));
    } else {
      this.#payload.exp = epoch_default(/* @__PURE__ */ new Date()) + secs_default(value);
    }
  }
  set iat(value) {
    if (typeof value === "undefined") {
      this.#payload.iat = epoch_default(/* @__PURE__ */ new Date());
    } else if (value instanceof Date) {
      this.#payload.iat = validateInput("setIssuedAt", epoch_default(value));
    } else if (typeof value === "string") {
      this.#payload.iat = validateInput("setIssuedAt", epoch_default(/* @__PURE__ */ new Date()) + secs_default(value));
    } else {
      this.#payload.iat = validateInput("setIssuedAt", value);
    }
  }
};

// ../node_modules/jose/dist/webapi/lib/sign.js
var sign_default = /* @__PURE__ */ __name(async (alg, key, data) => {
  const cryptoKey = await get_sign_verify_key_default(alg, key, "sign");
  check_key_length_default(alg, cryptoKey);
  const signature = await crypto.subtle.sign(subtle_dsa_default(alg, cryptoKey.algorithm), cryptoKey, data);
  return new Uint8Array(signature);
}, "default");

// ../node_modules/jose/dist/webapi/jws/flattened/sign.js
var FlattenedSign = class {
  static {
    __name(this, "FlattenedSign");
  }
  #payload;
  #protectedHeader;
  #unprotectedHeader;
  constructor(payload) {
    if (!(payload instanceof Uint8Array)) {
      throw new TypeError("payload must be an instance of Uint8Array");
    }
    this.#payload = payload;
  }
  setProtectedHeader(protectedHeader) {
    if (this.#protectedHeader) {
      throw new TypeError("setProtectedHeader can only be called once");
    }
    this.#protectedHeader = protectedHeader;
    return this;
  }
  setUnprotectedHeader(unprotectedHeader) {
    if (this.#unprotectedHeader) {
      throw new TypeError("setUnprotectedHeader can only be called once");
    }
    this.#unprotectedHeader = unprotectedHeader;
    return this;
  }
  async sign(key, options) {
    if (!this.#protectedHeader && !this.#unprotectedHeader) {
      throw new JWSInvalid("either setProtectedHeader or setUnprotectedHeader must be called before #sign()");
    }
    if (!is_disjoint_default(this.#protectedHeader, this.#unprotectedHeader)) {
      throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
    }
    const joseHeader = {
      ...this.#protectedHeader,
      ...this.#unprotectedHeader
    };
    const extensions = validate_crit_default(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, this.#protectedHeader, joseHeader);
    let b64 = true;
    if (extensions.has("b64")) {
      b64 = this.#protectedHeader.b64;
      if (typeof b64 !== "boolean") {
        throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
      }
    }
    const { alg } = joseHeader;
    if (typeof alg !== "string" || !alg) {
      throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
    }
    check_key_type_default(alg, key, "sign");
    let payload = this.#payload;
    if (b64) {
      payload = encoder.encode(encode(payload));
    }
    let protectedHeader;
    if (this.#protectedHeader) {
      protectedHeader = encoder.encode(encode(JSON.stringify(this.#protectedHeader)));
    } else {
      protectedHeader = encoder.encode("");
    }
    const data = concat(protectedHeader, encoder.encode("."), payload);
    const k = await normalize_key_default(key, alg);
    const signature = await sign_default(alg, k, data);
    const jws = {
      signature: encode(signature),
      payload: ""
    };
    if (b64) {
      jws.payload = decoder.decode(payload);
    }
    if (this.#unprotectedHeader) {
      jws.header = this.#unprotectedHeader;
    }
    if (this.#protectedHeader) {
      jws.protected = decoder.decode(protectedHeader);
    }
    return jws;
  }
};

// ../node_modules/jose/dist/webapi/jws/compact/sign.js
var CompactSign = class {
  static {
    __name(this, "CompactSign");
  }
  #flattened;
  constructor(payload) {
    this.#flattened = new FlattenedSign(payload);
  }
  setProtectedHeader(protectedHeader) {
    this.#flattened.setProtectedHeader(protectedHeader);
    return this;
  }
  async sign(key, options) {
    const jws = await this.#flattened.sign(key, options);
    if (jws.payload === void 0) {
      throw new TypeError("use the flattened module for creating JWS with b64: false");
    }
    return `${jws.protected}.${jws.payload}.${jws.signature}`;
  }
};

// ../node_modules/jose/dist/webapi/jwt/sign.js
var SignJWT = class {
  static {
    __name(this, "SignJWT");
  }
  #protectedHeader;
  #jwt;
  constructor(payload = {}) {
    this.#jwt = new JWTClaimsBuilder(payload);
  }
  setIssuer(issuer) {
    this.#jwt.iss = issuer;
    return this;
  }
  setSubject(subject) {
    this.#jwt.sub = subject;
    return this;
  }
  setAudience(audience) {
    this.#jwt.aud = audience;
    return this;
  }
  setJti(jwtId) {
    this.#jwt.jti = jwtId;
    return this;
  }
  setNotBefore(input) {
    this.#jwt.nbf = input;
    return this;
  }
  setExpirationTime(input) {
    this.#jwt.exp = input;
    return this;
  }
  setIssuedAt(input) {
    this.#jwt.iat = input;
    return this;
  }
  setProtectedHeader(protectedHeader) {
    this.#protectedHeader = protectedHeader;
    return this;
  }
  async sign(key, options) {
    const sig = new CompactSign(this.#jwt.data());
    sig.setProtectedHeader(this.#protectedHeader);
    if (Array.isArray(this.#protectedHeader?.crit) && this.#protectedHeader.crit.includes("b64") && this.#protectedHeader.b64 === false) {
      throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
    }
    return sig.sign(key, options);
  }
};

// index.js
function addCorsHeaders(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}
__name(addCorsHeaders, "addCorsHeaders");
function getUserFromSession(request, env) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { loggedIn: false };
    }
    const token = authHeader.substring(7);
    if (token && token.length > 10) {
      return {
        loggedIn: true,
        user_id: "9999",
        // Default test user ID
        email: "test@example.com",
        username: "testuser",
        displayName: "Test User"
      };
    }
    return { loggedIn: false };
  } catch (error) {
    console.error("Error getting user from session:", error);
    return { loggedIn: false };
  }
}
__name(getUserFromSession, "getUserFromSession");
var index_default = {
  async fetch(request, env) {
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
        const userRole = url.searchParams.get("role") || "ViewOnly";
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
          const userData = userRole === "subscriber" ? {
            profile: {
              user_id: userId,
              email: userEmail
            },
            settings: {
              darkMode: false,
              notifications: true,
              theme: "light"
            },
            subscriptions: []
            // Will be populated after verification by subscription-worker
          } : {};
          const insertQuery = `
            INSERT INTO config (user_id, email, emailVerificationToken, data, role)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(email) DO NOTHING;
          `;
          console.log(
            "Executing registration query:",
            insertQuery,
            "with parameters:",
            userId,
            userEmail,
            "NULL",
            // emailVerificationToken is NULL during registration, filled during verification
            JSON.stringify(userData),
            userRole
          );
          const { changes } = await db.prepare(insertQuery).bind(userId, userEmail, null, JSON.stringify(userData), userRole).run();
          if (changes === 0) {
            console.log("User already exists - no database changes made");
          } else {
            console.log(
              `Successfully created new user: user_id=${userId}, email=${userEmail}, role=${userRole}`
            );
          }
        } catch (dbError) {
          console.error("Error inserting user record into database:", dbError);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Failed to create user record in database." }), {
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
      if (path === "/verify-email" && method === "GET") {
        console.log("Received GET /verify-email request");
        const emailToken = url.searchParams.get("token");
        if (!emailToken) {
          console.error("Error in GET /verify-email: Missing token parameter");
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Missing token parameter" }), { status: 400 })
          );
        }
        try {
          console.log("Sending request to external verification API with token:", emailToken);
          const verifyResponse = await fetch(
            `https://slowyou.io/api/verify-email?token=${emailToken}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json"
              }
            }
          );
          console.log("External API response status:", verifyResponse.status);
          if (!verifyResponse.ok) {
            console.error(
              `Error from external API: ${verifyResponse.status} ${verifyResponse.statusText}`
            );
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: `Failed to verify email. External API returned status ${verifyResponse.status}.`
                }),
                { status: 500 }
              )
            );
          }
          const rawBody = await verifyResponse.text();
          console.log("Response body from external API:", rawBody);
          let parsedBody;
          try {
            parsedBody = JSON.parse(rawBody);
          } catch (parseError) {
            console.error("Error parsing response body:", parseError);
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: "Failed to parse response from external API." }),
                { status: 500 }
              )
            );
          }
          if (parsedBody.message === "Email verified successfully." && parsedBody.emailVerificationToken) {
            const db = env.vegvisr_org;
            try {
              const existingUserQuery = `
                SELECT emailVerificationToken
                FROM config
                WHERE email = ?;
              `;
              console.log("Checking if user exists in the database with query:", existingUserQuery);
              const existingUser = await db.prepare(existingUserQuery).bind(parsedBody.email).first();
              if (existingUser) {
                console.log(`User with email=${parsedBody.email} already exists in the database`);
                const updateQuery = `
                  UPDATE config
                  SET emailVerificationToken = ?
                  WHERE email = ?;
                `;
                console.log(
                  "Executing update query:",
                  updateQuery,
                  "with parameters:",
                  parsedBody.emailVerificationToken,
                  parsedBody.email
                );
                const updateResult = await db.prepare(updateQuery).bind(parsedBody.emailVerificationToken, parsedBody.email).run();
                console.log("Update result:", updateResult);
                if (updateResult.changes === 0) {
                  console.warn(
                    `No rows were updated for email=${parsedBody.email}. This might indicate an issue.`
                  );
                }
                console.log(
                  `Successfully updated emailVerificationToken for email=${parsedBody.email} (role preserved)`
                );
              } else {
                console.log(`Creating new user with email=${parsedBody.email}`);
                const userId = v4_default();
                const insertQuery = `
                  INSERT INTO config (user_id, email, emailVerificationToken, data, role)
                  VALUES (?, ?, ?, ?, ?);
                `;
                const insertResult = await db.prepare(insertQuery).bind(
                  userId,
                  parsedBody.email,
                  parsedBody.emailVerificationToken,
                  JSON.stringify({}),
                  "ViewOnly"
                ).run();
                if (insertResult.changes === 0) {
                  console.error(`Failed to create new user for email=${parsedBody.email}`);
                  return addCorsHeaders(
                    new Response(JSON.stringify({ error: "Failed to create user in database." }), {
                      status: 500
                    })
                  );
                }
                console.log(`Successfully created new user for email=${parsedBody.email}`);
              }
              const jwtSecret = new TextEncoder().encode(env.JWT_SECRET);
              const jwtToken = await new SignJWT({
                emailVerificationToken: parsedBody.emailVerificationToken
              }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("730d").sign(jwtSecret);
              console.log("Generated JWT Token:", jwtToken);
              return addCorsHeaders(
                new Response(null, {
                  status: 302,
                  headers: {
                    Location: `https://www.vegvisr.org/login?email=${encodeURIComponent(
                      parsedBody.email
                    )}&token=${encodeURIComponent(jwtToken)}`
                  }
                })
              );
            } catch (dbError) {
              console.error("Error updating emailVerificationToken in database:", dbError);
              return addCorsHeaders(
                new Response(
                  JSON.stringify({
                    error: "Failed to update emailVerificationToken in database.",
                    details: dbError.message
                  }),
                  { status: 500 }
                )
              );
            }
          }
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                status: verifyResponse.status,
                ok: verifyResponse.ok,
                body: parsedBody
              }),
              { status: 200 }
            )
          );
        } catch (error) {
          console.error("Error fetching from external API:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: "Failed to contact verification API. Please try again later."
              }),
              { status: 500 }
            )
          );
        }
      }
      if (path === "/check-email" && method === "GET") {
        console.log("Received GET /check-email request");
        const userEmail = url.searchParams.get("email");
        if (!userEmail) {
          console.error("Error in GET /check-email: Missing email parameter");
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Missing email parameter" }), { status: 400 })
          );
        }
        const db = env.vegvisr_org;
        try {
          const queryVerified = `
            SELECT user_id
            FROM config
            WHERE email = ? AND emailVerificationToken IS NOT NULL;
          `;
          const verifiedUser = await db.prepare(queryVerified).bind(userEmail).first();
          if (verifiedUser) {
            console.log(`User with email ${userEmail} is registered and verified`);
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  exists: true,
                  verified: true,
                  user_id: verifiedUser.user_id
                }),
                { status: 200 }
              )
            );
          }
          const queryNotVerified = `
            SELECT user_id
            FROM config
            WHERE email = ? AND emailVerificationToken IS NULL;
          `;
          const notVerifiedUser = await db.prepare(queryNotVerified).bind(userEmail).first();
          if (notVerifiedUser) {
            console.log(`User with email ${userEmail} is registered but not verified`);
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  exists: true,
                  verified: false,
                  user_id: notVerifiedUser.user_id
                }),
                { status: 200 }
              )
            );
          }
          console.log(`User with email ${userEmail} does not exist in the database`);
          return addCorsHeaders(
            new Response(JSON.stringify({ exists: false, verified: false }), { status: 200 })
          );
        } catch (dbError) {
          console.error("Error checking for existing user in database:", dbError);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Failed to check database for existing user." }), {
              status: 500
            })
          );
        }
      }
      if (path === "/reset-registration" && method === "POST") {
        console.log("Received POST /reset-registration request");
        const requestBody = await request.json();
        const userEmail = requestBody.email;
        if (!userEmail) {
          console.error("Error in POST /reset-registration: Missing email parameter");
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Missing email parameter" }), { status: 400 })
          );
        }
        const db = env.vegvisr_org;
        try {
          const deleteQuery = `
            DELETE FROM config
            WHERE email = ?;
          `;
          const deleteResult = await db.prepare(deleteQuery).bind(userEmail).run();
          console.log("Delete result:", deleteResult);
          if (deleteResult.changes > 0) {
            console.log(`User with email ${userEmail} deleted from the database`);
            return addCorsHeaders(
              new Response(JSON.stringify({ message: "User registration reset successfully." }), {
                status: 200
              })
            );
          } else {
            console.log(`User with email ${userEmail} not found in the database`);
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "User not found in the database." }), {
                status: 404
              })
            );
          }
        } catch (dbError) {
          console.error("Error deleting user from database:", dbError);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Failed to delete user from database." }), {
              status: 500
            })
          );
        }
      }
      if (path === "/set-jwt" && method === "GET") {
        console.log("Received GET /set-jwt request");
        const userEmail = url.searchParams.get("email");
        if (!userEmail) {
          console.error("Error in GET /set-jwt: Missing email parameter");
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Missing email parameter" }), { status: 400 })
          );
        }
        const db = env.vegvisr_org;
        try {
          const query = `
        SELECT emailVerificationToken
        FROM config
        WHERE email = ?;
          `;
          const userRecord = await db.prepare(query).bind(userEmail).first();
          if (!userRecord || !userRecord.emailVerificationToken) {
            console.error(`No valid emailVerificationToken found for email=${userEmail}`);
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: "No valid emailVerificationToken found for this email." }),
                { status: 404 }
              )
            );
          }
          const jwtSecret = new TextEncoder().encode(env.JWT_SECRET);
          const jwtToken = await new SignJWT({
            emailVerificationToken: userRecord.emailVerificationToken
          }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("730d").sign(jwtSecret);
          console.log("Generated JWT Token:", jwtToken);
          return addCorsHeaders(
            new Response(JSON.stringify({ jwt: jwtToken }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        } catch (dbError) {
          console.error("Error retrieving emailVerificationToken from database:", dbError);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: "Failed to retrieve emailVerificationToken from database." }),
              { status: 500 }
            )
          );
        }
      }
      if (path === "/github/issues" && method === "GET") {
        console.log("Received GET /github/issues request");
        try {
          const response = await fetch("https://www.slowyou.io/api/github/issues", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.GITHUB_TOKEN}`
            }
          });
          if (!response.ok) {
            console.error(`Error fetching GitHub issues: ${response.status} ${response.statusText}`);
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: `Failed to fetch GitHub issues. API returned status ${response.status}.`
                }),
                { status: response.status }
              )
            );
          }
          const issues = await response.json();
          return addCorsHeaders(
            new Response(JSON.stringify(issues), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        } catch (error) {
          console.error("Error fetching GitHub issues:", error);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Failed to fetch GitHub issues." }), {
              status: 500
            })
          );
        }
      }
      if (path === "/github/create-issue" && method === "POST") {
        console.log("Received POST /github/create-issue request");
        try {
          const requestBody = await request.json();
          const { title, body, labels } = requestBody;
          if (!title || !body) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "Title and body are required fields." }), {
                status: 400
              })
            );
          }
          const response = await fetch("https://www.slowyou.io/api/github/create-issue", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.GITHUB_TOKEN}`
            },
            body: JSON.stringify({
              title,
              body,
              labels: labels || []
            })
          });
          if (!response.ok) {
            console.error(`Error creating GitHub issue: ${response.status} ${response.statusText}`);
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: `Failed to create GitHub issue. API returned status ${response.status}.`
                }),
                { status: response.status }
              )
            );
          }
          const result = await response.json();
          return addCorsHeaders(
            new Response(JSON.stringify(result), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        } catch (error) {
          console.error("Error creating GitHub issue:", error);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Failed to create GitHub issue." }), {
              status: 500
            })
          );
        }
      }
      if (path === "/userdata" && method === "GET") {
        const url2 = new URL(request.url);
        const userEmail = url2.searchParams.get("email");
        if (!userEmail) {
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Missing email parameter" }), { status: 400 })
          );
        }
        const db = env.vegvisr_org;
        console.log("Fetching user data for email:", userEmail);
        const tableInfo = await db.prepare("PRAGMA table_info(config)").all();
        console.log("Table structure:", tableInfo);
        const hasBioColumn = tableInfo.results.some((col) => col.name === "bio");
        const hasProfileImageColumn = tableInfo.results.some((col) => col.name === "profileimage");
        const hasEmailVerificationTokenColumn = tableInfo.results.some(
          (col) => col.name === "emailVerificationToken"
        );
        const hasRoleColumn = tableInfo.results.some((col) => col.name === "role");
        try {
          if (!hasBioColumn) {
            console.log("Adding bio column to config table");
            await db.prepare("ALTER TABLE config ADD COLUMN bio TEXT").run();
          }
        } catch (e) {
          console.log("Bio column may already exist:", e.message);
        }
        try {
          if (!hasProfileImageColumn) {
            console.log("Adding profileimage column to config table");
            await db.prepare("ALTER TABLE config ADD COLUMN profileimage TEXT").run();
          }
        } catch (e) {
          console.log("Profileimage column may already exist:", e.message);
        }
        try {
          if (!hasEmailVerificationTokenColumn) {
            console.log("Adding emailVerificationToken column to config table");
            await db.prepare("ALTER TABLE config ADD COLUMN emailVerificationToken TEXT").run();
          }
        } catch (e) {
          console.log("EmailVerificationToken column may already exist:", e.message);
        }
        try {
          if (!hasRoleColumn) {
            console.log("Adding role column to config table");
            await db.prepare('ALTER TABLE config ADD COLUMN role TEXT DEFAULT "ViewOnly"').run();
          }
        } catch (e) {
          console.log("Role column may already exist:", e.message);
        }
        const query = `SELECT user_id, data, profileimage, emailVerificationToken, bio FROM config WHERE email = ?;`;
        const row = await db.prepare(query).bind(userEmail).first();
        console.log("Database row:", row);
        if (!row) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                email: userEmail,
                user_id: null,
                data: { profile: {}, settings: {} },
                profileimage: "",
                emailVerificationToken: null,
                bio: ""
              }),
              { status: 200 }
            )
          );
        }
        let parsedData = {};
        try {
          parsedData = JSON.parse(row.data);
        } catch (e) {
          console.error("Error parsing user data JSON:", e);
        }
        const mystmkraUserId = parsedData.profile && parsedData.profile.mystmkraUserId;
        console.log("Retrieved mystmkraUserId:", mystmkraUserId);
        const response = {
          email: userEmail,
          user_id: row.user_id,
          data: parsedData,
          profileimage: row.profileimage,
          emailVerificationToken: row.emailVerificationToken,
          bio: row.bio || ""
        };
        console.log("Sending response:", response);
        return addCorsHeaders(new Response(JSON.stringify(response), { status: 200 }));
      }
      if (path === "/userdata" && method === "PUT") {
        const db = env.vegvisr_org;
        const body = await request.json();
        console.log("\u{1F4E5} Received PUT /userdata request:", JSON.stringify(body, null, 2));
        console.log(
          "\u{1F50D} Checking for domainConfigs in body.data:",
          body.data?.domainConfigs ? "FOUND" : "NOT FOUND"
        );
        if (body.data?.domainConfigs) {
          console.log("\u{1F4CB} Domain configs array:", JSON.stringify(body.data.domainConfigs, null, 2));
        }
        const { email, bio, data, profileimage } = body;
        console.log("Bio from request:", bio);
        if (!email || !data || profileimage === void 0) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: "Missing required fields: email, data, or profileimage" }),
              { status: 400 }
            )
          );
        }
        if (typeof data !== "object" || !data.profile || !data.settings || typeof data.profile !== "object" || typeof data.settings !== "object") {
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Invalid data structure" }), { status: 400 })
          );
        }
        if (body.mystmkraUserId) {
          data.profile.mystmkraUserId = body.mystmkraUserId;
        }
        if (data.profile && data.profile.mystmkraUserId) {
        }
        console.log("Saving mystmkraUserId:", data.profile.mystmkraUserId);
        const dataJson = JSON.stringify(data);
        const tableInfo = await db.prepare("PRAGMA table_info(config)").all();
        console.log("Table structure:", tableInfo);
        const hasBioColumn = tableInfo.results.some((col) => col.name === "bio");
        const hasProfileImageColumn = tableInfo.results.some((col) => col.name === "profileimage");
        try {
          if (!hasBioColumn) {
            console.log("Adding bio column to config table");
            await db.prepare("ALTER TABLE config ADD COLUMN bio TEXT").run();
          }
        } catch (e) {
          console.log("Bio column may already exist:", e.message);
        }
        try {
          if (!hasProfileImageColumn) {
            console.log("Adding profileimage column to config table");
            await db.prepare("ALTER TABLE config ADD COLUMN profileimage TEXT").run();
          }
        } catch (e) {
          console.log("Profileimage column may already exist:", e.message);
        }
        const query = `
          INSERT INTO config (user_id, email, bio, data, profileimage)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET bio = ?, data = ?, profileimage = ?;
        `;
        console.log("Executing query with bio:", bio);
        const userId = data.profile?.user_id || v4_default();
        const result = await db.prepare(query).bind(userId, email, bio, dataJson, profileimage, bio, dataJson, profileimage).run();
        console.log("Query result:", result);
        if (data.domainConfigs && Array.isArray(data.domainConfigs)) {
          console.log(
            "\u{1F504} Processing multi-domain configurations:",
            data.domainConfigs.length,
            "domains"
          );
          console.log("\u{1F50D} Domain configs data:", JSON.stringify(data.domainConfigs, null, 2));
          for (const domainConfig of data.domainConfigs) {
            try {
              console.log(`\u{1F3D7}\uFE0F Processing domain: ${domainConfig.domain}`);
              let metaAreas = [];
              if (domainConfig.contentFilter === "custom" && domainConfig.selectedCategories) {
                metaAreas = domainConfig.selectedCategories;
                console.log(
                  `\u2705 Domain ${domainConfig.domain}: Using selected meta areas:`,
                  metaAreas
                );
              } else if (domainConfig.contentFilter === "none") {
                metaAreas = [];
                console.log(`\u2705 Domain ${domainConfig.domain}: No content filtering`);
              }
              const siteConfig = {
                domain: domainConfig.domain,
                owner: email,
                branding: {
                  mySite: domainConfig.domain,
                  myLogo: domainConfig.logo,
                  contentFilter: domainConfig.contentFilter,
                  selectedCategories: domainConfig.selectedCategories,
                  mySiteFrontPage: domainConfig.mySiteFrontPage
                },
                contentFilter: {
                  metaAreas
                },
                menuConfig: domainConfig.menuConfig || { enabled: false },
                updatedAt: (/* @__PURE__ */ new Date()).toISOString()
              };
              const kvKey = `site-config:${domainConfig.domain}`;
              console.log(`\u{1F4BE} Attempting to save to KV: ${kvKey}`);
              console.log(`\u{1F4CB} Site config data:`, JSON.stringify(siteConfig, null, 2));
              await env.SITE_CONFIGS.put(kvKey, JSON.stringify(siteConfig));
              console.log(
                `\u2705 Successfully saved domain config to KV: ${kvKey} with ${metaAreas.length} meta areas`
              );
              const verification = await env.SITE_CONFIGS.get(kvKey);
              if (verification) {
                console.log(`\u2705 KV verification successful for ${kvKey}`);
              } else {
                console.error(`\u274C KV verification failed for ${kvKey} - data not found after save`);
              }
            } catch (kvError) {
              console.error(`\u274C Error saving domain config for ${domainConfig.domain}:`, kvError);
              console.error(`\u274C KV Error details:`, kvError.message, kvError.stack);
            }
          }
        } else if (data.branding && data.branding.mySite) {
          try {
            let metaAreas = [];
            if (data.branding.contentFilter === "custom" && data.branding.selectedCategories) {
              metaAreas = data.branding.selectedCategories;
              console.log("Legacy: Using user-selected meta areas:", metaAreas);
            } else if (data.branding.contentFilter === "none") {
              metaAreas = [];
              console.log("Legacy: No content filtering");
            }
            const siteConfig = {
              domain: data.branding.mySite,
              owner: email,
              branding: {
                mySite: data.branding.mySite,
                myLogo: data.branding.myLogo,
                mySiteFrontPage: data.branding.mySiteFrontPage
              },
              contentFilter: {
                metaAreas
              },
              menuConfig: data.branding.menuConfig || { enabled: false },
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            };
            const kvKey = `site-config:${data.branding.mySite}`;
            await env.SITE_CONFIGS.put(kvKey, JSON.stringify(siteConfig));
            console.log(
              "Saved legacy site configuration to KV:",
              kvKey,
              "with metaAreas:",
              metaAreas
            );
          } catch (kvError) {
            console.error("Error saving legacy site config to KV:", kvError);
          }
        }
        return addCorsHeaders(
          new Response(
            JSON.stringify({ success: true, message: "User data updated successfully" }),
            { status: 200 }
          )
        );
      }
      if (path === "/site-config" && method === "PUT") {
        try {
          const body = await request.json();
          const { domain, owner, branding, contentFilter } = body;
          if (!domain || !owner || !branding) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: "Missing required fields: domain, owner, branding" }),
                { status: 400 }
              )
            );
          }
          const siteConfig = {
            domain,
            owner,
            branding,
            contentFilter: contentFilter || { metaAreas: [] },
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          const kvKey = `site-config:${domain}`;
          await env.SITE_CONFIGS.put(kvKey, JSON.stringify(siteConfig));
          console.log("Saved site configuration:", kvKey, siteConfig);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ success: true, message: "Site configuration saved successfully" }),
              { status: 200 }
            )
          );
        } catch (error) {
          console.error("Error saving site configuration:", error);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Failed to save site configuration" }), {
              status: 500
            })
          );
        }
      }
      if (path.startsWith("/site-config/") && method === "GET") {
        try {
          const domain = path.split("/site-config/")[1];
          if (!domain) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "Domain parameter is required" }), {
                status: 400
              })
            );
          }
          const kvKey = `site-config:${domain}`;
          const siteConfigData = await env.SITE_CONFIGS.get(kvKey);
          if (!siteConfigData) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "Site configuration not found" }), {
                status: 404
              })
            );
          }
          const siteConfig = JSON.parse(siteConfigData);
          console.log("Retrieved site configuration:", kvKey, siteConfig);
          return addCorsHeaders(new Response(JSON.stringify(siteConfig), { status: 200 }));
        } catch (error) {
          console.error("Error retrieving site configuration:", error);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Failed to retrieve site configuration" }), {
              status: 500
            })
          );
        }
      }
      if (path === "/main-logo" && method === "GET") {
        try {
          const logoUrl = env.MAIN_LOGO || "https://vegvisr.imgix.net/vegvisr-logo.png";
          console.log("Serving main logo URL:", logoUrl);
          return addCorsHeaders(
            new Response(JSON.stringify({ logoUrl }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        } catch (error) {
          console.error("Error retrieving main logo:", error);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: "Failed to retrieve main logo" }), {
              status: 500
            })
          );
        }
      }
      if (path === "/api/chat-rooms" && method === "GET") {
        const domain = url.searchParams.get("domain") || "vegvisr.org";
        try {
          console.log("Fetching chat rooms for domain:", domain);
          const result = await env.vegvisr_org.prepare(
            `
            SELECT
              scr.*,
              COUNT(srm.id) as member_count
            FROM site_chat_rooms scr
            LEFT JOIN site_room_members srm ON scr.room_id = srm.room_id AND srm.status = 'active'
            WHERE scr.domain_name = ? AND scr.room_status = 'active'
            GROUP BY scr.room_id
            ORDER BY scr.created_at DESC
          `
          ).bind(domain).all();
          console.log("Chat rooms query result:", result.results?.length || 0, "rooms found");
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                rooms: result.results || []
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error) {
          console.error("Error fetching chat rooms:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path === "/api/chat-rooms" && method === "POST") {
        try {
          const { roomName, description, roomType, createdBy, domain } = await request.json();
          if (!roomName || !roomType || !createdBy || !domain) {
            console.error("Missing required field(s) for chat room creation:", {
              roomName,
              roomType,
              createdBy,
              domain
            });
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Missing required field(s): roomName, roomType, createdBy, or domain."
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const roomId = `room_${Date.now()}`;
          console.log("Creating chat room:", {
            roomId,
            roomName,
            domain: domain || "vegvisr.org",
            createdBy
          });
          await env.vegvisr_org.prepare(
            `
            INSERT INTO site_chat_rooms
            (room_id, domain_name, room_name, room_description, room_type, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
          `
          ).bind(
            roomId,
            domain || "vegvisr.org",
            roomName,
            description,
            roomType || "public",
            createdBy
          ).run();
          const newRoom = {
            id: roomId,
            name: roomName,
            description,
            type: roomType || "public",
            domain: domain || "vegvisr.org",
            createdBy,
            memberCount: 1,
            created: (/* @__PURE__ */ new Date()).toISOString()
          };
          console.log("Chat room created successfully:", newRoom);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                room: newRoom
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error) {
          console.error("Error creating chat room:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path.startsWith("/api/chat-rooms/") && path.endsWith("/settings") && method === "GET") {
        try {
          console.log("\u{1F50D} [API] GET room settings endpoint called");
          console.log("\u{1F50D} [API] Full path:", path);
          console.log("\u{1F50D} [API] Method:", method);
          const roomId = path.split("/")[3];
          console.log("\u{1F50D} [API] Extracted roomId:", roomId);
          if (!roomId) {
            console.log("\u274C [API] No room ID provided");
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room ID is required"
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          console.log("\u{1F50D} [API] Querying database for room:", roomId);
          const result = await env.vegvisr_org.prepare("SELECT room_settings, room_name FROM site_chat_rooms WHERE room_id = ?").bind(roomId).first();
          console.log("\u{1F50D} [API] Database result:", JSON.stringify(result, null, 2));
          if (!result) {
            console.log("\u274C [API] Room not found in database");
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room not found"
                }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          let roomSettings = {};
          console.log("\u{1F50D} [API] Raw room_settings from DB:", result.room_settings);
          if (result.room_settings) {
            try {
              roomSettings = JSON.parse(result.room_settings);
              console.log(
                "\u2705 [API] Parsed room_settings successfully:",
                JSON.stringify(roomSettings, null, 2)
              );
            } catch (error) {
              console.error("\u274C [API] Error parsing room_settings JSON:", error);
              roomSettings = {};
            }
          } else {
            console.log("\u26A0\uFE0F [API] No room_settings found in database");
          }
          const response = {
            success: true,
            room_settings: roomSettings,
            room_name: result.room_name
          };
          console.log("\u2705 [API] Sending response:", JSON.stringify(response, null, 2));
          return addCorsHeaders(
            new Response(JSON.stringify(response), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        } catch (error) {
          console.error("Error loading room settings:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path.startsWith("/api/chat-rooms/") && path.endsWith("/settings") && method === "PUT") {
        try {
          const roomId = path.split("/")[3];
          if (!roomId) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room ID is required"
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const { room_settings } = await request.json();
          if (!room_settings) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "room_settings is required"
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          console.log("Updating room settings for:", roomId);
          console.log("New settings:", room_settings);
          const roomExists = await env.vegvisr_org.prepare("SELECT room_id FROM site_chat_rooms WHERE room_id = ?").bind(roomId).first();
          if (!roomExists) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room not found"
                }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          await env.vegvisr_org.prepare(
            "UPDATE site_chat_rooms SET room_settings = ?, updated_at = CURRENT_TIMESTAMP WHERE room_id = ?"
          ).bind(JSON.stringify(room_settings), roomId).run();
          console.log("Room settings updated successfully");
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: "Room settings updated successfully"
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error) {
          console.error("Error updating room settings:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path.startsWith("/api/chat-rooms/") && method === "DELETE") {
        try {
          const roomId = path.split("/")[3];
          if (!roomId) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room ID is required"
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const roomExists = await env.vegvisr_org.prepare("SELECT room_id FROM site_chat_rooms WHERE room_id = ?").bind(roomId).first();
          if (!roomExists) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room not found"
                }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          await env.vegvisr_org.prepare(
            "UPDATE site_chat_rooms SET room_status = ?, updated_at = CURRENT_TIMESTAMP WHERE room_id = ?"
          ).bind("disabled", roomId).run();
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: "Room deleted successfully",
                roomId
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path.startsWith("/api/chat-rooms/") && path.endsWith("/members") && method === "GET") {
        try {
          const roomId = path.split("/")[3];
          if (!roomId) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room ID is required"
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const membersResult = await env.vegvisr_org.prepare(
            `
              SELECT
                srm.id,
                srm.user_id,
                srm.role,
                srm.status,
                srm.joined_at,
                srm.last_activity,
                c.email as user_email,
                c.data as user_data
              FROM site_room_members srm
              LEFT JOIN config c ON srm.user_id = c.user_id
              WHERE srm.room_id = ? AND srm.status = 'active'
              ORDER BY
                CASE srm.role
                  WHEN 'owner' THEN 1
                  WHEN 'moderator' THEN 2
                  WHEN 'member' THEN 3
                END,
                srm.joined_at ASC
            `
          ).bind(roomId).all();
          const members = membersResult.results.map((member) => {
            let userData = {};
            try {
              if (member.user_data) {
                userData = JSON.parse(member.user_data);
              }
            } catch (e) {
              console.warn("Failed to parse user_data for user:", member.user_id);
            }
            return {
              id: member.user_id,
              name: userData.displayName || member.user_email || "Unknown User",
              email: member.user_email,
              initials: (userData.displayName || member.user_email || "UN").split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2),
              color: userData.profileColor || "#6366f1",
              avatar: userData.profileImage || null,
              role: member.role,
              status: member.status,
              isOnline: false,
              // TODO: Implement real presence system
              lastSeen: member.last_activity ? new Date(member.last_activity) : new Date(member.joined_at),
              joinedAt: member.joined_at
            };
          });
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                members,
                memberCount: members.length
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error) {
          console.error("Error fetching room members:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path.startsWith("/api/chat-rooms/") && path.endsWith("/join") && method === "POST") {
        try {
          const roomId = path.split("/")[3];
          const { user_id } = await request.json();
          if (!roomId || !user_id) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room ID and user_id are required"
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const room = await env.vegvisr_org.prepare("SELECT room_id, room_status FROM site_chat_rooms WHERE room_id = ?").bind(roomId).first();
          if (!room) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room not found"
                }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          if (room.room_status !== "active") {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room is not active"
                }),
                {
                  status: 403,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const existingMember = await env.vegvisr_org.prepare("SELECT id, status FROM site_room_members WHERE room_id = ? AND user_id = ?").bind(roomId, user_id).first();
          if (existingMember) {
            if (existingMember.status === "banned") {
              return addCorsHeaders(
                new Response(
                  JSON.stringify({
                    success: false,
                    error: "User is banned from this room"
                  }),
                  {
                    status: 403,
                    headers: { "Content-Type": "application/json" }
                  }
                )
              );
            }
            if (existingMember.status === "active") {
              return addCorsHeaders(
                new Response(
                  JSON.stringify({
                    success: false,
                    error: "User is already a member of this room"
                  }),
                  {
                    status: 409,
                    headers: { "Content-Type": "application/json" }
                  }
                )
              );
            }
          }
          const memberId = `${roomId}_${user_id}_${Date.now()}`;
          await env.vegvisr_org.prepare(
            `
              INSERT INTO site_room_members
              (id, room_id, user_id, role, status, joined_at)
              VALUES (?, ?, ?, 'member', 'active', CURRENT_TIMESTAMP)
            `
          ).bind(memberId, roomId, user_id).run();
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: "Successfully joined room",
                memberId
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error) {
          console.error("Error joining room:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path.startsWith("/api/chat-rooms/") && path.endsWith("/leave") && method === "DELETE") {
        try {
          const roomId = path.split("/")[3];
          const { user_id } = await request.json();
          if (!roomId || !user_id) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room ID and user_id are required"
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const member = await env.vegvisr_org.prepare(
            'SELECT id, role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"'
          ).bind(roomId, user_id).first();
          if (!member) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "User is not a member of this room"
                }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          if (member.role === "owner") {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room owner cannot leave. Transfer ownership first."
                }),
                {
                  status: 403,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          await env.vegvisr_org.prepare(
            'UPDATE site_room_members SET status = "left", updated_at = CURRENT_TIMESTAMP WHERE room_id = ? AND user_id = ?'
          ).bind(roomId, user_id).run();
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: "Successfully left room"
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error) {
          console.error("Error leaving room:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path.startsWith("/api/chat-rooms/") && path.includes("/members/") && method === "DELETE") {
        try {
          const pathParts = path.split("/");
          const roomId = pathParts[3];
          const userId = pathParts[5];
          const { removed_by, reason } = await request.json();
          if (!roomId || !userId || !removed_by) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room ID, user ID, and removed_by are required"
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const remover = await env.vegvisr_org.prepare(
            'SELECT role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"'
          ).bind(roomId, removed_by).first();
          if (!remover || remover.role !== "owner" && remover.role !== "moderator") {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Only room owners and moderators can remove members"
                }),
                {
                  status: 403,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const targetMember = await env.vegvisr_org.prepare(
            'SELECT id, role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"'
          ).bind(roomId, userId).first();
          if (!targetMember) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "User is not an active member of this room"
                }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          if (targetMember.role === "owner") {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Cannot remove room owner. Transfer ownership first."
                }),
                {
                  status: 403,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          if (targetMember.role === "moderator" && remover.role !== "owner") {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Only room owners can remove moderators"
                }),
                {
                  status: 403,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          await env.vegvisr_org.prepare(
            `
              UPDATE site_room_members
              SET status = 'removed', updated_at = CURRENT_TIMESTAMP,
                  notification_settings = json_set(
                    COALESCE(notification_settings, '{}'),
                    '$.removedBy', ?,
                    '$.removedAt', datetime('now'),
                    '$.reason', ?
                  )
              WHERE room_id = ? AND user_id = ?
            `
          ).bind(removed_by, reason || "No reason provided", roomId, userId).run();
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: "Member removed successfully",
                removedUserId: userId,
                reason: reason || "No reason provided"
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error) {
          console.error("Error removing member:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path.startsWith("/api/chat-rooms/") && path.endsWith("/ban") && method === "POST") {
        try {
          const roomId = path.split("/")[3];
          const { user_id, banned_by, reason } = await request.json();
          if (!roomId || !user_id || !banned_by) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room ID, user_id, and banned_by are required"
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const banner = await env.vegvisr_org.prepare(
            'SELECT role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"'
          ).bind(roomId, banned_by).first();
          if (!banner || banner.role !== "owner" && banner.role !== "moderator") {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Only room owners and moderators can ban members"
                }),
                {
                  status: 403,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const targetMember = await env.vegvisr_org.prepare(
            "SELECT id, role, status FROM site_room_members WHERE room_id = ? AND user_id = ?"
          ).bind(roomId, user_id).first();
          if (targetMember && targetMember.role === "owner") {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Cannot ban room owner"
                }),
                {
                  status: 403,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          if (targetMember && targetMember.role === "moderator" && banner.role !== "owner") {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Only room owners can ban moderators"
                }),
                {
                  status: 403,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          if (targetMember) {
            await env.vegvisr_org.prepare(
              `
                UPDATE site_room_members
                SET status = 'banned', updated_at = CURRENT_TIMESTAMP,
                    notification_settings = json_set(
                      COALESCE(notification_settings, '{}'),
                      '$.bannedBy', ?,
                      '$.bannedAt', datetime('now'),
                      '$.banReason', ?
                    )
                WHERE room_id = ? AND user_id = ?
              `
            ).bind(banned_by, reason || "No reason provided", roomId, user_id).run();
          } else {
            const banId = `${roomId}_ban_${user_id}_${Date.now()}`;
            await env.vegvisr_org.prepare(
              `
                INSERT INTO site_room_members
                (id, room_id, user_id, role, status, joined_at, notification_settings)
                VALUES (?, ?, ?, 'member', 'banned', CURRENT_TIMESTAMP, json(?))
              `
            ).bind(
              banId,
              roomId,
              user_id,
              JSON.stringify({
                bannedBy: banned_by,
                bannedAt: (/* @__PURE__ */ new Date()).toISOString(),
                banReason: reason || "No reason provided"
              })
            ).run();
          }
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: "Member banned successfully",
                bannedUserId: user_id,
                reason: reason || "No reason provided"
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error) {
          console.error("Error banning member:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path.startsWith("/api/chat-rooms/") && path.includes("/members/") && path.endsWith("/role") && method === "PUT") {
        try {
          const pathParts = path.split("/");
          const roomId = pathParts[3];
          const userId = pathParts[5];
          const { new_role, changed_by } = await request.json();
          if (!roomId || !userId || !new_role || !changed_by) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Room ID, user ID, new_role, and changed_by are required"
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          if (!["owner", "moderator", "member"].includes(new_role)) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Invalid role. Must be owner, moderator, or member"
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const changer = await env.vegvisr_org.prepare(
            'SELECT role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"'
          ).bind(roomId, changed_by).first();
          if (!changer || changer.role !== "owner") {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Only room owners can change member roles"
                }),
                {
                  status: 403,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const targetMember = await env.vegvisr_org.prepare(
            'SELECT id, role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"'
          ).bind(roomId, userId).first();
          if (!targetMember) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "User is not an active member of this room"
                }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          if (new_role === "owner") {
            await env.vegvisr_org.prepare(
              'UPDATE site_room_members SET role = "member", updated_at = CURRENT_TIMESTAMP WHERE room_id = ? AND user_id = ?'
            ).bind(roomId, changed_by).run();
          }
          await env.vegvisr_org.prepare(
            `
              UPDATE site_room_members
              SET role = ?, updated_at = CURRENT_TIMESTAMP,
                  notification_settings = json_set(
                    COALESCE(notification_settings, '{}'),
                    '$.roleChangedBy', ?,
                    '$.roleChangedAt', datetime('now'),
                    '$.previousRole', ?
                  )
              WHERE room_id = ? AND user_id = ?
            `
          ).bind(new_role, changed_by, targetMember.role, roomId, userId).run();
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: `Member role changed from ${targetMember.role} to ${new_role}`,
                userId,
                previousRole: targetMember.role,
                newRole: new_role,
                changedBy: changed_by
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error) {
          console.error("Error changing member role:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path.match(/^\/api\/chat-rooms\/([^\/]+)\/invite$/) && method === "POST") {
        try {
          const roomId = path.match(/^\/api\/chat-rooms\/([^\/]+)\/invite$/)[1];
          const body = await request.json();
          const { recipientEmail, invitationMessage } = body;
          if (!recipientEmail) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "recipientEmail is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          const userStore = getUserFromSession(request, env);
          if (!userStore.loggedIn) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "Authentication required" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          const memberInfo = await env.vegvisr_org.prepare(
            'SELECT role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"'
          ).bind(roomId, userStore.user_id).first();
          if (!memberInfo && userStore.user_id !== "9999") {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: "Only owners and moderators can send invitations" }),
                { status: 403, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          if (memberInfo && memberInfo.role !== "owner" && memberInfo.role !== "moderator") {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: "Only owners and moderators can send invitations" }),
                { status: 403, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          const roomInfo = await env.vegvisr_org.prepare("SELECT room_name FROM site_chat_rooms WHERE room_id = ?").bind(roomId).first();
          let roomName = roomInfo?.room_name;
          if (!roomInfo && roomId === "test-room") {
            roomName = "Test Room";
          } else if (!roomInfo) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "Room not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          let invitationData;
          try {
            const emailWorkerRequest = new Request(
              "https://email-worker.torarnehave.workers.dev/generate-invitation",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  recipientEmail,
                  roomId,
                  inviterName: userStore.displayName || userStore.email,
                  inviterUserId: userStore.user_id,
                  invitationMessage: invitationMessage || ""
                })
              }
            );
            const emailWorkerResponse = await env.EMAIL_WORKER.fetch(emailWorkerRequest);
            if (!emailWorkerResponse.ok) {
              const errorText = await emailWorkerResponse.text();
              console.error("Email worker error:", errorText);
              return addCorsHeaders(
                new Response(
                  JSON.stringify({
                    error: "Failed to generate invitation via email-worker",
                    details: errorText,
                    status: emailWorkerResponse.status
                  }),
                  { status: 500, headers: { "Content-Type": "application/json" } }
                )
              );
            }
            invitationData = await emailWorkerResponse.json();
            console.log("Generated invitation data via email-worker:", invitationData);
          } catch (error) {
            console.error("Error in invitation generation:", error);
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: "Failed to generate invitation", details: error.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          let templateData;
          try {
            templateData = {
              template: {
                subject: `You're invited to join ${roomName}`,
                body: `
                  <h2>You're invited to join ${roomName}</h2>
                  <p>Hello!</p>
                  <p>${userStore.displayName || userStore.email} has invited you to join the chat room "${roomName}".</p>
                  <p>Click the link below to accept the invitation:</p>
                  <a href="${invitationData.slowyouLink}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; display: inline-block;">Join Room</a>
                  <p>If the button doesn't work, copy and paste this link into your browser:</p>
                  <p>${invitationData.slowyouLink}</p>
                  <p>This invitation will expire on ${new Date(invitationData.expiresAt).toLocaleDateString()}.</p>
                  <p>Best regards,<br>Vegvisr Team</p>
                `
              }
            };
            console.log("Using simple template - can be upgraded to email-worker templates later");
          } catch (error) {
            console.error("Error in template generation:", error);
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: "Failed to render email template",
                  details: error.message
                }),
                { status: 500, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          const slowyouUrl = "https://slowyou.io/api/send-vegvisr-email";
          const slowyouResponse = await fetch(slowyouUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.API_TOKEN}`
            },
            body: JSON.stringify({
              email: recipientEmail,
              template: templateData.template.body,
              subject: templateData.template.subject,
              callbackUrl: invitationData.callbackUrl
            })
          });
          if (!slowyouResponse.ok) {
            let errorData;
            try {
              errorData = await slowyouResponse.text();
            } catch (e) {
              errorData = `Failed to read error response: ${e.message}`;
            }
            let safeErrorData;
            try {
              safeErrorData = errorData;
              JSON.stringify({ test: errorData });
            } catch (e) {
              safeErrorData = `Error data contains invalid characters: ${errorData.substring(0, 100)}...`;
            }
            console.error("Slowyou.io error:", safeErrorData);
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: "Failed to send email via slowyou.io",
                  details: safeErrorData,
                  status: slowyouResponse.status,
                  statusText: slowyouResponse.statusText
                }),
                {
                  status: 500,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: "Invitation sent successfully",
                invitationToken: invitationData.invitationToken,
                recipientEmail,
                expiresAt: invitationData.expiresAt
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        } catch (error) {
          console.error("Error sending invitation:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: "Failed to send invitation", details: error.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      }
      if (path === "/api/invitations" && method === "GET") {
        try {
          const userStore = getUserFromSession(request, env);
          if (!userStore.loggedIn) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "Authentication required" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          const invitations = await env.vegvisr_org.prepare(
            `
              SELECT id, recipient_email, room_id, inviter_name, inviter_user_id,
                     invitation_message, created_at, expires_at, used_at, is_active
              FROM invitation_tokens
              ORDER BY created_at DESC
            `
          ).all();
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                invitations: invitations.results,
                count: invitations.results.length
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        } catch (error) {
          console.error("Error fetching all invitations:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: "Failed to fetch invitations", details: error.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      }
      if (path.match(/^\/api\/chat-rooms\/([^\/]+)\/invitations$/) && method === "GET") {
        try {
          const roomId = path.match(/^\/api\/chat-rooms\/([^\/]+)\/invitations$/)[1];
          const userStore = getUserFromSession(request, env);
          if (!userStore.loggedIn) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "Authentication required" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          const memberInfo = await env.vegvisr_org.prepare(
            'SELECT role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"'
          ).bind(roomId, userStore.user_id).first();
          if (!memberInfo || memberInfo.role !== "owner" && memberInfo.role !== "moderator") {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: "Only owners and moderators can view invitations" }),
                { status: 403, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          const invitations = await env.vegvisr_org.prepare(
            `
              SELECT id, recipient_email, inviter_name, invitation_message,
                     created_at, expires_at, used_at, is_active
              FROM invitation_tokens
              WHERE room_id = ? AND is_active = 1 AND expires_at > datetime('now')
              ORDER BY created_at DESC
            `
          ).bind(roomId).all();
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                invitations: invitations.results
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        } catch (error) {
          console.error("Error fetching invitations:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: "Failed to fetch invitations", details: error.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      }
      if (path.match(/^\/api\/chat-rooms\/([^\/]+)\/invitations\/([^\/]+)$/) && method === "DELETE") {
        try {
          const [, roomId, invitationId] = path.match(
            /^\/api\/chat-rooms\/([^\/]+)\/invitations\/([^\/]+)$/
          );
          const userStore = getUserFromSession(request, env);
          if (!userStore.loggedIn) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "Authentication required" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          const memberInfo = await env.vegvisr_org.prepare(
            'SELECT role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"'
          ).bind(roomId, userStore.user_id).first();
          if (!memberInfo || memberInfo.role !== "owner" && memberInfo.role !== "moderator") {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: "Only owners and moderators can cancel invitations" }),
                { status: 403, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          const result = await env.vegvisr_org.prepare("UPDATE invitation_tokens SET is_active = 0 WHERE id = ? AND room_id = ?").bind(invitationId, roomId).run();
          if (result.changes === 0) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "Invitation not found or already cancelled" }), {
                status: 404,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: "Invitation cancelled successfully"
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        } catch (error) {
          console.error("Error cancelling invitation:", error);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: "Failed to cancel invitation", details: error.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      }
      return addCorsHeaders(new Response("Not Found", { status: 404 }));
    } catch (error) {
      console.error("Error in fetch handler:", error);
      return addCorsHeaders(new Response(JSON.stringify({ error: error.message }), { status: 500 }));
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

// .wrangler/tmp/bundle-uerlaS/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default
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

// .wrangler/tmp/bundle-uerlaS/middleware-loader.entry.ts
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
