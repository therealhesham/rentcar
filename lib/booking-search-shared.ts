import { computeBookingDays } from "@/lib/booking-days";

export type RentalTab = "daily" | "weekly" | "monthly" | "monthly_packages";
export type ModeTab = "pickup" | "delivery";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** قيمة حقول `datetime-local` بالتوقيت المحلي */
export function toDatetimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function addLocalDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/** شهر تقويمي كامل؛ إن لم يوجد نفس يوم الشهر يُضبط على آخر يوم الشهر السابق */
export function addLocalCalendarMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) {
    d.setDate(0);
  }
  return d;
}

export function computeAutoDropoff(pickup: Date, rental: RentalTab): Date | null {
  if (rental === "weekly") return addLocalDays(pickup, 7);
  if (rental === "monthly" || rental === "monthly_packages") {
    return addLocalCalendarMonths(pickup, 1);
  }
  return null;
}

export function validateRentalMinDays(rental: RentalTab, days: number): string | null {
  if (rental === "weekly" && days < 7) {
    return "نوع الأسبوعي يتطلّب مدة لا تقل عن 7 أيام بين الاستلام والتسليم.";
  }
  if (rental === "monthly_packages" && days < 28) {
    return "الباقات الشهرية تتطلّب مدة لا تقل عن 28 يوماً بين الاستلام والتسليم.";
  }
  if (rental === "monthly" && days < 28) {
    return "نوع الشهري يتطلّب مدة لا تقل عن 28 يوماً بين الاستلام والتسليم.";
  }
  return null;
}

export function computeDaysPreview(pickupDt: string, dropoffDt: string): number | null {
  if (!pickupDt || !dropoffDt) return null;
  const p = new Date(pickupDt);
  const d = new Date(dropoffDt);
  if (Number.isNaN(p.getTime()) || Number.isNaN(d.getTime())) return null;
  return computeBookingDays(p, d);
}

/** مقطع مساعدة تحت عنوان «تاريخ التسليم» في نماذج البحث */
export function rentalDropoffHint(rental: RentalTab): string | undefined {
  if (rental === "weekly") return "يُحدَّد تلقائياً بعد أسبوع من وقت الاستلام.";
  if (rental === "monthly") return "يُحدَّد تلقائياً بعد شهر تقويمي من الاستلام.";
  if (rental === "monthly_packages") {
    return "فترة شهر تقويمي أساساً للبحث؛ التسعير وفق الباقات الشهرية المعروضة.";
  }
  return undefined;
}

/** عرض تواريخ الـ widget: YYYY-MM-DD → DD-MM-YY */
export function formatYmdAsDdMmYy(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${d}-${mo}-${y.slice(-2)}`;
}

/** من قيمة `datetime-local` (YYYY-MM-DDTHH:mm) → DD-MM-YY • HH:mm */
export function formatDatetimeLocalAsDdMmYyTime(isoLocal: string): string {
  const t = isoLocal.trim();
  if (t.length < 10) return "";
  const ddmmyy = formatYmdAsDdMmYy(t.slice(0, 10));
  if (!ddmmyy) return "";
  const ti = t.indexOf("T");
  if (ti === -1) return ddmmyy;
  const timePart = t.slice(ti + 1, ti + 6);
  if (timePart.length < 5) return ddmmyy;
  return `${ddmmyy} • ${timePart}`;
}

/** يُفسَّر DD-MM-YY أو DD-MM-YYYY (أو بشرطة مائلة) → YYYY-MM-DD */
export function parseDdMmYyToYmd(text: string): string | null {
  const cleaned = text.trim().replace(/\//g, "-").replace(/\s+/g, "");
  const m = /^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/.exec(cleaned);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (m[3].length === 2) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const cal = new Date(year, month - 1, day);
  if (cal.getFullYear() !== year || cal.getMonth() !== month - 1 || cal.getDate() !== day) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** يدمج تاريخ YYYY-MM-DD ووقت HH:mm (من حقل time) لقيمة نفس شكل `datetime-local` */
export function composeDatetimeLocal(ymd: string, hm: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const tm = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!tm) return null;
  const hh = Number(tm[1]);
  const mm = Number(tm[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${ymd}T${pad2(hh)}:${pad2(mm)}`;
}

/** لمزامنة حقول العرض من قيمة datetime-local داخلية */
export function draftFromDatetimeLocal(iso: string): { dateDdMmYy: string; hm: string } {
  if (!iso || iso.length < 10) return { dateDdMmYy: "", hm: "09:00" };
  const ymd = iso.slice(0, 10);
  const hm = iso.includes("T") && iso.length >= 16 ? iso.slice(11, 16) : "09:00";
  const dateDdMmYy = formatYmdAsDdMmYy(ymd);
  return { dateDdMmYy: dateDdMmYy || "", hm };
}
