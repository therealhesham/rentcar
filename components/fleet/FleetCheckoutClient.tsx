"use client";

import {
  Baby,
  CircleHelp,
  Gauge,
  Info,
  KeyRound,
  Shield,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import {
  computeCheckoutTotals,
  formatSarAmount,
} from "@/lib/booking-checkout-pricing";
import { computeBookingDays } from "@/lib/booking-days";
import type { CheckoutCarDTO } from "@/lib/checkout-car-data";
import type { StoredFleetSearchContext } from "@/lib/fleet-search-storage";
import { FLEET_SEARCH_STORAGE_KEY } from "@/lib/fleet-search-storage";
import type { RentalAddonDTO } from "@/lib/rental-addon-data";

type Props = {
  car: CheckoutCarDTO;
  addons: RentalAddonDTO[];
  branchBySlug: Record<string, string>;
  /** عميل مسجّل الدخول وبياناته كافية لتخطّي نموذج التواصل */
  sessionCustomer: { name: string; phoneLocal: string; email: string } | null;
};

function AddonVisual({ iconKey }: { iconKey: string | null }) {
  const cls = "size-8 text-[#003749]";
  switch (iconKey) {
    case "key":
      return <KeyRound className={cls} aria-hidden />;
    case "key-plus":
      return <Shield className={cls} aria-hidden />;
    case "child":
      return <Baby className={cls} aria-hidden />;
    case "gauge":
      return <Gauge className={cls} aria-hidden />;
    default:
      return <CircleHelp className={cls} aria-hidden />;
  }
}

function fmtWhen(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "" };
  return {
    date: d.toLocaleDateString("ar-SA", { year: "numeric", month: "numeric", day: "numeric" }),
    time: d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function FleetCheckoutClient({
  car,
  addons,
  branchBySlug,
  sessionCustomer,
}: Props) {
  const sp = useSearchParams();
  const router = useRouter();
  const [ctxStore, setCtxStore] = useState<StoredFleetSearchContext | null>(null);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<
    | null
    | { loading: true }
    | { loading: false; available: boolean; fleetUnits: number; overlapping: number }
  >(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FLEET_SEARCH_STORAGE_KEY);
      if (raw) setCtxStore(JSON.parse(raw) as StoredFleetSearchContext);
    } catch {
      /* ignore */
    }
  }, []);

  const trip = useMemo(() => {
    const pickupUrl = sp.get("pickup")?.trim() || null;
    const dropoffUrl = sp.get("dropoff")?.trim() || null;
    const daysNum = Number(sp.get("days"));
    const mode =
      sp.get("mode") === "delivery" ? ("delivery" as const) : ("pickup" as const);
    const pickupBranch =
      sp.get("pickupBranch")?.trim() || ctxStore?.pickupBranch || undefined;
    const returnBranch =
      sp.get("returnBranch")?.trim() || ctxStore?.returnBranch || undefined;
    const dlat = sp.get("dlat");
    const dlng = sp.get("dlng");

    let pickupIso = pickupUrl;
    if (!pickupIso && ctxStore?.pickupDate) {
      pickupIso = `${ctxStore.pickupDate}T12:00:00`;
    }

    let days =
      Number.isFinite(daysNum) && daysNum >= 1 && daysNum <= 60
        ? Math.round(daysNum)
        : ctxStore?.days ?? 1;

    let dropoffIso = dropoffUrl;
    if (pickupIso && !dropoffIso) {
      const p = new Date(pickupIso);
      if (!Number.isNaN(p.getTime())) {
        const end = new Date(p);
        end.setDate(end.getDate() + days);
        dropoffIso = end.toISOString();
      }
    }

    let computedDays = days;
    if (pickupIso && dropoffIso) {
      const p = new Date(pickupIso);
      const d = new Date(dropoffIso);
      if (!Number.isNaN(p.getTime()) && !Number.isNaN(d.getTime()) && d >= p) {
        computedDays = computeBookingDays(p, d);
      }
    }

    const deliveryLat =
      mode === "delivery"
        ? (dlat != null ? Number(dlat) : ctxStore?.deliveryLat)
        : undefined;
    const deliveryLng =
      mode === "delivery"
        ? (dlng != null ? Number(dlng) : ctxStore?.deliveryLng)
        : undefined;

    const branchSlug =
      returnBranch?.trim().toLowerCase() ||
      ctxStore?.returnBranch?.trim().toLowerCase() ||
      Object.keys(branchBySlug)[0] ||
      "jeddah";

    const pickupLabel =
      mode === "delivery"
        ? deliveryLat != null &&
          deliveryLng != null &&
          Number.isFinite(deliveryLat) &&
          Number.isFinite(deliveryLng)
          ? `توصيل (${deliveryLat.toFixed(4)}, ${deliveryLng.toFixed(4)})`
          : "توصيل للموقع"
        : pickupBranch
          ? (branchBySlug[pickupBranch] ?? pickupBranch)
          : (branchBySlug[branchSlug] ?? branchSlug);

    const returnLabel = branchBySlug[branchSlug] ?? branchSlug;

    return {
      pickupIso,
      dropoffIso,
      days: computedDays,
      mode,
      pickupLabel,
      returnLabel,
      branchSlug,
      deliveryLat:
        typeof deliveryLat === "number" && Number.isFinite(deliveryLat)
          ? deliveryLat
          : undefined,
      deliveryLng:
        typeof deliveryLng === "number" && Number.isFinite(deliveryLng)
          ? deliveryLng
          : undefined,
    };
  }, [sp, ctxStore, branchBySlug]);

  const selectedRows = useMemo(
    () => addons.filter((a) => selected.has(a.id)),
    [addons, selected],
  );

  const totals = computeCheckoutTotals(
    car.pricePerDayExclTax,
    trip.days,
    car.vatRatePercent,
    selectedRows.map((a) => ({ pricePerDay: a.pricePerDay })),
  );

  useEffect(() => {
    if (!trip.pickupIso) {
      setAvailability(null);
      return;
    }
    const pickupDate = trip.pickupIso.slice(0, 10);
    const ctrl = new AbortController();
    setAvailability({ loading: true });
    void (async () => {
      try {
        const params = new URLSearchParams({
          carModelId: String(car.modelId),
          pickupDate,
          days: String(trip.days),
        });
        const res = await fetch(`/api/bookings/direct?${params}`, {
          signal: ctrl.signal,
          credentials: "include",
        });
        const data = (await res.json()) as {
          ok?: boolean;
          available?: boolean;
          fleetUnits?: number;
          overlapping?: number;
        };
        if (!data.ok || data.available === undefined || data.fleetUnits === undefined) {
          setAvailability(null);
          return;
        }
        setAvailability({
          loading: false,
          available: data.available,
          fleetUnits: data.fleetUnits,
          overlapping: data.overlapping ?? 0,
        });
      } catch {
        if (!ctrl.signal.aborted) setAvailability(null);
      }
    })();
    return () => ctrl.abort();
  }, [car.modelId, trip.pickupIso, trip.days]);

  function toggleAddon(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!trip.pickupIso) {
      setError("لم يُعثر على تواريخ الحجز. ارجع إلى الأسطول أو الصفحة الرئيسية وابحث مجدداً.");
      return;
    }
    if (availability && !availability.loading && !availability.available) {
      setError("هذه السيارة غير متاحة في الفترة المحددة.");
      return;
    }

    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const phone = String(fd.get("phone") ?? "")
      .replace(/\s+/g, "")
      .trim();
    const age = String(fd.get("age") ?? "");
    const terms = fd.get("terms") === "on";

    const pickupMode: "BRANCH" | "DELIVERY" =
      trip.mode === "delivery" &&
      trip.deliveryLat != null &&
      trip.deliveryLng != null
        ? "DELIVERY"
        : "BRANCH";

    const body: Record<string, unknown> = {
      carModelId: car.modelId,
      name,
      phone,
      age,
      branch: trip.branchSlug,
      pickupDate: trip.pickupIso,
      days: trip.days,
      terms,
      pickupMode,
      addonIds: [...selected],
    };
    if (pickupMode === "DELIVERY") {
      body.deliveryLat = trip.deliveryLat;
      body.deliveryLng = trip.deliveryLng;
    }

    setPending(true);
    try {
      const res = await fetch("/api/bookings/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        bookingRequestId?: number;
      };
      if (data.ok && data.bookingRequestId) {
        router.push(`/fleet/payment/${data.bookingRequestId}`);
        return;
      }
      setError(data.error ?? "تعذّر إرسال الطلب.");
    } catch {
      setError("تعذّر الاتصال بالخادم.");
    } finally {
      setPending(false);
    }
  }

  const pu = fmtWhen(trip.pickupIso);
  const du = fmtWhen(trip.dropoffIso);
  const slotBlocked = Boolean(
    availability && !availability.loading && !availability.available,
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f5] text-on-surface">
      <SiteNav active="fleet" />
      <div className="pt-24 pb-16">
        <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <nav className="mb-6 text-sm text-on-surface-variant">
            <Link href="/fleet" className="font-bold text-[#003749] hover:underline">
              الأسطول
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="font-semibold text-on-surface">إتمام الحجز</span>
          </nav>

          {!trip.pickupIso ? (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
              لم نجد تواريخ الاستلام من الرابط.{" "}
              <Link href="/fleet" className="underline">
                ارجع للأسطول
              </Link>{" "}
              بعد البحث من الصفحة الرئيسية، أو ابدأ بحثاً جديداً.
            </div>
          ) : null}

          {availability?.loading ? (
            <p className="mb-4 text-sm text-on-surface-variant">جاري التحقق من التوفر…</p>
          ) : null}
          {availability && !availability.loading ? (
            <p
              className={`mb-4 text-sm font-bold ${availability.available ? "text-primary" : "text-error"}`}
              role="status"
            >
              {availability.available
                ? `متاحة للحجز (${availability.fleetUnits} وحدة في الأسطول).`
                : `غير متاحة في هذه الفترة (${availability.overlapping} حجز متزامن).`}
            </p>
          ) : null}

          <div
            dir="rtl"
            className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]"
          >
            {/* المحتوى الرئيسي — الإضافات والأسعار */}
            <div className="order-2 space-y-6 lg:order-1">
              <h1 className="text-xl font-extrabold text-[#ea580c] sm:text-2xl">
                السعر والإضافات
              </h1>

              <div className="space-y-3">
                {addons.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-outline-variant/50 bg-white px-4 py-8 text-center text-sm text-on-surface-variant">
                    لا توجد إضافات مفعّلة حالياً. أضفها من{" "}
                    <Link href="/admin/rental-addons" className="font-bold underline underline-offset-2">
                      لوحة الإدارة — إضافات التأجير
                    </Link>
                    .
                  </p>
                ) : (
                  addons.map((a) => {
                    const on = selected.has(a.id);
                    return (
                      <label
                        key={a.id}
                        className={`flex cursor-pointer items-center gap-4 rounded-xl border bg-white px-4 py-4 shadow-sm transition-colors ${
                          on ? "border-[#dbb878] ring-1 ring-[#dbb878]/40" : "border-neutral-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleAddon(a.id)}
                          className="size-5 shrink-0 accent-[#003749]"
                        />
                        <AddonVisual iconKey={a.iconKey} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#003749]">{a.titleAr}</span>
                            <button
                              type="button"
                              className="text-on-surface-variant hover:text-[#003749]"
                              title={a.descriptionAr ?? ""}
                              aria-label="معلومات"
                            >
                              <Info className="size-4" />
                            </button>
                          </div>
                          {a.descriptionAr ? (
                            <p className="mt-1 text-xs text-on-surface-variant">{a.descriptionAr}</p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-start">
                          <p className="text-sm font-extrabold tabular-nums text-[#003749]" dir="ltr">
                            {formatSarAmount(a.pricePerDay)} ر.س
                          </p>
                          <p className="text-[11px] text-on-surface-variant">في اليوم</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                <div className="divide-y divide-neutral-100">
                  <PriceRow
                    label={`إجمالي الإيجار لمدة ${trip.days} يوم`}
                    value={`${formatSarAmount(totals.rentalExclTax)} ر.س`}
                  />
                  <PriceRow
                    label={`إجمالي الإضافات ${trip.days} يوم`}
                    value={`${formatSarAmount(totals.addonsExclTax)} ر.س`}
                  />
                  <PriceRow label="المجموع" value={`${formatSarAmount(totals.subtotalExclTax)} ر.س`} />
                  <PriceRow
                    label={`ضريبة القيمة المضافة ${car.vatRatePercent}%`}
                    value={`${formatSarAmount(totals.vatAmount)} ر.س`}
                  />
                  <PriceRow
                    label="المبلغ الإجمالي"
                    value={`${formatSarAmount(totals.totalInclTax)} ر.س`}
                    emphasize
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center text-xs font-bold text-[#003749] shadow-sm">
                  تمارا — تقسيم المبلغ على دفعات (عرض إعلامي)
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center text-xs font-bold text-[#003749] shadow-sm">
                  تابي — تقسيم المبلغ على دفعات (عرض إعلامي)
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-extrabold text-[#003749]">بيانات التواصل</h2>
                {sessionCustomer ? (
                  <>
                    <p className="text-xs text-on-surface-variant">
                      سيتم استخدام بيانات حسابك لإتمام الطلب والتواصل معك.
                    </p>
                    <div className="rounded-xl border border-[#003749]/15 bg-[#003749]/[0.04] px-4 py-3 text-sm">
                      <p className="font-extrabold text-[#003749]">{sessionCustomer.name}</p>
                      <p className="mt-1 text-xs text-on-surface-variant tabular-nums" dir="ltr">
                        {sessionCustomer.email}
                      </p>
                      <p className="mt-1 text-xs font-bold tabular-nums text-[#003749]" dir="ltr">
                        +966 {sessionCustomer.phoneLocal}
                      </p>
                      <Link
                        href="/account"
                        className="mt-2 inline-block text-xs font-bold text-[#ea580c] underline underline-offset-2"
                      >
                        تعديل البيانات من حسابي
                      </Link>
                    </div>
                    <input type="hidden" name="name" value={sessionCustomer.name} />
                    <input type="hidden" name="phone" value={sessionCustomer.phoneLocal} />
                    <input type="hidden" name="age" value="25-35" />
                  </>
                ) : (
                  <>
                    <p className="text-xs text-on-surface-variant">
                      نحتاج اسمك ورقم جوالك لإتمام الطلب والتواصل معك.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-on-surface-variant">الاسم الكامل</span>
                        <input
                          name="name"
                          required
                          minLength={3}
                          autoComplete="name"
                          className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#dbb878]/50"
                          dir="rtl"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-on-surface-variant">الجوال</span>
                        <div className="flex overflow-hidden rounded-lg border border-neutral-200" dir="ltr">
                          <span className="flex items-center border-e border-neutral-200 px-2 text-sm font-bold">
                            +966
                          </span>
                          <input
                            name="phone"
                            required
                            pattern="5[0-9]{8}"
                            maxLength={9}
                            inputMode="numeric"
                            autoComplete="tel-national"
                            placeholder="5XXXXXXXX"
                            className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#dbb878]/50"
                          />
                        </div>
                      </label>
                      <label className="flex flex-col gap-1 sm:col-span-2">
                        <span className="text-xs font-bold text-on-surface-variant">الفئة العمرية</span>
                        <select
                          name="age"
                          required
                          defaultValue="25-35"
                          className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#dbb878]/50"
                          dir="rtl"
                        >
                          <option value="25-35">25-35</option>
                          <option value="35-50">35-50</option>
                          <option value="50+">50+</option>
                        </select>
                      </label>
                    </div>
                  </>
                )}
                <label className="flex cursor-pointer items-start gap-2 text-sm font-bold">
                  <input type="checkbox" name="terms" required className="mt-1 accent-[#003749]" />
                  <span>أوافق على الشروط والأحكام</span>
                </label>

                {error ? (
                  <p className="text-sm font-bold text-error" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={pending || slotBlocked || !trip.pickupIso}
                  className="w-full rounded-xl bg-[#003749] py-3.5 text-sm font-extrabold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
                >
                  {pending ? "جاري الإرسال…" : "تأكيد الحجز ومتابعة الدفع"}
                </button>
              </form>
            </div>

            {/* الشريط الجانبي — ملخص السيارة */}
            <aside className="order-1 space-y-4 lg:order-2">
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-md">
                <div className="relative aspect-[16/10] bg-neutral-100">
                  <Image
                    src={car.image}
                    alt={car.alt}
                    fill
                    className="object-contain p-4"
                    sizes="(max-width: 1024px) 100vw, 340px"
                  />
                </div>
                <div className="space-y-4 border-t border-neutral-100 p-5">
                  <div>
                    <h2 className="text-lg font-extrabold leading-snug text-[#003749]">
                      {car.fullTitle} أو ما يشابه ذلك
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-[#ea580c]">{car.categoryTitle}</p>
                  </div>

                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="font-bold text-[#003749]">الاستلام</dt>
                      <dd className="mt-1 text-on-surface-variant">{trip.pickupLabel}</dd>
                      <dd className="tabular-nums text-on-surface" dir="ltr">
                        {pu.date}
                        {pu.time ? ` · ${pu.time}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[#003749]">التسليم</dt>
                      <dd className="mt-1 text-on-surface-variant">{trip.returnLabel}</dd>
                      <dd className="tabular-nums text-on-surface" dir="ltr">
                        {du.date}
                        {du.time ? ` · ${du.time}` : ""}
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-neutral-100 pt-3 font-bold">
                      <dt>مدة الإيجار</dt>
                      <dd dir="ltr">{trip.days} يوم</dd>
                    </div>
                    <div className="flex justify-between font-bold text-[#003749]">
                      <dt>الإيجار اليومي</dt>
                      <dd dir="ltr">{formatSarAmount(car.pricePerDayExclTax)} ر.س</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

function PriceRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3 ${
        emphasize ? "bg-[#52525b] text-white" : "bg-[#71717a] text-white"
      }`}
    >
      <span className={`text-sm ${emphasize ? "font-extrabold" : "font-semibold"}`}>{label}</span>
      <span className="tabular-nums text-sm font-bold" dir="ltr">
        {value}
      </span>
    </div>
  );
}
