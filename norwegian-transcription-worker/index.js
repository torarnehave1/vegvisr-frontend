// Recovered from the DEPLOYED worker on Cloudflare, because the local source was lost.
// esbuild artefacts undone: inlined npm dependencies removed, imports restored below, and the
// name-preservation wrappers stripped. Variable names may differ from the original where
// esbuild renamed to avoid collisions, and the original comments are gone.

var NORWEGIAN_CPU_ENDPOINT = "https://oor2ob8vgl59eiht.eu-west-1.aws.endpoints.huggingface.cloud";
var NORWEGIAN_GPU_ENDPOINT = "https://vfclin5tvetohyv0.us-east-2.aws.endpoints.huggingface.cloud";
var generateSilentWAV = (durationSeconds = 1) => {
  const sampleRate = 16e3;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const fileSize = 44 + dataSize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  writeString(0, "RIFF");
  view.setUint32(4, fileSize - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 44; i < fileSize; i++) {
    view.setUint8(i, 0);
  }
  return buffer;
};
var arrayBufferToBase64 = (buffer) => {
  const uint8Array = new Uint8Array(buffer);
  const chunkSize = 32768;
  let result = "";
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    result += String.fromCharCode.apply(null, chunk);
  }
  return btoa(result);
};
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-File-Name, X-Chunk-Index, X-Total-Chunks, X-Upload-Id, X-User-Email"
};
var createResponse = (body, status = 200, headers = {}) => {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...headers }
  });
};
var createErrorResponse = (message, status) => {
  console.error(message);
  return createResponse(JSON.stringify({ error: message }), status);
};
var isValidAudioFormat = (contentType, fileName) => {
  const validMimeTypes = [
    "audio/wav",
    "audio/wave",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/flac",
    "audio/webm",
    "audio/ogg",
    "audio/ogg; codecs=opus"
  ];
  const validExtensions = [".wav", ".mp3", ".m4a", ".flac", ".webm", ".ogg", ".opus"];
  if (contentType && validMimeTypes.includes(contentType.toLowerCase())) {
    return true;
  }
  if (fileName) {
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf("."));
    return validExtensions.includes(extension);
  }
  return false;
};
var detectAudioFormat = (audioBuffer) => {
  const audioArray = new Uint8Array(audioBuffer);
  const header = Array.from(audioArray.slice(0, 12)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (header.startsWith("1a45dfa3")) {
    return { contentType: "audio/webm", extension: ".webm", format: "WebM" };
  }
  if (header.startsWith("4f676753")) {
    return { contentType: "audio/ogg", extension: ".ogg", format: "OGG/Opus" };
  }
  if (header.startsWith("52494646")) {
    return { contentType: "audio/wav", extension: ".wav", format: "WAV" };
  }
  if (header.startsWith("494433") || header.startsWith("fffb") || header.startsWith("fff3")) {
    return { contentType: "audio/mpeg", extension: ".mp3", format: "MP3" };
  }
  if (header.includes("66747970")) {
    return { contentType: "audio/mp4", extension: ".m4a", format: "M4A" };
  }
  if (header.startsWith("664c6143")) {
    return { contentType: "audio/flac", extension: ".flac", format: "FLAC" };
  }
  return { contentType: "audio/wav", extension: ".wav", format: "Unknown" };
};
var formatTimestamp = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
var addSentenceTimestamps = (transcriptionData) => {
  if (!transcriptionData.chunks || !Array.isArray(transcriptionData.chunks)) {
    console.log("\u26A0\uFE0F No chunks data for timestamps, returning plain text");
    return transcriptionData.text || "";
  }
  console.log("\u{1F550} Processing word timestamps:", {
    totalChunks: transcriptionData.chunks.length,
    firstChunk: transcriptionData.chunks[0]
  });
  let timestampedText = "";
  let currentSentence = "";
  let sentenceStartTime = null;
  const sentenceEnders = [".", "!", "?", "..."];
  for (const chunk of transcriptionData.chunks) {
    const word = chunk.text || "";
    const timestamp = chunk.timestamp?.[0] || 0;
    if (sentenceStartTime === null) {
      sentenceStartTime = timestamp;
    }
    currentSentence += word;
    const endsWithPunctuation = sentenceEnders.some((ender) => word.trim().endsWith(ender));
    if (endsWithPunctuation) {
      timestampedText += `[${formatTimestamp(sentenceStartTime)}] ${currentSentence.trim()}
`;
      currentSentence = "";
      sentenceStartTime = null;
    }
  }
  if (currentSentence.trim()) {
    timestampedText += `[${formatTimestamp(sentenceStartTime || 0)}] ${currentSentence.trim()}
`;
  }
  console.log("\u2705 Sentence timestamps added:", {
    originalLength: transcriptionData.text?.length || 0,
    timestampedLength: timestampedText.length,
    sentences: (timestampedText.match(/\[/g) || []).length
  });
  return timestampedText;
};
var getAudioContentType = (fileName) => {
  if (!fileName) return "audio/wav";
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf("."));
  switch (extension) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".webm":
      return "audio/webm";
    default:
      return "audio/wav";
  }
};
async function resolveOwnAudioR2(email, env) {
  if (!email || !env.vegvisr_org) return null;
  try {
    const row = await env.vegvisr_org.prepare("SELECT cf_r2_account_id, cf_r2_bucket, cf_r2_access_key_id, cf_r2_secret, cf_r2_public_base FROM config WHERE email = ?").bind(email).first();
    if (!row || !row.cf_r2_bucket || !row.cf_r2_account_id || !row.cf_r2_access_key_id || !row.cf_r2_secret) return null;
    return {
      bucket: row.cf_r2_bucket,
      accountId: row.cf_r2_account_id,
      accessKeyId: row.cf_r2_access_key_id,
      secret: row.cf_r2_secret,
      publicBase: row.cf_r2_public_base || null
    };
  } catch {
    return null;
  }
}
async function r2PutSigned(bucket, key, body, contentType, metadata, accessKeyId, secretKey, accountId) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${bucket}/${key}`;
  const now = /* @__PURE__ */ new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const encoder = new TextEncoder();
  const hashHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const payloadHash = hashHex(await crypto.subtle.digest("SHA-256", body));
  const headers = { host, "x-amz-date": timeStr, "x-amz-content-sha256": payloadHash };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map((k) => `${k}:${headers[k]}`).join("\n") + "\n";
  const canonicalRequest = ["PUT", `/${bucket}/${key}`, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStr}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", timeStr, credentialScope, hashHex(await crypto.subtle.digest("SHA-256", encoder.encode(canonicalRequest)))].join("\n");
  const sign = async (k, data) => {
    const cryptoKey = await crypto.subtle.importKey("raw", typeof k === "string" ? encoder.encode(k) : k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data)));
  };
  const signingKey = await sign(await sign(await sign(await sign(encoder.encode("AWS4" + secretKey), dateStr), "auto"), "s3"), "aws4_request");
  const signature = hashHex(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), encoder.encode(stringToSign)));
  return fetch(url, {
    method: "PUT",
    headers: {
      ...headers,
      "content-type": contentType,
      "Authorization": `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}`,
      ...Object.fromEntries(Object.entries(metadata || {}).map(([k, v]) => [`x-amz-meta-${k}`, String(v)]))
    },
    body
  });
}
async function signR2RequestQS(method, bucket, key, queryString, accessKeyId, secretKey, accountId, body = null, extraHeaders = null) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const now = /* @__PURE__ */ new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const payloadHash = body ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", typeof body === "string" ? new TextEncoder().encode(body) : body))).map((b) => b.toString(16).padStart(2, "0")).join("") : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const headers = { host, "x-amz-date": timeStr, "x-amz-content-sha256": payloadHash };
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) headers[k.toLowerCase()] = String(v);
  const signedHeaderKeys = Object.keys(headers).sort();
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[k]}`).join("\n") + "\n";
  const canonicalRequest = [method, `/${bucket}/${key}`, queryString || "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const encoder = new TextEncoder();
  const credentialScope = `${dateStr}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timeStr,
    credentialScope,
    Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(canonicalRequest)))).map((b) => b.toString(16).padStart(2, "0")).join("")
  ].join("\n");
  const sign = async (k, data) => {
    const cryptoKey = await crypto.subtle.importKey("raw", typeof k === "string" ? encoder.encode(k) : k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data)));
  };
  const signingKey = await sign(await sign(await sign(await sign(encoder.encode("AWS4" + secretKey), dateStr), "auto"), "s3"), "aws4_request");
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    encoder.encode(stringToSign)
  ))).map((b) => b.toString(16).padStart(2, "0")).join("");
  return {
    url: `https://${host}/${bucket}/${key}${queryString ? "?" + queryString : ""}`,
    headers: { ...headers, "Authorization": `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}` }
  };
}
async function r2CreateMultipartUpload(bucket, key, contentType, metadata, accessKeyId, secretKey, accountId) {
  const extraHeaders = { "content-type": contentType, ...Object.fromEntries(Object.entries(metadata || {}).map(([k, v]) => [`x-amz-meta-${k}`, String(v)])) };
  const { url, headers } = await signR2RequestQS("POST", bucket, key, "uploads=", accessKeyId, secretKey, accountId, null, extraHeaders);
  const res = await fetch(url, { method: "POST", headers });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 300) };
  const m = text.match(/<UploadId>([^<]+)<\/UploadId>/);
  if (!m) return { ok: false, status: res.status, error: "No UploadId in CreateMultipartUpload response" };
  return { ok: true, uploadId: m[1] };
}
async function r2UploadPart(bucket, key, uploadId, partNumber, body, accessKeyId, secretKey, accountId) {
  const queryString = `partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`;
  const { url, headers } = await signR2RequestQS("PUT", bucket, key, queryString, accessKeyId, secretKey, accountId, body);
  const res = await fetch(url, { method: "PUT", headers, body });
  if (!res.ok) return { ok: false, status: res.status, error: (await res.text()).slice(0, 300) };
  return { ok: true, etag: res.headers.get("etag") };
}
async function r2CompleteMultipartUpload(bucket, key, uploadId, parts, accessKeyId, secretKey, accountId) {
  const xml = `<CompleteMultipartUpload>${parts.map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`).join("")}</CompleteMultipartUpload>`;
  const queryString = `uploadId=${encodeURIComponent(uploadId)}`;
  const { url, headers } = await signR2RequestQS("POST", bucket, key, queryString, accessKeyId, secretKey, accountId, xml);
  const res = await fetch(url, { method: "POST", headers, body: xml });
  if (!res.ok) return { ok: false, status: res.status, error: (await res.text()).slice(0, 300) };
  return { ok: true };
}
async function r2AbortMultipartUpload(bucket, key, uploadId, accessKeyId, secretKey, accountId) {
  const queryString = `uploadId=${encodeURIComponent(uploadId)}`;
  const { url, headers } = await signR2RequestQS("DELETE", bucket, key, queryString, accessKeyId, secretKey, accountId);
  const res = await fetch(url, { method: "DELETE", headers });
  return { ok: res.ok || res.status === 204 };
}
var handleUpload = async (request, env) => {
  try {
    const contentType = request.headers.get("Content-Type");
    const fileName = request.headers.get("X-File-Name") || "audio.wav";
    const userEmail = (request.headers.get("X-User-Email") || "").trim().toLowerCase();
    console.log("\u{1F4E4} Norwegian Upload request:", {
      fileName,
      contentType,
      hasBody: !!request.body,
      hasUserEmail: !!userEmail,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    const audioContentType = contentType || getAudioContentType(fileName);
    if (!isValidAudioFormat(contentType, fileName)) {
      return createErrorResponse(
        "Invalid audio format. Supported formats: WAV, MP3, M4A, FLAC.",
        400
      );
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const r2Key = `audio/${timestamp}-${fileName}`;
    const audioBuffer = await request.arrayBuffer();
    const customMetadata = { originalFileName: fileName, service: "norwegian-transcription" };
    const ownR2 = await resolveOwnAudioR2(userEmail, env);
    let audioUrl;
    if (ownR2) {
      const putResp = await r2PutSigned(ownR2.bucket, r2Key, audioBuffer, audioContentType, customMetadata, ownR2.accessKeyId, ownR2.secret, ownR2.accountId);
      if (!putResp.ok) {
        const errText = await putResp.text().catch(() => "");
        return createErrorResponse(`Upload to own R2 bucket failed (${putResp.status}): ${errText.slice(0, 300)}`, 502);
      }
      audioUrl = ownR2.publicBase ? `${ownR2.publicBase.replace(/\/+$/, "")}/${r2Key}` : null;
      console.log("\u2705 Norwegian upload completed (own bucket):", { r2Key, bucket: ownR2.bucket, size: audioBuffer.byteLength, hasPublicUrl: !!audioUrl });
    } else {
      await env.NORWEGIAN_AUDIO_BUCKET.put(r2Key, audioBuffer, {
        httpMetadata: { contentType: audioContentType },
        customMetadata
      });
      if (!env.ACCOUNT_ID) {
        return createErrorResponse("Server configuration error: ACCOUNT_ID not configured", 500);
      }
      audioUrl = `https://audio.vegvisr.org/${r2Key}`;
      console.log("\u2705 Norwegian upload completed (shared bucket):", { r2Key, size: audioBuffer.byteLength });
    }
    return createResponse(
      JSON.stringify({
        success: true,
        audioUrl,
        r2Key,
        fileName,
        size: audioBuffer.byteLength,
        contentType: audioContentType,
        message: "Audio uploaded successfully"
      })
    );
  } catch (error) {
    console.error("Norwegian upload error:", error);
    return createErrorResponse(`Upload failed: ${error.message}`, 500);
  }
};
var handleUploadInit = async (request, env) => {
  try {
    const { filename, contentType, size, userEmail } = await request.json();
    if (!filename || typeof filename !== "string") return createErrorResponse("filename is required", 400);
    if (!size || typeof size !== "number" || size <= 0) return createErrorResponse("size is required", 400);
    const effectiveType = typeof contentType === "string" && contentType.trim() ? contentType.trim() : "audio/wav";
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const r2Key = `audio/${timestamp}-${filename}`;
    const customMetadata = { originalFileName: filename, service: "norwegian-transcription" };
    const ownR2 = await resolveOwnAudioR2((userEmail || "").trim().toLowerCase(), env);
    if (ownR2) {
      const created = await r2CreateMultipartUpload(ownR2.bucket, r2Key, effectiveType, customMetadata, ownR2.accessKeyId, ownR2.secret, ownR2.accountId);
      if (!created.ok) return createErrorResponse(`R2 CreateMultipartUpload failed (${created.status}): ${created.error}`, 502);
      return createResponse(JSON.stringify({ success: true, uploadId: created.uploadId, key: r2Key, name: filename, size, contentType: effectiveType, target: "own" }));
    }
    const upload = await env.NORWEGIAN_AUDIO_BUCKET.createMultipartUpload(r2Key, { httpMetadata: { contentType: effectiveType }, customMetadata });
    return createResponse(JSON.stringify({ success: true, uploadId: upload.uploadId, key: r2Key, name: filename, size, contentType: effectiveType, target: "shared" }));
  } catch (error) {
    console.error("Error in /upload/init:", error);
    return createErrorResponse(`Upload init failed: ${error.message}`, 500);
  }
};
var handleUploadPart = async (request, env) => {
  try {
    const url = new URL(request.url);
    const key = String(url.searchParams.get("key") || "");
    const uploadId = String(url.searchParams.get("uploadId") || "");
    const partNumber = Number(url.searchParams.get("partNumber") || "");
    const userEmail = (url.searchParams.get("userEmail") || "").trim().toLowerCase();
    if (!key || !uploadId) return createErrorResponse("key and uploadId are required", 400);
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 1e4) {
      return createErrorResponse("partNumber must be an integer between 1 and 10000", 400);
    }
    const body = await request.arrayBuffer();
    if (!body.byteLength) return createErrorResponse("Upload part is empty", 400);
    const ownR2 = await resolveOwnAudioR2(userEmail, env);
    if (ownR2) {
      const part = await r2UploadPart(ownR2.bucket, key, uploadId, partNumber, body, ownR2.accessKeyId, ownR2.secret, ownR2.accountId);
      if (!part.ok) return createErrorResponse(`R2 UploadPart failed (${part.status}): ${part.error}`, 502);
      return createResponse(JSON.stringify({ success: true, part: { partNumber, etag: part.etag } }));
    }
    const upload = env.NORWEGIAN_AUDIO_BUCKET.resumeMultipartUpload(key, uploadId);
    const uploadedPart = await upload.uploadPart(partNumber, body);
    return createResponse(JSON.stringify({ success: true, part: { partNumber, etag: uploadedPart.etag } }));
  } catch (error) {
    console.error("Error in /upload/part:", error);
    return createErrorResponse(`Upload part failed: ${error.message}`, 500);
  }
};
var handleUploadComplete = async (request, env) => {
  try {
    const { key, uploadId, parts, name, size, contentType, userEmail } = await request.json();
    if (!key || !uploadId) return createErrorResponse("key and uploadId are required", 400);
    if (!Array.isArray(parts) || !parts.length) return createErrorResponse("parts are required", 400);
    const normalizedParts = parts.map((p) => ({ partNumber: Number(p?.partNumber), etag: String(p?.etag || "") })).filter((p) => Number.isInteger(p.partNumber) && p.partNumber > 0 && p.etag).sort((a, b) => a.partNumber - b.partNumber);
    if (!normalizedParts.length) return createErrorResponse("No valid parts were provided", 400);
    const ownR2 = await resolveOwnAudioR2((userEmail || "").trim().toLowerCase(), env);
    let audioUrl;
    if (ownR2) {
      const completed = await r2CompleteMultipartUpload(ownR2.bucket, key, uploadId, normalizedParts, ownR2.accessKeyId, ownR2.secret, ownR2.accountId);
      if (!completed.ok) return createErrorResponse(`R2 CompleteMultipartUpload failed (${completed.status}): ${completed.error}`, 502);
      audioUrl = ownR2.publicBase ? `${ownR2.publicBase.replace(/\/+$/, "")}/${key}` : null;
    } else {
      const upload = env.NORWEGIAN_AUDIO_BUCKET.resumeMultipartUpload(key, uploadId);
      await upload.complete(normalizedParts.map((p) => ({ partNumber: p.partNumber, etag: p.etag })));
      audioUrl = `https://audio.vegvisr.org/${key}`;
    }
    return createResponse(JSON.stringify({
      success: true,
      audioUrl,
      r2Key: key,
      fileName: typeof name === "string" && name ? name : key.replace(/^audio\//, ""),
      size: typeof size === "number" ? size : null,
      contentType: typeof contentType === "string" && contentType ? contentType : "audio/wav",
      message: "Audio uploaded successfully"
    }));
  } catch (error) {
    console.error("Error in /upload/complete:", error);
    return createErrorResponse(`Upload complete failed: ${error.message}`, 500);
  }
};
var handleUploadAbort = async (request, env) => {
  try {
    const { key, uploadId, userEmail } = await request.json();
    if (!key || !uploadId) return createErrorResponse("key and uploadId are required", 400);
    const ownR2 = await resolveOwnAudioR2((userEmail || "").trim().toLowerCase(), env);
    if (ownR2) {
      await r2AbortMultipartUpload(ownR2.bucket, key, uploadId, ownR2.accessKeyId, ownR2.secret, ownR2.accountId);
    } else {
      const upload = env.NORWEGIAN_AUDIO_BUCKET.resumeMultipartUpload(key, uploadId);
      await upload.abort();
    }
    return createResponse(JSON.stringify({ success: true }));
  } catch (error) {
    console.error("Error in /upload/abort:", error);
    return createErrorResponse(`Upload abort failed: ${error.message}`, 500);
  }
};
var callNorwegianTranscription = async (base64Audio, env, useGpu = false) => {
  const maxRetries = 8;
  const initialDelay = 3e3;
  let coldStartDetected = false;
  const endpoint = useGpu ? NORWEGIAN_GPU_ENDPOINT : NORWEGIAN_CPU_ENDPOINT;
  const endpointType = useGpu ? "GPU" : "CPU";
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`\u{1F680} Calling Norwegian transcription ${endpointType} (attempt ${attempt + 1}/${maxRetries})`);
      const payload = {
        inputs: base64Audio,
        parameters: {
          return_timestamps: "word"
          // Request word-level timestamps from Whisper
        }
      };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${env.whisperailab}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      console.log(`\u{1F4CA} Norwegian ${endpointType} response (attempt ${attempt + 1}):`, {
        status: response.status,
        statusText: response.statusText
      });
      if (response.ok) {
        const result = await response.json();
        console.log(`\u2705 Success with Norwegian ${endpointType} after ${attempt + 1} attempts`);
        return {
          success: true,
          result,
          modelUsed: `norwegian-${endpointType.toLowerCase()}`,
          endpoint,
          endpointType,
          attemptsUsed: attempt + 1,
          coldStartDetected
        };
      } else if (response.status === 503 && attempt < maxRetries - 1) {
        coldStartDetected = true;
        const baseDelay = initialDelay * Math.pow(2, Math.min(attempt, 4));
        const jitter = Math.random() * 2e3;
        const totalDelay = Math.min(baseDelay + jitter, 6e4);
        console.log(`\u23F3 Norwegian ${endpointType} cold start (503), waiting ${Math.round(totalDelay / 1e3)}s before retry... (can take 3-4 minutes total)`);
        await new Promise((resolve) => setTimeout(resolve, totalDelay));
        continue;
      } else {
        console.log(`\u274C Norwegian ${endpointType} error:`, response.status);
        const errorText = await response.text();
        if (attempt === maxRetries - 1) {
          return {
            success: false,
            error: `Norwegian ${endpointType} error (${response.status}) after ${attempt + 1} attempts: ${errorText}`
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 5e3));
      }
    } catch (error) {
      console.error(`\u274C Norwegian ${endpointType} exception (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries - 1) {
        return {
          success: false,
          error: `Norwegian ${endpointType} exception after ${attempt + 1} attempts: ${error.message}`
        };
      }
      const baseDelay = initialDelay * Math.pow(2, Math.min(attempt, 4));
      const jitter = Math.random() * 2e3;
      const totalDelay = Math.min(baseDelay + jitter, 6e4);
      console.log(`\u23F3 Network error, waiting ${Math.round(totalDelay / 1e3)}s before retry...`);
      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }
  }
  return {
    success: false,
    error: `Norwegian ${endpointType} failed after all retries - may need 3-4 minutes to warm up`
  };
};
var handleNorwegianTranscribe = async (request, env) => {
  try {
    const url = new URL(request.url);
    let audioUrl = url.searchParams.get("url");
    let selectedModel = url.searchParams.get("model") || "medium";
    let endpointType = url.searchParams.get("endpoint") || "cpu";
    if (!audioUrl && request.body) {
      const body = await request.json();
      audioUrl = body.audioUrl;
      selectedModel = body.model || selectedModel;
      endpointType = body.endpoint || endpointType;
    }
    if (!audioUrl) {
      return createErrorResponse("Missing required audio URL parameter", 400);
    }
    console.log("\u{1F1F3}\u{1F1F4} Norwegian transcription request:", {
      audioUrl,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    let r2Key;
    if (audioUrl.includes("audio.vegvisr.org/")) {
      r2Key = audioUrl.split("audio.vegvisr.org/")[1];
    } else if (audioUrl.includes(".r2.cloudflarestorage.com/")) {
      r2Key = audioUrl.split(".r2.cloudflarestorage.com/")[1];
    } else {
      console.error("URL parsing failed:", {
        audioUrl,
        expectedPatterns: ["audio.vegvisr.org/", ".r2.cloudflarestorage.com/"]
      });
      return createErrorResponse(`Invalid audio URL format: ${audioUrl}`, 400);
    }
    console.log("\u{1F4E5} Downloading audio from R2:", { r2Key, bucketBinding: "NORWEGIAN_AUDIO_BUCKET" });
    const audioObject = await env.NORWEGIAN_AUDIO_BUCKET.get(r2Key);
    if (!audioObject) {
      console.error("R2 file not found:", { r2Key, bucketBinding: "NORWEGIAN_AUDIO_BUCKET" });
      return createErrorResponse(`Audio file not found: ${r2Key}`, 404);
    }
    const audioBuffer = await audioObject.arrayBuffer();
    console.log("\u{1F4C1} Audio downloaded:", {
      size: audioBuffer.byteLength,
      sizeMB: (audioBuffer.byteLength / 1024 / 1024).toFixed(2)
    });
    const detectedFormat = detectAudioFormat(audioBuffer);
    console.log("\u{1F4DD} Detected audio format:", {
      format: detectedFormat.format,
      contentType: detectedFormat.contentType,
      extension: detectedFormat.extension
    });
    const originalFileName = audioObject.customMetadata?.originalFileName || "audio.wav";
    const correctedFileName = originalFileName.replace(/\.[^.]+$/, detectedFormat.extension);
    const base64Audio = arrayBufferToBase64(audioBuffer);
    console.log("\u{1F3AF} Audio processing details:", {
      originalFileName,
      correctedFileName,
      r2Key,
      detectedFormat: detectedFormat.format,
      detectedContentType: detectedFormat.contentType,
      audioSize: audioBuffer.byteLength,
      base64Length: base64Audio.length
    });
    console.log("\u{1F680} Calling transcription service with model selection:", {
      selectedModel,
      endpointType,
      fileName: correctedFileName,
      detectedFormat: detectedFormat.format,
      contentType: detectedFormat.contentType,
      audioSize: audioBuffer.byteLength,
      base64Size: base64Audio.length
    });
    const useGpu = endpointType.toLowerCase() === "gpu";
    const transcriptionResponse = await callNorwegianTranscription(base64Audio, env, useGpu);
    if (!transcriptionResponse.success) {
      console.error("Norwegian transcription failed:", transcriptionResponse.error);
      return createErrorResponse(
        `Transcription failed: ${transcriptionResponse.error}. Model may need 3-4 minutes to warm up.`,
        502
      );
    }
    const transcriptionResult = transcriptionResponse.result;
    console.log("\u2705 Transcription successful:", {
      modelUsed: transcriptionResponse.modelUsed,
      attemptedModels: transcriptionResponse.attemptedModels,
      endpoint: transcriptionResponse.endpoint
    });
    console.log("\u2705 Hugging Face transcription completed:", {
      hasResult: !!transcriptionResult,
      resultType: typeof transcriptionResult,
      resultPreview: JSON.stringify(transcriptionResult).substring(0, 200) + "..."
    });
    let transcriptionText = "";
    let timestampedText = "";
    if (typeof transcriptionResult === "string") {
      transcriptionText = transcriptionResult;
    } else if (transcriptionResult.text) {
      transcriptionText = transcriptionResult.text;
      timestampedText = addSentenceTimestamps(transcriptionResult);
    } else if (Array.isArray(transcriptionResult) && transcriptionResult[0]?.text) {
      transcriptionText = transcriptionResult[0].text;
      timestampedText = addSentenceTimestamps(transcriptionResult[0]);
    } else if (transcriptionResult.generated_text) {
      transcriptionText = transcriptionResult.generated_text;
    } else {
      transcriptionText = JSON.stringify(transcriptionResult);
    }
    return createResponse(
      JSON.stringify({
        success: true,
        text: transcriptionText,
        timestampedText: timestampedText || transcriptionText,
        // Include timestamped version
        transcription: transcriptionResult,
        language: "no",
        service: "Hugging Face Norwegian Transcription",
        metadata: {
          fileSize: audioBuffer.byteLength,
          fileName: originalFileName,
          processedAt: (/* @__PURE__ */ new Date()).toISOString(),
          service: "Hugging Face Norwegian Transcription",
          modelUsed: transcriptionResponse.modelUsed,
          endpoint: transcriptionResponse.endpoint,
          endpointType: transcriptionResponse.endpointType,
          requestedModel: selectedModel,
          requestedEndpoint: endpointType,
          language: "Norwegian",
          coldStartDetected: transcriptionResponse.coldStartDetected,
          hasTimestamps: !!timestampedText
        }
      })
    );
  } catch (error) {
    console.error("Norwegian transcription error:", error);
    return createErrorResponse(`Norwegian transcription failed: ${error.message}`, 500);
  }
};
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method === "GET" && url.pathname === "/hf-endpoint/status") {
      const endpointType = url.searchParams.get("type") || "cpu";
      const endpoint = endpointType.toLowerCase() === "gpu" ? NORWEGIAN_GPU_ENDPOINT : NORWEGIAN_CPU_ENDPOINT;
      try {
        console.log(`\u{1F50D} Checking ${endpointType.toUpperCase()} endpoint status:`, endpoint);
        const testAudioBuffer = generateSilentWAV(0.1);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5e3);
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "audio/wav",
            "Authorization": `Bearer ${env.whisperailab}`
          },
          body: testAudioBuffer,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        let status, message, details;
        if (response.status === 200 || response.status === 400 || response.status === 422) {
          status = "ready";
          message = `\u2705 ${endpointType.toUpperCase()} endpoint is READY`;
          details = `Status ${response.status} - Endpoint is warm and ready to process requests`;
        } else if (response.status === 503 || response.status === 504) {
          status = "scaled_to_zero";
          message = `\u23F3 ${endpointType.toUpperCase()} endpoint is SCALED TO ZERO`;
          details = `Status ${response.status} - Endpoint needs to be woken up`;
        } else {
          status = "unknown";
          message = `\u2139\uFE0F ${endpointType.toUpperCase()} endpoint status: ${response.status}`;
          details = "Endpoint responded but status is unclear";
        }
        return createResponse(JSON.stringify({
          status,
          message,
          details,
          endpoint: endpointType,
          httpStatus: response.status
        }));
      } catch (err) {
        if (err.name === "AbortError") {
          return createResponse(JSON.stringify({
            status: "timeout",
            message: `\u23F3 ${endpointType.toUpperCase()} endpoint timeout`,
            details: "Endpoint did not respond within 5 seconds - likely scaled to zero",
            endpoint: endpointType
          }));
        }
        return createErrorResponse(`Endpoint check failed: ${err.message}`, 500);
      }
    }
    if (request.method === "POST" && url.pathname === "/hf-endpoint/wake") {
      const endpointType = url.searchParams.get("type") || "cpu";
      const endpoint = endpointType.toLowerCase() === "gpu" ? NORWEGIAN_GPU_ENDPOINT : NORWEGIAN_CPU_ENDPOINT;
      try {
        console.log(`\u{1F680} Waking up ${endpointType.toUpperCase()} endpoint:`, endpoint);
        const maxAttempts = 20;
        const pollInterval = 6e3;
        let attempt = 0;
        const wakeAudioBuffer = generateSilentWAV(1);
        while (attempt < maxAttempts) {
          attempt++;
          console.log(`\u{1F504} Wake-up attempt ${attempt}/${maxAttempts}`);
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5e3);
            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "audio/wav",
                "Authorization": `Bearer ${env.whisperailab}`
              },
              body: wakeAudioBuffer,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.status === 200 || response.status === 400 || response.status === 422) {
              console.log(`\u2705 ${endpointType.toUpperCase()} endpoint ready after ${attempt} attempts`);
              return createResponse(JSON.stringify({
                success: true,
                message: `\u2705 ${endpointType.toUpperCase()} endpoint is now READY`,
                attempts: attempt,
                endpoint: endpointType,
                httpStatus: response.status
              }));
            }
            if (attempt < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, pollInterval));
            }
          } catch (err) {
            if (err.name === "AbortError") {
              console.log(`\u23F3 Attempt ${attempt} timeout, retrying...`);
              if (attempt < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, pollInterval));
              }
            } else {
              throw err;
            }
          }
        }
        return createResponse(JSON.stringify({
          success: false,
          message: `\u274C ${endpointType.toUpperCase()} endpoint did not wake up`,
          attempts: maxAttempts,
          endpoint: endpointType
        }), 504);
      } catch (err) {
        return createErrorResponse(`Wake-up failed: ${err.message}`, 500);
      }
    }
    if (request.method === "POST" && url.pathname === "/generate-analysis") {
      try {
        const { prompt, returnType = "json" } = await request.json();
        if (!prompt) {
          return createErrorResponse("Missing required prompt parameter", 400);
        }
        console.log("\u{1F916} Generating AI analysis:", {
          promptLength: prompt.length,
          returnType,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
        const MAX_INPUT_LENGTH = 4e4;
        let processedPrompt = prompt;
        if (prompt.length > MAX_INPUT_LENGTH) {
          console.log(`\u26A0\uFE0F Prompt too long (${prompt.length} chars), truncating to ${MAX_INPUT_LENGTH}`);
          const parts = prompt.split("\n\n");
          const instructions = parts.slice(-5).join("\n\n");
          const conversationParts = parts.slice(0, -5).join("\n\n");
          const instructionsLength = instructions.length;
          const availableSpace = MAX_INPUT_LENGTH - instructionsLength - 200;
          if (conversationParts.length > availableSpace) {
            const keepLength = Math.floor(availableSpace / 2);
            const beginning = conversationParts.substring(0, keepLength);
            const end = conversationParts.substring(conversationParts.length - keepLength);
            processedPrompt = `${beginning}

[... ${Math.floor((conversationParts.length - availableSpace) / 1e3)}k characters omitted for context length ...]

${end}

${instructions}`;
          } else {
            processedPrompt = `${conversationParts}

${instructions}`;
          }
          console.log(`\u2702\uFE0F Truncated prompt from ${prompt.length} to ${processedPrompt.length} chars`);
        }
        const aiResponse = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: [
            {
              role: "system",
              content: "Du er en ekspert p\xE5 samtalanalyse. Svar KUN med valid JSON uten markdown formatering."
            },
            {
              role: "user",
              content: processedPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: 2048,
          stream: false
        });
        console.log("\u2705 AI response received:", {
          hasResponse: !!aiResponse,
          responseType: typeof aiResponse
        });
        let responseText;
        if (aiResponse.response && typeof aiResponse.response === "object") {
          responseText = JSON.stringify(aiResponse.response);
        } else {
          responseText = aiResponse.response || aiResponse.result?.response || aiResponse.text || JSON.stringify(aiResponse);
        }
        let cleanedText = typeof responseText === "string" ? responseText.trim() : JSON.stringify(responseText);
        if (cleanedText.startsWith("```json")) {
          cleanedText = cleanedText.replace(/^```json\s*/, "").replace(/```\s*$/, "");
        } else if (cleanedText.startsWith("```")) {
          cleanedText = cleanedText.replace(/^```\s*/, "").replace(/```\s*$/, "");
        }
        return createResponse(JSON.stringify({
          success: true,
          info: cleanedText,
          bibl: [],
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }));
      } catch (error) {
        console.error("Error generating AI analysis:", error);
        return createErrorResponse(`AI analysis failed: ${error.message}`, 500);
      }
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return createResponse(
        JSON.stringify({
          status: "healthy",
          service: "Norwegian Transcription Worker",
          version: "2.1.0",
          features: ["transcription", "text_improvement", "upload", "speaker_diarization"],
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          endpoints: {
            transcribe: "/ (POST)",
            upload: "/upload (POST)",
            health: "/health (GET)",
            generateAnalysis: "/generate-analysis (POST) - NEW: Simple AI analysis using Workers AI",
            diarization: "/diarize-audio (POST) - Test speaker diarization",
            speakerIdentification: "/identify-speakers (POST) - AI-powered speaker identification",
            conversationAnalysis: "/analyze-conversation (POST) - AI conversation analysis with diarization"
          },
          diarization: {
            provider: "Hugging Face Inference Endpoint",
            model: "pyannote/speaker-diarization-3.1",
            endpoint: "https://xr8h7vvrrtja455d.us-east-1.aws.endpoints.huggingface.cloud",
            status: "active"
          }
        })
      );
    }
    if (request.method === "POST" && url.pathname === "/diarize-audio") {
      try {
        const { audioUrl } = await request.json();
        if (!audioUrl) {
          return createErrorResponse("Missing required audioUrl parameter", 400);
        }
        console.log("\u{1F3A4} Diarization request:", { audioUrl, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
        let r2Key;
        if (audioUrl.includes("audio.vegvisr.org/")) {
          r2Key = audioUrl.split("audio.vegvisr.org/")[1];
        } else if (audioUrl.includes(".r2.cloudflarestorage.com/")) {
          r2Key = audioUrl.split(".r2.cloudflarestorage.com/")[1];
        } else {
          return createErrorResponse(`Invalid audio URL format: ${audioUrl}`, 400);
        }
        console.log("\u{1F4E5} Downloading audio from R2:", { r2Key });
        const audioObject = await env.NORWEGIAN_AUDIO_BUCKET.get(r2Key);
        if (!audioObject) {
          return createErrorResponse(`Audio file not found: ${r2Key}`, 404);
        }
        const audioBuffer = await audioObject.arrayBuffer();
        console.log("\u{1F4C1} Audio downloaded:", {
          size: audioBuffer.byteLength,
          sizeMB: (audioBuffer.byteLength / 1024 / 1024).toFixed(2)
        });
        const base64Audio = arrayBufferToBase64(audioBuffer);
        console.log("\u{1F504} Converted to base64:", { length: base64Audio.length });
        const HF_DIARIZATION_ENDPOINT = "https://xr8h7vvrrtja455d.us-east-1.aws.endpoints.huggingface.cloud";
        console.log("\u{1F680} Calling HF diarization endpoint...");
        const diarizationResponse = await fetch(HF_DIARIZATION_ENDPOINT, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.whisperailab}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            inputs: base64Audio
          })
        });
        if (!diarizationResponse.ok) {
          const errorText = await diarizationResponse.text();
          console.error("\u274C Diarization failed:", {
            status: diarizationResponse.status,
            error: errorText
          });
          return createErrorResponse(
            `Diarization service error (${diarizationResponse.status}): ${errorText}`,
            502
          );
        }
        const diarizationResult = await diarizationResponse.json();
        console.log("\u2705 Diarization successful:", {
          hasSegments: !!diarizationResult.segments,
          segmentCount: diarizationResult.segments?.length
        });
        return createResponse(JSON.stringify({
          success: true,
          segments: diarizationResult.segments || [],
          metadata: {
            audioUrl,
            r2Key,
            processedAt: (/* @__PURE__ */ new Date()).toISOString(),
            service: "Hugging Face Speaker Diarization",
            model: "pyannote/speaker-diarization-3.1",
            segmentCount: diarizationResult.segments?.length || 0
          }
        }));
      } catch (error) {
        console.error("\u274C Diarization error:", error);
        return createErrorResponse(`Diarization failed: ${error.message}`, 500);
      }
    }
    if (request.method === "POST" && url.pathname === "/identify-speakers") {
      try {
        const { transcriptionText, speakerTimeline, numSpeakers } = await request.json();
        if (!transcriptionText || !speakerTimeline || speakerTimeline.length === 0) {
          return createErrorResponse("Missing required data: transcriptionText and speakerTimeline required", 400);
        }
        console.log("\u{1F916} Identifying speakers with AI:", {
          textLength: transcriptionText.length,
          segments: speakerTimeline.length,
          numSpeakers
        });
        const totalDuration = Math.max(...speakerTimeline.map((s) => s.end));
        const totalChars = transcriptionText.length;
        const approxSecondsPerChar = totalDuration / totalChars;
        let prompt = `Du skal automatisk segmentere denne norske samtalen i talersegmenter.

`;
        prompt += `INFORMASJON:
`;
        prompt += `- Antall talere: ${numSpeakers}
`;
        prompt += `- Total varighet: ${Math.round(totalDuration)} sekunder
`;
        prompt += `- Beregningsformel: tegnposisjon \xD7 ${approxSecondsPerChar.toFixed(4)} = sekunder

`;
        prompt += `TRANSKRIPSJON:
"${transcriptionText}"

`;
        prompt += `OPPGAVE:
`;
        prompt += `1. Les hele samtalen og identifiser rollene til hver taler
`;
        prompt += `2. Analyser dialogm\xF8nsteret - sp\xF8rsm\xE5l, svar, lengre monologer, korte responser
`;
        prompt += `3. Identifiser ALLE steder i teksten hvor taleren skifter
`;
        prompt += `4. For hvert segment, beregn start/slutt-tid basert p\xE5 tegnposisjon i teksten

`;
        prompt += `EKSEMPEL P\xC5 TALERSKIFT:
`;
        prompt += `- Sp\xF8rsm\xE5l etterfulgt av svar = talerskift
`;
        prompt += `- Lang monolog = \xE9n taler
`;
        prompt += `- Korte bekreftelser ("ja", "ok") = \xE9n taler
`;
        prompt += `- Emnebytte eller ny tankerekke = potensielt talerskift

`;
        prompt += `Svar KUN med JSON (ingen markdown, ingen forklaring):
`;
        prompt += `{"speakers":[{"index":0,"role":"Terapeut/Klient","reasoning":"kort forklaring","suggestedName":"Navn"}],`;
        prompt += `"suggestedTimeline":[{"speaker":0,"start":0,"end":15.5,"role":"Terapeut","textExcerpt":"f\xF8rste 50 tegn..."}]}

`;
        prompt += `VIKTIG: Generer ALLE segmenter du kan identifisere i samtalen.`;
        console.log("\u{1F4E4} Calling Cloudflare Workers AI for automatic speaker segmentation");
        console.log("\u{1F4CA} Input:", {
          promptLength: prompt.length,
          transcriptionLength: transcriptionText.length,
          expectedSegments: "auto-detect all speaker changes"
        });
        const aiResponse = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: [
            {
              role: "system",
              content: "Du er ekspert p\xE5 \xE5 analysere dialoger og identifisere talerskift. Du analyserer norsk transkribert tale og genererer automatiske talersegmenter. Svar KUN med valid JSON. VIKTIG: S\xF8rg for at JSON er komplett og valid med alle kr\xF8llete parenteser lukket."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 4096,
          stream: false
        });
        console.log("\u2705 AI response received:", {
          hasResponse: !!aiResponse,
          responseType: typeof aiResponse
        });
        console.log("\u2705 AI response received:", {
          hasResponse: !!aiResponse,
          responseType: typeof aiResponse
        });
        let speakerIdentifications;
        try {
          const aiText = aiResponse.response || JSON.stringify(aiResponse);
          console.log("\u{1F4DD} Full AI response text length:", aiText.length);
          console.log("\u{1F4DD} AI response text (first 500 chars):", aiText.substring(0, 500));
          let cleanedText = aiText.trim();
          if (cleanedText.startsWith("```json")) {
            cleanedText = cleanedText.replace(/^```json\s*/, "").replace(/```\s*$/, "");
          } else if (cleanedText.startsWith("```")) {
            cleanedText = cleanedText.replace(/^```\s*/, "").replace(/```\s*$/, "");
          }
          if (!cleanedText.trim().endsWith("}")) {
            console.log("\u26A0\uFE0F JSON appears incomplete, attempting to repair");
            const openBrackets = (cleanedText.match(/\[/g) || []).length;
            const closeBrackets = (cleanedText.match(/\]/g) || []).length;
            const openBraces = (cleanedText.match(/\{/g) || []).length;
            const closeBraces = (cleanedText.match(/\}/g) || []).length;
            cleanedText = cleanedText.replace(/,\s*$/, "");
            for (let i = 0; i < openBrackets - closeBrackets; i++) {
              cleanedText += "]";
            }
            for (let i = 0; i < openBraces - closeBraces; i++) {
              cleanedText += "}";
            }
            console.log("\u{1F527} Repaired JSON (last 200 chars):", cleanedText.substring(cleanedText.length - 200));
          }
          console.log("\u{1F4DD} Final JSON (first 200 chars):", cleanedText.substring(0, 200));
          speakerIdentifications = JSON.parse(cleanedText);
          console.log("\u2705 Successfully parsed speaker identifications:", {
            hasSpeakers: !!speakerIdentifications.speakers,
            speakersCount: speakerIdentifications.speakers?.length,
            hasTimeline: !!speakerIdentifications.suggestedTimeline,
            timelineCount: speakerIdentifications.suggestedTimeline?.length
          });
        } catch (parseError) {
          console.error("Failed to parse AI response:", parseError);
          console.error("Parse error details:", {
            message: parseError.message,
            stack: parseError.stack
          });
          speakerIdentifications = {
            speakers: [],
            suggestedTimeline: [],
            rawResponse: JSON.stringify(aiResponse),
            error: parseError.message
          };
        }
        return createResponse(JSON.stringify({
          success: true,
          identifications: speakerIdentifications,
          processingTime: Date.now()
        }));
      } catch (error) {
        console.error("Error identifying speakers:", error);
        return createErrorResponse(`Speaker identification failed: ${error.message}`, 500);
      }
    }
    if (request.method === "POST" && url.pathname === "/analyze-conversation") {
      try {
        const body = await request.json();
        const { transcription, diarization, context, model = "cloudflare" } = body;
        if (!transcription || !diarization?.segments) {
          return createErrorResponse("Transcription and diarization data required", 400);
        }
        const providers = {
          cloudflare: { type: "cloudflare", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
          claude: { type: "anthropic", apiKey: env.ANTHROPIC_API_KEY, baseURL: "https://api.anthropic.com/v1", model: "claude-sonnet-4-6" },
          grok: { type: "openai", apiKey: env.XAI_API_KEY, baseURL: "https://api.x.ai/v1", model: "grok-beta" },
          gemini: { type: "gemini", apiKey: env.GOOGLE_GEMINI_API_KEY, baseURL: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-1.5-pro" },
          gpt4: { type: "openai", apiKey: env.OPENAI_API_KEY, baseURL: "https://api.openai.com/v1", model: "gpt-4" },
          gpt5: { type: "openai", apiKey: env.OPENAI_API_KEY, baseURL: "https://api.openai.com/v1", model: "gpt-5" }
        };
        const provider = providers[model] || providers.cloudflare;
        console.log("\u{1F3AD} Analyzing conversation:", {
          segmentCount: diarization.segments.length,
          hasContext: !!context,
          transcriptionLength: transcription.length,
          provider: model,
          type: provider.type
        });
        const conversationTimeline = diarization.segments.map((segment) => {
          const startTime = Math.floor(segment.start);
          const minutes = Math.floor(startTime / 60);
          const seconds = startTime % 60;
          const timeLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;
          return `[${timeLabel}] ${segment.speaker}: [speaking for ${Math.floor(segment.end - segment.start)}s]`;
        }).join("\n");
        const systemPrompt = "Du er en ekspert p\xE5 samtaleanalyse. Du analyserer norske samtaler og gir innsiktsfulle, strukturerte analyser. Svar alltid med valid JSON.";
        let userPrompt = `Analyser denne samtalen og gi en strukturert analyse.

`;
        if (context) {
          userPrompt += `Kontekst: ${context}

`;
        }
        userPrompt += `Samtale tidslinje:
${conversationTimeline}

`;
        userPrompt += `Full transkripsjon:
${transcription.substring(0, 8e3)}

`;
        userPrompt += `Generer analyse i f\xF8lgende JSON-format:
`;
        userPrompt += `{
`;
        userPrompt += `  "summary": "Kort 2-3 setningers oppsummering",
`;
        userPrompt += `  "keyThemes": ["tema1", "tema2", "tema3"],
`;
        userPrompt += `  "speakerRoles": {
`;
        userPrompt += `    "SPEAKER_01": {"role": "Rolle", "characteristics": "Beskrivelse"},
`;
        userPrompt += `    "SPEAKER_02": {"role": "Rolle", "characteristics": "Beskrivelse"}
`;
        userPrompt += `  },
`;
        userPrompt += `  "keyMoments": [
`;
        userPrompt += `    {"timestamp": 145, "speaker": "SPEAKER_01", "description": "Hva skjedde"}
`;
        userPrompt += `  ],
`;
        userPrompt += `  "actionItems": ["handling1", "handling2"]
`;
        userPrompt += `}

`;
        userPrompt += `Svar KUN med valid JSON, ingen markdown eller forklaring.`;
        let analysisResult;
        if (provider.type === "cloudflare") {
          console.log("\u{1F4E4} Calling Cloudflare Workers AI");
          const aiResponse = await env.AI.run(provider.model, {
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.2,
            max_tokens: 2048,
            stream: false
          });
          console.log("\u2705 AI analysis response received");
          if (aiResponse.response && typeof aiResponse.response === "object") {
            analysisResult = aiResponse.response;
          } else {
            const aiText = aiResponse.response || aiResponse.result?.response || aiResponse.text || JSON.stringify(aiResponse);
            let cleanedText = typeof aiText === "string" ? aiText.trim() : JSON.stringify(aiText);
            if (cleanedText.startsWith("```json")) {
              cleanedText = cleanedText.replace(/^```json\s*/, "").replace(/```\s*$/, "");
            } else if (cleanedText.startsWith("```")) {
              cleanedText = cleanedText.replace(/^```\s*/, "").replace(/```\s*$/, "");
            }
            analysisResult = JSON.parse(cleanedText);
          }
        } else if (provider.type === "anthropic") {
          console.log("\u{1F4E4} Calling Claude API");
          if (!provider.apiKey) {
            return createErrorResponse("Anthropic API key not configured", 500);
          }
          const response = await fetch(`${provider.baseURL}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": provider.apiKey,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: provider.model,
              max_tokens: 4096,
              temperature: 0.2,
              messages: [
                { role: "user", content: `${systemPrompt}

${userPrompt}` }
              ]
            })
          });
          const data = await response.json();
          const textContent = data.content?.[0]?.text || JSON.stringify(data);
          analysisResult = JSON.parse(textContent.replace(/^```json\s*/, "").replace(/```\s*$/, ""));
          console.log("\u2705 Claude analysis completed");
        } else if (provider.type === "gemini") {
          console.log("\u{1F4E4} Calling Gemini API");
          if (!provider.apiKey) {
            return createErrorResponse("Google Gemini API key not configured", 500);
          }
          const response = await fetch(`${provider.baseURL}/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: `${systemPrompt}

${userPrompt}` }]
              }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096
              }
            })
          });
          const data = await response.json();
          const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);
          analysisResult = JSON.parse(textContent.replace(/^```json\s*/, "").replace(/```\s*$/, ""));
          console.log("\u2705 Gemini analysis completed");
        } else if (provider.type === "openai") {
          console.log("\u{1F4E4} Calling OpenAI-compatible API:", model, provider.model);
          if (!provider.apiKey) {
            return createErrorResponse(`API key not configured for ${model} provider`, 500);
          }
          const response = await fetch(`${provider.baseURL}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${provider.apiKey}`
            },
            body: JSON.stringify({
              model: provider.model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              temperature: 0.2,
              max_tokens: 4096
            })
          });
          const data = await response.json();
          const textContent = data.choices?.[0]?.message?.content || JSON.stringify(data);
          analysisResult = JSON.parse(textContent.replace(/^```json\s*/, "").replace(/```\s*$/, ""));
          console.log("\u2705 OpenAI-compatible analysis completed");
        }
        return createResponse(JSON.stringify({
          success: true,
          analysis: analysisResult,
          metadata: {
            model,
            provider: provider.type,
            analyzedAt: (/* @__PURE__ */ new Date()).toISOString(),
            segmentCount: diarization.segments.length,
            hasContext: !!context
          }
        }));
      } catch (error) {
        console.error("Conversation analysis error:", error);
        return createErrorResponse(error.message || "Analysis failed", 500);
      }
    }
    if (request.method === "POST" && url.pathname === "/upload") {
      return handleUpload(request, env);
    }
    if (request.method === "POST" && url.pathname === "/upload/init") {
      return handleUploadInit(request, env);
    }
    if (request.method === "POST" && url.pathname === "/upload/part") {
      return handleUploadPart(request, env);
    }
    if (request.method === "POST" && url.pathname === "/upload/complete") {
      return handleUploadComplete(request, env);
    }
    if (request.method === "POST" && url.pathname === "/upload/abort") {
      return handleUploadAbort(request, env);
    }
    if (request.method === "POST" && url.pathname === "/transcribe-from-url") {
      return handleNorwegianTranscribe(request, env);
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    try {
      const formData = await request.formData();
      const audioFile = formData.get("audio");
      const model = formData.get("model") || "medium";
      const endpoint = formData.get("endpoint") || "cpu";
      const context = formData.get("context") || "";
      if (!audioFile) {
        return new Response(JSON.stringify({ error: "No audio file provided" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const startTime = Date.now();
      const audioBuffer = await audioFile.arrayBuffer();
      const base64Audio = arrayBufferToBase64(audioBuffer);
      console.log("\u{1F680} Calling transcription service with model selection:", {
        selectedModel: model,
        endpointType: endpoint,
        hasAudio: !!audioFile,
        audioSize: audioBuffer.byteLength,
        base64Size: base64Audio.length,
        hasContext: !!context,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const useGpu = endpoint.toLowerCase() === "gpu";
      const transcriptionResponse = await callNorwegianTranscription(base64Audio, env, useGpu);
      if (!transcriptionResponse.success) {
        console.error("Norwegian transcription failed:", transcriptionResponse.error);
        throw new Error(transcriptionResponse.error);
      }
      const transcriptionData = transcriptionResponse.result;
      console.log("\u2705 Transcription successful:", {
        modelUsed: transcriptionResponse.modelUsed,
        endpoint: transcriptionResponse.endpoint,
        attempts: transcriptionResponse.attemptsUsed
      });
      let rawText = "";
      let timestampedText = "";
      if (typeof transcriptionData === "string") {
        rawText = transcriptionData;
      } else if (transcriptionData.text) {
        rawText = transcriptionData.text;
        timestampedText = addSentenceTimestamps(transcriptionData);
      } else if (Array.isArray(transcriptionData) && transcriptionData[0]?.text) {
        rawText = transcriptionData[0].text;
        timestampedText = addSentenceTimestamps(transcriptionData[0]);
      } else if (transcriptionData.generated_text) {
        rawText = transcriptionData.generated_text;
      } else {
        throw new Error("Invalid transcription response format");
      }
      if (!rawText) {
        throw new Error("No transcription text received");
      }
      let improvedText = null;
      let improvementTime = 0;
      try {
        const improvementStart = Date.now();
        const improvementRequest = new Request("https://dummy-url/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: rawText,
            context
          })
        });
        const improvementResponse = await env.NORWEGIAN_TEXT_WORKER.fetch(improvementRequest);
        if (improvementResponse.ok) {
          const improvementData = await improvementResponse.json();
          if (improvementData.success && improvementData.improved_text) {
            improvedText = improvementData.improved_text;
            improvementTime = Date.now() - improvementStart;
          }
        }
      } catch (error) {
        console.error("Text improvement failed:", error);
      }
      const totalTime = Date.now() - startTime;
      return new Response(
        JSON.stringify({
          success: true,
          transcription: {
            raw_text: rawText,
            timestamped_text: timestampedText || rawText,
            // Include timestamped version
            improved_text: improvedText,
            language: "no",
            chunks: 1,
            processing_time: 0,
            improvement_time: improvementTime,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          },
          metadata: {
            filename: audioFile.name,
            model,
            modelUsed: transcriptionResponse.modelUsed,
            endpoint: transcriptionResponse.endpoint,
            endpointType: transcriptionResponse.endpointType,
            requestedModel: model,
            requestedEndpoint: endpoint,
            total_processing_time: totalTime,
            transcription_server: "Hugging Face",
            coldStartDetected: transcriptionResponse.coldStartDetected,
            text_improvement: improvedText ? "Cloudflare Workers AI - Llama 3.3 70B Fast" : "Not available",
            cloudflare_ai_available: improvedText !== null,
            hasTimestamps: !!timestampedText
          }
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    } catch (error) {
      console.error("Norwegian transcription error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || "Transcription failed",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
  }
};
export {
  index_default as default
};
