import { prisma } from "@/lib/prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Expo تقبل 100 رسالة كحد أقصى في الطلب الواحد. */
const CHUNK_SIZE = 100;
const REQUEST_TIMEOUT_MS = 15_000;
/** لا بد أن تطابق القناة المعرَّفة في rawaes-app/lib/push.ts. */
const ANDROID_CHANNEL_ID = "booking-updates";

export type PushPayload = {
  title: string;
  body: string;
  /** يُسلَّم للتطبيق عند الضغط — `bookingId` يفتح شاشة تفاصيل الحجز. */
  data?: Record<string, string | number>;
};

export type PushChannel = "bookingUpdates" | "promotions";

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

export type PushSendResult = {
  targeted: number;
  accepted: number;
  rejected: number;
  /** أسباب الرفض كما ترجعها Expo — تُعرض للإدارة بدل ابتلاعها. */
  errors: string[];
};

async function postMessages(messages: unknown[]): Promise<ExpoTicket[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Expo رفض الطلب (${res.status})`);
    const body = (await res.json()) as { data?: ExpoTicket[] };
    return body.data ?? [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * التوكن يموت حين يحذف المستخدم التطبيق أو يسحب صلاحية الإشعارات. بدون تنظيف
 * يمتلئ الجدول بتوكنات ميتة ويضيع كل إرسال وقتاً عليها.
 */
async function dropDeadTokens(tokens: string[], tickets: ExpoTicket[]): Promise<void> {
  const dead = tokens.filter(
    (_, i) => tickets[i]?.status === "error" && tickets[i]?.details?.error === "DeviceNotRegistered",
  );
  if (dead.length === 0) return;
  await prisma.pushDevice.deleteMany({ where: { token: { in: dead } } });
}

export async function sendPushToTokens(
  tokens: string[],
  payload: PushPayload,
): Promise<PushSendResult> {
  const result: PushSendResult = { targeted: tokens.length, accepted: 0, rejected: 0, errors: [] };
  if (tokens.length === 0) return result;

  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);
    const messages = chunk.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: "default",
      channelId: ANDROID_CHANNEL_ID,
    }));

    const tickets = await postMessages(messages);
    for (const t of tickets) {
      if (t.status === "ok") result.accepted += 1;
      else {
        result.rejected += 1;
        const reason = t.details?.error ?? t.message ?? "سبب غير معروف";
        if (!result.errors.includes(reason)) result.errors.push(reason);
      }
    }
    await dropDeadTokens(chunk, tickets);
  }

  return result;
}

/** أجهزة المستخدمين الذين لم يُغلقوا هذه القناة. الغياب من الجدول = الافتراضي. */
async function tokensForUsers(userIds: number[], channel: PushChannel): Promise<string[]> {
  if (userIds.length === 0) return [];

  const [devices, prefs] = await Promise.all([
    prisma.pushDevice.findMany({ where: { userId: { in: userIds } }, select: { userId: true, token: true } }),
    prisma.notificationPreference.findMany({ where: { userId: { in: userIds } } }),
  ]);

  const defaultOn = channel === "bookingUpdates";
  const allowed = new Map(prefs.map((p) => [p.userId, channel === "promotions" ? p.promotions : p.bookingUpdates]));

  return devices.filter((d) => allowed.get(d.userId) ?? defaultOn).map((d) => d.token);
}

/**
 * يبعث لكل أجهزة مستخدم واحد. يبتلع كل الأخطاء عمداً: الإشعار مكمِّل للعملية
 * لا جزء منها، ولا يصح أن يفشل إلغاءٌ نُفِّذ ورُدَّ مبلغُه لأن Expo لم تستجب.
 */
export async function sendPushToUserSafe(
  userId: number,
  payload: PushPayload,
  channel: PushChannel = "bookingUpdates",
): Promise<void> {
  try {
    const tokens = await tokensForUsers([userId], channel);
    if (tokens.length === 0) return;
    await sendPushToTokens(tokens, payload);
  } catch (e) {
    console.error("[expo-push] فشل إرسال إشعار:", (e as Error).message);
  }
}

/** أجهزة كل العملاء المشتركين في قناة ما — تُستخدم لصفحة عروض الجوال. */
export async function tokensForChannel(channel: PushChannel): Promise<string[]> {
  const devices = await prisma.pushDevice.findMany({ select: { userId: true } });
  const userIds = [...new Set(devices.map((d) => d.userId))];
  return tokensForUsers(userIds, channel);
}
