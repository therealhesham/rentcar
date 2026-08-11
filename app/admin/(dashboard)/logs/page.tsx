import Link from "next/link";
import { Prisma } from "@prisma/client";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { VisitorMap } from "@/components/admin/VisitorMap";
import { LogsFilterSelect, type LogsFilterGroup } from "@/components/admin/LogsFilterSelect";
import { clusterSessionsByCity, isGeoDatabaseReady } from "@/lib/geo-ip";
import {
  buildFunnel,
  buildSessions,
  CHECKOUT_ERROR_LABELS,
  FUNNEL_STAGE_LABELS,
  median,
  pathQuery,
  shortBrowser,
  tally,
  type FunnelStage,
} from "@/lib/activity-funnel";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/** سقف الصفوف التي تُحمَّل لحساب رحلة الحجز — يحمي الصفحة عند نمو السجل. */
const FUNNEL_ROW_CAP = 20000;

const KIND_LABELS: Record<string, string> = {
  CUSTOMER_LOGIN: "دخول عميل",
  ADMIN_LOGIN: "دخول موظف",
  PAGE_VIEW: "مشاهدة صفحة",
  CAR_VIEW: "مشاهدة سيارة",
  BOOK_NOW_CLICK: "ضغط احجز الآن",
  OR_SIMILAR_CONFIRM: "أكّد «أو ما شابه»",
  OR_SIMILAR_DISMISS: "أغلق «أو ما شابه»",
  DATES_MODAL_SHOWN: "طُلبت التواريخ",
  DATES_MODAL_CONFIRM: "أكمل التواريخ",
  CAR_UNAVAILABLE: "السيارة غير متاحة",
  CHECKOUT_SUBMIT: "أرسل النموذج",
  CHECKOUT_ERROR: "خطأ في النموذج",
};

const KIND_BADGE_CLASSES: Record<string, string> = {
  CUSTOMER_LOGIN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ADMIN_LOGIN: "bg-amber-50 text-amber-700 border-amber-200",
  PAGE_VIEW: "bg-sky-50 text-sky-700 border-sky-200",
  CAR_VIEW: "bg-violet-50 text-violet-700 border-violet-200",
  BOOK_NOW_CLICK: "bg-teal-50 text-teal-700 border-teal-200",
  OR_SIMILAR_CONFIRM: "bg-teal-50 text-teal-700 border-teal-200",
  OR_SIMILAR_DISMISS: "bg-orange-50 text-orange-700 border-orange-200",
  DATES_MODAL_SHOWN: "bg-orange-50 text-orange-700 border-orange-200",
  DATES_MODAL_CONFIRM: "bg-teal-50 text-teal-700 border-teal-200",
  CAR_UNAVAILABLE: "bg-rose-50 text-rose-700 border-rose-200",
  CHECKOUT_SUBMIT: "bg-indigo-50 text-indigo-700 border-indigo-200",
  CHECKOUT_ERROR: "bg-rose-50 text-rose-700 border-rose-200",
};

/**
 * أحداث التفاعل التي أُضيفت بعد إطلاق السجل. الجلسات الأقدم منها لا تحمل هذه
 * الأحداث إطلاقاً، فتبدو مراحلها صفراً — وهو نقص قياس لا انسحاب زوّار.
 */
const INTERACTION_KINDS = [
  "BOOK_NOW_CLICK",
  "OR_SIMILAR_CONFIRM",
  "OR_SIMILAR_DISMISS",
  "DATES_MODAL_SHOWN",
  "DATES_MODAL_CONFIRM",
  "CAR_UNAVAILABLE",
  "CHECKOUT_SUBMIT",
  "CHECKOUT_ERROR",
];

/** عناوين محلية — تظهر أثناء التطوير ولا تمثّل زواراً. */
const LOCAL_IPS = ["::1", "127.0.0.1", "::ffff:127.0.0.1"];

/**
 * عناوين تُستبعد يدوياً عبر `ANALYTICS_EXCLUDED_IPS` (مفصولة بفواصل). لازمة لأن اشتقاق
 * عناوين الفريق من `ADMIN_LOGIN` لا يمسك جهازاً تتصفّح منه بحساب عميل للتجربة دون
 * تسجيل دخول الإدارة — فيُحتسب زائراً حقيقياً ويلوّث الأرقام.
 */
const MANUALLY_EXCLUDED_IPS = (process.env.ANALYTICS_EXCLUDED_IPS ?? "")
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean);

const pct = (v: number) => `${Math.round(v * 100)}%`;

const formatSar = (v: number) =>
  v.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

function formatDuration(ms: number): string {
  if (ms < 1000) return "لحظة";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} ث`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes} د ${seconds} ث` : `${minutes} د`;
}

/** الأنواع التي تُحتسب «زيارة» للموقع العام. */
const VIEW_KINDS = ["PAGE_VIEW", "CAR_VIEW"];

/** فترات جاهزة — `days` بعدد الأيام شاملةً اليوم الحالي، و`null` = كل الفترة. */
const RANGES: Array<{ key: string; label: string; days: number | null }> = [
  { key: "today", label: "اليوم", days: 1 },
  { key: "7d", label: "آخر ٧ أيام", days: 7 },
  { key: "30d", label: "آخر ٣٠ يوم", days: 30 },
  { key: "all", label: "كل الفترة", days: null },
];

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** أنواع تسجيل الدخول — عدّادها يقيس الأشخاص لا العناوين. */
const LOGIN_KINDS = ["CUSTOMER_LOGIN", "ADMIN_LOGIN"];

/**
 * التبويبات تحمل **وحدة قياس واحدة** يختارها المستخدم من مبدّل `count`. سابقاً كان كل
 * تبويب يعدّ بوحدته (أشخاص للدخول، عناوين للمشاهدات) فكانت الأرقام تبدو متناقضة:
 * صف واحد فيه ثلاث وحدات، وتحته إجمالي سجلات لا يساويها أيٌّ منها.
 */
const FILTERS: Array<{ key: string; label: string; kinds: string[] | null }> = [
  { key: "all", label: "الكل", kinds: null },
  { key: "logins", label: "تسجيلات الدخول", kinds: LOGIN_KINDS },
  { key: "customer-logins", label: "دخول العملاء", kinds: ["CUSTOMER_LOGIN"] },
  { key: "admin-logins", label: "دخول الموظفين", kinds: ["ADMIN_LOGIN"] },
  { key: "views", label: "مشاهدات الصفحات", kinds: ["PAGE_VIEW"] },
  { key: "car-views", label: "مشاهدات السيارات", kinds: ["CAR_VIEW"] },
  // بدون هذا التبويب تبقى أحداث التفاعل محسوبة في «الكل» وغير قابلة للعرض،
  // فيبدو الفرق بين «الكل» ومجموع التبويبات بلا تفسير.
  { key: "interactions", label: "تفاعلات الحجز", kinds: INTERACTION_KINDS },
];

type CountMode = "records" | "unique";

const COUNT_MODES: Array<{ key: CountMode; label: string; unit: string }> = [
  { key: "records", label: "كل السجلات", unit: "سجل" },
  { key: "unique", label: "زوّار منفردون", unit: "زائر منفرد (IP فريدة)" },
];

