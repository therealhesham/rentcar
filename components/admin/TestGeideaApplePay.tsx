"use client";

import { useRouter } from "next/navigation";
import { ApplePayExpressButton } from "@/components/fleet/ApplePayExpressButton";
import { startGeideaApplePayTestSessionAction } from "@/app/admin/test-geidea-actions";

/**
 * اختبار زر Apple Pay السريع بريال واحد من صفحة أدوات الإدارة.
 * يستخدم نفس مكوّن الزر المستخدم في صفحة دفع العميل — لا منطق مكرر.
 */
export function TestGeideaApplePay({ scriptUrl }: { scriptUrl: string }) {
  const router = useRouter();
  return (
    <ApplePayExpressButton
      scriptUrl={scriptUrl}
      createSession={startGeideaApplePayTestSessionAction}
      onPaid={() => router.refresh()}
    />
  );
}
