import "server-only";
import { prisma } from "@/lib/prisma";
import { pageLabel, pathTemplate, stripQuery } from "@/lib/insights/insights-paths";
import { riyadhMoment } from "@/lib/insights/insights-time";
import {
  DEVICE_KIND_LABELS,
  browserOf,
  describeDevice,
  deviceKindOf,
  isBotUa,
  osOf,
} from "@/lib/insights/insights-ua";
import type {
  BreakdownRow,
  EmployeeUsage,
  EmployeeUsageRow,
  ExitPageRow,
  InsightsRange,
  PageUsageRow,
  PeakHours,
  VisitorInsights,
} from "@/lib/insights/insights-types";
import { DEFAULT_INSIGHTS_RANGE, INSIGHTS_RANGES } from "@/lib/insights/insights-types";

/**
 * سقف الصفوف المحمَّلة. التحليل (الجلسات، صفحات الخروج) يحتاج الصفوف الخام في
 * الذاكرة — لا يمكن عمله بـ groupBy. السقف يمنع أن تنهار الصفحة بعد سنة من النمو،
 * والعلم `truncated` يخبر مدير النظام أن الأرقام لفترة أقصر مما اختار.
 */
const ROW_CAP = 60_000;

/** فاصل الخمول الذي يُنهي الجلسة — نصف ساعة، العُرف في تحليلات الويب. */
const SESSION_IDLE_MS = 30 * 60 * 1000;

/**
 * جلسة ما زالت مفتوحة (آخر حدث فيها أحدث من هذا) لا تُحتسب في صفحات الخروج:
 * الصفحة المفتوحة الآن ليست «صفحة انسحب عندها الزائر»، وبدون هذا الاستثناء تتصدّر
 * أكثرُ الصفحات نشاطاً قائمةَ الخروج دائماً.
 */
const OPEN_SESSION_GRACE_MS = SESSION_IDLE_MS;

const TOP_PAGES_LIMIT = 12;
const EXIT_PAGES_LIMIT = 12;
const EMPLOYEES_LIMIT = 25;

/** أنواع الأحداث التي تُعدّ «مشاهدة صفحة» في سجل الموقع العام. */
const PUBLIC_VIEW_KINDS = ["PAGE_VIEW", "CAR_VIEW"];

export function parseInsightsRange(raw: string | undefined): InsightsRange {
  const n = Number(raw);
  return (INSIGHTS_RANGES as readonly number[]).includes(n)
    ? (n as InsightsRange)
    : DEFAULT_INSIGHTS_RANGE;
}

