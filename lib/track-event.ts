import type { ClientTrackableKind } from "@/lib/activity-log";

/**
 * إرسال حدث إلى سجل النشاط من المتصفح. لا يرمي أخطاء ولا يُنتظر —
 * التتبّع يجب ألا يعطّل التصفح ولا يؤخّر تنقّلاً.
 *
 * `path` يُلتقط تلقائياً **مع الـ query string**، لأن التواريخ والفرع والفئة كلها
 * فيه، وبدونها لا يمكن معرفة ما الذي بحث عنه الزائر قبل أن ينسحب.
 */
export function trackEvent(
  kind: ClientTrackableKind,
  extra?: { carModelId?: number; detail?: string; path?: string },
): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    kind,
    path: extra?.path ?? window.location.pathname + window.location.search,
    referrer: document.referrer || undefined,
    carModelId: extra?.carModelId,
    detail: extra?.detail,
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track/view", new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch("/api/track/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    /* التتبع لا يجب أن يكسر التصفح */
  }
}
