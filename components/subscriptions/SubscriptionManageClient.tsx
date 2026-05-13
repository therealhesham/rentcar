"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { addUtcCalendarMonths, startOfUtcDay } from "@/lib/subscriptions/utc-calendar";
import {
  MAX_SUBSCRIPTION_DURATION_MONTHS,
  MIN_SUBSCRIPTION_DURATION_MONTHS,
} from "@/lib/subscriptions/duration-options";

export type SerializedSubscription = {
  id: number;
  status: string;
  durationMonths: number;
  /** يوم البداية الذي اختاره العميل — يُستخدم لحساب تقريبي للنهاية قبل التفعيل */
  plannedStartDateIso: string | null;
  autoRenew: boolean;
  mileageUsedKm: number;
  mileageAllowanceKm: number;
  depositSnapshotSar: number;
  monthlyPriceSnapshotSar: number;
  createdAtIso: string;
  startAtIso: string | null;
  endAtIso: string | null;
  planTitle: string;
  planSlug: string;
  hasLicense: boolean;
  hasNationalId: boolean;
  pendingPayment: boolean;
};

type Props = { rows: SerializedSubscription[]; highlightedId?: number | null };

export function SubscriptionManageClient({ rows, highlightedId }: Props) {
  const router = useRouter();

  async function pay(id: number) {
    const res = await fetch(`/api/subscriptions/${id}/pay`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = await res.json();
    alert(j.ok ? "تم تأكيد الدفع التجريبي." : j.error ?? "خطأ");
    router.refresh();
  }

  async function cancel(id: number) {
    const reason = window.prompt("سبب الإلغاء (اختياري):") ?? "";
    const res = await fetch(`/api/subscriptions/${id}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const j = await res.json();
    alert(j.ok ? "تم الطلب." : j.error ?? "خطأ");
    router.refresh();
  }

  async function renew(id: number, months: number) {
    const res = await fetch(`/api/subscriptions/${id}/renew`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMonths: months }),
    });
    const j = await res.json();
    alert(j.ok ? `تم إنشاء دفع تجديد #${j.paymentId}` : j.error ?? "خطأ");
    router.refresh();
  }

  async function upload(id: number, kind: string, input: HTMLInputElement) {
    const f = input.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", f);
    const res = await fetch(`/api/subscriptions/${id}/documents`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const j = await res.json();
    alert(j.ok ? "تم رفع الملف." : j.error ?? "خطأ");
    router.refresh();
  }

  const sorted = useMemo(() => rows, [rows]);

  return (
    <div className="grid gap-4">
      {sorted.map((s) => (
        <article
          key={s.id}
          id={`sub-${s.id}`}
          className={`rounded-2xl border bg-white p-5 shadow-md ${highlightedId === s.id ? "border-[#ea580c] ring-2 ring-[#ea580c]/35" : "border-neutral-200"
            }`}
        >
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wide text-[#775927]">
                اشتراك #{s.id}
              </p>
              <h3 className="mt-1 text-lg font-extrabold text-[#003749]">{s.planTitle}</h3>
              <Link href={`/subscriptions/${encodeURIComponent(s.planSlug)}`} className="mt-2 inline-block text-xs font-bold text-[#003749] underline">
                صفحة الباقة
              </Link>
            </div>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide">
              {s.status}
            </span>
          </header>

          <dl className="mt-4 grid gap-3 text-[13px] text-on-surface sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="font-bold text-[#003749]/65">تاريخ الإنشاء</dt>
              <dd dir="ltr">{new Date(s.createdAtIso).toLocaleString("ar-SA")}</dd>
            </div>
            <div>
              <dt className="font-bold text-[#003749]/65">بداية / نهاية</dt>
              <dd dir="ltr" className="space-y-0.5 leading-snug">
                {s.status === "PENDING" ? (
                  <>
                    <span className="block">
                      بدء مطلوب:{" "}
                      {s.plannedStartDateIso
                        ? new Date(s.plannedStartDateIso).toLocaleDateString("ar-SA")
                        : "—"}
                    </span>
                    <span className="block text-on-surface-variant">
                      نهاية تقريبية (قبل الموافقة):{" "}
                      {formatProjectedEndFromPlanned(s.plannedStartDateIso, s.durationMonths) ?? "—"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block">
                      {s.startAtIso
                        ? new Date(s.startAtIso).toLocaleDateString("ar-SA")
                        : "—"}{" "}
                      ←{" "}
                      {s.endAtIso ? new Date(s.endAtIso).toLocaleDateString("ar-SA") : "—"}
                    </span>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-[#003749]/65">التجديد التلقائي</dt>
              <dd>{s.autoRenew ? "مفعّل" : "غير مفعّل"}</dd>
            </div>
            <div>
              <dt className="font-bold text-[#003749]/65">مسافة مسموحة vs مستخدمة</dt>
              <dd dir="ltr">
                {s.mileageUsedKm.toLocaleString("ar-SA")} /{" "}
                {s.mileageAllowanceKm.toLocaleString("ar-SA")} كم
              </dd>
            </div>
            <div>
              <dt className="font-bold text-[#003749]/65">ملخص التسعير المرجّع للطلب</dt>
              <dd dir="ltr">{s.monthlyPriceSnapshotSar} شهرياً ، عربون متوقّع {s.depositSnapshotSar}</dd>
            </div>
          </dl>

          <section className="mt-5 border-t border-neutral-100 pt-4">
            <p className="mb-3 text-[12px] font-black uppercase tracking-wide text-[#003749]/65">
              المستندات القانونية
            </p>
            <div className="flex flex-wrap gap-3">
              <UploadRow
                label="رخصة القيادة"
                ok={s.hasLicense}
                onUpload={(inp) => upload(s.id, "DRIVERS_LICENSE", inp)}
              />
              <UploadRow
                label="الهوية الوطنية"
                ok={s.hasNationalId}
                onUpload={(inp) => upload(s.id, "NATIONAL_ID", inp)}
              />
            </div>
          </section>

          <footer className="mt-6 flex flex-wrap gap-3">
            {s.pendingPayment ? (
              <button
                type="button"
                className="rounded-xl bg-[#ea580c] px-5 py-2 text-xs font-black text-white"
                onClick={() => pay(s.id)}
              >
                تأكيد دفع تجريبي
              </button>
            ) : (
              <span className="rounded-xl bg-neutral-50 px-3 py-2 text-[11px] font-bold text-on-surface-variant">
                لا توجد دفعة معلّقة لهذا الطلب
              </span>
            )}
            {["ACTIVE"].includes(s.status) ? (
              <RenewBlock
                subscriptionId={s.id}
                defaultMonths={s.durationMonths}
                onRenew={renew}
              />
            ) : null}
            {["PENDING", "ACTIVE"].includes(s.status) ? (
              <button type="button" className="text-xs font-bold text-red-700 underline" onClick={() => cancel(s.id)}>
                طلب إلغاء الاشتراك (سياسة مبسّطة لنسخة ألفا)
              </button>
            ) : null}
          </footer>
        </article>
      ))}
      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
          لم تشترِك بعد. انتقل إلى{" "}
          <Link href="/subscriptions" className="font-bold underline">
            الباقات
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

function RenewBlock({
  subscriptionId,
  defaultMonths,
  onRenew,
}: {
  subscriptionId: number;
  defaultMonths: number;
  onRenew: (id: number, months: number) => Promise<void>;
}) {
  const clamp = (m: number) =>
    Math.min(
      MAX_SUBSCRIPTION_DURATION_MONTHS,
      Math.max(MIN_SUBSCRIPTION_DURATION_MONTHS, Math.round(m)),
    );
  const [months, setMonths] = useState(() => clamp(defaultMonths));

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[#003749]/20 bg-[#fdfbf8] px-3 py-2">
      <label className="flex flex-col gap-1 text-[11px] font-bold text-[#003749]/80">
        أشهر التجديد
        <input
          type="number"
          inputMode="numeric"
          min={MIN_SUBSCRIPTION_DURATION_MONTHS}
          max={MAX_SUBSCRIPTION_DURATION_MONTHS}
          step={1}
          value={months}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (e.target.value === "" || Number.isNaN(v)) return;
            setMonths(clamp(v));
          }}
          onBlur={() => setMonths((m) => clamp(m))}
          className="w-[5.5rem] rounded-lg border border-[#003749]/25 bg-white px-2 py-1.5 text-[12px] font-black tabular-nums text-[#003749]"
          dir="ltr"
        />
      </label>
      <button
        type="button"
        className="rounded-xl border border-[#003749] bg-[#003749] px-4 py-2 text-[11px] font-black text-white"
        onClick={() => onRenew(subscriptionId, months)}
      >
        تجديد
      </button>
    </div>
  );
}

function formatProjectedEndFromPlanned(
  plannedIso: string | null,
  months: number,
): string | null {
  if (!plannedIso) return null;
  const d = new Date(plannedIso);
  if (Number.isNaN(d.getTime())) return null;
  const start = startOfUtcDay(d);
  return addUtcCalendarMonths(start, months).toLocaleDateString("ar-SA");
}

function UploadRow({
  label,
  ok,
  onUpload,
}: {
  label: string;
  ok: boolean;
  onUpload: (inp: HTMLInputElement) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="inline-flex flex-col gap-1 rounded-xl border border-neutral-200 px-3 py-2 text-[12px] font-bold">
      <span className="flex items-center gap-2">
        {label}{" "}
        {ok ? <span className="text-emerald-700">✓ تم</span> : <span className="text-amber-700">مطلوب</span>}
      </span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="text-[11px] font-medium"
        disabled={busy}
        onChange={async (ev) => {
          const el = ev.target as HTMLInputElement;
          const file = el.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            await onUpload(el);
          } finally {
            el.value = "";
            setBusy(false);
          }
        }}
      />
    </label>
  );
}
