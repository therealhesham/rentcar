import { prisma } from "@/lib/prisma";

export const WHATSAPP_TEMPLATE_KEYS = [
  "whatsapp_template_customer_login_otp",
  "whatsapp_template_booking_checkout_otp",
  "whatsapp_template_booking_completion_customer",
  "whatsapp_template_booking_completion_admin",
  "whatsapp_template_booking_received_customer",
  "whatsapp_template_booking_received_admin",
  "whatsapp_template_booking_confirmed_customer",
] as const;

export type WhatsAppTemplateKey = typeof WHATSAPP_TEMPLATE_KEYS[number];

export const DEFAULT_WHATSAPP_TEMPLATES: Record<WhatsAppTemplateKey, string> = {
  whatsapp_template_customer_login_otp: 
    "رمز تسجيل الدخول في روائس لتأجير السيارات: {otp}\n\nصالح لمدة 10 دقائق.",
  whatsapp_template_booking_checkout_otp: 
    "رمز إتمام الحجز في روائس لتأجير السيارات: {otp}\n\nصالح لمدة 10 دقائق.",
  whatsapp_template_booking_completion_customer: 
    "مرحباً {fullName}،\n\nتم تأكيد حجزكم واستلام الدفع بنجاح.\n\nرقم الطلب: #{bookingId}\nالمركبة: {carTitle}\nالاستلام: {pickupDate}\nالتسليم: {dropoffDate}\n{pickupDetails}\n{branchLocation}\nطريقة الدفع: {paymentMethod}\nالمبلغ الإجمالي: {totalAmount} ر.س (شامل الضريبة)\n\nشكراً لاختياركم روائس لتأجير السيارات. نتمنى لكم رحلة آمنة.",
  whatsapp_template_booking_completion_admin: 
    "🚨 *حجز أفراد جديد مدفوع ومؤكد*\n\n*رقم الطلب:* #{bookingId}\n*المركبة:* {carTitle}\n*العميل:* {fullName}\n*رقم الجوال:* {phone}\n*الفرع:* {branchLocation}\n*تاريخ الاستلام:* {pickupDate}\n*المدة:* {numberOfDays} أيام",
  whatsapp_template_booking_received_customer: 
    "مرحباً {fullName}،\n\nتم استلام حجزك بنجاح.\n\nرقم الطلب: #{bookingId}\nالمركبة: {carTitle}\n\nطلبكم قيد المراجعة — سيتواصل معكم فريق روائس قريباً لتأكيد الحجز هاتفياً.\nستُرسل الفاتورة بعد التأكيد.\n\nشكراً لاختياركم روائس لتأجير السيارات.",
  whatsapp_template_booking_received_admin: 
    "🚨 *حجز أفراد جديد مسجل*\n\n*رقم الطلب:* #{bookingId}\n*المركبة:* {carTitle}\n*العميل:* {fullName}\n*رقم الجوال:* {phone}\n*الفرع:* {branchLocation}\n*تاريخ الاستلام:* {pickupDate}\n*المدة:* {numberOfDays} أيام",
  whatsapp_template_booking_confirmed_customer:
    "مرحباً {fullName}،\n\nتم تأكيد حجزك لدينا بنجاح.\n\nرقم الطلب: #{bookingId}\nالمركبة: {carTitle}\n{pickupDetails}\nتاريخ الاستلام: {pickupDate}\nالمدة: {numberOfDays} أيام\n\nنتطلع لخدمتك قريباً، شكراً لاختياركم روائس لتأجير السيارات.",
};

export async function getWhatsAppTemplate(key: WhatsAppTemplateKey): Promise<string> {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  if (row?.value) {
    return row.value;
  }
  return DEFAULT_WHATSAPP_TEMPLATES[key];
}

export function expandTemplate(template: string, vars: Record<string, string | number>): string {
  let expanded = template;
  for (const [key, value] of Object.entries(vars)) {
    expanded = expanded.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }
  return expanded;
}
