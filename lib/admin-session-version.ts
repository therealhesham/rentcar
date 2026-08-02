/**
 * إصدار حمولة كوكي جلسة الأدمن. زيادته تُبطل كل الكوكيز القديمة فوراً (تسجيل دخول جديد مرة واحدة).
 *
 * 2 = إضافة cityId/cityName — بدون الإبطال كان مشرف المدينة بكوكي قديم (بلا cityId) يُقرأ
 * كـ«بلا نطاق» أي يرى كل الفروع طوال أسبوع صلاحية الكوكي.
 *
 * في ملف مستقل لأن `lib/admin-session-edge.ts` يعمل في الـ edge runtime ولا يستطيع استيراد
 * `lib/admin-session-token.ts` (يستورد `crypto` من node).
 */
export const ADMIN_SESSION_VERSION = 2;
