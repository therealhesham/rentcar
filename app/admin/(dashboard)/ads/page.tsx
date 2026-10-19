import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminBarChart } from "@/components/admin/stats/AdminBarChart";
import { AdminPeriodSelect } from "@/components/admin/stats/AdminPeriodSelect";
import { requireAdminPage } from "@/lib/admin-page";
import { parseAdminStatsPeriod } from "@/lib/admin-statistics";
import {
  loadAdsReport,
  type CampaignRow,
  type ChannelStats,
  type HealthCheck,
  type HealthLevel,
} from "@/lib/ads-performance";
import { AdsSettingsPanel } from "./AdsSettingsPanel";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ days?: string }> };

const num = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
const sar = (v: number) => `${v.toLocaleString("en-US", { maximumFractionDigits: 0 })} ر.س`;
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} ث`;
  return `${Math.floor(s / 60)} د ${s % 60} ث`;
}

const LEVEL_STYLE: Record<HealthLevel, { box: string; dot: string; label: string }> = {
  ok: { box: "border-emerald-200 bg-emerald-50/60", dot: "bg-emerald-500", label: "سليم" },
  warn: { box: "border-amber-200 bg-amber-50/70", dot: "bg-amber-500", label: "يحتاج انتباهاً" },
  bad: { box: "border-rose-200 bg-rose-50/70", dot: "bg-rose-500", label: "مشكلة" },
  info: { box: "border-outline-variant/30 bg-surface-container-low/60", dot: "bg-sky-500", label: "ملاحظة" },
};

const LEVEL_ORDER: Record<HealthLevel, number> = { bad: 0, warn: 1, info: 2, ok: 3 };

function HealthItem({ check }: { check: HealthCheck }) {
  const style = LEVEL_STYLE[check.level];
  return (
    <li className={`rounded-xl border p-4 ${style.box}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${style.dot}`} aria-label={style.label} />
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-on-surface">{check.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-on-surface-variant">{check.detail}</p>
          {check.action ? (
            <p className="mt-2 text-[13px] font-bold leading-relaxed text-on-surface">← {check.action}</p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function Th({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <th className="whitespace-nowrap px-3 py-3 text-start" title={hint}>
      {children}
    </th>
  );
}

function FunnelCell({ count, base, strong }: { count: number; base: number; strong?: boolean }) {
  return (
    <td className="px-4 py-3">
      <span className={`tabular-nums ${strong ? "font-extrabold text-on-surface" : "font-bold"}`}>{num(count)}</span>
      <span className="ms-2 text-xs font-medium tabular-nums text-on-surface-variant">{pct(count, base)}</span>
    </td>
  );
}

const FUNNEL_ROWS: Array<{ label: string; pick: (s: ChannelStats) => number; strong?: boolean }> = [
  { label: "زيارات (جلسات)", pick: (s) => s.sessions },
  { label: "تصفّح الأسطول", pick: (s) => s.reachedFleet },
  { label: "ضغط «احجز الآن»", pick: (s) => s.reachedBookNow },
  { label: "فتح صفحة الحجز", pick: (s) => s.reachedCheckout, strong: true },
  { label: "أرسل نموذج الحجز", pick: (s) => s.submitted },
  { label: "حجوزات أُنشئت", pick: (s) => s.bookings },
  { label: "حجوزات فعّالة", pick: (s) => s.active, strong: true },
  { label: "استلم السيارة فعلاً", pick: (s) => s.delivered },
  { label: "مؤكَّد دفعها", pick: (s) => s.paid },
];

function campaignBadge(c: CampaignRow) {
  if (!c.paidClick) {
    return (
      <span
        className="ms-2 rounded-full border border-outline-variant/40 px-2 py-0.5 text-[10px] font-bold text-on-surface-variant"
        title="وسم UTM بلا معرّف نقرة — قد لا يكون إعلاناً مدفوعاً"
      >
        UTM فقط
      </span>
    );
  }
  if (c.isRawId) {
    return (
      <span
        className="ms-2 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800"
        title="رقم حملة خام — سمِّه من «أسماء الحملات»"
      >
        بلا اسم
      </span>
    );
  }
  return null;
}

export default async function AdminAdsPerformancePage({ searchParams }: Props) {
  await requireAdminPage();
  const sp = await searchParams;
  const days = parseAdminStatsPeriod(sp.days);
  const r = await loadAdsReport(days);

  const { paid, googleAds, organic, utmOnly, spend } = r;
  const health = [...r.health].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  const problems = health.filter((h) => h.level === "bad" || h.level === "warn").length;
  const noAdTraffic = paid.sessions === 0 && paid.bookings === 0;
  const campaignKeys = [...new Set(r.campaigns.filter((c) => c.paidClick).map((c) => c.campaign))];

  return (
    <>
      <AdminPageHeader
        title="الأداء الإعلاني"
        description={
          <>
            كم أنفقنا، كم زائراً جاء، وكم حجزاً <span className="font-bold text-on-surface">فعّالاً</span> خرجنا به.
            الحجز الفعّال = غير مرفوض وغير ملغى — لأن أغلب العملاء يدفعون في الفرع، فلا يصح قياس الحملة بالدفع الإلكتروني وحده.
          </>
        }
        backHref="/admin"
        actions={
          <Suspense fallback={<div className="h-10 w-48 animate-pulse rounded-xl bg-surface-container-high" />}>
            <AdminPeriodSelect current={days} />
          </Suspense>
        }
      />

      <p className="mb-6 text-xs font-medium text-on-surface-variant">
        الفترة: <span dir="ltr">{r.startYmd} → {r.endYmd}</span> (بتوقيت الرياض) · تُستبعد زياراتك وفريقك والبوتات
        {r.truncated ? (
          <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">
            السجل كبير: اقتُطعت أقدم الزيارات — اختر فترة أقصر لدقة أعلى
          </span>
        ) : null}
      </p>

      {noAdTraffic ? (
        <AdminCard>
          <p className="py-6 text-center text-sm font-medium text-on-surface-variant">
            لا زيارات إعلانية في هذه الفترة. الزيارة تُعدّ إعلانية إذا حمل رابطها{" "}
            <span className="font-mono text-xs" dir="ltr">gclid / gbraid / wbraid / fbclid / ttclid</span> أو{" "}
            <span className="font-mono text-xs" dir="ltr">utm_medium=cpc</span>.
          </p>
        </AdminCard>
      ) : (
        <>
          {/* ── المؤشرات الرئيسية ─────────────────────────────────────────── */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <AdminStatCard
              label="زيارات إعلانية"
              value={num(paid.sessions)}
              hint={`ارتداد ${pct(paid.bounced, paid.sessions)} · متوسط ${formatDuration(r.medianAdSessionMs)}`}
            />
            <AdminStatCard
              label="فتحوا صفحة الحجز"
              value={num(paid.reachedCheckout)}
              hint={`${pct(paid.reachedCheckout, paid.sessions)} من الزيارات`}
            />
            <AdminStatCard
              label="أرسلوا النموذج"
              value={num(paid.submitted)}
              hint={`${pct(paid.submitted, paid.reachedCheckout)} ممن فتحوا الصفحة`}
              highlight={paid.reachedCheckout >= 15 && paid.submitted / paid.reachedCheckout < 0.2}
            />
            <AdminStatCard
              label="حجوزات فعّالة"
              value={num(paid.active)}
              hint={`من ${num(paid.bookings)} حجز · ${num(paid.dead)} مرفوض/ملغى`}
            />
            <AdminStatCard
              label="قيمة الحجوزات الفعّالة"
              value={sar(paid.pipelineSar)}
              hint={`مؤكَّد دفعه ${sar(paid.collectedSar)}`}
            />
            <AdminStatCard
              label="تكلفة الحجز الفعّال"
              value={spend.cpaSar != null ? sar(spend.cpaSar) : "—"}
              hint={spend.totalSar > 0 ? `إنفاق ${sar(spend.totalSar)}` : "أدخل الإنفاق أسفل الصفحة"}
            />
          </div>

          {/* ── سلامة القياس ──────────────────────────────────────────────── */}
          <AdminCard
            title="سلامة القياس"
            description={
              problems > 0
                ? `${problems} بند يحتاج مراجعة قبل الاعتماد على الأرقام.`
                : "لا مشاكل ظاهرة في القياس."
            }
            className="mb-6"
          >
            <ul className="grid gap-3 lg:grid-cols-2">
              {health.map((h) => (
                <HealthItem key={h.id} check={h} />
              ))}
            </ul>
          </AdminCard>

          {/* ── مقارنة القمع ──────────────────────────────────────────────── */}
          <AdminCard
            title="رحلة الزائر: إعلانات مقابل غيرها"
            description="النسبة بجانب كل رقم من إجمالي زيارات نفس العمود. المقارنة تكشف هل المشكلة في الإعلان أم في الموقع نفسه."
            className="mb-6"
            noPadding
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-start text-sm">
                <thead>
                  <tr className="bg-surface-container text-xs font-extrabold text-on-surface-variant">
                    <th className="px-4 py-3 text-start">المرحلة</th>
                    <th className="px-4 py-3 text-start">كل الإعلانات المدفوعة</th>
                    <th className="px-4 py-3 text-start">منها: Google Ads</th>
                    <th className="px-4 py-3 text-start">غير إعلاني</th>
                  </tr>
                </thead>
                <tbody>
                  {FUNNEL_ROWS.map((row, i) => (
                    <tr
                      key={row.label}
                      className={`border-t border-outline-variant/15 ${i % 2 === 1 ? "bg-surface-container/30" : ""}`}
                    >
                      <td className={`px-4 py-3 ${row.strong ? "font-extrabold" : "font-medium text-on-surface-variant"}`}>
                        {row.label}
                      </td>
                      <FunnelCell count={row.pick(paid)} base={paid.sessions} strong={row.strong} />
                      <FunnelCell count={row.pick(googleAds)} base={googleAds.sessions} strong={row.strong} />
                      <FunnelCell count={row.pick(organic)} base={organic.sessions} strong={row.strong} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-outline-variant/15 px-4 py-3 text-xs leading-relaxed text-on-surface-variant">
              عمود «غير إعلاني» يضم المباشر والبحث العضوي وأي زيارة فقدت معرّفها
              {utmOnly.sessions > 0 ? `، إضافة إلى ${num(utmOnly.sessions)} زيارة موسومة UTM بلا معرّف نقرة (تُعرض في الجدول أدناه)` : ""}،
              وحجوزات المكتب/الهاتف. لذلك قد تتجاوز نسبة حجوزاته نسبة زياراته.
            </p>
          </AdminCard>

          {/* ── الحملات ───────────────────────────────────────────────────── */}
          <AdminCard
            title="الحملات"
            description="مرتبة بالحجوزات الفعّالة ثم الوصول لصفحة الحجز. الحجز يُنسب بمعرّف النقرة المحفوظ عليه إن وُجد، وإلا بالجلسة."
            className="mb-6"
            noPadding
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-start text-sm">
                <thead>
                  <tr className="bg-surface-container text-xs font-extrabold text-on-surface-variant">
                    <Th>الحملة</Th>
                    <Th>الشبكة</Th>
                    <Th>زيارات</Th>
                    <Th hint="زيارة بصفحة واحدة وبلا أي تفاعل">ارتداد</Th>
                    <Th>صفحة الحجز</Th>
                    <Th>أرسل</Th>
                    <Th>حجوزات</Th>
                    <Th hint="غير مرفوض وغير ملغى">فعّالة</Th>
                    <Th hint="تم استلام السيارة">استلام</Th>
                    <Th>الإنفاق</Th>
                    <Th hint="الإنفاق ÷ الحجوزات الفعّالة">تكلفة الحجز</Th>
                  </tr>
                </thead>
                <tbody>
                  {r.campaigns.map((c, i) => (
                    <tr
                      key={c.key}
                      className={`border-t border-outline-variant/15 ${i % 2 === 1 ? "bg-surface-container/30" : ""} ${
                        c.active > 0 ? "bg-emerald-50/60" : ""
                      }`}
                    >
                      <td className="px-3 py-3 font-bold">
                        {c.displayName}
                        {campaignBadge(c)}
                        {c.displayName !== c.campaign ? (
                          <span className="ms-2 font-mono text-[10px] font-medium text-on-surface-variant" dir="ltr">
                            {c.campaign}
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-on-surface-variant">{c.network}</td>
                      <td className="px-3 py-3 tabular-nums">{num(c.sessions)}</td>
                      <td className="px-3 py-3 tabular-nums text-on-surface-variant">{pct(c.bounced, c.sessions)}</td>
                      <td className="px-3 py-3 tabular-nums">{num(c.reachedCheckout)}</td>
                      <td className="px-3 py-3 tabular-nums">{num(c.submitted)}</td>
                      <td className="px-3 py-3 tabular-nums">{num(c.bookings)}</td>
                      <td className="px-3 py-3 font-extrabold tabular-nums text-emerald-700">{num(c.active)}</td>
                      <td className="px-3 py-3 tabular-nums">{num(c.delivered)}</td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums">{c.spendSar > 0 ? sar(c.spendSar) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-bold tabular-nums">
                        {c.cpaSar != null ? sar(c.cpaSar) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminCard>

          {/* ── الاتجاهات ─────────────────────────────────────────────────── */}
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <AdminCard title="الزيارات الإعلانية اليومية" description="جلسات مدفوعة يقيناً (معرّف نقرة أو medium مدفوع)">
              <AdminBarChart data={r.daily.adSessions} height={200} accent="#003749" />
            </AdminCard>
            <AdminCard title="الحجوزات الفعّالة الإعلانية اليومية" description="حسب يوم إنشاء الحجز">
              <AdminBarChart data={r.daily.adActiveBookings} height={200} accent="#775927" />
            </AdminCard>
          </div>

          {/* ── الأجهزة وصفحات الهبوط ─────────────────────────────────────── */}
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <AdminCard title="الأجهزة" description="زيارات إعلانية مدفوعة حسب الجهاز">
              <ul className="space-y-2.5 text-sm">
                {r.devices.map((d) => (
                  <li key={d.device} className="flex items-baseline justify-between gap-3">
                    <span className="font-bold">{d.device}</span>
                    <span className="tabular-nums text-on-surface-variant">
                      {num(d.sessions)} زيارة · {pct(d.reachedCheckout, d.sessions)} وصلوا للحجز
                    </span>
                  </li>
                ))}
              </ul>
            </AdminCard>
            <AdminCard title="صفحات الهبوط" description="أول صفحة يراها الزائر الإعلاني">
              <ul className="space-y-2.5 text-sm">
                {r.landingPages.map((l) => (
                  <li key={l.path} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-xs font-bold" dir="ltr">{l.path}</span>
                    <span className="shrink-0 tabular-nums text-on-surface-variant">
                      {num(l.sessions)} · ارتداد {pct(l.bounced, l.sessions)} · حجز {pct(l.reachedCheckout, l.sessions)}
                    </span>
                  </li>
                ))}
              </ul>
            </AdminCard>
          </div>

          {/* ── العملاء المحتملون ─────────────────────────────────────────── */}
          <AdminCard
            title="رسائل التواصل وطلبات الشركات"
            description="تُحسب من معرّف النقرة المحفوظ على الرسالة نفسها"
            className="mb-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/admin/contact-messages"
                className="rounded-xl border border-outline-variant/25 p-4 transition-colors hover:border-primary/30"
              >
                <p className="text-xs font-bold text-on-surface-variant">رسائل تواصل معنا</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">
                  {num(r.leads.contactFromAds)}
                  <span className="ms-2 text-sm font-bold text-on-surface-variant">من الإعلانات · الإجمالي {num(r.leads.contactMessages)}</span>
                </p>
              </Link>
              <Link
                href="/admin/corporate-leads"
                className="rounded-xl border border-outline-variant/25 p-4 transition-colors hover:border-primary/30"
              >
                <p className="text-xs font-bold text-on-surface-variant">طلبات الشركات</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">
                  {num(r.leads.corporateFromAds)}
                  <span className="ms-2 text-sm font-bold text-on-surface-variant">من الإعلانات · الإجمالي {num(r.leads.corporateLeads)}</span>
                </p>
              </Link>
            </div>
          </AdminCard>

          {/* ── التوصيات ──────────────────────────────────────────────────── */}
          {r.insights.length > 0 ? (
            <AdminCard title="ماذا تقول الأرقام" description="قراءة آلية للبيانات أعلاه — تحقق منها قبل اتخاذ قرار" className="mb-6">
              <ul className="space-y-3 text-sm leading-relaxed">
                {r.insights.map((t) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </AdminCard>
          ) : null}
        </>
      )}

      {/* ── الإعدادات: الإنفاق وأسماء الحملات ─────────────────────────────── */}
      <h2 className="mb-3 mt-10 text-xl font-extrabold tracking-tight">بيانات من خارج الموقع</h2>
      <AdsSettingsPanel
        settings={r.settings}
        campaignKeys={campaignKeys}
        defaultFrom={r.startYmd}
        defaultTo={r.endYmd}
      />

      <AdminCard title="تعريف الأرقام" className="mt-8">
        <dl className="grid gap-x-8 gap-y-3 text-sm leading-relaxed sm:grid-cols-2">
          <div>
            <dt className="font-extrabold">زيارة إعلانية</dt>
            <dd className="text-on-surface-variant">جلسة جاءت برابط يحمل معرّف نقرة من المنصة (gclid…) أو utm_medium مدفوع.</dd>
          </div>
          <div>
            <dt className="font-extrabold">الجلسة</dt>
            <dd className="text-on-surface-variant">زيارات نفس الجهاز والشبكة تفصلها أقل من ٣٠ دقيقة. تقريبية لأن الموقع لا يضع كوكي زائر.</dd>
          </div>
          <div>
            <dt className="font-extrabold">حجز فعّال</dt>
            <dd className="text-on-surface-variant">أي حجز حالته ليست «مرفوض» ولا «ملغى» — بغض النظر عن طريقة الدفع.</dd>
          </div>
          <div>
            <dt className="font-extrabold">نسب الحجز للإعلان</dt>
            <dd className="text-on-surface-variant">بمعرّف النقرة المحفوظ على الحجز (الأمتن)، وإلا بالجلسة التي فتحت صفحة دفعه. الحجوزات القديمة قبل تفعيل الحفظ تعتمد على الجلسة فقط.</dd>
          </div>
        </dl>
      </AdminCard>
    </>
  );
}
