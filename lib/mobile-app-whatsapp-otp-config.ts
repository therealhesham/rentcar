/**
 * إعدادات إرسال رمز تسجيل الدخول عبر واتساب في تطبيق الموبايل "روائس".
 * يُخزَّن في MobileAppSetting بمفتاح `mobile_app_whatsapp_otp_config_v1` كـ JSON.
 * هذا هو المصدر الوحيد لهذه البيانات — باك إند التطبيق لا يعتمد على أي
 * متغيرات بيئة (.env) لها، فأي تغيير هنا ينعكس فوراً بدون إعادة نشر السيرفر.
 */

export type MobileAppWhatsappOtpConfig = {
  enabled: boolean;
  apiBaseUrl: string;
  apiKey: string;
  instanceName: string;
};

export const MOBILE_KEY_WHATSAPP_OTP_CONFIG = "mobile_app_whatsapp_otp_config_v1";

export const DEFAULT_MOBILE_APP_WHATSAPP_OTP_CONFIG: MobileAppWhatsappOtpConfig = {
  enabled: false,
  apiBaseUrl: "",
  apiKey: "",
  instanceName: "",
};

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

export function normalizeMobileAppWhatsappOtpConfig(raw: unknown): MobileAppWhatsappOtpConfig {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    enabled: asBool(o.enabled, DEFAULT_MOBILE_APP_WHATSAPP_OTP_CONFIG.enabled),
    apiBaseUrl: asString(o.apiBaseUrl, DEFAULT_MOBILE_APP_WHATSAPP_OTP_CONFIG.apiBaseUrl).trim(),
    apiKey: asString(o.apiKey, DEFAULT_MOBILE_APP_WHATSAPP_OTP_CONFIG.apiKey).trim(),
    instanceName: asString(o.instanceName, DEFAULT_MOBILE_APP_WHATSAPP_OTP_CONFIG.instanceName).trim(),
  };
}