/** بداية يوم YYYY-MM-DD بتوقيت الرياض. */
function riyadhDayStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+03:00`);
}

function riyadhYmd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

/** إزاحة تاريخ YYYY-MM-DD بعدد أيام (بالسالب للخلف). */
function shiftYmd(ymd: string, days: number): string {
  const d = riyadhDayStart(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return riyadhYmd(d);
}

export default async function AdminActivityLogsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();

  const sp = searchParams ? await searchParams : {};
  const filterKey = typeof sp.kind === "string" ? sp.kind : "all";
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const pageRaw = Number(typeof sp.page === "string" ? sp.page : "1");
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  // المدى المخصص (from/to) يتقدّم على الفترات الجاهزة إن وُجد أيٌّ منهما.
  const from = typeof sp.from === "string" && YMD_PATTERN.test(sp.from) ? sp.from : null;
  const to = typeof sp.to === "string" && YMD_PATTERN.test(sp.to) ? sp.to : null;
  const isCustomRange = from !== null || to !== null;
  const rangeKey = typeof sp.range === "string" ? sp.range : "all";
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[3];

  let gte: Date | undefined;
  let lt: Date | undefined;
  if (isCustomRange) {
    if (from) gte = riyadhDayStart(from);
    // «إلى» شامل لليوم نفسه، فالحد الأعلى هو بداية اليوم التالي.
    if (to) lt = riyadhDayStart(shiftYmd(to, 1));
  } else if (range.days !== null) {
    gte = riyadhDayStart(shiftYmd(riyadhYmd(new Date()), -(range.days - 1)));
  }
  const dateWhere = gte || lt ? { createdAt: { ...(gte && { gte }), ...(lt && { lt }) } } : {};
  const rangeLabel = isCustomRange
    ? `${from ?? "البداية"} → ${to ?? "الآن"}`
    : range.label;

  // عناوين الموظفين تُشتقّ من `ADMIN_LOGIN` عبر كل الفترة بدل قائمة ثابتة في الكود:
  // أي جهاز سجّل دخول الإدارة منه مرة = جهاز داخلي، ولو تغيّر عنوانه لاحقاً تحدّث نفسه.
  const [adminIpRows, firstInteraction] = await Promise.all([
    prisma.activityLog.findMany({
      where: { kind: "ADMIN_LOGIN", ip: { not: null } },
      select: { ip: true },
      distinct: ["ip"],
    }),
    prisma.activityLog.findFirst({
      where: { kind: { in: INTERACTION_KINDS } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);
  const trackingStartedAt = firstInteraction?.createdAt ?? null;
  const staffIps = new Set<string>([
    ...adminIpRows.map((r) => r.ip as string),
    ...LOCAL_IPS,
    ...MANUALLY_EXCLUDED_IPS,
  ]);

  // `real` (الافتراضي) يخفي زياراتك أنت وفريقك — بدونها تغرق الأرقام في ترافيك داخلي.
  const traffic = sp.traffic === "all" ? "all" : "real";
  // الافتراضي «كل السجلات»: هو الوحدة التي تتطابق مع إجمالي السجلات أسفل الجدول.
  const countMode: CountMode = sp.count === "unique" ? "unique" : "records";
  const countUnit = COUNT_MODES.find((m) => m.key === countMode)!.unit;
  const excludeIps = traffic === "real" ? [...staffIps] : [];

  // صفاية البحث والاستبعاد — multi-value مفصولة بفواصل
  const qRaw = typeof sp.q === "string" ? sp.q : "";
  const excludeRaw = typeof sp.exclude === "string" ? sp.exclude : "";
  const qValues = qRaw ? qRaw.split(",").map((v) => v.trim()).filter(Boolean) : [];
  const excludeValues = excludeRaw ? excludeRaw.split(",").map((v) => v.trim()).filter(Boolean) : [];

  // جلب mبكر للـ userAgents الفريدة — لبناء خريطة "اسم المتصفح → raw UAs" قبل بناء شرط البحث.
  // بدونه لو المستخدم اختار "سفاري – آيفون" كان contains يدور على هذا النص الحرفي في الـ DB ولن يجده.
  const rawBrowserUAs = await prisma.activityLog.findMany({
    where: { ...dateWhere, userAgent: { not: null } },
    select: { userAgent: true },
    distinct: ["userAgent"],
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  /** اسم المتصفح (shortBrowser) → قائمة raw userAgent strings */
  const browserLabelToUAs = new Map<string, string[]>();
  for (const r of rawBrowserUAs) {
    const ua = r.userAgent as string;
    const label = shortBrowser(ua);
    if (label) {
      const list = browserLabelToUAs.get(label) ?? [];
      list.push(ua);
      browserLabelToUAs.set(label, list);
    }
  }

  /** بناء OR-clause لقيمة واحدة عبر جميع الحقول.
   * لو كانت القيمة اسم متصفح معروف (shortBrowser label) نستخدم IN على raw UAs الحقيقية.
   * لو كانت نص حر (IP أو مسار...) نستخدم contains العادي. */
  const makeMatchOr = (v: string): Prisma.ActivityLogWhereInput => {
    const browserUAs = browserLabelToUAs.get(v);
    const orConds: Prisma.ActivityLogWhereInput[] = [
      { ip: { contains: v } },
      { path: { contains: v } },
      { actorLabel: { contains: v } },
      { detail: { contains: v } },
    ];
    if (browserUAs && browserUAs.length > 0) {
      // تطابق دقيق على raw userAgent strings
      orConds.push({ userAgent: { in: browserUAs } });
    } else {
      // بحث حر في raw userAgent
      orConds.push({ userAgent: { contains: v } });
    }
    return { OR: orConds };
  };

  const searchConditions: Prisma.ActivityLogWhereInput[] = [];

  // كل قيمة تحديد يجب أن يطابقها الصف ولو واحدة منها (OR عبر القيم)
  if (qValues.length > 0) {
    searchConditions.push({ OR: qValues.map(makeMatchOr) });
  }
  // استبعاد: كل قيمة يجب ألّا يطابقها الصف (AND NOT)
  for (const v of excludeValues) {
    searchConditions.push({ NOT: makeMatchOr(v) });
  }

  const searchWhere: Prisma.ActivityLogWhereInput = searchConditions.length
    ? { AND: searchConditions }
    : {};

  // وقف فلتر الترافيك فقط لما في قيم تحديد (include) — لأن تحديد IP موظف يتناقض مع
  // "ip NOT IN staffIps" ويعطي صفر نتائج. الاستبعاد لا يتناقض: الاثنين يستبعدان معاً.
  const hasActiveSearch = qValues.length > 0 || excludeValues.length > 0; // لزر "مسح الصفاية"
  const effectiveExcludeIps = qValues.length > 0 ? [] : excludeIps;

  const trafficWhere = effectiveExcludeIps.length ? { ip: { notIn: effectiveExcludeIps } } : {};
  const baseWhere = { ...dateWhere, ...trafficWhere, ...searchWhere };
  const where = filter.kinds ? { ...baseWhere, kind: { in: filter.kinds } } : baseWhere;

  const dateSql =
    gte && lt
      ? Prisma.sql`AND createdAt >= ${gte} AND createdAt < ${lt}`
      : gte
        ? Prisma.sql`AND createdAt >= ${gte}`
        : lt
          ? Prisma.sql`AND createdAt < ${lt}`
          : Prisma.empty;

  // استخدم effectiveExcludeIps في الـ raw SQL كذلك
  const trafficSql = effectiveExcludeIps.length
    ? Prisma.sql`AND (ip IS NULL OR ip NOT IN (${Prisma.join(effectiveExcludeIps)}))`
    : Prisma.empty;

  // للعدّاد الدقيق للتبويبات نحتاج SQL للجلسات — لكن searchWhere مضمّن في baseWhere مسبقاً
  const qSql = Prisma.empty;
  const excludeSql = Prisma.empty;

  const [
    rows,
    total,
    rangeCustomerLogins,
    rangeAdminLogins,
    rangeViews,
    rangeCarViews,
    topCarGroups,
    topVisitorGroups,
    kindIpPairs,
    kindRecordCounts,
    funnelRows,
  ] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
    // تسجيلات الدخول لا تخضع لفلتر الترافيك: `ADMIN_LOGIN` يأتي بحكم التعريف من
    // عناوين الفريق، فاستبعادها كان يجعل العدّاد صفراً دائماً في وضع «زوّار حقيقيون».
    prisma.activityLog.count({ where: { ...dateWhere, kind: "CUSTOMER_LOGIN" } }),
    prisma.activityLog.count({ where: { ...dateWhere, kind: "ADMIN_LOGIN" } }),
    prisma.activityLog.count({ where: { ...baseWhere, kind: "PAGE_VIEW" } }),
    prisma.activityLog.count({ where: { ...baseWhere, kind: "CAR_VIEW" } }),
    prisma.activityLog.groupBy({
      by: ["carModelId"],
      where: { ...baseWhere, kind: "CAR_VIEW", carModelId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { carModelId: "desc" } },
      take: 10,
    }),
    prisma.activityLog.groupBy({
      by: ["userId"],
      where: { ...baseWhere, kind: { in: VIEW_KINDS }, userId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 10,
    }),
    // العناوين المميّزة لكل نوع — نحسب منها عدّاد كل تبويب في الذاكرة، لأن اتحاد
    // نوعين ليس مجموع منفرديهما (نفس الـ IP قد يظهر في الاثنين).
    prisma.$queryRaw<Array<{ kind: string; ip: string }>>`
      SELECT DISTINCT kind, ip FROM ActivityLog WHERE ip IS NOT NULL ${dateSql} ${trafficSql} ${qSql} ${excludeSql}`,
    // عدد السجلات لكل نوع — هذا الوضع جمعي بحت: مجموع التبويبات = إجمالي السجلات.
    prisma.activityLog.groupBy({
      by: ["kind"],
      where: baseWhere,
      _count: { _all: true },
    }),
    // كل أحداث الفترة (بلا ترقيم) — رحلة الحجز تحتاج خيط الجلسة كاملاً لا صفحة منه.
    prisma.activityLog.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      take: FUNNEL_ROW_CAP,
      select: {
        id: true,
        kind: true,
        path: true,
        ip: true,
        userAgent: true,
        userId: true,
        carModelId: true,
        referrer: true,
        detail: true,
        createdAt: true,
      },
    }),
  ]);

  const allSessions = buildSessions(funnelRows, staffIps);
  // البوتات المتنكّرة بمتصفح عادي لا يمسكها فلتر الـ User-Agent، فتُستبعد هنا
  // بسلوكها: عدة مسارات خلال ثوانٍ. تبقى ظاهرة في وضع «كل الترافيك».
  const sessions = traffic === "real" ? allSessions.filter((s) => !s.isSuspectedBot) : allSessions;
  const funnel = buildFunnel(sessions);
  const botSessionCount = allSessions.filter((s) => s.isSuspectedBot).length;
  /** الجلسات المعروضة في الجدول — نحدّها حتى لا نجلب أسماء عملاء وسيارات بلا داعٍ. */
  const shownSessions = sessions.slice(0, 100);

  // جلسات أقدم من تفعيل تتبّع التفاعلات: مراحل «ضغط احجز الآن» و«أرسل النموذج»
  // تظهر لها صفراً بحكم عدم القياس، فنُعلن العدد بدل ترك الرقم يُقرأ كانسحاب.
  const sessionsBeforeTracking = trackingStartedAt
    ? sessions.filter((s) => s.startedAt < trackingStartedAt).length
    : sessions.length;

  // الجلسات المقيسة بالكامل — عليها وحدها يصحّ سؤال «دخل صفحة الحجز بدون الزرار؟»
  const trackedSessions = trackingStartedAt
    ? sessions.filter((s) => s.startedAt >= trackingStartedAt)
    : [];
  const trackedCheckout = trackedSessions.filter((s) => s.stages.has("checkout"));
  const checkoutWithoutButton = trackedCheckout.filter((s) => !s.stages.has("book_now")).length;

  // خطوات المسار من كل مرحلة حتى إتمام الدفع فعلياً
  // "payment" = فتح صفحة الدفع بس‛ لا يزال يحتاج اختيار طريقة دفع + تأكيدها
  const STAGE_ORDER = ["home", "fleet", "book_now", "checkout", "submit", "otp", "payment"] as const;
  const stepsToPayment = (stage: string): number => {
    const idx = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
    if (idx < 0) return -1;
    // payment (index 6) = خطوة واحدة متبقية — لازم يختار ويكمل الدفع فعلياً
    return STAGE_ORDER.length - idx; // home=7, fleet=6, ..., otp=2, payment=1
  };

  // أكثر exitPath شيوعاً لكل مرحلة توقف
  const dropOffPathCounts = new Map<string, Map<string, number>>(); // stage -> (exitPath -> count)
  const dropOff = new Map<string, number>();
  for (const s of sessions) {
    const key = s.deepestStage ?? "none";
    dropOff.set(key, (dropOff.get(key) ?? 0) + 1);
    if (s.exitPath) {
      const pathMap = dropOffPathCounts.get(key) ?? new Map<string, number>();
      pathMap.set(s.exitPath, (pathMap.get(s.exitPath) ?? 0) + 1);
      dropOffPathCounts.set(key, pathMap);
    }
  }
  const topExitPath = (stage: string): string | null => {
    const pathMap = dropOffPathCounts.get(stage);
    if (!pathMap) return null;
    let best: string | null = null;
    let bestCount = 0;
    for (const [p, c] of pathMap) {
      if (c > bestCount) { bestCount = c; best = p; }
    }
    return best;
  };

  // عدد الحجوزات المدفوعة فعلياً — "اكتمال الحجز" الحقيقي
  const paidBookingsCount = await prisma.bookingRequest.count({
    where: {
      paymentStatus: "PAID",
      ...(gte || lt ? { createdAt: { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } } : {}),
    },
  });

  const dropOffRows: Array<{
    stage: string;
    label: string;
    count: number;
    exitPath: string | null;
    steps: number;
  }> = [
    // صف "اكتمل الحجز" = دفع فعلي مسجّل في الداتا بيس (paymentStatus PAID)
    { stage: "paid", label: "اكتمل الحجز ✔", count: paidBookingsCount, exitPath: null, steps: 0 },
    ...[...dropOff.entries()]
      .map(([stage, count]) => ({
        stage,
        label: stage === "none" ? "صفحات أخرى فقط" : FUNNEL_STAGE_LABELS[stage as FunnelStage],
        count,
        exitPath: topExitPath(stage),
        steps: stage === "none" ? -1 : stepsToPayment(stage),
      }))
      .sort((a, b) => b.count - a.count),
  ];

  const errorTally = tally(
    sessions.flatMap((s) => s.errorCodes),
    (code) => code,
  );
  const referrerTally = tally(sessions, (s) => s.referrer);
  const directSessions = sessions.filter((s) => !s.referrer).length;
  const deviceTally = tally(sessions, (s) => s.device);
  const searchQueryTally = tally(
    funnelRows.filter((r) => r.kind === "PAGE_VIEW"),
    (r) => pathQuery(r.path) || null,
  );

  // ── الترافيك الإعلاني ───────────────────────────────────────────────────
  // «نجح» تعني حجزاً **مدفوعاً فعلاً**، لا مجرد وصول لصفحة الدفع. لذلك نربط رقم
  // الحجز المستخرَج من مسار صفحة الدفع بجدول الحجوزات ونقرأ `paymentStatus`.
  const adSessions = sessions.filter((s) => s.adClick);
  const adBookingIds = [...new Set(adSessions.flatMap((s) => s.bookingRequestIds))];
  const adBookings = adBookingIds.length
    ? await prisma.bookingRequest.findMany({
        where: { id: { in: adBookingIds } },
        select: { id: true, paymentStatus: true, status: true, paidAmountSar: true },
      })
    : [];
  const bookingById = new Map(adBookings.map((b) => [b.id, b]));
  const isPaidBooking = (id: number) => bookingById.get(id)?.paymentStatus === "PAID";

  type AdCampaignStats = {
    key: string;
    network: string;
    campaign: string;
    paid: boolean;
    sessions: number;
    reachedCheckout: number;
    createdBooking: number;
    paidBooking: number;
    revenueSar: number;
  };
  const adCampaigns = new Map<string, AdCampaignStats>();
  for (const s of adSessions) {
    const ad = s.adClick!;
    const key = `${ad.network}|${ad.campaign}`;
    const stats =
      adCampaigns.get(key) ??
      ({
        key,
        network: ad.network,
        campaign: ad.campaign,
        paid: ad.paid,
        sessions: 0,
        reachedCheckout: 0,
        createdBooking: 0,
        paidBooking: 0,
        revenueSar: 0,
      } satisfies AdCampaignStats);
    stats.sessions++;
    if (s.stages.has("checkout")) stats.reachedCheckout++;
    if (s.bookingRequestIds.length > 0) stats.createdBooking++;
    const paidIds = s.bookingRequestIds.filter(isPaidBooking);
    if (paidIds.length > 0) {
      stats.paidBooking++;
      for (const id of paidIds) stats.revenueSar += bookingById.get(id)?.paidAmountSar ?? 0;
    }
    adCampaigns.set(key, stats);
  }
  const adRows = [...adCampaigns.values()].sort(
    (a, b) => b.paidBooking - a.paidBooking || b.sessions - a.sessions,
  );
  const adTotals = adRows.reduce(
    (acc, r) => ({
      sessions: acc.sessions + r.sessions,
      reachedCheckout: acc.reachedCheckout + r.reachedCheckout,
      createdBooking: acc.createdBooking + r.createdBooking,
      paidBooking: acc.paidBooking + r.paidBooking,
      revenueSar: acc.revenueSar + r.revenueSar,
    }),
    { sessions: 0, reachedCheckout: 0, createdBooking: 0, paidBooking: 0, revenueSar: 0 },
  );

  const [geoClusters, geoReady, acIps, acPaths, acActors] = await Promise.all([
    clusterSessionsByCity(
      sessions.map((s) => ({ ip: s.ip, reachedCheckout: s.stages.has("checkout") })),
    ),
    isGeoDatabaseReady(),
    // autocomplete: IPs الفريدة — محدودة 50
    prisma.activityLog.findMany({
      where: { ...dateWhere, ip: { not: null } },
      select: { ip: true },
      distinct: ["ip"],
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    // autocomplete: مسارات فريدة — محدودة 40
    prisma.activityLog.findMany({
      where: { ...dateWhere, path: { not: null } },
      select: { path: true },
      distinct: ["path"],
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    // autocomplete: actorLabel فريدة — محدودة 30
    prisma.activityLog.findMany({
      where: { ...dateWhere, actorLabel: { not: null } },
      select: { actorLabel: true },
      distinct: ["actorLabel"],
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  // acBrowsers محتاجلهاش ثاني — rawBrowserUAs جبناها مبكراً وهي نفس البيانات
  const acBrowsers = rawBrowserUAs;
  const mappedSessions = geoClusters.reduce((sum, c) => sum + c.sessions, 0);

  // تجميع الخيارات حسب الفئة لـ LogsFilterSelect
  const uniqueBrowsers = [
    ...new Set(
      acBrowsers.map((r) => shortBrowser(r.userAgent)).filter((b): b is string => Boolean(b)),
    ),
  ];
  const filterGroups: LogsFilterGroup[] = [
    {
      label: "عناوين IP",
      options: acIps.map((r) => r.ip as string),
    },
    {
      label: "الصفحات / المسارات",
      options: acPaths.map((r) => r.path as string),
    },
    {
      label: "العملاء / الموظفون",
      options: acActors.map((r) => r.actorLabel as string),
    },
    {
      label: "المتصفحات",
      options: uniqueBrowsers,
    },
  ].filter((g) => g.options.length > 0);

  const medianDurationMs = median(sessions.map((s) => s.durationMs));
  const checkoutDwells = sessions
    .filter((s) => s.stages.has("checkout"))
    .map((s) => s.checkoutDwellMs ?? 0);
  const medianCheckoutDwellMs = median(checkoutDwells);

  const ipsByKind = new Map<string, Set<string>>();
  for (const pair of kindIpPairs) {
    const set = ipsByKind.get(pair.kind) ?? new Set<string>();
    set.add(pair.ip);
    ipsByKind.set(pair.kind, set);
  }
  const recordsByKind = new Map(kindRecordCounts.map((r) => [r.kind, r._count._all]));

  /**
   * عدّاد التبويب بالوحدة المختارة. `kinds = null` يعني كل الأنواع.
   *
   * في وضع «منفردون» نأخذ **اتحاد** المجموعات لا مجموع أحجامها، لأن العنوان الواحد
   * قد يظهر في أكثر من نوع فيُحتسب مرتين.
   */
  const tabCount = (kinds: string[] | null): number => {
    if (countMode === "records") {
      let total = 0;
      for (const [kind, count] of recordsByKind) {
        if (kinds && !kinds.includes(kind)) continue;
        total += count;
      }
      return total;
    }
    const union = new Set<string>();
    for (const [kind, ips] of ipsByKind) {
      if (kinds && !kinds.includes(kind)) continue;
      for (const ip of ips) union.add(ip);
    }
    return union.size;
  };

  // أسماء السيارات: للأكثر مشاهدة + للصفوف المعروضة في الجدول
  const carIds = new Set<number>();
  for (const g of topCarGroups) if (g.carModelId != null) carIds.add(g.carModelId);
  for (const r of rows) if (r.carModelId != null) carIds.add(r.carModelId);
  for (const s of shownSessions) if (s.exitCarModelId != null) carIds.add(s.exitCarModelId);
  const carModels = carIds.size
    ? await prisma.carModel.findMany({
        where: { id: { in: [...carIds] } },
        select: { id: true, name: true, year: true, brand: { select: { name: true } } },
      })
    : [];
  const carNameById = new Map(
    carModels.map((m) => [m.id, `${m.brand.name} ${m.name} ${m.year}`]),
  );
  const topCars = topCarGroups
    .filter((g) => g.carModelId != null)
    .map((g) => ({
      carModelId: g.carModelId as number,
      views: g._count._all,
      name: carNameById.get(g.carModelId as number) ?? `موديل #${g.carModelId}`,
    }));
  const maxTopViews = Math.max(1, ...topCars.map((c) => c.views));

  // أسماء العملاء: للأكثر زيارة + للصفوف المعروضة (المشاهدات تُخزَّن بـ userId بلا اسم)
  const userIds = new Set<number>();
  for (const g of topVisitorGroups) if (g.userId != null) userIds.add(g.userId);
  for (const r of rows) if (r.userId != null && !r.actorLabel) userIds.add(r.userId);
  for (const s of shownSessions) if (s.userId != null) userIds.add(s.userId);
  const users = userIds.size
    ? await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, name: true, phone: true, email: true },
      })
    : [];
  const userLabelById = new Map(
    users.map((u) => [u.id, u.name?.trim() || u.phone || u.email]),
  );
  const topVisitors = topVisitorGroups
    .filter((g) => g.userId != null)
    .map((g) => ({
      userId: g.userId as number,
      visits: g._count._all,
      label: userLabelById.get(g.userId as number) ?? `عميل #${g.userId}`,
    }));
  const maxTopVisits = Math.max(1, ...topVisitors.map((v) => v.visits));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** رابط يحافظ على باقي الفلاتر. تغيير التبويب أو الفترة يعيد الترقيم للصفحة الأولى. */
  const hrefWith = (patch: {
    kind?: string;
    range?: string;
    page?: number;
    traffic?: "real" | "all";
    count?: CountMode;
    q?: string[] | null;
    exclude?: string[] | null;
    hash?: string;
  }) => {
    const p = new URLSearchParams();
    const kind = patch.kind ?? filter.key;
    if (kind !== "all") p.set("kind", kind);
    if (patch.range !== undefined) {
      if (patch.range !== "all") p.set("range", patch.range);
    } else if (isCustomRange) {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    } else if (range.key !== "all") {
      p.set("range", range.key);
    }
    const nextTraffic = patch.traffic ?? traffic;
    if (nextTraffic !== "real") p.set("traffic", nextTraffic);
    const nextCount = patch.count ?? countMode;
    if (nextCount !== "records") p.set("count", nextCount);

    const nextQ = patch.q !== undefined ? patch.q : qValues;
    if (nextQ && nextQ.length > 0) p.set("q", nextQ.join(","));

    const nextExclude = patch.exclude !== undefined ? patch.exclude : excludeValues;
    if (nextExclude && nextExclude.length > 0) p.set("exclude", nextExclude.join(","));

    if (patch.page && patch.page > 1) p.set("page", String(patch.page));
    const qs = p.toString();
    const base = qs ? `/admin/logs?${qs}` : "/admin/logs";
    return patch.hash ? `${base}#${patch.hash}` : base;
  };

  /**
   * بطاقة رقم قابلة للضغط تفتح جدول الأحداث مفلتَراً على نوعها.
   *
   * `traffic` تُمرَّر صراحةً لبطاقات الدخول: عدّادها يشمل كل الترافيك، فلو بقي الجدول
   * على «زوّار حقيقيون» لظهر فارغاً — رقم في البطاقة وصفر في الجدول.
   */
  const StatCard = ({
    label,
    value,
    scope,
    filterKey,
    forceTraffic,
  }: {
    label: string;
    value: number;
    scope: string;
    filterKey: string;
    forceTraffic?: "real" | "all";
  }) => {
    const isActive = filter.key === filterKey && (!forceTraffic || traffic === forceTraffic);
    return (
      <Link
        href={hrefWith({ kind: filterKey, traffic: forceTraffic, hash: "events" })}
        className={`group rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
          isActive
            ? "border-primary bg-primary/[0.06] shadow-sm"
            : "border-outline-variant/30 bg-surface-container-low hover:border-primary/40"
        }`}
      >
        <p className="flex items-center gap-1.5 text-sm font-bold text-on-surface-variant">
          {label}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5 opacity-0 transition-opacity group-hover:opacity-70"
            aria-hidden
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums">{value}</p>
        <p className="mt-1 text-[11px] text-on-surface-variant">{scope}</p>
      </Link>
    );
  };

  return (
    <>
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">سجل النشاط</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          مراقبة تسجيلات دخول <span className="font-bold text-on-surface">العملاء والموظفين</span>{" "}
          ومشاهدات صفحات الموقع العام.
        </p>
        <p className="mt-3 text-sm text-on-surface-variant">
          <Link href="/admin" className="font-bold text-primary hover:underline">
            لوحة التحكم
          </Link>
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-on-surface-variant">الفترة</span>
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={hrefWith({ range: r.key })}
              className={`rounded-full border px-4 py-1.5 text-sm font-bold transition-colors ${
                !isCustomRange && r.key === range.key
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant/40 text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
              }`}
            >
              {r.label}
            </Link>
          ))}

          <form method="get" action="/admin/logs" className="ms-auto flex flex-wrap items-center gap-2">
            {filter.key !== "all" && <input type="hidden" name="kind" value={filter.key} />}
            {traffic !== "real" && <input type="hidden" name="traffic" value={traffic} />}
            <label className="flex items-center gap-1.5 text-sm font-bold text-on-surface-variant">
              من
              <input
                type="date"
                name="from"
                defaultValue={from ?? ""}
                className="rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-sm font-medium text-on-surface"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm font-bold text-on-surface-variant">
              إلى
              <input
                type="date"
                name="to"
                defaultValue={to ?? ""}
                className="rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-sm font-medium text-on-surface"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl border border-primary bg-primary px-4 py-1.5 text-sm font-bold text-on-primary"
            >
              تطبيق
            </button>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-outline-variant/20 pt-4">
          <span className="text-sm font-bold text-on-surface-variant">الترافيك</span>
          {(
            [
              { key: "real", label: "زوّار حقيقيون" },
              { key: "all", label: "الكل (يشمل الفريق والبوتات)" },
            ] as const
          ).map((t) => (
            <Link
              key={t.key}
              href={hrefWith({ traffic: t.key })}
              className={`rounded-full border px-4 py-1.5 text-sm font-bold transition-colors ${
                traffic === t.key
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant/40 text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
              }`}
            >
              {t.label}
            </Link>
          ))}
          <span className="text-xs text-on-surface-variant">
            {traffic === "real"
              ? `مستبعَد: ${staffIps.size} عنوان داخلي (كل عنوان سجّل منه دخول إدارة) و${botSessionCount} جلسة بوت`
              : "كل الترافيك ظاهر — الأرقام تشمل زياراتك أنت وفريقك"}
          </span>
        </div>
      </section>

      <p className="mb-3 text-sm text-on-surface-variant">
        الأرقام التالية عن: <span className="font-bold text-on-surface">{rangeLabel}</span>
      </p>
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="دخول العملاء"
          value={rangeCustomerLogins}
          scope="كل الترافيك"
          filterKey="customer-logins"
          forceTraffic="all"
        />
        <StatCard
          label="دخول الموظفين"
          value={rangeAdminLogins}
          scope="كل الترافيك"
          filterKey="admin-logins"
          forceTraffic="all"
        />
        <StatCard
          label="مشاهدات الصفحات"
          value={rangeViews}
          scope={traffic === "real" ? "زوّار حقيقيون فقط" : "كل الترافيك"}
          filterKey="views"
        />
        <StatCard
          label="مشاهدات السيارات"
          value={rangeCarViews}
          scope={traffic === "real" ? "زوّار حقيقيون فقط" : "كل الترافيك"}
          filterKey="car-views"
        />
      </section>
      <p className="-mt-5 mb-8 text-xs text-on-surface-variant">
        اضغط أي بطاقة لعرض سجلّاتها في الجدول بالأسفل.
      </p>

      <section className="mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">رحلة الحجز</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              كم جلسة وصلت كل خطوة. الجلسة = أحداث نفس الزائر (IP + متصفح) بفاصل خمول أقل من
              ٣٠ دقيقة.
            </p>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="font-bold text-on-surface-variant">الجلسات</p>
              <p className="text-2xl font-extrabold tabular-nums">{funnel.totalSessions}</p>
            </div>
            <div>
              <p className="font-bold text-on-surface-variant">وسيط مدة الجلسة</p>
              <p className="text-2xl font-extrabold tabular-nums">
                {medianDurationMs == null ? "—" : formatDuration(medianDurationMs)}
              </p>
            </div>
            <div>
              <p className="font-bold text-on-surface-variant">وسيط البقاء في صفحة الحجز</p>
              <p className="text-2xl font-extrabold tabular-nums">
                {medianCheckoutDwellMs == null ? "—" : formatDuration(medianCheckoutDwellMs)}
              </p>
            </div>
          </div>
        </div>

        {sessionsBeforeTracking > 0 && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">
              {sessionsBeforeTracking} من {funnel.totalSessions} جلسة أقدم من تفعيل تتبّع
              التفاعلات
              {trackingStartedAt &&
                ` (${trackingStartedAt.toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })})`}
              .
            </p>
            <p className="mt-1">
              مرحلتا <span className="font-bold">«ضغط احجز الآن»</span> و
              <span className="font-bold">«أرسل النموذج»</span> تظهران أقل من الحقيقة لهذه
              الجلسات — لأنها لم تُقَس أصلاً، لا لأن الزوّار انسحبوا. اختر فترة تبدأ بعد هذا
              التاريخ لقراءة سليمة.
            </p>
          </div>
        )}

        {funnel.totalSessions === 0 ? (
          <p className="mt-6 text-sm text-on-surface-variant">لا توجد جلسات في هذه الفترة.</p>
        ) : (
          <ol className="mt-6 space-y-3">
            {funnel.rows.map((r) => {
              // السقوط عند الخطوة يُقاس بالنسبة للخطوة السابقة: هو مكان النزيف الفعلي.
              const dropped = r.shareOfPrevious != null && r.shareOfPrevious < 0.6;
              return (
                <li key={r.stage} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-sm font-bold">{r.label}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-lg bg-outline-variant/20">
                    <div
                      className={`h-full rounded-lg ${dropped ? "bg-rose-500" : "bg-primary"}`}
                      style={{ width: `${Math.max(1, Math.round(r.shareOfAll * 100))}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-end text-sm font-extrabold tabular-nums">
                    {r.sessions}
                  </span>
                  <span className="w-16 shrink-0 text-end text-xs font-bold tabular-nums text-on-surface-variant">
                    {pct(r.shareOfAll)}
                  </span>
                  <span
                    className={`w-28 shrink-0 text-end text-xs font-bold tabular-nums ${
                      dropped ? "text-rose-600" : "text-on-surface-variant"
                    }`}
                  >
                    {r.shareOfPrevious == null ? "—" : `${pct(r.shareOfPrevious)} من السابقة`}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {trackedCheckout.length > 0 && (
          <p className="mt-4 text-xs text-on-surface-variant">
            «ضغط احجز الآن» ليست خطوة إجبارية:{" "}
            <span className="font-extrabold tabular-nums text-on-surface">
              {checkoutWithoutButton}
            </span>{" "}
            من {trackedCheckout.length} جلسة وصلت صفحة الحجز دون المرور بالزرار — عبر رابط
            مباشر أو إعادة حجز أو رجوع من خطوة لاحقة. لذلك قد يتجاوز عدد «فتح صفحة الحجز»
            عدد الضغطات دون أن يكون في الأمر خطأ.
          </p>
        )}

        <div className="mt-6 grid gap-6 border-t border-outline-variant/20 pt-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-extrabold">أين يتوقفون</h3>
            <ul className="mt-3 space-y-2.5 text-sm">
              {dropOffRows.map((d) => {
                // لون الشارة حسب عدد الخطوات
                const badgeColor =
                  d.steps <= 0
                    ? "bg-emerald-100 text-emerald-800"
                    : d.steps === 1
                      ? "bg-rose-100 text-rose-800"
                      : d.steps === 2
                        ? "bg-orange-100 text-orange-800"
                        : d.steps <= 4
                          ? "bg-amber-100 text-amber-800"
                          : "bg-outline-variant/20 text-on-surface-variant";
                const stepsLabel =
                  d.steps < 0
                    ? null
                    : d.steps === 0
                      ? "اكتمل الحجز ✔"
                      : d.steps === 1
                        ? "خطوة واحدة — فتح صفحة الدفع"
                        : `${d.steps} خطوات من الدفع`;
                return (
                  <li key={d.stage} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-bold text-on-surface">{d.label}</span>
                      {d.exitPath && (
                        <a
                          href={d.exitPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-mono text-[10px] text-on-surface-variant/70 hover:text-primary hover:underline"
                          dir="ltr"
                          title={d.exitPath}
                        >
                          {d.exitPath.length > 55 ? d.exitPath.slice(0, 55) + "…" : d.exitPath}
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {stepsLabel && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${badgeColor}`}>
                          {stepsLabel}
                        </span>
                      )}
                      <span className="font-extrabold tabular-nums">{d.count}</span>
                    </div>
                  </li>
                );
              })}
              {dropOffRows.length === 0 && (
                <li className="text-on-surface-variant">—</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-extrabold">الأجهزة</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {deviceTally.map(([device, count]) => (
                <li key={device} className="flex items-baseline justify-between gap-3">
                  <span className="text-on-surface-variant">{device}</span>
                  <span className="font-extrabold tabular-nums">{count}</span>
                </li>
              ))}
              {deviceTally.length === 0 && <li className="text-on-surface-variant">—</li>}
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">الترافيك الإعلاني</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            الزيارات القادمة من إعلان (معرّف نقرة أو وسم UTM). «حجز ناجح» تعني حجزاً{" "}
            <span className="font-bold text-on-surface">مدفوعاً فعلاً</span> — لا مجرد وصول
            لصفحة الدفع.
          </p>
        </div>

        {adTotals.sessions === 0 ? (
          <p className="mt-5 text-sm text-on-surface-variant">
            لا توجد زيارات إعلانية في هذه الفترة. الزيارة تُحتسب إعلانية إذا حمل رابط الدخول{" "}
            <span className="font-mono text-xs" dir="ltr">
              gclid
            </span>{" "}
            أو{" "}
            <span className="font-mono text-xs" dir="ltr">
              fbclid
            </span>{" "}
            أو وسوم{" "}
            <span className="font-mono text-xs" dir="ltr">
              utm_*
            </span>
            .
          </p>
        ) : (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-bold text-emerald-800">حجوزات ناجحة (مدفوعة)</p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums text-emerald-900">
                  {adTotals.paidBooking}
                </p>
                <p className="mt-1 text-[11px] font-bold text-emerald-800">
                  {formatSar(adTotals.revenueSar)} ريال
                </p>
              </div>
              <div className="rounded-2xl border border-outline-variant/30 bg-surface p-5">
                <p className="text-sm font-bold text-on-surface-variant">أنشأت حجزاً ولم تدفع</p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums">
                  {adTotals.createdBooking - adTotals.paidBooking}
                </p>
                <p className="mt-1 text-[11px] text-on-surface-variant">وصلت صفحة الدفع وتوقفت</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/30 bg-surface p-5">
                <p className="text-sm font-bold text-on-surface-variant">فتحت صفحة الحجز فقط</p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums">
                  {adTotals.reachedCheckout - adTotals.createdBooking}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                <p className="text-sm font-bold text-rose-800">لم تصل صفحة الحجز</p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums text-rose-900">
                  {adTotals.sessions - adTotals.reachedCheckout}
                </p>
                <p className="mt-1 text-[11px] font-bold text-rose-800">
                  من {adTotals.sessions} زيارة إعلانية
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-outline-variant/25">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-start text-sm">
                  <thead>
                    <tr className="bg-surface-container text-xs font-extrabold uppercase tracking-wide text-on-surface-variant">
                      <th className="px-4 py-3 text-start">الحملة</th>
                      <th className="px-4 py-3 text-start">الشبكة</th>
                      <th className="px-4 py-3 text-start">زيارات</th>
                      <th className="px-4 py-3 text-start">صفحة الحجز</th>
                      <th className="px-4 py-3 text-start">أنشأت حجزاً</th>
                      <th className="px-4 py-3 text-start">حجز ناجح</th>
                      <th className="px-4 py-3 text-start">الإيراد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adRows.map((r, i) => (
                      <tr
                        key={r.key}
                        className={`border-t border-outline-variant/15 ${
                          i % 2 === 1 ? "bg-surface-container/40" : ""
                        } ${r.paidBooking > 0 ? "bg-emerald-50/60" : ""}`}
                      >
                        <td className="px-4 py-3 font-bold">
                          {r.campaign}
                          {!r.paid && (
                            <span
                              className="ms-2 rounded-full border border-outline-variant/40 px-2 py-0.5 text-[10px] font-bold text-on-surface-variant"
                              title="وسم UTM بلا معرّف نقرة — قد لا يكون إعلاناً مدفوعاً"
                            >
                              UTM فقط
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">
                          {r.network}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{r.sessions}</td>
                        <td className="px-4 py-3 tabular-nums">{r.reachedCheckout}</td>
                        <td className="px-4 py-3 tabular-nums">{r.createdBooking}</td>
                        <td className="px-4 py-3 font-extrabold tabular-nums text-emerald-700">
                          {r.paidBooking}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                          {r.revenueSar > 0 ? `${formatSar(r.revenueSar)} ر.س` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="mb-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
          <h2 className="text-lg font-extrabold tracking-tight">أسباب فشل نموذج الحجز</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            عند أي حقل يتعثّر من ضغط «إتمام الحجز».
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {errorTally.map(([code, count]) => (
              <li key={code} className="flex items-baseline justify-between gap-3">
                <span className="text-on-surface-variant">
                  {CHECKOUT_ERROR_LABELS[code] ?? code}
                </span>
                <span className="font-extrabold tabular-nums">{count}</span>
              </li>
            ))}
            {errorTally.length === 0 && (
              <li className="text-on-surface-variant">لا أخطاء مسجّلة في هذه الفترة.</li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
          <h2 className="text-lg font-extrabold tracking-tight">مصادر الزيارات</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            من أين جاء الزائر. «مباشر» = كتب العنوان أو جاء من تطبيق يخفي المصدر.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {referrerTally.map(([source, count]) => (
              <li key={source} className="flex items-baseline justify-between gap-3">
                <span className="text-on-surface-variant" dir="ltr">
                  {source}
                </span>
                <span className="font-extrabold tabular-nums">{count}</span>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-3">
              <span className="text-on-surface-variant">مباشر / غير معروف</span>
              <span className="font-extrabold tabular-nums">{directSessions}</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">خريطة الزوار</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              من أين يتصفّح الزوار — تجميع حسب المدينة.
            </p>
          </div>
          {geoReady && (
            <p className="text-sm text-on-surface-variant">
              <span className="font-extrabold tabular-nums text-on-surface">{mappedSessions}</span>{" "}
              من {sessions.length} جلسة أمكن تحديد موقعها في{" "}
              <span className="font-extrabold tabular-nums text-on-surface">
                {geoClusters.length}
              </span>{" "}
              مدينة
            </p>
          )}
        </div>

        {!geoReady ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">قاعدة تحديد المواقع غير منزَّلة بعد.</p>
            <ol className="mt-2 list-inside list-decimal space-y-1">
              <li>
                أنشئ حساباً مجانياً على{" "}
                <span className="font-mono text-xs" dir="ltr">
                  maxmind.com/en/geolite2/signup
                </span>
              </li>
              <li>
                My Account ← Manage License Keys ← Generate new license key، وضعه في{" "}
                <span className="font-mono text-xs" dir="ltr">
                  .env
                </span>{" "}
                باسم{" "}
                <span className="font-mono text-xs" dir="ltr">
                  MAXMIND_LICENSE_KEY
                </span>
              </li>
              <li>
                شغّل{" "}
                <span className="font-mono text-xs" dir="ltr">
                  npm run geo:update
                </span>
              </li>
            </ol>
          </div>
        ) : (
          <VisitorMap clusters={geoClusters} />
        )}

        <p className="mt-3 text-xs text-on-surface-variant">
          تنبيه: عناوين شبكات الجوال غالباً تُنسب لبوابة المشغّل لا لمدينة المستخدم، ومعظم
          ترافيكك جوال — فاقرأ المدن كمؤشر عام لا كموقع دقيق.
        </p>
      </section>

      {searchQueryTally.length > 0 && (
        <details className="group mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
          <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">معايير البحث المستخدَمة</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                التواريخ والفرع والفئة كما وصلت في رابط الصفحة — أكثر ٢٥ تركيبة.
              </p>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ms-auto size-5 shrink-0 text-on-surface-variant transition-transform group-open:rotate-180"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <ul className="mt-4 space-y-2 text-xs">
            {searchQueryTally.slice(0, 25).map(([query, count]) => (
              <li key={query} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-on-surface-variant" dir="ltr" title={query}>
                  {query}
                </span>
                <span className="shrink-0 font-extrabold tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {topVisitors.length > 0 && (
        <details className="group mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
          <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">العملاء الأكثر زيارة</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                عدد مشاهدات الصفحات والسيارات لكل عميل مسجّل دخول. الزيارات قبل تفعيل الربط
                تظهر كـ«زائر».
              </p>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ms-auto size-5 shrink-0 text-on-surface-variant transition-transform group-open:rotate-180"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <ol className="mt-4 space-y-3">
            {topVisitors.map((v, i) => (
              <li key={v.userId} className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-center text-sm font-extrabold text-on-surface-variant tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-bold">{v.label}</span>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums">
                      {v.visits} <span className="font-medium text-on-surface-variant">زيارة</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-outline-variant/20">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.max(4, Math.round((v.visits / maxTopVisits) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}

      {topCars.length > 0 && (
        <details className="group mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
          <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">السيارات الأكثر زيارة</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                عدد مرات فتح صفحة الحجز لكل سيارة خلال الفترة المحددة.
              </p>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ms-auto size-5 shrink-0 text-on-surface-variant transition-transform group-open:rotate-180"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <ol className="mt-4 space-y-3">
            {topCars.map((c, i) => (
              <li key={c.carModelId} className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-center text-sm font-extrabold text-on-surface-variant tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/fleet/checkout?modelId=${c.carModelId}`}
                      target="_blank"
                      className="truncate font-bold hover:text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums">
                      {c.views} <span className="font-medium text-on-surface-variant">مشاهدة</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-outline-variant/20">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(4, Math.round((c.views / maxTopViews) * 100))}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}

      {sessions.length > 0 && (
        <details className="group mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
          <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">
                أين توقّف كل زائر
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                أحدث ١٠٠ جلسة: من هو، وأين وصل، و<span className="font-bold">آخر عنوان فتحه
                قبل أن يغادر</span> بالرابط كاملاً.
              </p>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ms-auto size-5 shrink-0 text-on-surface-variant transition-transform group-open:rotate-180"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>

          <div className="mt-5 overflow-hidden rounded-xl border border-outline-variant/25">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-start text-sm">
                <thead>
                  <tr className="bg-surface-container text-xs font-extrabold uppercase tracking-wide text-on-surface-variant">
                    <th className="px-4 py-3 text-start">البداية</th>
                    <th className="px-4 py-3 text-start">العميل</th>
                    <th className="px-4 py-3 text-start">الجهاز</th>
                    <th className="px-4 py-3 text-start">المدة</th>
                    <th className="px-4 py-3 text-start">توقّف عند</th>
                    <th className="px-4 py-3 text-start">آخر عنوان فتحه</th>
                    <th className="px-4 py-3 text-start">الأثر</th>
                  </tr>
                </thead>
                <tbody>
                  {shownSessions.map((s, i) => (
                    <tr
                      key={`${s.key}-${s.startedAt.getTime()}`}
                      className={`border-t border-outline-variant/15 align-top ${
                        i % 2 === 1 ? "bg-surface-container/40" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-on-surface-variant">
                        {s.startedAt.toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        {s.userId != null ? (
                          userLabelById.get(s.userId) ?? `عميل #${s.userId}`
                        ) : (
                          <span className="text-on-surface-variant">زائر غير مسجّل</span>
                        )}
                        <span className="block text-[11px] font-normal text-on-surface-variant" dir="ltr">
                          {s.ip ?? "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant" dir="ltr">
                        {s.browser ?? s.device}
                        {s.isStaff && (
                          <span className="ms-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            داخلي
                          </span>
                        )}
                        {s.isSuspectedBot && (
                          <span className="ms-2 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            بوت؟
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-on-surface-variant">
                        {formatDuration(s.durationMs)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-bold">
                        {s.deepestStage ? FUNNEL_STAGE_LABELS[s.deepestStage] : "—"}
                        {s.lastErrorCode && (
                          <span className="block text-[11px] font-bold text-rose-600">
                            {CHECKOUT_ERROR_LABELS[s.lastErrorCode] ?? s.lastErrorCode}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[340px] px-4 py-3">
                        {s.exitPath ? (
                          <>
                            <a
                              href={s.exitPath}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={s.exitPath}
                              className="block truncate text-xs text-primary hover:underline"
                              dir="ltr"
                            >
                              {s.exitPath}
                            </a>
                            {s.exitCarModelId != null && (
                              <span className="mt-0.5 block text-[11px] font-bold text-on-surface-variant">
                                {carNameById.get(s.exitCarModelId) ?? `موديل #${s.exitCarModelId}`}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </td>
                      <td className="max-w-[280px] px-4 py-3 text-xs text-on-surface-variant" dir="ltr">
                        {s.trail.join(" → ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}

      <section
        id="events"
        className="scroll-mt-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold tracking-tight">سجل الأحداث</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-on-surface-variant">وحدة العدّ</span>
            <div className="flex overflow-hidden rounded-full border border-outline-variant/40">
              {COUNT_MODES.map((m) => (
                <Link
                  key={m.key}
                  href={hrefWith({ count: m.key, hash: "events" })}
                  title={`عدّ بوحدة: ${m.unit}`}
                  className={`px-4 py-1.5 text-sm font-bold transition-colors ${
                    countMode === m.key
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-outline-variant/15 hover:text-on-surface"
                  }`}
                >
                  {m.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

            {/* صفاية الأحداث — Multi-select autocomplete */}
        <div className="mb-5 rounded-2xl border border-outline-variant/30 bg-surface/70 p-4">
          <div className="flex flex-wrap items-start gap-3">
            <LogsFilterSelect
              name="q"
              value={qValues}
              groups={filterGroups}
              color="emerald"
              label="+ تحديد:"
            />
            <LogsFilterSelect
              name="exclude"
              value={excludeValues}
              groups={filterGroups}
              color="rose"
              label="- استبعاد:"
            />
            {(qValues.length > 0 || excludeValues.length > 0) && (
              <Link
                href={hrefWith({ q: null, exclude: null, page: 1, hash: "events" })}
                className="rounded-xl border border-outline-variant/40 bg-surface px-3.5 py-2 text-sm font-bold text-on-surface-variant hover:bg-outline-variant/15 hover:text-on-surface transition-colors shrink-0 self-center"
              >
                مسح الصفاية
              </Link>
            )}
          </div>

        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const isActive = f.key === filter.key;
            return (
              <Link
                key={f.key}
                href={hrefWith({ kind: f.key, hash: "events" })}
                title={`عدد ${countUnit} خلال: ${rangeLabel}`}
                className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline-variant/40 text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums ${
                    isActive ? "bg-on-primary/20" : "bg-outline-variant/25"
                  }`}
                >
                  {tabCount(f.kinds)}
                </span>
              </Link>
            );
          })}
          <span className="ms-auto text-sm text-on-surface-variant">
            {total} سجل — صفحة {page} من {totalPages}
          </span>
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">
          {countMode === "records" ? (
            <>
              كل تبويب يعرض <span className="font-bold">عدد السجلات</span>، فمجموع التبويبات
              يساوي «الكل» تماماً.
            </>
          ) : (
            <>
              كل تبويب يعرض <span className="font-bold">عدد الزوّار المنفردين</span> (IP فريدة).
              مجموع التبويبات <span className="font-bold">أكبر من</span> «الكل» بشكل طبيعي: الزائر
              الواحد يظهر في أكثر من تبويب، و«الكل» يعدّه مرة واحدة.
            </>
          )}
        </p>

        {rows.length === 0 ? (
          <p className="mt-6 text-sm text-on-surface-variant">لا توجد سجلات بعد.</p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-xl border border-outline-variant/25">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-center text-sm">
              <thead>
                <tr className="bg-surface-container text-xs font-extrabold uppercase tracking-wide text-on-surface-variant">
                  <th className="px-4 py-3">الوقت</th>
                  <th className="px-4 py-3">النوع</th>
                  <th className="px-4 py-3">بواسطة</th>
                  <th className="px-4 py-3">الصفحة</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">المتصفح</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-t border-outline-variant/15 align-middle transition-colors hover:bg-primary/[0.04] ${
                      i % 2 === 1 ? "bg-surface-container/40" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-on-surface-variant">
                      {r.createdAt.toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                          KIND_BADGE_CLASSES[r.kind] ?? "bg-surface text-on-surface-variant border-outline-variant/40"
                        }`}
                      >
                        {KIND_LABELS[r.kind] ?? r.kind}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 font-medium"
                      dir={r.actorLabel ? "ltr" : undefined}
                    >
                      {r.actorLabel ??
                        (r.userId != null ? userLabelById.get(r.userId) : null) ?? (
                          <span className="text-on-surface-variant">زائر</span>
                        )}
                    </td>
                    <td
                      className="max-w-[220px] truncate px-4 py-3"
                      dir={r.carModelId != null ? undefined : "ltr"}
                      title={r.path ?? undefined}
                    >
                      {r.carModelId != null ? (
                        <a
                          href={`/fleet/checkout?modelId=${r.carModelId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {carNameById.get(r.carModelId) ?? `موديل #${r.carModelId}`}
                        </a>
                      ) : r.path ? (
                        <a
                          href={r.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {r.path}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums" dir="ltr">
                      {r.ip ? (
                        <div className="group/ip relative inline-flex items-center gap-1.5">
                          <span>{r.ip}</span>
                          <span className="inline-flex items-center gap-1 opacity-0 transition-opacity group-hover/ip:opacity-100">
                            <Link
                              href={hrefWith({ q: [...qValues, r.ip], page: 1, hash: "events" })}
                              className="rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-extrabold text-emerald-800 hover:bg-emerald-200"
                              title="تحديد هذا الـ IP فقط"
                            >
                              +
                            </Link>
                            <Link
                              href={hrefWith({ exclude: [...excludeValues, r.ip], page: 1, hash: "events" })}
                              className="rounded bg-rose-100 px-1 py-0.5 text-[10px] font-extrabold text-rose-800 hover:bg-rose-200"
                              title="استبعاد هذا الـ IP"
                            >
                              -
                            </Link>
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant" dir="ltr" title={r.userAgent ?? undefined}>
                      {shortBrowser(r.userAgent) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            {page > 1 && (
              <Link
                href={hrefWith({ page: page - 1, hash: "events" })}
                className="rounded-xl border border-outline-variant/40 px-4 py-2 text-sm font-bold hover:border-primary/40"
              >
                الأحدث
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={hrefWith({ page: page + 1, hash: "events" })}
                className="rounded-xl border border-outline-variant/40 px-4 py-2 text-sm font-bold hover:border-primary/40"
              >
                الأقدم
              </Link>
            )}
          </div>
        )}
      </section>
    </>
  );
}
