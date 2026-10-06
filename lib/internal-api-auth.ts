
import { createHmac, timingSafeEqual } from "crypto";

export const INTERNAL_AUTH_HEADER = "x-internal-secret";

/** مقارنة بوقت ثابت لنصّين مهما اختلف طولهما. */
function secretsMatch(a: string, b: string): boolean {
  // HMAC للطرفين بمفتاح عشوائي لكل نداء: بيساوي الطول قبل المقارنة من غير ما
  // يسرّب طول السرّ الحقيقي، وهي الحيلة القياسية لتفادي رمي timingSafeEqual
  // على مدخلات مختلفة الطول.
  const key = createHmac("sha256", "len-eq").update(String(Date.now())).digest();
  const ha = createHmac("sha256", key).update(a).digest();
  const hb = createHmac("sha256", key).update(b).digest();
  return timingSafeEqual(ha, hb);
}

export type InternalAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

export function verifyInternalRequest(req: Request): InternalAuthResult {
  const expected = (process.env.INTERNAL_API_SECRET ?? "").trim();
  if (!expected) {
    return { ok: false, status: 503, error: "internal api not configured" };
  }
  const got = (req.headers.get(INTERNAL_AUTH_HEADER) ?? "").trim();
  if (!got || !secretsMatch(got, expected)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}

/** يقرأ ويتحقق من `customerId` في جسم الطلب. */
export function readCustomerId(body: unknown): number | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = (body as Record<string, unknown>).customerId;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}
