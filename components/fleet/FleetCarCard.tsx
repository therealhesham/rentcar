"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SpecIcon } from "@/components/icons";
import type { FleetCar } from "@/lib/fleet-types";
import { FLEET_CARD_TAX_LINE_AR } from "@/lib/pricing";

const FALLBACK_BRANCH_OPTIONS: { slug: string; name: string }[] = [
  { slug: "jeddah", name: "جدة" },
  { slug: "madinah", name: "المدينة المنورة" },
  { slug: "tabuk", name: "تبوك" },
];

function CheckoutHref({ modelId }: { modelId: number }) {
  const sp = useSearchParams();
  const extra = sp.toString();
  const href = `/fleet/checkout?modelId=${modelId}${extra ? `&${extra}` : ""}`;
  return (
    <Link
      href={href}
      className="block w-full rounded-xl bg-primary-fixed py-3.5 text-center text-sm font-extrabold text-on-primary-fixed transition-colors hover:bg-primary-fixed-dim"
    >
      احجز الآن
    </Link>
  );
}

function CheckoutHrefFallback({ modelId }: { modelId: number }) {
  return (
    <Link
      href={`/fleet/checkout?modelId=${modelId}`}
      className="block w-full rounded-xl bg-primary-fixed py-3.5 text-center text-sm font-extrabold text-on-primary-fixed transition-colors hover:bg-primary-fixed-dim"
    >
      احجز الآن
    </Link>
  );
}

export function FleetCarCard({
  car,
  branchOptions: _branchOptions = FALLBACK_BRANCH_OPTIONS,
}: {
  car: FleetCar;
  branchOptions?: { slug: string; name: string }[];
}) {
  void _branchOptions;

  return (
    <article className="group overflow-hidden rounded-[18px] border border-outline-variant/50 bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[5/3] bg-surface-container-lowest px-4 pt-6 pb-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- روابط صور ديناميكية من الإدارة */}
        <img
          src={car.image}
          alt={car.alt}
          className="mx-auto h-full max-h-[200px] w-full object-contain object-bottom transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {car.badge ? (
          <div className="absolute start-4 top-4 rounded-md rounded-es-none bg-primary-fixed px-3 py-1.5 text-xs font-bold text-on-primary-fixed shadow-sm">
            {car.badge}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 bg-surface-container-low px-5 pb-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-start text-lg font-extrabold leading-snug text-on-primary-container">
            <span className="text-on-primary-container">{car.brand}</span>
            <span className="mx-1.5 font-bold text-on-primary-container/50" aria-hidden>
              |
            </span>
            <span className="text-on-primary-container">{car.name}</span>
          </h3>
          <p className="shrink-0 pt-0.5 text-base font-semibold text-on-surface tabular-nums">
            {car.year}
          </p>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-1 justify-start gap-6 sm:gap-8">
            {car.specs.map((s, i) => (
              <div
                key={`${car.id}-spec-${i}`}
                className="flex flex-col items-center gap-1.5 text-center"
              >
                <span className="text-primary-fixed-dim" aria-hidden>
                  <SpecIcon name={s.icon} className="size-7 shrink-0" />
                </span>
                <span className="text-sm font-bold tabular-nums text-on-surface">{s.value}</span>
              </div>
            ))}
          </div>
          <div className="shrink-0 text-end" dir="ltr">
            <span className="text-2xl font-extrabold tracking-tight text-on-surface">
              {car.price}
            </span>
            <span className="me-1 text-lg font-bold text-on-primary-container">ر.س</span>
          </div>
        </div>

        <div className="space-y-2.5">
          <Suspense fallback={<CheckoutHrefFallback modelId={car.modelId} />}>
            <CheckoutHref modelId={car.modelId} />
          </Suspense>
          <p className="text-center text-[11px] font-semibold leading-relaxed text-on-primary-container">
            {FLEET_CARD_TAX_LINE_AR}
          </p>
        </div>
      </div>
    </article>
  );
}
