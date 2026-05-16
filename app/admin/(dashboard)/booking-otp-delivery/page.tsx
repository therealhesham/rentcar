import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getBookingOtpChannel } from "@/lib/site-settings";
import { isBookingOtpSmsUrlConfigured } from "@/lib/booking-checkout-otp";
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
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">رمز التحقق عند إتمام الحجز</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          اختر كيف يستلم العميل رمز التحقق قبل تأكيد الحجز المباشر من الموقع: عبر رسالة نصية،
          واتساب (Evolution API)، أو البريد الإلكتروني الذي يُدخله في بيانات التواصل. الإرسال الفعلي
          يعتمد على تهيئة الخادم.
        </p>
        <p className="mt-3 max-w-2xl text-sm font-semibold text-on-surface-variant">
          يُطبَّق نفس الإعداد تلقائياً على تسجيل دخول العميل من صفحة «دخول العميل» (رمز إلى الجوال
          أو البريد المسجَّلين في الحساب)، وليس فقط عند إتمام الحجز.
        </p>
      </header>

      <BookingOtpDeliveryForm
        key={currentChannel}
        currentChannel={currentChannel}
        smsUrlConfigured={isBookingOtpSmsUrlConfigured()}
        mailConfigured={isOutgoingMailTransportConfigured()}
        whatsappConfigured={isEvolutionWhatsAppConfigured()}
      />
    </>
  );
}
