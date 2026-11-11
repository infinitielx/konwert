// Session handling for the dashboard login.
// Uses only Web Crypto so it works in the proxy and in server code.
//
// Login values come from environment variables (never from code):
//   AUTH_USERNAME, AUTH_PASSWORD, AUTH_SECRET (random string, 16+ characters)

export const SESSION_COOKIE = "konwert_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

const enc = new TextEncoder();

function toB64Url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

/** False when the login environment variables are missing, so the site stays locked. */
export function authConfigured() {
  return Boolean(
    process.env.AUTH_USERNAME &&
      process.env.AUTH_PASSWORD &&
      (process.env.AUTH_SECRET?.length ?? 0) >= 16
  );
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(process.env.AUTH_SECRET ?? ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Signed token: base64url(payload).base64url(HMAC-SHA256 signature). */
export async function createSessionToken(user: string) {
  const payload = toB64Url(
    enc.encode(JSON.stringify({ u: user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE }))
  );
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload));
  return `${payload}.${toB64Url(new Uint8Array(sig))}`;
}

/** Returns the username when the token is genuine and not expired, otherwise null. */
export async function verifySessionToken(token?: string | null): Promise<string | null> {
  if (!token || !authConfigured()) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromB64Url(sig) as BufferSource,
      enc.encode(payload)
    );
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64Url(payload)));
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    return typeof data.u === "string" ? data.u : null;
  } catch {
    return null;
  }
}

async function sha256(s: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

/** Compares both fields in constant time (hashes first, so lengths do not leak). */
export async function checkCredentials(username: string, password: string) {
  if (!authConfigured()) return false;
  const [uIn, uOk, pIn, pOk] = await Promise.all([
    sha256(username),
    sha256(process.env.AUTH_USERNAME!),
    sha256(password),
    sha256(process.env.AUTH_PASSWORD!),
  ]);
  let diff = 0;
  for (let i = 0; i < uIn.length; i++) diff |= uIn[i] ^ uOk[i] | (pIn[i] ^ pOk[i]);
  return diff === 0;
}
