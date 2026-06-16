"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

type BookingStepperProps = {
  /** 1 = نتائج البحث / Search, 2 = إتمام الحجز / Checkout, 3 = الدفع / Payment, 4 = تأكيد / Confirmation */
  currentStep: number;
  modelId?: number;
  bookingId?: number;
};

const stepsAr = [
  { id: 1, label: "نتائج البحث" },
  { id: 2, label: "إتمام الحجز" },
  { id: 3, label: "الدفع" },
  { id: 4, label: "تأكيد الحجز" },
];

const stepsEn = [
  { id: 1, label: "Search Results" },
  { id: 2, label: "Checkout" },
  { id: 3, label: "Payment" },
  { id: 4, label: "Confirmation" },
];

export function BookingStepper({ currentStep, modelId, bookingId }: BookingStepperProps) {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const spString = searchParams?.toString() ?? "";

  const steps = locale === "en" ? stepsEn : stepsAr;

  function hrefForStep(id: number): string | undefined {
    if (id >= currentStep) return undefined; // not clickable for future / current
    if (id === 1) return `/fleet${spString ? `?${spString}` : ""}`;
    if (id === 2) return modelId ? `/fleet/checkout?modelId=${modelId}${spString ? `&${spString}` : ""}` : "/fleet";
    if (id === 3) return bookingId ? `/fleet/payment/${bookingId}` : undefined;
    return undefined;
  }

  return (
    <div className="w-full mt-8 mb-8" dir="ltr">
      {/* Step track */}
      <div className="relative flex items-center justify-between px-2 sm:px-4">
        {/* Background track line */}
        <div className="absolute inset-x-0 top-4 h-[2px] bg-[#ebe4d3] mx-8 sm:mx-12" aria-hidden />

        {/* Active track line */}
        <div
          className="absolute top-4 h-[2px] bg-[#003749] mx-8 sm:mx-12 transition-all duration-500 ease-out"
          style={{ width: `calc(${((Math.min(currentStep, steps.length) - 1) / (steps.length - 1)) * 100}% - 0px)` }}
          aria-hidden
        />

        {steps.map((step) => {
          const isDone = step.id < currentStep;
          const isActive = step.id === currentStep;
          const href = hrefForStep(step.id);

          const circle = (
            <div
              className={`
                relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-extrabold transition-all duration-300
                ${isDone
                  ? "border-[#003749] bg-[#003749] text-white"
                  : isActive
                  ? "border-[#003749] bg-white text-[#003749] shadow-[0_0_0_4px_rgba(0,55,73,0.12)]"
                  : "border-[#d1c9b8] bg-white text-[#aaa08e]"
                }
              `}
            >
              {isDone ? (
                <CheckCircle2 className="size-4" aria-hidden />
              ) : (
                <span>{step.id}</span>
              )}
            </div>
          );

          return (
            <div key={step.id} className="flex flex-col items-center gap-2 flex-1 first:items-start last:items-end">
              {href ? (
                <Link href={href} className="flex flex-col items-center gap-2 group">
                  <span className="group-hover:scale-110 transition-transform">{circle}</span>
                  <span
                    className={`text-center text-[11px] sm:text-[12px] font-bold leading-snug transition-colors ${
                      isDone ? "text-[#003749] group-hover:text-[#003749]/80" : isActive ? "text-[#003749]" : "text-[#aaa08e]"
                    }`}
                  >
                    {step.label}
                  </span>
                </Link>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  {circle}
                  <span
                    className={`text-center text-[11px] sm:text-[12px] font-bold leading-snug ${
                      isActive ? "text-[#003749]" : isDone ? "text-[#003749]/70" : "text-[#aaa08e]"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
