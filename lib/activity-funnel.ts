/**
 * تجميع صفوف `ActivityLog` الخام إلى **جلسات زيارة** ومراحل رحلة الحجز.
 *
 * الصفوف المفردة لا تجيب على السؤال المهم: «أين ينسحب الزائر؟». الجواب يحتاج ربط
 * أحداث الزائر الواحد في خيط زمني واحد، ثم قياس أعمق مرحلة وصلها. لا يوجد كوكي
 * جلسة على الموقع العام، فنستخدم (IP + User-Agent) مع فاصل خمول كبديل.
 */

export type ActivityRowForFunnel = {
  id: number;
  kind: string;
  path: string | null;
  ip: string | null;
  userAgent: string | null;
  userId: number | null;
  carModelId: number | null;
  referrer: string | null;
  detail: string | null;
  createdAt: Date;
};

/** فاصل الخمول الذي يُنهي الجلسة — نصف ساعة، وهو العُرف في تحليلات الويب. */
const SESSION_IDLE_MS = 30 * 60 * 1000;

/** انتقال بين صفحتين أسرع من هذا = بوت لا إنسان (لا وقت لقراءة أي شيء). */
const BOT_HOP_MS = 1500;

export const FUNNEL_STAGES = [
  "home",
  "fleet",
  "book_now",
  "checkout",
  "submit",
  "otp",
  "payment",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  home: "الصفحة الرئيسية",
  fleet: "تصفّح الأسطول",
  book_now: "ضغط «احجز الآن»",
  checkout: "فتح صفحة الحجز",
  submit: "أرسل النموذج",
  otp: "رمز التحقق",
  payment: "صفحة الدفع",
};

export const CHECKOUT_ERROR_LABELS: Record<string, string> = {
  NO_DATES: "تواريخ الحجز مفقودة",
  NAME_INCOMPLETE: "الاسم غير كامل",
  EMAIL_INVALID: "بريد إلكتروني غير صالح",
  LICENSE_IMAGE_MISSING: "لم يرفع صورة الرخصة",
  LICENSE_NUMBER_INVALID: "رقم الرخصة غير صالح",
  LICENSE_EXPIRY_FORMAT: "صيغة تاريخ انتهاء الرخصة",
  LICENSE_EXPIRED_BEFORE_RENTAL: "الرخصة تنتهي قبل نهاية الإيجار",
  NATIONAL_ID_INVALID: "رقم الهوية/الإقامة غير صالح",
  PASSPORT_LENGTH: "طول رقم الجواز",
  PASSPORT_CHARS: "أحرف رقم الجواز",
  BRANCH_HOURS_PICKUP: "الفرع مغلق وقت الاستلام",
  BRANCH_HOURS_RETURN: "الفرع مغلق وقت التسليم",
  BRANCH_HOURS_SERVER: "الفرع مغلق (رفض الخادم)",
  CAPACITY_FULL: "لا تتوفر سيارة في هذا الموعد",
  SLOT_BLOCKED: "السيارة محجوزة في الفترة المطلوبة",
  SERVER_REJECTED: "رفض الخادم الطلب",
  NETWORK: "انقطاع الاتصال",
};

/** المسار بدون البادئة اللغوية وبدون الـ query — للمقارنة والتصنيف. */
export function normalizePath(path: string | null): string {
  const withoutQuery = (path ?? "").split("?")[0];
  return withoutQuery.replace(/^\/(ar|en)(?=\/|$)/, "") || "/";
}

/** الـ query string وحده (بدون `?`) — فيه التواريخ والفرع والفئة. */
export function pathQuery(path: string | null): string {
  return (path ?? "").split("?").slice(1).join("?");
}

/** أي مرحلة من رحلة الحجز يمثّلها هذا المسار، أو `null` لو خارجها. */
export function pathStage(path: string | null): FunnelStage | null {
  const p = normalizePath(path);
  if (p === "/") return "home";
  if (p.startsWith("/fleet/payment")) return "payment";
  if (p.startsWith("/fleet/checkout/otp")) return "otp";
  if (p.startsWith("/fleet/checkout")) return "checkout";
  if (p.startsWith("/fleet")) return "fleet";
  return null;
}

/** مرحلة يدلّ عليها نوع الحدث نفسه لا المسار (المودالات والإرسال). */
function kindStage(kind: string): FunnelStage | null {
  if (kind === "BOOK_NOW_CLICK") return "book_now";
  if (kind === "CHECKOUT_SUBMIT") return "submit";
  return null;
}

