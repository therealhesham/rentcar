/** يقيِّد yyyy-mm-dd ويمرّره إلى ظهر UTC لتخفيف حدود اليوم الزمنية. */

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ParseStartDateResult =
  | { ok: true; date: Date }
  | { ok: false; error: string };

export function parseSubscriptionStartDateYmd(ymd: string): ParseStartDateResult {
  const m = YMD.exec(String(ymd).trim());
  if (!m) {
    return { ok: false, error: "أدخل تاريخ بداية الباقة بصيغة yyyy-mm-dd." };
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const candidate = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (
    candidate.getUTCFullYear() !== y ||
    candidate.getUTCMonth() !== mo - 1 ||
    candidate.getUTCDate() !== d
  ) {
    return { ok: false, error: "تاريخ البداية غير صالح في التقويم." };
  }

  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const chosenStart = Date.UTC(y, mo - 1, d);
  if (chosenStart < todayStart) {
    return { ok: false, error: "لا يمكن أن يكون يوم البداية قبل اليوم." };
  }

  return { ok: true, date: candidate };
}
