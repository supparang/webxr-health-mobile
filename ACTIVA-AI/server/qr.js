import crypto from "node:crypto";

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function fromB64url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function secret() {
  const value = process.env.QR_SIGNING_SECRET || "";
  if (value.length < 24) {
    throw new Error("QR_SIGNING_SECRET must be at least 24 characters");
  }
  return value;
}

function sign(encodedPayload) {
  return crypto
    .createHmac("sha256", secret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createEventToken(activityId, ttlSeconds = 45) {
  const issued = Math.floor(Date.now() / 1000);
  const payload = {
    typ: "ACTIVA_EVENT_QR",
    eventId: activityId,
    iat: issued,
    exp: issued + ttlSeconds,
    nonce: crypto.randomBytes(12).toString("base64url"),
    kv: 1,
  };

  const encoded = b64url(JSON.stringify(payload));
  const signature = sign(encoded);
  return {
    token: encoded + "." + signature,
    payload,
    tokenHash: crypto.createHash("sha256").update(encoded + "." + signature).digest("hex"),
  };
}

export function verifyEventToken(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 2) return { ok: false, reason: "MALFORMED_TOKEN" };

    const encoded = parts[0];
    const supplied = parts[1];
    const expected = sign(encoded);

    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, reason: "INVALID_SIGNATURE" };
    }

    const payload = JSON.parse(fromB64url(encoded));
    if (payload.typ !== "ACTIVA_EVENT_QR") return { ok: false, reason: "INVALID_TYPE" };

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return { ok: false, reason: "EXPIRED_TOKEN", payload };

    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "TOKEN_VALIDATION_ERROR" };
  }
}
