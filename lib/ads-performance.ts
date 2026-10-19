/**
 * لوحة الأداء الإعلاني — تجمع **مصدرين** كان كلٌّ منهما يُقرأ وحده:
 *   1) سجل النشاط (الزيارات والمراحل) → جلسات مُعاد بناؤها، وهي تقريبية بطبيعتها.
 *   2) جدول الحجوزات (الحالة والدفع والمبلغ ومعرّف نقرة Google المحفوظ) → هو الحقيقة.
 *
 * قاعدتان تحكمان كل رقم هنا:
 *   - النجاح = **حجز فعّال** (ليس مرفوضاً ولا ملغى)، لا «مدفوع إلكترونياً»: أغلب العملاء
 *     يدفعون في الفرع نقداً، فمقياس «مدفوع» كان يُظهر الحملات صفراً وهي تجلب حجوزات حقيقية.
 *   - الحجز يُنسب لإعلان إن حمل معرّف نقرة محفوظاً **أو** ارتبط بجلسة إعلانية؛ الأول أمتن.
 */
import { prisma } from "@/lib/prisma";
import { CLIENT_TRACKABLE_KINDS } from "@/lib/activity-log";
import { VISIBLE_BOOKINGS_WHERE } from "@/lib/booking-visibility";
import {
  buildSessions,
  median,
  pathQuery,
  type ActivityRowForFunnel,
  type VisitorSession,
} from "@/lib/activity-funnel";
import { getAdsSettings, type AdsSettings, type AdsSpendEntry } from "@/lib/ads-settings";

export type AdsPeriod = 7 | 30 | 90 | 365;

/** سقف صفوف سجل النشاط المحمّلة — يحمي الصفحة عند نمو السجل (الأحدث أولاً). */
const ACTIVITY_ROW_CAP = 80000;

const LOCAL_IPS = ["::1", "127.0.0.1", "::ffff:127.0.0.1"];
const MANUALLY_EXCLUDED_IPS = (process.env.ANALYTICS_EXCLUDED_IPS ?? "")
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean);

/** أحداث الزائر الحقيقية فقط؛ أحداث الخادم (دفع/استرداد/حظر) لا تمثّل زيارة وتصنع جلسات وهمية. */
const VISITOR_KINDS: string[] = [...CLIENT_TRACKABLE_KINDS, "CUSTOMER_LOGIN"];

const DEAD_STATUSES = new Set(["CANCELLED", "REJECTED"]);
const DELIVERED_STATUSES = new Set(["PICKED_UP", "RETURNED", "COMPLETED"]);

// ─── تواريخ الرياض ────────────────────────────────────────────────────────────

function riyadhDayStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+03:00`);
}
function riyadhYmd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}
function shiftYmd(ymd: string, days: number): string {
  const d = riyadhDayStart(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return riyadhYmd(d);
}
function ymdDiffDays(a: string, b: string): number {
  return Math.round((riyadhDayStart(b).getTime() - riyadhDayStart(a).getTime()) / 86_400_000);
}
function dayLabel(ymd: string): string {
  return riyadhDayStart(ymd).toLocaleDateString("ar-SA", {
    timeZone: "Asia/Riyadh",
    day: "numeric",
    month: "short",
  });
}

// ─── الأنواع ──────────────────────────────────────────────────────────────────

export type OutcomeStats = {
  /** حجوزات أُنشئت (أي حالة). */
  bookings: number;
  /** حجوزات فعّالة = غير مرفوضة وغير ملغاة. هذا مقياس النجاح الرئيسي. */
  active: number;
  /** وصلت للاستلام الفعلي (استلام/إرجاع/مكتمل). */
  delivered: number;
  /** مرفوضة أو ملغاة. */
  dead: number;
  /** فعّالة ومؤكَّد دفعها (إلكترونياً أو سجّله الموظف). */
  paid: number;
  /** إيراد مؤكَّد الدفع. */
  collectedSar: number;
  /** قيمة الحجوزات الفعّالة (مدفوعة وغير مدفوعة). */
  pipelineSar: number;
};

export type SessionStats = {
  sessions: number;
  bounced: number;
  reachedFleet: number;
  reachedBookNow: number;
  reachedCheckout: number;
  submitted: number;
};

export type ChannelStats = SessionStats & OutcomeStats;

export type CampaignRow = ChannelStats & {
  key: string;
  network: string;
  campaign: string;
  displayName: string;
  /** اسم الحملة رقم خام (لم يُسمَّ بعد). */
  isRawId: boolean;
  /** معرّف نقرة حقيقي (مدفوع يقيناً) أم وسم UTM فقط. */
  paidClick: boolean;
  spendSar: number;
  reportedClicks: number | null;
  /** تكلفة الحجز الفعّال. */
  cpaSar: number | null;
  /** تكلفة الوصول لصفحة الحجز. */
  costPerCheckoutSar: number | null;
};

export type HealthLevel = "ok" | "warn" | "bad" | "info";

export type HealthCheck = {
  id: string;
  level: HealthLevel;
  title: string;
  detail: string;
  action?: string;
};

export type DayPoint = { dateKey: string; label: string; count: number };

export type AdsReport = {
  days: AdsPeriod;
  startYmd: string;
  endYmd: string;
  generatedAt: Date;
  /** بلغ تحميل سجل النشاط السقف — الأقدم مقتطع. */
  truncated: boolean;
  paid: ChannelStats;
  googleAds: ChannelStats;
  utmOnly: ChannelStats;
  organic: ChannelStats;
  campaigns: CampaignRow[];
  daily: { adSessions: DayPoint[]; adActiveBookings: DayPoint[] };
  devices: Array<{ device: string; sessions: number; reachedCheckout: number; bookings: number }>;
  landingPages: Array<{ path: string; sessions: number; bounced: number; reachedCheckout: number }>;
  leads: {
    contactMessages: number;
    contactFromAds: number;
    corporateLeads: number;
    corporateFromAds: number;
  };
  spend: {
    totalSar: number;
    entries: number;
    reportedClicks: number | null;
    cpaSar: number | null;
    costPerCheckoutSar: number | null;
    cpcSar: number | null;
  };
  medianAdSessionMs: number | null;
  health: HealthCheck[];
  insights: string[];
  settings: AdsSettings;
};

// ─── أدوات حسابية صغيرة ───────────────────────────────────────────────────────

const emptyStats = (): ChannelStats => ({
  sessions: 0,
  bounced: 0,
  reachedFleet: 0,
  reachedBookNow: 0,
  reachedCheckout: 0,
  submitted: 0,
  bookings: 0,
  active: 0,
  delivered: 0,
  dead: 0,
  paid: 0,
  collectedSar: 0,
  pipelineSar: 0,
});

function addSession(acc: ChannelStats, s: VisitorSession) {
  acc.sessions++;
  if (s.events.length === 1) acc.bounced++;
  if (s.stages.has("fleet")) acc.reachedFleet++;
  if (s.stages.has("book_now")) acc.reachedBookNow++;
  if (s.stages.has("checkout")) acc.reachedCheckout++;
  if (s.stages.has("submit")) acc.submitted++;
}

type BookingRow = {
  id: number;
  createdAt: Date;
  status: string;
  paymentStatus: string;
  paidAmountSar: number | null;
  snapshotTotalAmountSar: number | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
};

function addBooking(acc: ChannelStats, b: BookingRow) {
  const status = b.status.trim().toUpperCase();
  const dead = DEAD_STATUSES.has(status);
  acc.bookings++;
  if (dead) {
    acc.dead++;
    return;
  }
  acc.active++;
  if (DELIVERED_STATUSES.has(status)) acc.delivered++;
  acc.pipelineSar += b.snapshotTotalAmountSar ?? b.paidAmountSar ?? 0;
  if (b.paymentStatus === "PAID") {
    acc.paid++;
    acc.collectedSar += b.paidAmountSar ?? 0;
  }
}

const hasClickId = (b: Pick<BookingRow, "gclid" | "gbraid" | "wbraid">) =>
  Boolean(b.gclid || b.gbraid || b.wbraid);

const ratio = (num: number, den: number) => (den > 0 ? num / den : null);
const pctText = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/** رقم الحملة الخام من جوجل (لم يُستبدل باسم مقروء). */
const RAW_ID_RE = /^\d{6,}$/;

/** مصادر UTM التي تعني منصة إعلانية — لو جاءت بلا معرّف نقرة فغالباً فُقد المعرّف. */
const AD_PLATFORM_SOURCE_RE =
  /^(google|googleads|adwords|bing|facebook|fb|meta|instagram|ig|tiktok|snapchat|snap|twitter|x)$/i;

/** قيم medium تدل على رابط تجريبي نُسي في قالب التتبّع. */
const TEST_MEDIUM_RE = /^(test|testing|temp|tmp|demo)$/i;

function firstAdParams(s: VisitorSession): URLSearchParams | null {
  for (const e of s.events) {
    const q = pathQuery(e.path);
    if (q && /(utm_|gclid|gbraid|wbraid|gad_|fbclid|msclkid|ttclid)/.test(q)) {
      return new URLSearchParams(q);
    }
  }
  return null;
}

// ─── الإنفاق ──────────────────────────────────────────────────────────────────

function prorate(entry: AdsSpendEntry, startYmd: string, endYmd: string) {
  const from = entry.from > startYmd ? entry.from : startYmd;
  const to = entry.to < endYmd ? entry.to : endYmd;
  if (to < from) return { amount: 0, clicks: 0 };
  const entryDays = ymdDiffDays(entry.from, entry.to) + 1;
  const overlap = ymdDiffDays(from, to) + 1;
  const share = overlap / entryDays;
  return { amount: entry.amountSar * share, clicks: (entry.clicks ?? 0) * share };
}

// ─── البناء الرئيسي ───────────────────────────────────────────────────────────

export async function loadAdsReport(days: AdsPeriod): Promise<AdsReport> {
  const now = new Date();
  const endYmd = riyadhYmd(now);
  const startYmd = shiftYmd(endYmd, -(days - 1));
  const start = riyadhDayStart(startYmd);

  const [adminIpRows, settings] = await Promise.all([
    prisma.activityLog.findMany({
      where: { kind: "ADMIN_LOGIN", ip: { not: null } },
      select: { ip: true },
      distinct: ["ip"],
    }),
    getAdsSettings(),
  ]);
  const staffIps = new Set<string>([
    ...adminIpRows.map((r) => r.ip as string),
    ...LOCAL_IPS,
    ...MANUALLY_EXCLUDED_IPS,
  ]);

  const [rows, bookings, firstClickBooking, contactRows, corporateRows] = await Promise.all([
    prisma.activityLog.findMany({
      where: {
        createdAt: { gte: start },
        kind: { in: VISITOR_KINDS },
        OR: [{ ip: null }, { ip: { notIn: [...staffIps] } }],
      },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_ROW_CAP,
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
    prisma.bookingRequest.findMany({
      where: {
        ...VISIBLE_BOOKINGS_WHERE,
        createdAt: { gte: start },
        isBulkAvailabilityImport: false,
        legacyRef: null,
      },
      select: {
        id: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        paidAmountSar: true,
        snapshotTotalAmountSar: true,
        gclid: true,
        gbraid: true,
        wbraid: true,
      },
    }),
    prisma.bookingRequest.findFirst({
      where: { OR: [{ gclid: { not: null } }, { gbraid: { not: null } }, { wbraid: { not: null } }] },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.contactMessage.findMany({
      where: { createdAt: { gte: start } },
      select: { gclid: true, gbraid: true, wbraid: true },
    }),
    prisma.corporateBookingLead.findMany({
      where: { createdAt: { gte: start } },
      select: { gclid: true, gbraid: true, wbraid: true },
    }),
  ]);

  const truncated = rows.length >= ACTIVITY_ROW_CAP;
  const allSessions = buildSessions(rows as ActivityRowForFunnel[], staffIps);
  const botSessions = allSessions.filter((s) => s.isSuspectedBot).length;
  const sessions = allSessions.filter((s) => !s.isSuspectedBot);

  // ── الجلسة التي ينتسب إليها كل حجز (الأقدم إعلانياً أولاً) ───────────────────
  const sessionsByBooking = new Map<number, VisitorSession[]>();
  for (const s of sessions) {
    for (const id of s.bookingRequestIds) {
      const list = sessionsByBooking.get(id) ?? [];
      list.push(s);
      sessionsByBooking.set(id, list);
    }
  }
  const attributingSession = (id: number): VisitorSession | null => {
    const list = sessionsByBooking.get(id);
    if (!list?.length) return null;
    const ordered = [...list].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    return (
      ordered.find((s) => s.adClick?.paid) ?? ordered.find((s) => s.adClick) ?? null
    );
  };

  // ── تجميع الجلسات ────────────────────────────────────────────────────────────
  const paid = emptyStats();
  const googleAds = emptyStats();
  const utmOnly = emptyStats();
  const organic = emptyStats();
  const campaigns = new Map<string, CampaignRow>();
  const deviceMap = new Map<string, { sessions: number; reachedCheckout: number; bookings: number }>();
  const landing = new Map<string, { sessions: number; bounced: number; reachedCheckout: number }>();
  const adSessionDurations: number[] = [];

  const getCampaign = (network: string, campaign: string, paidClick: boolean): CampaignRow => {
    const key = `${network}|${campaign}`;
    let row = campaigns.get(key);
    if (!row) {
      row = {
        ...emptyStats(),
        key,
        network,
        campaign,
        displayName: settings.campaignNames[campaign] ?? campaign,
        isRawId: RAW_ID_RE.test(campaign) && !settings.campaignNames[campaign],
        paidClick,
        spendSar: 0,
        reportedClicks: null,
        cpaSar: null,
        costPerCheckoutSar: null,
      };
      campaigns.set(key, row);
    }
    if (paidClick) row.paidClick = true;
    return row;
  };

  for (const s of sessions) {
    const ad = s.adClick;
    if (ad?.paid) {
      addSession(paid, s);
      if (ad.network === "Google Ads") addSession(googleAds, s);
      addSession(getCampaign(ad.network, ad.campaign, true), s);
      adSessionDurations.push(s.durationMs);

      const dev = deviceMap.get(s.device) ?? { sessions: 0, reachedCheckout: 0, bookings: 0 };
      dev.sessions++;
      if (s.stages.has("checkout")) dev.reachedCheckout++;
      deviceMap.set(s.device, dev);

      const lp = s.trail[0] ?? "/";
      const l = landing.get(lp) ?? { sessions: 0, bounced: 0, reachedCheckout: 0 };
      l.sessions++;
      if (s.events.length === 1) l.bounced++;
      if (s.stages.has("checkout")) l.reachedCheckout++;
      landing.set(lp, l);
    } else if (ad) {
      addSession(utmOnly, s);
      addSession(getCampaign(ad.network, ad.campaign, false), s);
    } else {
      addSession(organic, s);
    }
  }

  // ── تجميع الحجوزات (معرّف النقرة المحفوظ يغلب الجلسة) ────────────────────────
  for (const b of bookings) {
    const session = attributingSession(b.id);
    const sessionAd = session?.adClick ?? null;

    if (hasClickId(b)) {
      addBooking(paid, b);
      addBooking(googleAds, b);
      const network = "Google Ads";
      const campaign =
        sessionAd?.paid && sessionAd.network === network ? sessionAd.campaign : "غير محدد (من المعرّف المحفوظ)";
      addBooking(getCampaign(network, campaign, true), b);
      if (session) {
        const dev = deviceMap.get(session.device);
        if (dev) dev.bookings++;
      }
    } else if (sessionAd?.paid) {
      addBooking(paid, b);
      if (sessionAd.network === "Google Ads") addBooking(googleAds, b);
      addBooking(getCampaign(sessionAd.network, sessionAd.campaign, true), b);
      const dev = deviceMap.get(session!.device);
      if (dev) dev.bookings++;
    } else if (sessionAd) {
      addBooking(utmOnly, b);
      addBooking(getCampaign(sessionAd.network, sessionAd.campaign, false), b);
    } else {
      addBooking(organic, b);
    }
  }

  // ── الإنفاق ─────────────────────────────────────────────────────────────────
  let totalSpend = 0;
  let totalReportedClicks = 0;
  let anyClicks = false;
  for (const e of settings.spend) {
    const p = prorate(e, startYmd, endYmd);
    totalSpend += p.amount;
    if (e.clicks != null) {
      anyClicks = true;
      totalReportedClicks += p.clicks;
    }
    if (!e.campaign) continue;
    const row = [...campaigns.values()].find(
      (c) => c.network.toLowerCase() === e.network.toLowerCase() && c.campaign === e.campaign,
    );
    if (row) {
      row.spendSar += p.amount;
      if (e.clicks != null) row.reportedClicks = (row.reportedClicks ?? 0) + p.clicks;
    }
  }
  const campaignRows = [...campaigns.values()];
  for (const row of campaignRows) {
    row.cpaSar = row.spendSar > 0 && row.active > 0 ? row.spendSar / row.active : null;
    row.costPerCheckoutSar =
      row.spendSar > 0 && row.reachedCheckout > 0 ? row.spendSar / row.reachedCheckout : null;
  }
  campaignRows.sort(
    (a, b) =>
      b.active - a.active || b.reachedCheckout - a.reachedCheckout || b.sessions - a.sessions,
  );

  // ── السلاسل اليومية ──────────────────────────────────────────────────────────
  const dayKeys: string[] = [];
  for (let i = 0; i < days && i < 90; i++) dayKeys.push(shiftYmd(endYmd, -(Math.min(days, 90) - 1) + i));
  const sessionDay = new Map<string, number>();
  for (const s of sessions) {
    if (!s.adClick?.paid) continue;
    const k = riyadhYmd(s.startedAt);
    sessionDay.set(k, (sessionDay.get(k) ?? 0) + 1);
  }
  const bookingDay = new Map<string, number>();
  for (const b of bookings) {
    const session = attributingSession(b.id);
    const isAd = hasClickId(b) || Boolean(session?.adClick?.paid);
    if (!isAd || DEAD_STATUSES.has(b.status.trim().toUpperCase())) continue;
    const k = riyadhYmd(b.createdAt);
    bookingDay.set(k, (bookingDay.get(k) ?? 0) + 1);
  }
  const daily = {
    adSessions: dayKeys.map((k) => ({ dateKey: k, label: dayLabel(k), count: sessionDay.get(k) ?? 0 })),
    adActiveBookings: dayKeys.map((k) => ({ dateKey: k, label: dayLabel(k), count: bookingDay.get(k) ?? 0 })),
  };

  // ── العملاء المحتملون ─────────────────────────────────────────────────────────
  const fromAds = (r: { gclid: string | null; gbraid: string | null; wbraid: string | null }) =>
    hasClickId(r);
  const leads = {
    contactMessages: contactRows.length,
    contactFromAds: contactRows.filter(fromAds).length,
    corporateLeads: corporateRows.length,
    corporateFromAds: corporateRows.filter(fromAds).length,
  };

  // ── مؤشرات الإنفاق الكلية ──────────────────────────────────────────────────────
  const spend = {
    totalSar: totalSpend,
    entries: settings.spend.length,
    reportedClicks: anyClicks ? totalReportedClicks : null,
    cpaSar: totalSpend > 0 && paid.active > 0 ? totalSpend / paid.active : null,
    costPerCheckoutSar: totalSpend > 0 && paid.reachedCheckout > 0 ? totalSpend / paid.reachedCheckout : null,
    cpcSar:
      totalSpend > 0 && anyClicks && totalReportedClicks > 0
        ? totalSpend / totalReportedClicks
        : totalSpend > 0 && paid.sessions > 0
          ? totalSpend / paid.sessions
          : null,
  };

  // ── صحة القياس ───────────────────────────────────────────────────────────────
  const health: HealthCheck[] = [];

  // 1) التقاط معرّف النقرة على الحجز
  const captureStart = firstClickBooking?.createdAt ?? null;
  if (!captureStart) {
    health.push({
      id: "clickid-capture",
      level: "warn",
      title: "لم يُحفظ أي معرّف نقرة على أي حجز بعد",
      detail:
        "ميزة حفظ GCLID/GBRAID/WBRAID على الحجز جديدة ولم يمرّ بها حجز قادم من إعلان. حتى ذلك الحين تعتمد أرقام الحجوزات الإعلانية على ربط الجلسات (تقريبي).",
      action: "بعد أول حجز من إعلان افتح تفاصيله وتأكد أن حقل GCLID ظاهر.",
    });
  } else {
    const tied = bookings.filter(
      (b) => b.createdAt >= captureStart && attributingSession(b.id)?.adClick?.network === "Google Ads",
    );
    const withId = tied.filter(hasClickId).length;
    if (tied.length >= 3) {
      const cov = withId / tied.length;
      health.push({
        id: "clickid-capture",
        level: cov >= 0.8 ? "ok" : withId === 0 ? "bad" : "warn",
        title: `معرّف النقرة محفوظ على ${pctText(cov)} من حجوزات إعلانات جوجل`,
        detail: `${withId} من ${tied.length} حجز مرتبط بجلسة إعلانية يحمل معرّفاً. النقص يعني أن الكوكي لم يصل لخادم الحجز (حاجب كوكيز / فتح الرابط من تطبيق).`,
        action: cov >= 0.8 ? undefined : "راجع ثبات كوكي rw_gclid وتأكد أن الحجز يقرؤه من نفس الدومين.",
      });
    } else {
      health.push({
        id: "clickid-capture",
        level: "info",
        title: "التقاط معرّف النقرة مفعّل — العيّنة ما زالت صغيرة",
        detail: `بدأ الحفظ في ${riyadhYmd(captureStart)}. يلزم ٣ حجوزات إعلانية على الأقل لقياس نسبة التغطية.`,
      });
    }
  }

  // 2) أسماء الحملات
  const googleCampaigns = campaignRows.filter((c) => c.network === "Google Ads" && c.paidClick);
  const rawIdSessions = googleCampaigns.filter((c) => c.isRawId).reduce((a, c) => a + c.sessions, 0);
  const googleSessionsTotal = googleCampaigns.reduce((a, c) => a + c.sessions, 0);
  if (googleSessionsTotal > 0) {
    const share = rawIdSessions / googleSessionsTotal;
    health.push({
      id: "campaign-names",
      level: share >= 0.5 ? "warn" : "ok",
      title:
        share >= 0.5
          ? `${pctText(share)} من زيارات جوجل أسماء حملاتها أرقام خام`
          : "أسماء حملات جوجل مقروءة",
      detail:
        share >= 0.5
          ? "اللوحة ترى رقم الحملة (gad_campaignid) لا اسمها، فيصعب معرفة أي حملة تعمل."
          : "أغلب الزيارات مرتبطة بأسماء حملات واضحة.",
      action:
        share >= 0.5
          ? "إمّا سمِّ كل رقم من «أسماء الحملات» أسفل الصفحة، أو اضبط قالب التتبّع في جوجل (انظر التوصيات)."
          : undefined,
    });
  }

  // 3) وسوم ضائعة أو تجريبية
  let lostClickId = 0;
  let testTagged = 0;
  for (const s of sessions) {
    if (!s.adClick) continue;
    const p = firstAdParams(s);
    if (!p) continue;
    const medium = p.get("utm_medium")?.trim() ?? "";
    const source = p.get("utm_source")?.trim() ?? "";
    if (TEST_MEDIUM_RE.test(medium)) testTagged++;
    if (!s.adClick.paid && AD_PLATFORM_SOURCE_RE.test(source)) lostClickId++;
  }
  if (testTagged > 0) {
    health.push({
      id: "test-medium",
      level: "bad",
      title: `${testTagged} زيارة بوسم utm_medium=test`,
      detail:
        "قالب التتبّع في الحساب الإعلاني يحمل medium تجريبياً (test). يلوّث تقارير GA4 ويصعّب فصل المدفوع عن غيره.",
      action: "غيّره في قالب التتبّع إلى utm_medium=cpc.",
    });
  }
  if (lostClickId > 0) {
    health.push({
      id: "lost-click-id",
      level: "warn",
      title: `${lostClickId} زيارة من منصة إعلانية فقدت معرّف النقرة`,
      detail:
        "الرابط يحمل utm_source لمنصة إعلانية لكن بلا gclid/fbclid، فتُصنَّف «UTM فقط» ولا تُحسب مدفوعة. غالباً أُعيد التوجيه أو قُصّ الرابط (iOS/تطبيقات داخلية).",
      action: "فعّل Auto-tagging في جوجل وتأكد أن الصفحة المقصودة لا تعيد التوجيه وتقصّ الـ query.",
    });
  }

  // 4) هبوط مفاجئ في الزيارات الإعلانية
  const fullDays = daily.adSessions.slice(0, -1);
  if (fullDays.length >= 10) {
    const last3 = fullDays.slice(-3);
    const prior = fullDays.slice(0, -3);
    const priorAvg = prior.reduce((a, d) => a + d.count, 0) / prior.length;
    const lastAvg = last3.reduce((a, d) => a + d.count, 0) / last3.length;
    if (priorAvg >= 3 && lastAvg < priorAvg * 0.4) {
      health.push({
        id: "traffic-drop",
        level: "bad",
        title: `الزيارات الإعلانية هبطت من ~${priorAvg.toFixed(0)} إلى ~${lastAvg.toFixed(1)} يومياً`,
        detail: `متوسط آخر ٣ أيام مكتملة مقابل متوسط ما قبلها. إمّا توقفت الحملات/نفدت الميزانية/رُفضت الإعلانات، أو انكسر قالب التتبّع فلم تعد الروابط تحمل المعرّف.`,
        action: "افتح حساب جوجل وقارن النقرات بنفس الأيام؛ إن كانت النقرات سليمة فالعطل في التتبّع.",
      });
    }
  }

  // 5) نسبة ما التقطه الموقع من نقرات المنصة
  if (spend.reportedClicks && spend.reportedClicks >= 20) {
    const cap = googleAds.sessions / spend.reportedClicks;
    health.push({
      id: "click-capture-rate",
      level: cap >= 0.7 && cap <= 1.3 ? "ok" : "warn",
      title: `الموقع التقط ${pctText(cap)} من النقرات التي أبلغت عنها المنصة`,
      detail: `${googleAds.sessions} جلسة إعلانية مقابل ~${Math.round(spend.reportedClicks)} نقرة. المعتاد ٧٠–١٠٠٪؛ ما دونه يعني صفحة بطيئة يغادرها الزائر قبل التتبّع أو حاجب إعلانات.`,
      action: cap < 0.7 ? "افحص سرعة صفحة الهبوط على الجوال." : undefined,
    });
  } else {
    health.push({
      id: "click-capture-rate",
      level: "info",
      title: "لا يمكن قياس فقد التتبّع بدون نقرات المنصة",
      detail:
        "أدخل «النقرات» من تقرير جوجل مع الإنفاق ليُقارنها بما التقطه الموقع، فتعرف كم نقرة تضيع قبل أن تُسجَّل.",
    });
  }

  // 6) دمج زوار مختلفين في جلسة واحدة
  let merged = 0;
  for (const s of sessions) {
    const ids = new Set<string>();
    for (const e of s.events) {
      const p = new URLSearchParams(pathQuery(e.path));
      const v = p.get("gclid") || p.get("gbraid") || p.get("wbraid");
      if (v) ids.add(v);
    }
    if (ids.size > 1) merged++;
  }
  health.push({
    id: "session-merge",
    level: sessions.length && merged / sessions.length > 0.03 ? "warn" : "ok",
    title:
      merged > 0
        ? `${merged} جلسة دمجت أكثر من زائر (بنفس IP والجهاز)`
        : "لا دمج بين زوار مختلفين في جلسة واحدة",
    detail:
      "الجلسات تُبنى من IP + نوع الجهاز لعدم وجود كوكي زائر. شبكات الجوال تشارك IP بين كثيرين، فقد يُنسب حجز لإعلان غيره. يظهر الأثر عند ارتفاع الحجم.",
    action: merged > 0 && sessions.length && merged / sessions.length > 0.03
      ? "أضف كوكي معرّف زائر للتتبّع لإنهاء هذه المشكلة."
      : undefined,
  });

  // 7) الحجوزات التي لا ارتباط لها بأي زيارة
  const unlinked = bookings.filter((b) => !sessionsByBooking.has(b.id) && !hasClickId(b)).length;
  if (bookings.length >= 5) {
    health.push({
      id: "unlinked-bookings",
      level: unlinked / bookings.length > 0.35 ? "warn" : "ok",
      title: `${unlinked} من ${bookings.length} حجزاً بلا زيارة مسجّلة`,
      detail:
        "تشمل حجوزات المكتب/الهاتف والزوار الذين لم يلتقط التتبّع جلستهم. تُحسب «غير إعلانية» في اللوحة، فارتفاعها يعني أن مساهمة الإعلانات الحقيقية أعلى مما يظهر.",
    });
  }

  // 8) الإنفاق
  if (spend.entries === 0) {
    health.push({
      id: "spend-missing",
      level: "info",
      title: "لم يُدخَل إنفاق إعلاني",
      detail: "بدونه لا تُحسب تكلفة الحجز الفعّال ولا تكلفة النقرة.",
      action: "أدخل إنفاق كل حملة من «إدخال الإنفاق» أسفل الصفحة.",
    });
  }

  if (botSessions > 0 && sessions.length + botSessions > 0) {
    health.push({
      id: "bots",
      level: "info",
      title: `استُبعدت ${botSessions} جلسة يُشتبه أنها بوتات`,
      detail: "انتقالات فورية بين الصفحات خلال ثوانٍ — لا تدخل في أي رقم في هذه اللوحة.",
    });
  }

  // ── التوصيات ─────────────────────────────────────────────────────────────────
  const insights: string[] = [];

  if (paid.reachedCheckout >= 15) {
    const submitRate = ratio(paid.submitted, paid.reachedCheckout);
    if (submitRate != null && submitRate < 0.2) {
      insights.push(
        `من ${paid.reachedCheckout} زائر إعلاني فتح صفحة الحجز أرسل النموذج ${paid.submitted} فقط (${pctText(submitRate)}). الخسارة الكبرى بعد النقرة لا قبلها — رفع الميزانية لن يعالجها، راجع نموذج الحجز (قسم أسباب الانسحاب في سجل النشاط).`,
      );
    }
  }
  if (paid.bookings >= 5) {
    const deadRate = paid.dead / paid.bookings;
    const organicDead = ratio(organic.dead, organic.bookings);
    if (deadRate >= 0.5) {
      insights.push(
        `${pctText(deadRate)} من الحجوزات الإعلانية انتهت مرفوضة أو ملغاة${
          organicDead != null ? ` (مقابل ${pctText(organicDead)} لغير الإعلانية)` : ""
        }. اجمع أسباب الرفض: إن كانت «لا تنطبق الشروط» فالاستهداف أوسع من الشريحة المؤهلة.`,
      );
    }
  }
  const iphoneShare = ratio(deviceMap.get("iPhone")?.sessions ?? 0, paid.sessions);
  if (iphoneShare != null && iphoneShare >= 0.5 && paid.sessions >= 30) {
    insights.push(
      `${pctText(iphoneShare)} من الزيارات الإعلانية من iPhone، حيث يخفي iOS معرّف gclid غالباً (يستبدله gbraid/wbraid). تأكد من تفعيل Enhanced Conversions وأن رفع التحويلات يقبل gbraid/wbraid.`,
    );
  }
  const wasted = googleCampaigns.filter((c) => c.sessions >= 25 && c.reachedCheckout === 0);
  if (wasted.length) {
    insights.push(
      `حملات جلبت ٢٥ زيارة فأكثر ولم يفتح أحد منها صفحة الحجز: ${wasted
        .map((c) => `«${c.displayName}»`)
        .join("، ")}. مرشّحة للإيقاف أو لمراجعة الكلمات.`,
    );
  }
  const best = campaignRows.find((c) => c.active > 0);
  if (best) {
    insights.push(
      `أفضل حملة بالحجوزات الفعّالة: «${best.displayName}» (${best.active} حجز فعّال من ${best.sessions} زيارة${
        best.cpaSar != null ? ` بتكلفة ${Math.round(best.cpaSar)} ر.س للحجز` : ""
      }).`,
    );
  }
  if (paid.active >= 3 && paid.paid / paid.active < 0.5) {
    insights.push(
      `${pctText(ratio(paid.paid, paid.active))} فقط من الحجوزات الإعلانية الفعّالة مؤكَّد دفعها؛ الباقي يُدفع عند الفرع. لذلك يُقاس العائد بالحجز الفعّال، ولا يصح الحكم على الحملة بالإيراد الإلكتروني وحده.`,
    );
  }
  if (googleCampaigns.some((c) => c.isRawId)) {
    insights.push(
      "اضبط قالب التتبّع في جوجل ليحمل اسم الحملة والكلمة: ‎{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}&utm_content={creative}‎ — وغيّر medium من test إلى cpc إن كان قديماً.",
    );
  }

  const devices = [...deviceMap.entries()]
    .map(([device, v]) => ({ device, ...v }))
    .sort((a, b) => b.sessions - a.sessions);
  const landingPages = [...landing.entries()]
    .map(([path, v]) => ({ path, ...v }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 8);

  return {
    days,
    startYmd,
    endYmd,
    generatedAt: now,
    truncated,
    paid,
    googleAds,
    utmOnly,
    organic,
    campaigns: campaignRows,
    daily,
    devices,
    landingPages,
    leads,
    spend,
    medianAdSessionMs: median(adSessionDurations),
    health,
    insights,
    settings,
  };
}
