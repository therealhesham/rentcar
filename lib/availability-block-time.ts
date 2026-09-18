/**
 * أدوات تحليل/تنسيق وقت خالصة — بلا اتصال قاعدة بيانات وبلا `"server-only"` عمداً، لأنها
 * تُستخدم من مكوّن عميل (شاشة معاينة الأعمدة في `app/admin/(dashboard)/fleet-availability
 * /import/AvailabilityImportClient.tsx`) بجانب `lib/availability-block-import.ts` في الخادم.
 */

function toLatinDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * يحلّل خلية وقت لصيغة `HH:mm`. يدعم: نص مباشر (`14:30` أو `2:30 PM`/`٩:٠٠ ص`)، ISO كامل
 * (من `cellToPlainStringWithTime` لخلية Time حقيقية في Excel — نأخذ جزء الوقت فقط بلا
 * اعتبار للتاريخ المرفق لأن Excel يُرسي خلايا الوقت المجرّد على تاريخ وهمي مثل ١٨٩٩)،
 * وكسر يوم رقمي خام (نادر، لو رجعت المكتبة رقماً بدل تاريخ).
 */
export function parseHmCell(raw: string): string | null {
  const s = toLatinDigits(raw).trim();
  if (!s) return null;

  const iso = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/.exec(s);
  if (iso) return `${iso[1]}:${iso[2]}`;

  const hm = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(ص|م|am|pm)?$/i.exec(s);
  if (hm) {
    let hh = Number(hm[1]);
    const mm = Number(hm[2]);
    const suffix = hm[3]?.toLowerCase();
    if (hh > 23 || mm > 59) return null;
    if (suffix === "م" || suffix === "pm") {
      if (hh < 12) hh += 12;
    } else if (suffix === "ص" || suffix === "am") {
      if (hh === 12) hh = 0;
    }
    if (hh > 23) return null;
    return `${pad2(hh)}:${pad2(mm)}`;
  }

  if (/^0?\.\d+$/.test(s)) {
    const frac = Number(s);
    const totalMinutes = Math.round(frac * 24 * 60);
    const hh = Math.floor(totalMinutes / 60) % 24;
    const mm = totalMinutes % 60;
    return `${pad2(hh)}:${pad2(mm)}`;
  }

  return null;
}

/**
 * للعرض فقط في شاشة معاينة الأعمدة — تحوّل قيمة خلية وقت خام لصيغة HH:mm قابلة للقراءة
 * بدل نص ISO مربك (`1899-12-30T14:30:00.000Z`) قادم من خلية Time حقيقية في Excel. لو
 * تعذّر التحليل تُرجع القيمة كما هي — التحقق الفعلي والرسالة الواضحة يحصلا وقت الفحص
 * («فحص بدون حفظ») عبر `parseHmCell` نفسها، مش هنا.
 */
export function previewTimeCell(raw: string): string {
  return parseHmCell(raw) ?? raw;
}

/**
 * للعرض فقط — لو القيمة ISO كامل (من خلية Excel Date حقيقية) نعرض جزء التاريخ فقط بدل
 * السلسلة الكاملة (`2026-09-25T00:00:00.000Z` → `2026-09-25`).
 */
export function previewDateCell(raw: string): string {
  const iso = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}/.exec(raw.trim());
  return iso ? iso[1]! : raw;
}
