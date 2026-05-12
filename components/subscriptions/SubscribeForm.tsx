"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { parseDurationOptionsCsv } from "@/lib/subscriptions/duration-options";
import { parseSubscriptionStartDateYmd } from "@/lib/subscriptions/start-date";
import { addUtcCalendarMonths, startOfUtcDay } from "@/lib/subscriptions/utc-calendar";

export type SubscribeFormPlan = {
  slug: string;
  durationOptionsCsv: string;
};

type Props = {
  plan: SubscribeFormPlan;
  /** من الرابط ?months= — يُقيَّد بما تسمح به الخطة */
  initialDurationMonths?: number;
  /** من الرابط ?start=YYYY-MM-DD */
  initialStartDateYmd?: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayYmdLocal(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

function normalizeDuration(options: number[], preset?: number): number {
  if (preset != null && options.includes(preset)) return preset;
  return options[0] ?? 1;
}

function normalizeStart(preset?: string): string {
  if (preset) {
    const p = parseSubscriptionStartDateYmd(preset);
    if (p.ok) return preset.trim();
  }
  return todayYmdLocal();
}

export function SubscribeForm({
  plan,
  initialDurationMonths,
  initialStartDateYmd,
}: Props) {
  const router = useRouter();
  const options = parseDurationOptionsCsv(plan.durationOptionsCsv);
  const [duration, setDuration] = useState(() =>
    normalizeDuration(options, initialDurationMonths),
  );
  const [startDate, setStartDate] = useState(() =>
    normalizeStart(initialStartDateYmd),
  );
  const [autoRenew, setAutoRenew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const opts = parseDurationOptionsCsv(plan.durationOptionsCsv);
    setDuration(normalizeDuration(opts, initialDurationMonths));
    setStartDate(normalizeStart(initialStartDateYmd));
  }, [plan.slug, plan.durationOptionsCsv, initialDurationMonths, initialStartDateYmd]);

  const previewEndIso = useMemo(() => {
    const p = parseSubscriptionStartDateYmd(startDate);
    if (!p.ok) return null;
    const dayStart = startOfUtcDay(p.date);
    return addUtcCalendarMonths(dayStart, duration).toISOString();
  }, [startDate, duration]);

  function durationArabicSegment(m: number): string {
    if (m === 1) return "شهر";
    return `${m} أشهر`;
  }

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planSlug: plan.slug,
          durationMonths: duration,
          autoRenew,
          startDate,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "تعذّر إنشاء الاشتراك.");
        setBusy(false);
        return;
      }
      router.push(`/account/subscription?created=${json.subscriptionId}`);
      router.refresh();
    } catch {
      setError("خطأ شبكة أو خادم غير متاح.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-[#fdfbf6]/80 p-5 shadow-inner">
      <div>
        <label
          htmlFor="sub-start-date"
          className="text-[11px] font-bold uppercase tracking-wide text-[#003749]/65"
        >
          يوم بدء الباقة
        </label>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
          لا حاجة لإدخال تاريخ الانتهاء — يُحسب تلقائياً بتقويم وفق مدة الباقة؛ تُثبّت الموافقة النهائية
          عند جاهزيتك ودفع المتطلبات.
        </p>
        <input
          id="sub-start-date"
          type="date"
          min={todayYmdLocal()}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="mt-3 w-full max-w-[14rem] rounded-xl border border-[#003749]/25 bg-white px-3 py-2 text-sm font-semibold shadow-sm"
          dir="ltr"
        />
        {previewEndIso ? (
          <p className="mt-2 text-[12px] font-bold text-[#003749]" dir="ltr">
            تقريباً تنتهي الباقة قبل الموافقة:{" "}
            {new Date(previewEndIso).toLocaleDateString("ar-SA")}
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-amber-800">اختَر تاريخ بدء صالحاً.</p>
        )}
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#003749]/65">
          مدة الباقة
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDuration(m)}
              className={`rounded-full px-4 py-2 text-[12px] font-extrabold transition-colors ${duration === m
                  ? "bg-[#ea580c] text-white shadow-sm"
                  : "border border-[#003749]/20 bg-white text-[#003749]"
                }`}
            >
              {durationArabicSegment(m)}
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={autoRenew}
          onChange={(e) => setAutoRenew(e.target.checked)}
          className="size-4 rounded accent-[#003749]"
        />
        تفعيل التجديد التلقائي قبل انتهاء المدة
      </label>

      {error ? (
        <p className="text-sm font-bold text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={subscribe}
        className="w-full rounded-xl bg-[#003749] py-3.5 text-[14px] font-extrabold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
      >
        {busy ? "جاري المعالجة…" : "ابدأ الاشتراك — الإنشاء وحفظ المتطلبات"}
      </button>
      <p className="text-[10px] leading-relaxed text-on-surface-variant">
        بعد الإنشاء ستحيلك المنصّة لتسديد الدفع التجريبي ورفع المستندات. اليوم الفعلي الأول يكون الأبعد
        بين يوم بدئك ويوم الموافقة إذا تأخّرت المعالجة.
      </p>
    </div>
  );
}
