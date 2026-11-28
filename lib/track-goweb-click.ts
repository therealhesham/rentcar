import type { GowebClickType } from "@/lib/goweb-crm";

const lastSent = new Map<GowebClickType, number>();
const DEDUPE_MS = 3000;

/**
 * يبعت ضغطة إلى /api/goweb/click (وهي بتسجّلها في GoWeb). لا يرمي أخطاء ولا يُنتظر.
 * نفس النوع خلال 3 ثواني بيتحسب مرة واحدة (ضغطتين سريعتين أو لمس + نقر).
 */
export function trackGowebClick(type: GowebClickType): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - (lastSent.get(type) ?? 0) < DEDUPE_MS) return;
  lastSent.set(type, now);

  const payload = JSON.stringify({ type });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/goweb/click", new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch("/api/goweb/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    /* التتبع لا يجب أن يكسر التصفح */
  }
}
