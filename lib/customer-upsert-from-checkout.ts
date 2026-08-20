import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * ينشئ حساب عميل أو يحدّثه من بيانات إتمام الحجز المباشر (بعد التحقق من OTP عند الحاجة).
 * كلمة المرور تبقى فارغة حتى يضبطها العميل من «إنشاء حساب» أو ميزة لاحقة.
 */
export async function upsertCustomerFromFleetBooking(opts: {
  email: string;
  phoneE164: string;
  name: string;
  kyc?: {
    idDocumentKind: string;
    nationalIdNumber: string | null;
    passportNumber: string | null;
    licenseNumber: string;
    licenseExpiryDate: Date;
    idCardImageUrl: string | null;
    driverLicenseImageUrl: string | null;
  } | null;
}): Promise<{ ok: true; userId: number } | { ok: false; error: string }> {
  const email = opts.email.trim().toLowerCase();
  const phone = opts.phoneE164.trim();
  const name = opts.name.trim();
  const kyc = opts.kyc ?? null;

  const kycData = kyc
    ? {
        idDocumentKind: kyc.idDocumentKind,
        nationalIdNumber: kyc.nationalIdNumber,
        passportNumber: kyc.passportNumber,
        licenseNumber: kyc.licenseNumber,
        licenseExpiryDate: kyc.licenseExpiryDate,
        idCardImageUrl: kyc.idCardImageUrl,
        driverLicenseImageUrl: kyc.driverLicenseImageUrl,
      }
    : {};

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { ok: false, error: "البريد الإلكتروني غير صالح لربط الحساب." };
  }

  const byEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true, phone: true },
  });
  const byPhone = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, email: true },
  });

  if (byEmail && byPhone && byEmail.id !== byPhone.id) {
    return {
      ok: false,
      error:
        "البريد ورقم الجوال مسجّلان لحسابين مختلفين. راجع البيانات أو تواصل معنا.",
    };
  }

  if (byEmail) {
    try {
      await prisma.user.update({
        where: { id: byEmail.id },
        data: { name, phone, ...kycData } as any,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return {
          ok: false,
          error: "رقم الجوال مرتبط بحساب آخر. راجع بياناتك أو تواصل معنا.",
        };
      }
      throw e;
    }
    return { ok: true, userId: byEmail.id };
  }

  if (byPhone) {
    if (byPhone.email.trim().toLowerCase() !== email) {
      return {
        ok: false,
        error:
          "رقم الجوال مسجّل لحساب ببريد مختلف. سجّل الدخول بالبريد المسجّل أو استخدم الجوال المطابق لحسابك.",
      };
    }
    await prisma.user.update({
      where: { id: byPhone.id },
      data: { name, ...kycData } as any,
    });
    return { ok: true, userId: byPhone.id };
  }

  const user = await prisma.user.create({
    data: {
      email,
      phone,
      name,
      passwordHash: null,
      ...kycData,
    } as any,
    select: { id: true },
  });
  return { ok: true, userId: user.id };
}