function since(days: InsightsRange): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function bump(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function toBreakdown(counts: Map<string, number>, total: number, limit?: number): BreakdownRow[] {
  const rows = [...counts.entries()]
    .map(([label, count]) => ({ label, count, share: total > 0 ? count / total : 0 }))
    .sort((a, b) => b.count - a.count);
  return limit ? rows.slice(0, limit) : rows;
}

/** صف موحَّد يغذّي حساب الجلسات، مهما كان مصدره. */
type ViewRow = {
  /** مفتاح تمييز الفاعل: الموظف، أو (IP + متصفح) للزائر المجهول */
  actorKey: string;
  path: string;
  createdAt: Date;
};

type Session = {
  actorKey: string;
  /** قوالب الصفحات بالترتيب الزمني */
  templates: string[];
  lastAt: Date;
};

/**
 * تقسيم الصفوف إلى جلسات لكل فاعل: أحداثه مرتّبة زمنياً، وأي فجوة أطول من فاصل
 * الخمول تبدأ جلسة جديدة. بدون هذا لا يمكن معرفة «أين توقّفت الزيارة».
 */
function buildSessions(rows: ViewRow[]): Session[] {
  const byActor = new Map<string, ViewRow[]>();
  for (const row of rows) {
    const list = byActor.get(row.actorKey);
    if (list) list.push(row);
    else byActor.set(row.actorKey, [row]);
  }

  const sessions: Session[] = [];
  for (const [actorKey, actorRows] of byActor) {
    actorRows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    let current: Session | null = null;
    let previousAt = 0;

    for (const row of actorRows) {
      const at = row.createdAt.getTime();
      if (!current || at - previousAt > SESSION_IDLE_MS) {
        current = { actorKey, templates: [], lastAt: row.createdAt };
        sessions.push(current);
      }
      const template = pathTemplate(row.path);
      // تحديث متتالٍ لنفس الصفحة (تغيير فلتر، إعادة تحميل) ليس انتقالاً جديداً —
      // احتسابه يضخّم «صفحات لكل جلسة» ويحجب أن الزائر لم يبرح مكانه.
      if (current.templates[current.templates.length - 1] !== template) {
        current.templates.push(template);
      }
      current.lastAt = row.createdAt;
      previousAt = at;
    }
  }

  return sessions;
}

/* ------------------------------------------------------------------ *
 *  القسم الإداري الوحيد: الموظفون الأكثر فتحاً للنظام
 * ------------------------------------------------------------------ */

export async function getEmployeeUsage(days: InsightsRange): Promise<EmployeeUsage> {
  const raw = await prisma.adminPageView.findMany({
    where: { createdAt: { gte: since(days) } },
    orderBy: { createdAt: "desc" },
    take: ROW_CAP,
    select: {
      employeeId: true,
      employeeLabel: true,
      isSuperAdmin: true,
      path: true,
      ip: true,
      userAgent: true,
      createdAt: true,
    },
  });

  type Acc = {
    employeeId: number | null;
    label: string;
    isSuperAdmin: boolean;
    views: number;
    days: Set<string>;
    pages: Map<string, number>;
    devices: Map<string, number>;
    lastSeenAt: Date;
  };

  const byActor = new Map<string, Acc>();
  const viewRows: ViewRow[] = [];

  for (const r of raw) {
    // موظف بلا معرّف (جلسة قديمة) لا يُدمج مع غيره — يُميَّز بجهازه بدل ذلك.
    const actorKey =
      r.employeeId != null ? `e:${r.employeeId}` : `a:${r.ip ?? "?"}|${r.userAgent ?? "?"}`;
    viewRows.push({ actorKey, path: r.path, createdAt: r.createdAt });

    let acc = byActor.get(actorKey);
    if (!acc) {
      acc = {
        employeeId: r.employeeId,
        label: r.employeeLabel?.trim() || "موظف غير معروف",
        isSuperAdmin: r.isSuperAdmin,
        views: 0,
        days: new Set(),
        pages: new Map(),
        devices: new Map(),
        lastSeenAt: r.createdAt,
      };
      byActor.set(actorKey, acc);
    }
    acc.views += 1;
    acc.days.add(riyadhMoment(r.createdAt).day);
    bump(acc.pages, pathTemplate(r.path));
    const device = describeDevice(r.userAgent);
    if (device) bump(acc.devices, device);
    if (r.createdAt > acc.lastSeenAt) {
      acc.lastSeenAt = r.createdAt;
      // الاسم الأحدث هو الصحيح لو غُيّر اسم الموظف خلال الفترة.
      if (r.employeeLabel?.trim()) acc.label = r.employeeLabel.trim();
    }
  }

  const sessionsByActor = new Map<string, number>();
  for (const s of buildSessions(viewRows)) bump(sessionsByActor, s.actorKey);

  const rows: EmployeeUsageRow[] = [...byActor.entries()]
    .map(([actorKey, acc]) => {
      const topPage = [...acc.pages.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        employeeId: acc.employeeId,
        label: acc.label,
        isSuperAdmin: acc.isSuperAdmin,
        views: acc.views,
        sessions: sessionsByActor.get(actorKey) ?? 0,
        activeDays: acc.days.size,
        distinctPages: acc.pages.size,
        lastSeenAt: acc.lastSeenAt,
        topPageLabel: topPage ? (pageLabel(topPage[0], "admin") ?? topPage[0]) : "—",
        topPageViews: topPage?.[1] ?? 0,
        devices: [...acc.devices.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d),
      };
    })
    .sort((a, b) => b.views - a.views);

  return {
    rows: rows.slice(0, EMPLOYEES_LIMIT),
    totalViews: raw.length,
    activeEmployees: rows.length,
  };
}

/* ------------------------------------------------------------------ *
 *  جسم الصفحة: إحصاءات زوّار الموقع العام (العملاء)
 * ------------------------------------------------------------------ */

type VisitorRow = ViewRow & { userAgent: string | null };

function computePeak(rows: VisitorRow[]): PeakHours {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const byHour = new Array<number>(24).fill(0);

  for (const row of rows) {
    const { hour, weekday } = riyadhMoment(row.createdAt);
    grid[weekday]![hour]! += 1;
    byHour[hour]! += 1;
  }

  let maxCell = 0;
  let peakWeekday: number | null = null;
  let peakWeekdayHour: number | null = null;
  for (let d = 0; d < 7; d += 1) {
    for (let h = 0; h < 24; h += 1) {
      if (grid[d]![h]! > maxCell) {
        maxCell = grid[d]![h]!;
        peakWeekday = d;
        peakWeekdayHour = h;
      }
    }
  }

  let peakHour: number | null = null;
  let peakHourCount = 0;
  let quietHour: number | null = null;
  let quietCount = Number.POSITIVE_INFINITY;
  for (let h = 0; h < 24; h += 1) {
    const count = byHour[h]!;
    if (count > peakHourCount) {
      peakHourCount = count;
      peakHour = h;
    }
    // «أهدأ ساعة» تعني أهدأ ساعة **بها حركة**؛ ساعة بصفر زيارات قد تعني غياب
    // قياس لا هدوءاً، ولا تصلح لجدولة صيانة بناءً عليها.
    if (count > 0 && count < quietCount) {
      quietCount = count;
      quietHour = h;
    }
  }

  return {
    grid,
    byHour,
    maxCell,
    peakHour,
    peakHourCount,
    peakWeekday,
    peakWeekdayHour,
    peakCellCount: maxCell,
    quietHour,
  };
}

function computeTopPages(rows: VisitorRow[], total: number): PageUsageRow[] {
  const views = new Map<string, number>();
  const visitors = new Map<string, Set<string>>();
  const samples = new Map<string, string>();

  for (const row of rows) {
    const template = pathTemplate(row.path);
    bump(views, template);
    const set = visitors.get(template);
    if (set) set.add(row.actorKey);
    else visitors.set(template, new Set([row.actorKey]));
    // أحدث مسار حقيقي شوهد — الصفوف مرتّبة تنازلياً زمنياً، فأول ما نراه هو الأحدث.
    if (!samples.has(template)) samples.set(template, stripQuery(row.path));
  }

  return [...views.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_PAGES_LIMIT)
    .map(([template, count]) => ({
      template,
      label: pageLabel(template, "public") ?? template,
      sampleUrl: samples.get(template) ?? template,
      views: count,
      visitors: visitors.get(template)?.size ?? 0,
      share: total > 0 ? count / total : 0,
    }));
}

function computeExitPages(rows: VisitorRow[], sessions: Session[], now: Date): ExitPageRow[] {
  const viewsByTemplate = new Map<string, number>();
  const samples = new Map<string, string>();
  for (const row of rows) {
    const template = pathTemplate(row.path);
    bump(viewsByTemplate, template);
    if (!samples.has(template)) samples.set(template, stripQuery(row.path));
  }

  const exits = new Map<string, number>();
  const bounces = new Map<string, number>();
  const cutoff = now.getTime() - OPEN_SESSION_GRACE_MS;

  for (const session of sessions) {
    if (session.lastAt.getTime() > cutoff) continue; // جلسة قد تكون ما زالت جارية
    const last = session.templates[session.templates.length - 1];
    if (!last) continue;
    bump(exits, last);
    if (session.templates.length === 1) bump(bounces, last);
  }

  return [...exits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, EXIT_PAGES_LIMIT)
    .map(([template, exitCount]) => {
      const views = viewsByTemplate.get(template) ?? 0;
      return {
        template,
        label: pageLabel(template, "public") ?? template,
        sampleUrl: samples.get(template) ?? template,
        exits: exitCount,
        views,
        exitRate: views > 0 ? Math.min(exitCount / views, 1) : 0,
        bounces: bounces.get(template) ?? 0,
      };
    });
}

export async function getVisitorInsights(days: InsightsRange): Promise<VisitorInsights> {
  const now = new Date();
  const raw = await prisma.activityLog.findMany({
    where: { createdAt: { gte: since(days) }, kind: { in: PUBLIC_VIEW_KINDS }, path: { not: null } },
    orderBy: { createdAt: "desc" },
    take: ROW_CAP + 1,
    select: { path: true, ip: true, userAgent: true, userId: true, createdAt: true },
  });

  const truncated = raw.length > ROW_CAP;
  const rows: VisitorRow[] = [];
  for (const r of truncated ? raw.slice(0, ROW_CAP) : raw) {
    // البوتات تشوّه كل شيء هنا: أعدادها ضخمة، وأجهزتها ليست أجهزة عملاء، وهي لا
    // «تنسحب» من صفحة فتفسد قائمة صفحات الخروج تحديداً.
    if (isBotUa(r.userAgent)) continue;
    if (!r.path) continue;
    rows.push({
      actorKey: r.userId != null ? `u:${r.userId}` : `v:${r.ip ?? "?"}|${r.userAgent ?? "?"}`,
      path: r.path,
      userAgent: r.userAgent,
      createdAt: r.createdAt,
    });
  }

  const sessions = buildSessions(rows);
  const totalViews = rows.length;

  const deviceCounts = new Map<string, number>();
  const osCounts = new Map<string, number>();
  const browserCounts = new Map<string, number>();
  for (const row of rows) {
    bump(deviceCounts, DEVICE_KIND_LABELS[deviceKindOf(row.userAgent)]);
    bump(osCounts, osOf(row.userAgent));
    bump(browserCounts, browserOf(row.userAgent));
  }

  return {
    isEmpty: totalViews === 0,
    truncated,
    totalViews,
    totalSessions: sessions.length,
    uniqueVisitors: new Set(rows.map((r) => r.actorKey)).size,
    pagesPerSession:
      sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.templates.length, 0) / sessions.length
        : 0,
    devices: toBreakdown(deviceCounts, totalViews),
    operatingSystems: toBreakdown(osCounts, totalViews, 6),
    browsers: toBreakdown(browserCounts, totalViews, 6),
    peak: computePeak(rows),
    topPages: computeTopPages(rows, totalViews),
    exitPages: computeExitPages(rows, sessions, now),
  };
}
