/**
 * أدوات الوقت لصفحة «إحصائيات» — كلها بتوقيت الرياض.
 *
 * قاعدة البيانات تخزّن UTC، وقراءة الساعة من `Date.getHours()` تعطي توقيت الخادم.
 * على خادم UTC تظهر ذروة الساعة ٩ مساءً كأنها ٦ مساءً — فرق ثلاث ساعات يقلب
 * الاستنتاج كله. لذلك كل اشتقاق للساعة أو اليوم يمرّ من هنا.
 */

export const RIYADH_TZ = "Asia/Riyadh";

export const WEEKDAY_LABELS = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

const PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: RIYADH_TZ,
  hour12: false,
  weekday: "short",
  hour: "numeric",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type RiyadhMoment = {
  /** 0–23 بتوقيت الرياض */
  hour: number;
  /** 0 = الأحد … 6 = السبت، بتوقيت الرياض */
  weekday: number;
  /** YYYY-MM-DD بتوقيت الرياض — مفتاح تجميع «الأيام النشطة» */
  day: string;
};

export function riyadhMoment(date: Date): RiyadhMoment {
  const parts = PARTS_FORMATTER.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  // `hour12: false` يُخرج الساعة 24 لمنتصف الليل في بعض بيئات ICU بدل 0.
  const rawHour = Number(get("hour"));
  const hour = Number.isFinite(rawHour) ? rawHour % 24 : 0;

  return {
    hour,
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    day: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

/** «٣ م» / «١١ ص» — تسمية عمود الساعة في خريطة الذروة. */
export function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "ص" : "م";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${suffix}`;
}

/** «٣ م – ٤ م» — نطاق الساعة في بطاقة الذروة. */
export function hourRangeLabel(hour: number): string {
  return `${hourLabel(hour)} – ${hourLabel((hour + 1) % 24)}`;
}

export function formatRiyadhDateTime(date: Date): string {
  return date.toLocaleString("ar-SA", {
    timeZone: RIYADH_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** «منذ ٣ ساعات» — أوضح من تاريخ كامل في عمود «آخر ظهور». */
export function relativeFromNow(date: Date, now = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.round(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  const months = Math.round(days / 30);
  return `منذ ${months} شهر`;
}
