"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { resolveUploadedImageUrl } from "@/lib/admin-image-resolve";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PAYMENT_ICON_URLS,
  isAllowedPaymentIconUrl,
  PAYMENT_ICON_METHODS,
  paymentIconSettingKey,
  type PaymentIconMethod,
} from "@/lib/site-settings";

const FOLDER_SLUG = "payment-icons";
const FOLDER_LABEL = "أيقونات وسائل الدفع";

async function upsertSiteSetting(key: string, value: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function updatePaymentIcons(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const resolvedByMethod: Partial<Record<PaymentIconMethod, string>> = {};

  for (const method of PAYMENT_ICON_METHODS) {
    const resolved = await resolveUploadedImageUrl({
      imageFile: formData.get(`imageFile_${method}`),
      galleryImageUrl: String(formData.get(`galleryImageUrl_${method}`) ?? "").trim(),
      currentImage: String(formData.get(`currentImage_${method}`) ?? "").trim(),
      fallbackDefault: DEFAULT_PAYMENT_ICON_URLS[method],
      isAllowedUrl: isAllowedPaymentIconUrl,
      folderSlug: FOLDER_SLUG,
      folderLabel: FOLDER_LABEL,
    });
    if (!resolved.ok) {
      return { ok: false, error: `${method}: ${resolved.error}` };
    }
    resolvedByMethod[method] = resolved.imageUrl;
  }

  try {
    for (const method of PAYMENT_ICON_METHODS) {
      await upsertSiteSetting(paymentIconSettingKey(method), resolvedByMethod[method]!);
    }
  } catch (e: unknown) {
    console.error(e);
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2021") {
      return {
        ok: false,
        error:
          "جدول إعدادات الموقع غير موجود. نفّذ تحديث قاعدة البيانات (مثلاً: npx prisma db push) ثم أعد المحاولة.",
      };
    }
    return { ok: false, error: "تعذّر حفظ الإعدادات." };
  }

  revalidatePath("/fleet/payment/[id]", "page");
  revalidatePath("/admin/payment-icons");
  return { ok: true };
}
