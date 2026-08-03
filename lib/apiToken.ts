const encoder = new TextEncoder();

const COOKIE_NAME = "api_session";
const DEFAULT_TTL_SEC = 300; 

/**
 * Uses the Web Crypto API (globalThis.crypto.subtle) instead of Node's
 * `crypto` module — Node's crypto is NOT available in the Edge runtime,
 * which is what middleware.ts runs on by default. Web Crypto works in
 * both Edge and Node, so this file is safe to import from middleware.
 */
async function getKey(): Promise<CryptoKey> {
  const secret = process.env.API_TOKEN_SECRET;
  if (!secret) {
    throw new Error("API_TOKEN_SECRET is not set");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/** Creates a signed token: `<payload>.<expiry>.<hmac-hex>` */
export async function signToken(
  payload = "web",
  expiresInSec = DEFAULT_TTL_SEC
): Promise<string> {
  const key = await getKey();
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const data = `${payload}.${exp}`;
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return `${data}.${toHex(sigBuf)}`;
}

/**
 * Verifies signature and expiry. `crypto.subtle.verify` does a
 * constant-time comparison internally, so no separate timing-safe-equal
 * helper is needed here (unlike the Node.js crypto version).
 */
export async function verifyToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [payload, exp, sigHex] = parts;

  try {
    const key = await getKey();
    const data = `${payload}.${exp}`;
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromHex(sigHex),
      encoder.encode(data)
    );
    if (!valid) return false;
  } catch {
    return false;
  }

  return Number(exp) > Math.floor(Date.now() / 1000);
}

export { COOKIE_NAME };