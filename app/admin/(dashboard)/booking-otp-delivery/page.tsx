import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getBookingOtpChannel } from "@/lib/site-settings";
import { isSmsChannelConfigured } from "@/lib/booking-checkout-otp";
import { isOutgoingMailTransportConfigured } from "@/lib/booking-invoice-email";
import { isEvolutionWhatsAppConfigured } from "@/lib/evolution-whatsapp";
import { BookingOtpDeliveryForm } from "./BookingOtpDeliveryForm";

export const dynamic = "force-dynamic";

export default async function AdminBookingOtpDeliveryPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const currentChannel = await getBookingOtpChannel();

  return (
    <>
      <AdminPageHeader
        title="رمز التحقق عند إتمام الحجز"
        description={
          <>
            اختر كيف يستلم العميل رمز التحقق قبل تأكيد الحجز المباشر من الموقع: عبر رسالة نصية،
            واتساب (Evolution API)، أو البريد الإلكتروني الذي يُدخله في بيانات التواصل. الإرسال الفعلي
            يعتمد على تهيئة الخادم.
            <br />
            <span className="mt-2 block font-semibold">
              يُطبَّق نفس الإعداد تلقائياً على تسجيل دخول العميل من صفحة «دخول العميل» (رمز إلى الجوال
              أو البريد المسجَّلين في الحساب)، وليس فقط عند إتمام الحجز.
            </span>
          </>
        }
        backHref="/admin"
      />

      <BookingOtpDeliveryForm
        key={currentChannel}
        currentChannel={currentChannel}
        smsUrlConfigured={isSmsChannelConfigured()}
        mailConfigured={isOutgoingMailTransportConfigured()}
        whatsappConfigured={isEvolutionWhatsAppConfigured()}
      />
    </>
  );
}
