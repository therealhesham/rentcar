import type { Metadata } from "next";
import { Suspense } from "react";
import { FleetCheckoutOtpClient } from "@/components/fleet/FleetCheckoutOtpClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "رمز التحقق | Rawaes",
  description: "أدخل رمز التحقق المرسل إلى جوالك أو بريدك لإتمام الحجز.",
};

export default function FleetCheckoutOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#fdfbf6] pt-24 text-on-surface">
          <p className="text-sm font-bold text-[#003749]">جاري التحميل…</p>
        </div>
      }
    >
      <FleetCheckoutOtpClient />
    </Suspense>
  );
}
