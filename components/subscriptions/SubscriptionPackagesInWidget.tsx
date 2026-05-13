"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DdMmYyDateWithPicker } from "@/components/ui/DdMmYyDateWithPicker";
import { formatYmdAsDdMmYy, parseDdMmYyToYmd } from "@/lib/booking-search-shared";
import {
  MAX_SUBSCRIPTION_DURATION_MONTHS,
  MIN_SUBSCRIPTION_DURATION_MONTHS,
} from "@/lib/subscriptions/duration-options";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayYmdLocal(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

type ApiPlan = {
  slug: string;
  marketingTitleAr: string;
  monthlyPriceSar: number;
  car: { name: string; image: string | null; alt: string | null };
};

type Props = {
  months: number;
  startYmd: string;
  onMonthsChange: (m: number) => void;
  onStartYmdChange: (ymd: string) => void;
  /** مواقع الاستلام/الإرجاع أو التوصيل — داخل نفس السكشن البصري */
  children?: ReactNode;
};

/**
 * شريط داخل widget الحجز عند تبويب «الباقات الشهرية»: عدد الأشهر (3–6)، يوم البداية، وبطاقات سريعة للخطط.
 * الحالة (المدة ويوم البداية) تُدار من الأب لربطها ببحث الأسطول دون حقول تاريخ مكررة.
 */
export function SubscriptionPackagesInWidget({
  months,
  startYmd,
  onMonthsChange,
  onStartYmdChange,
  children,
}: Props) {
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [startDraft, setStartDraft] = useState(() => formatYmdAsDdMmYy(startYmd));

  useEffect(() => {
    setStartDraft(formatYmdAsDdMmYy(startYmd));
  }, [startYmd]);

  useEffect(() => {
    let cancelled = false;
    setPlansLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/subscriptions/plans?limit=8&page=1", {
          cache: "no-store",
        });
        const j = await res.json();
        if (!j.ok) throw new Error(j.error ?? "bad");
        if (!cancelled) {
          setPlans(Array.isArray(j.plans) ? j.plans : []);
          setLoadError(null);
        }
      } catch {
        if (!cancelled) {
          setPlans([]);
          setLoadError("تعذّر تحميل باقات الاشتراك.");
        }
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const querySuffix = useMemo(() => {
    const q = new URLSearchParams();
    q.set("months", String(months));
    q.set("start", startYmd);
    return `?${q.toString()}`;
  }, [months, startYmd]);

  return (
    <div className="col-span-full mb-1 rounded-2xl border border-[#dbb878]/35 bg-gradient-to-br from-[#fffdf8] via-white to-[#f0faf9] p-3.5 shadow-inner sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-[#775927]/90 whitespace-nowrap">
            اشتراك شهري بالسيارة
          </p>
          <h3 className="mt-0.5 text-sm font-extrabold text-[#003749] sm:text-[15px]">
            باقات شهرية — اختر عدد الأشهر (3–6) ويوم البداية ثم الباقة
          </h3>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-on-surface-variant">
            تُحسب نهاية الباقة تلقائياً من تاريخ البداية وعدد الأشهر، وتُستخدم أيضاً لحساب مدة البحث في الأسطول
            دون إدخال تاريخ تسليم منفصل.
          </p>
        </div>
        <Link
          href={`/subscriptions${querySuffix}`}
          className="shrink-0 rounded-xl border border-[#003749]/20 bg-white px-3 py-1.5 text-[11px] font-extrabold text-[#003749] shadow-sm transition-colors hover:border-[#dbb878]"
        >
          كل الباقات ←
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/55">
            عدد أشهر الباقة
          </span>
          <div className="flex flex-wrap items-end gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={MIN_SUBSCRIPTION_DURATION_MONTHS}
              max={MAX_SUBSCRIPTION_DURATION_MONTHS}
              step={1}
              value={months}
              onChange={(ev) => {
                const raw = ev.target.value;
                if (raw === "") return;
                const n = Number(raw);
                if (!Number.isInteger(n)) return;
                onMonthsChange(
                  Math.min(
                    MAX_SUBSCRIPTION_DURATION_MONTHS,
                    Math.max(MIN_SUBSCRIPTION_DURATION_MONTHS, n),
                  ),
                );
              }}
              onBlur={() => {
                if (!Number.isInteger(months) || months < MIN_SUBSCRIPTION_DURATION_MONTHS) {
                  onMonthsChange(MIN_SUBSCRIPTION_DURATION_MONTHS);
                }
              }}
              dir="ltr"
              className="w-[5.5rem] rounded-xl border border-[#003749]/20 bg-white px-2.5 py-1.5 text-center text-[13px] font-extrabold tabular-nums text-[#003749] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#dbb878]/40"
            />
            <span className="pb-1 text-[10px] font-semibold text-on-surface-variant">
              شهراً ({MIN_SUBSCRIPTION_DURATION_MONTHS}–{MAX_SUBSCRIPTION_DURATION_MONTHS})
            </span>
          </div>
        </div>
        <div>
          <label
            htmlFor="widget-sub-start"
            className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#003749]/55"
          >
            يوم بدء الباقة
          </label>
          <DdMmYyDateWithPicker
            id="widget-sub-start"
            value={startDraft}
            onChange={(e) => setStartDraft(e.target.value)}
            onBlur={() => {
              if (!startDraft.trim()) {
                const t = todayYmdLocal();
                onStartYmdChange(t);
                setStartDraft(formatYmdAsDdMmYy(t));
                return;
              }
              const y = parseDdMmYyToYmd(startDraft);
              if (!y) {
                setStartDraft(formatYmdAsDdMmYy(startYmd));
                return;
              }
              const min = todayYmdLocal();
              if (y < min) {
                onStartYmdChange(min);
                setStartDraft(formatYmdAsDdMmYy(min));
                return;
              }
              onStartYmdChange(y);
              setStartDraft(formatYmdAsDdMmYy(y));
            }}
            nativeYmd={/^\d{4}-\d{2}-\d{2}$/.test(startYmd) ? startYmd : ""}
            minYmd={todayYmdLocal()}
            onCalendarSelect={(ymd) => {
              const min = todayYmdLocal();
              const y = ymd < min ? min : ymd;
              onStartYmdChange(y);
              setStartDraft(formatYmdAsDdMmYy(y));
            }}
            inputClassName="rounded-xl border-[#ebe4d3]/90 bg-white px-2.5 py-1.5 shadow-sm"
            buttonClassName="rounded-xl"
          />
        </div>
      </div>

      {loadError ? (
        <p className="mt-2 text-[11px] font-bold text-red-700">{loadError}</p>
      ) : plansLoading && plans.length === 0 ? (
        <p className="mt-2 text-[11px] text-on-surface-variant">جاري تحميل الباقات…</p>
      ) : plans.length > 0 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {plans.map((p) => {
            const img = p.car.image?.trim() || null;
            return (
              <li key={p.slug} className="w-[min(11rem,72vw)] shrink-0">
                <Link
                  href={`/subscriptions/${encodeURIComponent(p.slug)}${querySuffix}`}
                  className="flex flex-col overflow-hidden rounded-xl border border-[#ebe4d3]/80 bg-white shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-[16/10] bg-neutral-100">
                    {img ? (
                      <Image
                        src={img}
                        alt={p.car.alt?.trim() || p.marketingTitleAr}
                        fill
                        className="object-cover"
                        sizes="176px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] font-bold text-neutral-400">
                        بدون صورة
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 text-[11px] font-extrabold leading-snug text-[#003749]">
                      {p.marketingTitleAr}
                    </p>
                    <p className="mt-1 text-[10px] font-bold text-[#ea580c]" dir="ltr">
                      <SarAmountWithSymbol amountClassName="tabular-nums font-semibold">
                        {p.monthlyPriceSar}
                      </SarAmountWithSymbol>{" "}
                      / شهر
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      {children ? (
        <div className="mt-4 border-t border-[#dbb878]/30 pt-4 sm:mt-5 sm:pt-5">{children}</div>
      ) : null}
    </div>
  );
}