export function deviceOf(ua: string | null): string {
  if (!ua) return "غير معروف";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipod/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os x|macintosh/i.test(ua)) return "Mac";
  if (/linux/i.test(ua)) return "Linux";
  return "غير معروف";
}

export function isMobileUa(ua: string | null): boolean {
  const d = deviceOf(ua);
  return d === "Android" || d === "iPhone" || d === "iPad";
}

/** اختصار الـ User-Agent إلى «متصفح — نظام» مثل: Chrome — Android */
export function shortBrowser(ua: string | null): string | null {
  if (!ua) return null;

  let browser: string;
  if (/edg(a|ios)?\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/samsungbrowser\//i.test(ua)) browser = "Samsung Internet";
  else if (/firefox\/|fxios\//i.test(ua)) browser = "Firefox";
  else if (/instagram|fban|fbav/i.test(ua)) browser = "Facebook/Instagram";
  else if (/chrome\/|crios\//i.test(ua)) browser = "Chrome";
  else if (/safari\//i.test(ua) && /version\//i.test(ua)) browser = "Safari";
  else if (/whatsapp/i.test(ua)) browser = "WhatsApp";
  else if (/curl|wget|postman/i.test(ua)) browser = "أداة برمجية";
  else browser = ua.split(/[\s/]/)[0]?.slice(0, 24) || "غير معروف";

  const os = deviceOf(ua);
  return os === "غير معروف" ? browser : `${browser} — ${os}`;
}

export type VisitorSession = {
  key: string;
  ip: string | null;
  userAgent: string | null;
  device: string;
  browser: string | null;
  referrer: string | null;
  userId: number | null;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  events: ActivityRowForFunnel[];
  /** المسارات المميّزة بالترتيب — «أثر» الجلسة. */
  trail: string[];
  stages: Set<FunnelStage>;
  deepestStage: FunnelStage | null;
  carModelIds: number[];
  errorCodes: string[];
  /** الزمن بين أول فتح لصفحة الحجز وآخر حدث في الجلسة. */
  checkoutDwellMs: number | null;
  /**
   * الصفحة التي غادر منها الزائر — **بالـ query كاملاً** (التواريخ والفرع والموديل).
   * هذا هو ما يلزم لإعادة إنتاج ما رآه بالضبط قبل أن ينسحب.
   */
  exitPath: string | null;
  /** موديل السيارة المرتبط بصفحة الخروج، إن كانت صفحة حجز سيارة. */
  exitCarModelId: number | null;
  /** آخر حدث في الجلسة — يميّز «خرج من صفحة» عن «فشل عنده النموذج». */
  lastKind: string;
  /** سبب آخر خطأ واجهه، إن وُجد. */
  lastErrorCode: string | null;
  isStaff: boolean;
  isSuspectedBot: boolean;
};

/**
 * بناء الجلسات. `staffIps` هي عناوين الموظفين (تُشتقّ من `ADMIN_LOGIN`) —
 * تُعلَّم ولا تُحذف، حتى تبقى قابلة للعرض عند الطلب.
 */
export function buildSessions(
  rows: ActivityRowForFunnel[],
  staffIps: ReadonlySet<string>,
): VisitorSession[] {
  const ordered = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const byVisitor = new Map<string, ActivityRowForFunnel[]>();
  for (const row of ordered) {
    const key = `${row.ip ?? "?"}|${row.userAgent ?? "?"}`;
    const list = byVisitor.get(key);
    if (list) list.push(row);
    else byVisitor.set(key, [row]);
  }

  const sessions: VisitorSession[] = [];
  for (const [key, events] of byVisitor) {
    let bucket: ActivityRowForFunnel[] = [];
    const flush = () => {
      if (bucket.length) sessions.push(finalizeSession(key, bucket, staffIps));
      bucket = [];
    };
    for (const event of events) {
      const previous = bucket[bucket.length - 1];
      if (previous && event.createdAt.getTime() - previous.createdAt.getTime() > SESSION_IDLE_MS) {
        flush();
      }
      bucket.push(event);
    }
    flush();
  }

  return sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

function finalizeSession(
  key: string,
  events: ActivityRowForFunnel[],
  staffIps: ReadonlySet<string>,
): VisitorSession {
  const first = events[0];
  const last = events[events.length - 1];
  const durationMs = last.createdAt.getTime() - first.createdAt.getTime();

  const stages = new Set<FunnelStage>();
  const trail: string[] = [];
  const carModelIds: number[] = [];
  const errorCodes: string[] = [];
  let userId: number | null = null;
  let referrer: string | null = null;
  let firstCheckoutAt: Date | null = null;
  // انتقالات الصفحات وسرعتها — أساس كشف البوتات المتنكّرة بمتصفح عادي.
  let hops = 0;
  let fastHops = 0;
  let lastPathAt: Date | null = null;

  for (const event of events) {
    const fromPath = pathStage(event.path);
    if (fromPath) stages.add(fromPath);
    const fromKind = kindStage(event.kind);
    if (fromKind) stages.add(fromKind);

    if (fromPath === "checkout" && !firstCheckoutAt) firstCheckoutAt = event.createdAt;

    const p = normalizePath(event.path);
    if (p && trail[trail.length - 1] !== p) {
      if (lastPathAt) {
        hops++;
        if (event.createdAt.getTime() - lastPathAt.getTime() < BOT_HOP_MS) fastHops++;
      }
      trail.push(p);
      lastPathAt = event.createdAt;
    }
    if (event.carModelId != null && !carModelIds.includes(event.carModelId)) {
      carModelIds.push(event.carModelId);
    }
    if (event.kind === "CHECKOUT_ERROR" && event.detail) errorCodes.push(event.detail);
    if (event.userId != null) userId = event.userId;
    if (!referrer && event.referrer) referrer = event.referrer;
  }

  let deepestStage: FunnelStage | null = null;
  for (const stage of FUNNEL_STAGES) if (stages.has(stage)) deepestStage = stage;

  // صفحة الخروج = آخر حدث **يحمل مساراً**. لا نأخذ آخر حدث مطلقاً لأنه قد يكون
  // حدث تفاعل (ضغط زر / خطأ نموذج) يحمل نفس مسار الصفحة أو لا يعني تنقّلاً.
  const lastWithPath = [...events].reverse().find((e) => e.path?.trim());
  const lastError = [...events].reverse().find((e) => e.kind === "CHECKOUT_ERROR" && e.detail);

  const ip = first.ip;
  return {
    key,
    ip,
    userAgent: first.userAgent,
    device: deviceOf(first.userAgent),
    browser: shortBrowser(first.userAgent),
    referrer,
    userId,
    startedAt: first.createdAt,
    endedAt: last.createdAt,
    durationMs,
    events,
    trail,
    stages,
    deepestStage,
    carModelIds,
    errorCodes,
    checkoutDwellMs: firstCheckoutAt ? last.createdAt.getTime() - firstCheckoutAt.getTime() : null,
    exitPath: lastWithPath?.path?.trim() ?? null,
    exitCarModelId: lastWithPath?.carModelId ?? null,
    lastKind: last.kind,
    lastErrorCode: lastError?.detail ?? null,
    isStaff: ip != null && staffIps.has(ip),
    // معظم الانتقالات فورية = بوت. لا نعتمد على مدة الجلسة الكلية لأن البوت
    // قد يعود بعد دقائق فتبدو جلسته طويلة بينما كل انتقالاته داخلها فورية.
    isSuspectedBot: fastHops >= 2 && fastHops / hops >= 0.5,
  };
}

export type FunnelRow = {
  stage: FunnelStage;
  label: string;
  sessions: number;
  /** النسبة من إجمالي الجلسات. */
  shareOfAll: number;
  /**
   * النسبة من **أوسع** مرحلة قبلها، لا من المرحلة السابقة مباشرة. المقارنة بالسابقة
   * مباشرةً تعطي نسباً فوق ١٠٠٪ متى كانت مرحلة وسطى صفراً — وهو ما يحدث فعلاً للمراحل
   * التي تعتمد أحداثاً أُضيفت حديثاً ولم تُسجَّل في البيانات القديمة.
   */
  shareOfPrevious: number | null;
};

export function buildFunnel(sessions: VisitorSession[]): {
  totalSessions: number;
  rows: FunnelRow[];
} {
  const total = sessions.length;
  const rows: FunnelRow[] = [];
  let widestAbove: number | null = null;

  for (const stage of FUNNEL_STAGES) {
    const count = sessions.filter((s) => s.stages.has(stage)).length;
    rows.push({
      stage,
      label: FUNNEL_STAGE_LABELS[stage],
      sessions: count,
      shareOfAll: total ? count / total : 0,
      shareOfPrevious: widestAbove != null && widestAbove > 0 ? count / widestAbove : null,
    });
    widestAbove = Math.max(widestAbove ?? 0, count);
  }

  return { totalSessions: total, rows };
}

/** عدّ تكرارات قيمة مع ترتيب تنازلي — يُستخدم للمصادر والأخطاء والأجهزة. */
export function tally<T>(items: T[], pick: (item: T) => string | null): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = pick(item);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** الوسيط — أمتن من المتوسط أمام جلسة واحدة طويلة شاذّة. */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
