"use server";

import { requireSuperAdminForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import {
  sendPushToTokens,
  tokensForAudience,
  tokensForChannel,
  type PushAudience,
  type PushChannel,
} from "@/lib/expo-push";

export type MobileOfferSendState = {
  ok: boolean;
  message: string;
};

/** حدود العرض على الجهاز — أطول من ذلك يُقتطع في درج الإشعارات. */
const MAX_TITLE = 80;
const MAX_BODY = 240;

type Target =
  | { kind: "single"; userId: number }
  | { kind: "broadcast"; audience: PushAudience; channel: PushChannel };

function readTarget(formData: FormData): Target | null {
  const mode = String(formData.get("target") ?? "");

  if (mode === "single") {
    const id = Number(String(formData.get("customerId") ?? "").trim());
    if (!Number.isInteger(id) || id <= 0) return null;
    return { kind: "single", userId: id };
  }

  // قناة تحديثات الحجز متاحة للمسجّلين وحدهم — الزائر ليس له حجوزات يُخطَر بها.
  if (mode === "registered-booking-updates") {
    return { kind: "broadcast", audience: "registered", channel: "bookingUpdates" };
  }

  const audience: Record<string, PushAudience> = {
    registered: "registered",
    anonymous: "anonymous",
    all: "all",
  };
  const a = audience[mode];
  if (!a) return null;
  return { kind: "broadcast", audience: a, channel: "promotions" };
}

export async function sendMobileOfferAction(
  _prev: MobileOfferSendState,
  formData: FormData,
): Promise<MobileOfferSendState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, message: auth.error };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const bookingIdRaw = String(formData.get("bookingId") ?? "").trim();

  if (!title) return { ok: false, message: "العنوان مطلوب." };
  if (!body) return { ok: false, message: "نص الرسالة مطلوب." };
  if (title.length > MAX_TITLE)
    return { ok: false, message: `العنوان أطول من ${MAX_TITLE} حرفاً.` };
  if (body.length > MAX_BODY)
    return { ok: false, message: `النص أطول من ${MAX_BODY} حرفاً.` };

  const target = readTarget(formData);
  if (!target) return { ok: false, message: "حدّد وجهة الإرسال بشكل صحيح." };

  try {
    let bookingId: number | undefined;
    if (bookingIdRaw) {
      const n = Number(bookingIdRaw);
      if (!Number.isInteger(n) || n <= 0)
        return { ok: false, message: "رقم الحجز غير صالح." };
      // رقم حجز غير موجود يُنتج إشعاراً يفتح شاشة فارغة عند العميل — نرفضه هنا
      // بدل أن يكتشفه بنفسه.
      const exists = await prisma.bookingRequest.findUnique({
        where: { id: n },
        select: { id: true },
      });
      if (!exists) return { ok: false, message: `لا يوجد حجز رقم ${n}.` };
      bookingId = n;
    }

    let tokens: string[];
    if (target.kind === "single") {
      const devices = await prisma.pushDevice.findMany({
        where: { userId: target.userId },
        select: { token: true },
      });
      if (devices.length === 0) {
        return {
          ok: false,
          message: `العميل رقم ${target.userId} ليس لديه جهاز مسجَّل في التطبيق.`,
        };
      }
      tokens = devices.map((d) => d.token);
    } else {
      tokens = await tokensForAudience(target.audience, target.channel);
      if (tokens.length === 0) {
        return { ok: false, message: "لا توجد أجهزة في هذه الفئة." };
      }
    }

    const res = await sendPushToTokens(tokens, {
      title,
      body,
      data: bookingId ? { bookingId } : {},
    });

    if (res.accepted === 0) {
      return { ok: false, message: `لم يُقبل أي إشعار. ${res.errors.join(" / ")}` };
    }
    const failed =
      res.rejected > 0 ? ` — رُفض ${res.rejected} (${res.errors.join(" / ")})` : "";
    return {
      ok: true,
      // "أُرسل" لا "وصل": Expo تقبل الرسالة ثم تسلّمها لجوجل، والتسليم النهائي
      // يظهر في الإيصالات لاحقاً. لا نَعِد الإدارة بما لا نملك إثباته.
      message: `أُرسل إلى ${res.accepted} جهاز من ${res.targeted}${failed}.`,
    };
  } catch (e) {
    return { ok: false, message: `تعذّر الإرسال: ${(e as Error).message}` };
  }
}

export type MobileAudience = {
  devices: number;
  customers: number;
  promotionsOptedIn: number;
  bookingUpdatesOptedIn: number;
  anonymousDevices: number;
  allPromotions: number;
};

const EMPTY_AUDIENCE: MobileAudience = {
  devices: 0,
  customers: 0,
  promotionsOptedIn: 0,
  bookingUpdatesOptedIn: 0,
  anonymousDevices: 0,
  allPromotions: 0,
};

/**
 * جدولا الإشعارات يملكهما تطبيق الجوال وقد لا يكونان منشأين في كل قاعدة يشير
 * إليها الموقع (الإنتاج والتجريبي قاعدتان منفصلتان). تُعرض أصفار بدل انهيار
 * الصفحة، والنموذج نفسه يرفض الإرسال حين لا يجد جمهوراً.
 */
export async function getMobileAudience(): Promise<MobileAudience> {
  try {
    const [devices, promoTokens, bookingTokens, anonTokens, allPromo] = await Promise.all([
      prisma.pushDevice.findMany({ select: { userId: true } }),
      tokensForChannel("promotions"),
      tokensForChannel("bookingUpdates"),
      tokensForAudience("anonymous", "promotions"),
      tokensForAudience("all", "promotions"),
    ]);

    return {
      devices: devices.length,
      customers: new Set(devices.filter((d) => d.userId != null).map((d) => d.userId)).size,
      promotionsOptedIn: promoTokens.length,
      bookingUpdatesOptedIn: bookingTokens.length,
      anonymousDevices: anonTokens.length,
      allPromotions: allPromo.length,
    };
  } catch (e) {
    console.error("[mobile-offers] تعذّر قراءة جمهور الجوال:", (e as Error).message);
    return EMPTY_AUDIENCE;
  }
}
