/** شريحة خصم أيام عند الإلغاء الذاتي — تُطابق حسب الوقت المتبقي قبل الاستلام. */
export type CancellationDeductTier = {
  /** إذا كان الوقت المتبقي قبل الاستلام ≤ هذا العدد (بالساعات)، تُطبَّق قيمة الخصم. */
  maxHoursBeforePickup: number;
  /** عدد أيام الإيجار المخصومة (يمكن كسوراً مثل ٠٫٥). */
  deductDays: number;
};

const MAX_TIER_HOURS = 720;
const MAX_DEDUCT_DAYS = 365;
const MAX_TIERS = 20;

const MS_PER_HOUR = 60 * 60 * 1000;

/** حدود آمنة قبل التخزين أو التطبيق. */
export function clampCancellationDeductTiersForStorage(
  tiers: CancellationDeductTier[],
): CancellationDeductTier[] {
  const sorted = [...tiers].sort((a, b) => a.maxHoursBeforePickup - b.maxHoursBeforePickup);
  return sorted
    .filter(
      (t) =>
        Number.isInteger(t.maxHoursBeforePickup) &&
        t.maxHoursBeforePickup >= 1 &&
        t.maxHoursBeforePickup <= MAX_TIER_HOURS &&
        Number.isFinite(t.deductDays) &&
        t.deductDays >= 0 &&
        t.deductDays <= MAX_DEDUCT_DAYS,
    )
    .slice(0, MAX_TIERS);
}

export function hoursBeforePickup(pickup: Date, now: Date): number {
  return (pickup.getTime() - now.getTime()) / MS_PER_HOUR;
}

/**
 * يُرتَّب حسب maxHours تصاعدياً؛ أول شريحة حيث hoursBefore ≤ maxHours تُطبَّق.
 * خارج كل الشرائح = لا خصم (إلغاء مبكر جداً).
 */
export function computeCancellationDeductedDays(
  hoursBefore: number,
  tiers: CancellationDeductTier[],
  numberOfDays: number,
): number {
  if (!tiers.length || numberOfDays <= 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.maxHoursBeforePickup - b.maxHoursBeforePickup);
  const h = Math.max(0, hoursBefore);
  for (const t of sorted) {
    if (h <= t.maxHoursBeforePickup) {
      const d = Math.max(0, t.deductDays);
      return Math.min(numberOfDays, d);
    }
  }
  return 0;
}

const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * خصم الإلغاء المبكر بعد استلام السيارة (إدارة فقط): الأيام المنقضية منذ
 * الاستلام تُحتجز بالكامل (الخدمة قُدّمت فعلياً)، وتُطبَّق شرائح السياسة على
 * الأيام المتبقية فقط بحساب الساعات قبل موعد الإرجاع الأصلي — لا استرداد كامل
 * تلقائي لبقية المدة. مشتركة بين حساب السيرفر ومعاينة الواجهة حتى لا يفترقا.
 */
export function computePickedUpCancellationDeductDays(
  pickupDate: Date,
  numberOfDays: number,
  tiers: CancellationDeductTier[],
  now: Date = new Date(),
): number {
  const elapsedDays = Math.min(
    numberOfDays,
    Math.max(0, (now.getTime() - pickupDate.getTime()) / MS_PER_DAY),
  );
  const remainingDays = Math.max(0, numberOfDays - elapsedDays);
  const returnDate = new Date(pickupDate.getTime() + numberOfDays * MS_PER_DAY);
  const hoursBeforeReturn = hoursBeforePickup(returnDate, now);
  const remainingTierDeduct =
    remainingDays > 0
      ? computeCancellationDeductedDays(hoursBeforeReturn, tiers, remainingDays)
      : 0;
  return elapsedDays + remainingTierDeduct;
}

export function normalizeCancellationDeductTiers(
  raw: unknown,
): CancellationDeductTier[] | null {
  if (!Array.isArray(raw)) return null;
  const out: CancellationDeductTier[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const mh = Number(o.maxHoursBeforePickup);
    const dd = Number(o.deductDays);
    if (!Number.isFinite(mh) || !Number.isInteger(mh) || mh < 1 || mh > MAX_TIER_HOURS) continue;
    if (!Number.isFinite(dd) || dd < 0 || dd > MAX_DEDUCT_DAYS) continue;
    out.push({
      maxHoursBeforePickup: mh,
      deductDays: Math.round(dd * 10000) / 10000,
    });
  }
  if (!out.length) return [];
  out.sort((a, b) => a.maxHoursBeforePickup - b.maxHoursBeforePickup);
  const dedup: CancellationDeductTier[] = [];
  for (const t of out) {
    const prev = dedup[dedup.length - 1];
    if (prev && prev.maxHoursBeforePickup === t.maxHoursBeforePickup) {
      prev.deductDays = Math.max(prev.deductDays, t.deductDays);
      continue;
    }
    dedup.push({ ...t });
  }
  return dedup;
}

export function parseCancellationDeductTiersJson(
  json: string | null | undefined,
): CancellationDeductTier[] {
  const s = String(json ?? "").trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    const n = normalizeCancellationDeductTiers(parsed);
    return clampCancellationDeductTiersForStorage(n ?? []);
  } catch {
    return [];
  }
}

/** قراءة حقل النموذج (JSON نصّي) من لوحة الإدارة. */
export function parseCancellationDeductTiersFromAdminForm(
  raw: string,
): { ok: true; tiers: CancellationDeductTier[] } | { ok: false; error: string } {
  const s = raw.trim();
  if (!s) return { ok: true, tiers: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(s) as unknown;
  } catch {
    return { ok: false, error: "صيغة JSON لشرائح الخصم غير صالحة." };
  }
  const n = normalizeCancellationDeductTiers(parsed);
  if (n === null) {
    return { ok: false, error: "شرائح الخصم يجب أن تكون مصفوفة JSON." };
  }
  return { ok: true, tiers: clampCancellationDeductTiersForStorage(n) };
}

export function formatDeductDaysSummaryAr(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return "لا يُخصم أي يوم";
  if (Math.abs(days - 0.5) < 1e-6) return "نصف يوم";
  if (Math.abs(days - 1) < 1e-6) return "يوم واحد";
  const rounded = Math.round(days * 100) / 100;
  const hasFrac = Math.abs(rounded - Math.round(rounded)) > 1e-6;
  const n = hasFrac ? rounded.toFixed(2).replace(/\.?0+$/, "") : String(Math.round(rounded));
  return `${n} يوم`;
}
