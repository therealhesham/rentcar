import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getBookingOtpChannel, getLoginOtpChannel } from "@/lib/site-settings";
import { isSmsChannelConfigured } from "@/lib/booking-checkout-otp";
import { isOutgoingMailTransportConfigured } from "@/lib/booking-invoice-email";
import { isEvolutionWhatsAppConfigured } from "@/lib/evolution-whatsapp";
import { getMetaWhatsappOtpConfig } from "@/lib/meta-whatsapp";
import { BookingOtpDeliveryForm } from "./BookingOtpDeliveryForm";

export const dynamic = "force-dynamic";

export default async function AdminBookingOtpDeliveryPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const [loginChannel, checkoutChannel] = await Promise.all([
    getLoginOtpChannel(),
    getBookingOtpChannel(),
  ]);
  // الـ token لا يُرسَل للمتصفح — نمرّر فقط هل هو محفوظ.
  const { accessToken, ...meta } = await getMetaWhatsappOtpConfig();

  return (
    <>
      <AdminPageHeader
        title="رموز التحقق (OTP)"
        description="لكل من تسجيل دخول العميل وتأكيد الحجز: اختر القناة (SMS أو واتساب أو بريد)، وإن اخترت واتساب حدّد المزوّد Evolution أو Meta وقالب Meta الخاص به."
        backHref="/admin"
      />

      <BookingOtpDeliveryForm
        loginChannel={loginChannel}
        checkoutChannel={checkoutChannel}
        meta={meta}
        hasAccessToken={Boolean(accessToken)}
        smsConfigured={isSmsChannelConfigured()}
        mailConfigured={isOutgoingMailTransportConfigured()}
        evolutionConfigured={isEvolutionWhatsAppConfigured()}
      />
    </>
  );
}
