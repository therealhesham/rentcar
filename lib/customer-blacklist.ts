import "server-only";
import type { Prisma } from "@prisma/client";
import { currentRequestMeta, logActivity } from "@/lib/activity-log";
import { syntheticEmailForPhone } from "@/lib/booking-import";
import { prisma } from "@/lib/prisma";

/**
 * رسالة الرفض الوحيدة التي يراها العميل المحظور — عامة عمداً ومطابقة لنبرة أخطاء
 * الحجز الأخرى. **ممنوع** أن تحمل أي إشارة للقائمة السوداء أو أن تختلف حسب سبب المطابقة.
 */
export const BLOCKED_BOOKING_MESSAGE =
  "تعذّر إتمام الحجز حالياً. يُرجى التواصل مع خدمة العملاء.";

/** رسالة الإدارة فقط (حجز المكتب) — الموظف يحق له معرفة السبب. */
export const BLACKLISTED_ADMIN_MESSAGE =
  "هذا العميل مُدرج في القائمة السوداء — لا يمكن إنشاء حجز له. ألغِ الحظر من صفحة العملاء أولاً.";

/** أقل طول لرقم هوية/رخصة يُعتمد في المطابقة — يمنع تطابقاً عرضياً على قيم وهمية قصيرة. */
const MIN_DOC_NUMBER_LENGTH = 5;

export type BlacklistIdentity = {
  customerId?: number | null;
  phone?: string | null;
  email?: string | null;
  nationalIdNumber?: string | null;
  passportNumber?: string | null;
  licenseNumber?: string | null;
};

function docNumber(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  return v && v.length >= MIN_DOC_NUMBER_LENGTH ? v : null;
}

/**
 * يبحث عن حساب محظور يطابق أيّاً من بيانات الهوية: الحساب، الجوال، البريد، أو
 * أرقام الهوية/الجواز/الرخصة — الأخيرة تسدّ ثغرة تغيير الجوال والبريد والحجز من جديد.
 */
export async function findBlacklistedMatch(
  identity: BlacklistIdentity,
): Promise<{ userId: number; matchedBy: string } | null> {
  const or: Prisma.UserWhereInput[] = [];
  const customerId =
    identity.customerId != null && Number.isInteger(identity.customerId) && identity.customerId > 0
      ? identity.customerId
      : null;
  const phone = identity.phone?.trim() || null;
  const email = identity.email?.trim().toLowerCase() || null;
  const nationalId = docNumber(identity.nationalIdNumber);
  const passport = docNumber(identity.passportNumber);
  const license = docNumber(identity.licenseNumber);

  if (customerId != null) or.push({ id: customerId });
  if (phone) or.push({ phone });
  if (email) or.push({ email });
  if (nationalId) or.push({ nationalIdNumber: nationalId });
  if (passport) or.push({ passportNumber: passport });
  if (license) or.push({ licenseNumber: license });
  if (or.length === 0) return null;

  const row = await prisma.user.findFirst({
    where: { isBlacklisted: true, OR: or },
    select: {
      id: true,
      phone: true,
      email: true,
      nationalIdNumber: true,
      passportNumber: true,
      licenseNumber: true,
    },
  });
  if (!row) return null;

  const matchedBy =
    customerId === row.id
      ? "account"
      : phone && row.phone === phone
        ? "phone"
        : email && row.email === email
          ? "email"
          : nationalId && row.nationalIdNumber === nationalId
            ? "nationalId"
            : passport && row.passportNumber === passport
              ? "passport"
              : "license";
  return { userId: row.id, matchedBy };
}

/**
 * بوابة الحجز للعميل: عند المطابقة يُسجَّل الحدث داخلياً (سجل النشاط) ويُعاد خطأ عام
 * لا يكشف السبب. `source` يوضح للإدارة من أين جاءت المحاولة.
 */
export async function assertCustomerNotBlacklisted(
  identity: BlacklistIdentity,
  source: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const match = await findBlacklistedMatch(identity);
  if (!match) return { ok: true };

  const meta = await currentRequestMeta();
  await logActivity({
    kind: "BOOKING_BLOCKED",
    userId: match.userId,
    actorLabel: identity.phone?.trim() || identity.email?.trim() || null,
    detail: `${source} · ${match.matchedBy}`,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return { ok: false, error: BLOCKED_BOOKING_MESSAGE };
}

/**
 * يحلّ حساب العميل صاحب الحجز لحظره: الحساب المربوط أولاً ثم الجوال. عميل بلا حساب
 * (استفسار من الرئيسية) يُنشأ له حساب ببريد اصطلاحي على `.invalid` — نفس نمط استيراد
 * الحجوزات — فيبقى الحظر قائماً لو سجّل لاحقاً بنفس الجوال (يُربط بنفس السجل).
 */
export async function resolveOrCreateUserForBlacklist(opts: {
  customerId: number | null;
  phone: string;
  fullName: string;
}): Promise<number> {
  if (opts.customerId != null) {
    const linked = await prisma.user.findUnique({
      where: { id: opts.customerId },
      select: { id: true },
    });
    if (linked) return linked.id;
  }

  const phone = opts.phone.trim();
  const byPhone = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (byPhone) return byPhone.id;

  const email = syntheticEmailForPhone(phone);
  const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (byEmail) return byEmail.id;

  const created = await prisma.user.create({
    data: { email, phone, name: opts.fullName.trim() || null, passwordHash: null },
    select: { id: true },
  });
  return created.id;
}
