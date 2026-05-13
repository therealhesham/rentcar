/**
 * مواعيد فتح الفروع بتوقيت السعودية (Asia/Riyadh).
 * JSON في قاعدة البيانات: { "days": { "0": { "open": "09:00", "close": "22:00" }, ... } }
 * المفتاح 0 = الأحد … 6 = السبت (مثل JavaScript getDay في التقويم الميلادي).
 */

export const BRANCH_OPENING_HOURS_TIMEZONE = "Asia/Riyadh";

export type BranchDayHoursRow = {
  closed?: boolean;
  open?: string;
  close?: string;
};

export type BranchOpeningHoursSchedule = {
  days: Partial<Record<string, BranchDayHoursRow>>;
};

/** دقائق منذ منتصف الليل في توقيت الرياض لحظة `at`. */
export function riyadhMinutesSinceMidnight(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BRANCH_OPENING_HOURS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  let h = 0;
  let m = 0;
  for (const p of parts) {
    if (p.type === "hour") h = Number(p.value);
    if (p.type === "minute") m = Number(p.value);
  }
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/** 0 = الأحد … 6 = السبت في تقويم الرياض. */
export function riyadhJsWeekday(at: Date): number {
  const w = new Intl.DateTimeFormat("en-US", {
    timeZone: BRANCH_OPENING_HOURS_TIMEZONE,
    weekday: "short",
  }).format(at);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[w] ?? 0;
}

export function parseHmToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59 || h < 0 || min < 0) {
    return null;
  }
  return h * 60 + min;
}

/** true إذا كان الجدول «فارغاً» من ناحية التقييد (يُعامل كـ 24/7). */
export function scheduleHasAnyRule(schedule: BranchOpeningHoursSchedule | null): boolean {
  if (!schedule || !schedule.days || typeof schedule.days !== "object") return false;
  return Object.keys(schedule.days).length > 0;
}

export function parseBranchOpeningHoursJson(
  raw: string | null | undefined,
): BranchOpeningHoursSchedule | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    const o = JSON.parse(t) as unknown;
    if (!o || typeof o !== "object") return null;
    const rec = o as Record<string, unknown>;
    const days = rec.days;
    if (!days || typeof days !== "object") return null;
    const out: BranchOpeningHoursSchedule["days"] = {};
    for (const [k, v] of Object.entries(days as Record<string, unknown>)) {
      if (!/^[0-6]$/.test(k)) continue;
      if (!v || typeof v !== "object") continue;
      const row = v as Record<string, unknown>;
      const closed = row.closed === true;
      const open = typeof row.open === "string" ? row.open : undefined;
      const close = typeof row.close === "string" ? row.close : undefined;
      out[k] = { closed, open, close };
    }
    if (Object.keys(out).length === 0) return null;
    return { days: out };
  } catch {
    return null;
  }
}

function dayRowAllows(
  row: BranchDayHoursRow | undefined,
  minutes: number,
): { ok: boolean } {
  if (!row || row.closed === true) return { ok: false };
  const o = row.open?.trim();
  const c = row.close?.trim();
  if (!o || !c) return { ok: false };
  const openM = parseHmToMinutes(o);
  const closeM = parseHmToMinutes(c);
  if (openM == null || closeM == null) return { ok: false };
  if (openM >= closeM) return { ok: false };
  return { ok: minutes >= openM && minutes <= closeM };
}

/** هل اللحظة ضمن مواعيد الفرع؟ schedule = null → دائماً نعم. */
export function isDateTimeWithinBranchSchedule(
  at: Date,
  schedule: BranchOpeningHoursSchedule | null,
): boolean {
  if (!scheduleHasAnyRule(schedule)) return true;
  const d = String(riyadhJsWeekday(at));
  const row = schedule!.days[d];
  const minutes = riyadhMinutesSinceMidnight(at);
  return dayRowAllows(row, minutes).ok;
}
