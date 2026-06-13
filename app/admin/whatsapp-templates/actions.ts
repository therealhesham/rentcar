"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { WHATSAPP_TEMPLATE_KEYS, type WhatsAppTemplateKey, DEFAULT_WHATSAPP_TEMPLATES } from "@/lib/whatsapp-templates";

export type WhatsappTemplatesState = Record<WhatsAppTemplateKey, string>;

export async function getWhatsappTemplatesState(): Promise<WhatsappTemplatesState> {
  const keys = WHATSAPP_TEMPLATE_KEYS;
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: [...keys] } },
  });

  const state = { ...DEFAULT_WHATSAPP_TEMPLATES };
  for (const row of rows) {
    if (keys.includes(row.key as WhatsAppTemplateKey)) {
      state[row.key as WhatsAppTemplateKey] = row.value;
    }
  }

  return state;
}

export async function updateWhatsappTemplatesState(
  prevState: any,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await getAdminSession();
    if (!session?.isSuperAdmin) {
      return { ok: false, error: "غير مصرح لك بتعديل القوالب." };
    }
  } catch {
    return { ok: false, error: "حدث خطأ في المصادقة." };
  }

  const data: Record<string, string> = {};
  for (const key of WHATSAPP_TEMPLATE_KEYS) {
    data[key] = formData.get(key) as string;
  }

  try {
    await prisma.$transaction(
      WHATSAPP_TEMPLATE_KEYS.map((key) =>
        prisma.siteSetting.upsert({
          where: { key },
          create: { key, value: data[key] },
          update: { value: data[key] },
        }),
      ),
    );
    revalidatePath("/admin/whatsapp-templates");
    return { ok: true };
  } catch (err) {
    console.error("updateWhatsappTemplatesState failed:", err);
    return { ok: false, error: "تعذّر حفظ القوالب." };
  }
}
