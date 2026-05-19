import type { AdminSession } from "@/lib/admin-session-token";

function getSessionSecret(): string | undefined {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function signPayloadEdge(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return bytesToHex(mac);
}

function decodeBase64Url(input: string): string | null {
  try {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export async function parseAdminSessionTokenEdge(
  raw: string | undefined | null,
): Promise<AdminSession | null> {
  const secret = getSessionSecret();
  if (!secret || !raw) return null;
  const dot = raw.indexOf(".");
  if (dot < 0) return null;
  const payloadPart = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const payload = decodeBase64Url(payloadPart);
  if (!payload) return null;
  const expected = await signPayloadEdge(payload, secret);
  if (!timingSafeEqualHex(sig, expected)) return null;
  let data: AdminSession;
  try {
    data = JSON.parse(payload) as AdminSession;
  } catch {
    return null;
  }
  if (typeof data.exp !== "number" || data.exp <= Date.now()) return null;
  if (typeof data.isSuperAdmin !== "boolean") return null;
  if (data.employeeId != null && typeof data.employeeId !== "number") return null;
  if (data.branchId != null && typeof data.branchId !== "number") return null;
  if (data.branchSlug != null && typeof data.branchSlug !== "string") return null;
  if (data.branchName != null && typeof data.branchName !== "string") return null;
  if (typeof data.displayName !== "string") return null;
  if (!data.isSuperAdmin && !data.branchSlug) return null;
  return data;
}
