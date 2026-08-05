"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { SITE_KEY_SOCIAL_LINKS } from "@/lib/site-settings";
import { parseSocialLinksJson, type SocialLinkItem } from "@/lib/social-links";

export async function updateSocialLinks(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const rawJson = formData.get("socialLinksJson");
  let items: SocialLinkItem[] = [];

  if (typeof rawJson === "string") {
    items = parseSocialLinksJson(rawJson);
  }

  try {
    const jsonValue = JSON.stringify(items);
    await prisma.siteSetting.upsert({
      where: { key: SITE_KEY_SOCIAL_LINKS },
      create: { key: SITE_KEY_SOCIAL_LINKS, value: jsonValue },
      update: { value: jsonValue },
    });
  } catch (e: unknown) {
    console.error(e);
    return { ok: false, error: "تعذّر حفظ إعدادات التواصل الاجتماعي." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/social-links");
  revalidatePath("/admin/site-branding");
  return { ok: true };
}
