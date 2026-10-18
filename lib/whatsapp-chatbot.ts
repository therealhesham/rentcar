import { getWhatsappOtpConfig } from "@/lib/whatsapp-otp";
import { getOpenRouterReply, isOpenRouterConfigured } from "@/lib/openrouter";
import { SITE_NAME_AR, absoluteUrl } from "@/lib/seo";
import { getFleetCategoriesForFilter, getFleetPriceBounds } from "@/lib/fleet-data";
import { prisma } from "@/lib/prisma";

/**
 * شات بوت رد تلقائي على استفسارات العملاء الواردة عبر واتساب (رسائلي)، بنفس عقد
 * "إعدادات n8n" الموثّق في لوحة رسائلي: نستقبل رسالة العميل من الـ webhook،
 * نولّد رداً منظَّماً (نص + تصنيف نية + تصعيد للدعم) عبر OpenRouter، ثم نرجّعه
 * عبر POST /api/n8n-callback — مش رداً مباشراً على نفس طلب الـ webhook.
 *
 * لا نستخدم "قاعدة معرفة" رسائلي (رفع CSV يدوي) — بنبني قاعدة معرفتنا من قاعدة
 * بيانات الموقع نفسها (أسعار/فئات الأسطول) في buildGroundingContext() كي تفضل
 * محدثة تلقائياً بلا تكرار يدوي في مكانين.
 */

const RASAYILY_CALLBACK_URL = "https://rasayily.com/api/n8n-callback";
const INTENT_TAGS = ["حجز", "أسعار", "دعم_فني", "شكوى", "استفسار_عام"] as const;
const INTENT_TAGS_SET = new Set<string>(INTENT_TAGS);

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

type IncomingMessage = {
  phone: string;
  text: string;
  language: string;
  companyId: number | string | null;
};

/** شكل الحمولة الواردة مبني على نظام n8n عند رسائلي (company_name/language/contact_phone...). نُبقي بدائل أسماء حقول دفاعياً لحين تأكيد شكلها الحقيقي من رسالة فعلية. */
function extractIncomingMessage(raw: unknown): IncomingMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;

  const phone = str(data.contact_phone) || str(data.phone) || str(data.sender_phone) || str(data.from);
  const text =
    str(data.message) || str(data.message_body) || str(data.text) || str(data.body) || str(data.question);
  if (!phone || !text) return null;

  const language = str(data.language) || "ar";

  const companyIdRaw = data.company_id;
  let companyId: number | string | null = null;
  if (typeof companyIdRaw === "number" && Number.isFinite(companyIdRaw)) {
    companyId = companyIdRaw;
  } else if (typeof companyIdRaw === "string" && companyIdRaw.trim()) {
    const n = Number(companyIdRaw.trim());
    companyId = Number.isFinite(n) ? n : companyIdRaw.trim();
  }

  return { phone, text, language, companyId };
}

/** أسماء المدن اللي فيها فروع نشطة فعلاً — بدل تثبيتها كنص عشان ما تبقاش قديمة لو اتفتح/اتقفل فرع. */
async function getActiveBranchCityNames(): Promise<string[]> {
  const cities = await prisma.city.findMany({
    where: { isActive: true, branches: { some: { isActive: true } } },
    select: { name: true },
    orderBy: { sortOrder: "asc" },
  });
  return cities.map((c) => c.name);
}

/** بيانات حقيقية من قاعدة البيانات تحل محل "قاعدة معرفة" رسائلي — كي لا يخترع البوت أسعاراً أو روابط أو فروعاً. */
async function buildGroundingContext(): Promise<string> {
  const fleetUrl = absoluteUrl("/fleet");
  try {
    const [categories, bounds, cityNames] = await Promise.all([
      getFleetCategoriesForFilter("ar"),
      getFleetPriceBounds("daily"),
      getActiveBranchCityNames(),
    ]);
    const categoryNames = categories.map((c) => c.title).join("، ") || "—";
    return [
      `المدن اللي فيها فروعنا حالياً: ${cityNames.join("، ") || "—"}`,
      `رابط صفحة الأسطول الكاملة بكل السيارات وأسعارها الحقيقية: ${fleetUrl}`,
      `الفئات المتاحة حالياً: ${categoryNames}`,
      `السعر اليومي (غير شامل الضريبة) يبدأ من ${bounds.min} ر.س ويصل حتى ${bounds.max} ر.س حسب السيارة والفئة.`,
    ].join("\n");
  } catch (e) {
    console.error("[whatsapp-chatbot] فشل جلب بيانات الأسطول — سيُكتفى برابط الصفحة:", e);
    return `رابط صفحة الأسطول الكاملة بكل السيارات وأسعارها الحقيقية: ${fleetUrl}`;
  }
}

/** مبني على الـ System Message الجاهز في لوحة رسائلي (تاب "موجه الذكاء")، معدّل لنشاط تأجير السيارات وقاعدة معرفتنا بدل قاعدة معرفتهم. */
function buildSystemPrompt(opts: { language: string; grounding: string }): string {
  return `أنت المساعد الذكي الرسمي لشركة "${SITE_NAME_AR}" لتأجير السيارات في السعودية. المدن والفئات والأسعار الحقيقية موجودة في "قاعدة المعرفة" بالأسفل.

لغة العميل المفضّلة: ${opts.language}

إليك قاعدة المعرفة الحالية والمحدثة:
${opts.grounding}

=== ١. اللغة ===
رد بنفس لغة رسالة العميل. عربي بعربي، إنجليزي بإنجليزي. لو مش واضح استخدم "${opts.language}". لا تخلط لغتين في رد واحد.

=== ٢. مصدر الحقيقة ===
جاوب فقط من "قاعدة المعرفة" أعلاه. ممنوع تخترع أو تخمّن: أسعار، فئات، عروض، مواعيد، أرقام تليفون، إيميلات، أو روابط غير مذكورة فيها. أي حاجة بتتغيّر مع الوقت (الأسعار/العروض) وجّه العميل لرابط الأسطول المذكور بدل ما تقول رقم من عندك.

=== ٣. شكل الرسالة على واتساب ===
ردك هيترسل كرسالة واتساب مش صفحة ويب:
- الخط العريض بنجمة واحدة: *هكذا*. ممنوع **.
- المائل بشرطة سفلية واحدة: _هكذا_.
- ممنوع عناوين ماركداون (#) أو جداول أو code fences.
- للقوائم استخدم أرقام/إيموجي أو شرطة بسيطة في أول السطر.
- إيموجي باعتدال واحترافية.
- خليك مختصر: أقل من ١٢٠ كلمة.

=== ٤. لو مش عارف الإجابة ===
لو الإجابة مش في قاعدة المعرفة، ما تخترعش ولا تعتذر بإسهاب. رد بالظبط (بنفس لغة العميل):
- عربي: "هذه المعلومة غير متوفرة لدي حالياً. هل تود أن أحوّلك لأحد موظفي خدمة العملاء؟ (اكتب 'نعم' أو 'تحويل' للتواصل مع الدعم)"
- English: "This information isn't available to me right now. Would you like me to transfer you to a support agent? (Reply 'yes' or 'support')"
لو العميل رد بعدها نعم/تحويل/yes/support، أكّد التحويل وخلّي escalate_to_human = true.

=== ٥. التصعيد للدعم البشري ===
خلّي escalate_to_human = true، وقول للعميل إنك هتحوّله، لما:
- يطلب موظف أو دعم بشري صراحة.
- السؤال عن حجز قائم فعلاً، دفع، استرداد فلوس، أو مشكلة في عملية دفع.
- يشتكي من مشكلة في سيارة أو فرع أو تجربة سيئة.
- هو غضبان أو محبط بوضوح.
- سأل حاجة مش في قاعدة المعرفة ووافق على التحويل.

=== ٦. تصنيف النية ===
اختر من صفر إلى علامتين بالظبط من هذه القائمة فقط حسب موضوع الرسالة: ${INTENT_TAGS.map((t) => `"${t}"`).join("، ")}.

=== ٧. ممنوع تسريب التنسيق الداخلي ===
escalate_to_human وintent_tags حقول مخرجات منظّمة (JSON)، مش نص. ممنوع تكتب أي أسماء حقول أو JSON أو true/false داخل الرسالة اللي العميل هيشوفها — هو لازم يشوف كلام طبيعي بس.

=== ٨. النبرة ===
ودود، محترف، مختصر، ومفيد. ممكن تشجع العميل يحجز أو يزور صفحة الأسطول لو مناسب، من غير ضغط أو مبالغة، ومن غير وعد بحاجة مش في قاعدة المعرفة.

رد حصراً بكائن JSON بالشكل التالي ولا شيء غيره، بدون أي نص قبله أو بعده:
{"reply_text": "نص الرد للعميل", "intent_tags": ["وسم أو اثنين من القائمة أعلاه، أو مصفوفة فاضية"], "escalate_to_human": true أو false}`;
}

type StructuredReply = { reply_text: string; intent_tags: string[]; escalate_to_human: boolean };

function parseStructuredReply(raw: string): StructuredReply | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const reply_text = str(obj.reply_text);
    if (!reply_text) return null;
    const intent_tags = Array.isArray(obj.intent_tags)
      ? obj.intent_tags.filter((t): t is string => typeof t === "string" && INTENT_TAGS_SET.has(t))
      : [];
    return { reply_text, intent_tags, escalate_to_human: obj.escalate_to_human === true };
  } catch {
    return null;
  }
}

/** الـ callback بيتحقق من "رمز التحقق (Secret Token)" المحفوظ في إعدادات n8n عند رسائلي كـ Bearer — مش توكن الـ API العادي (ده بيرجع 401 Invalid token). */
async function sendRasayilyCallback(opts: {
  secret: string;
  phone: string;
  reply: StructuredReply;
  companyId: number | string;
}): Promise<void> {
  const res = await fetch(RASAYILY_CALLBACK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${opts.secret}`,
      "X-Company-ID": String(opts.companyId),
    },
    body: JSON.stringify({
      phone: opts.phone,
      reply_text: opts.reply.reply_text,
      intent_tags: opts.reply.intent_tags,
      escalate_to_human: opts.reply.escalate_to_human,
      company_id: opts.companyId,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Rasayily n8n-callback HTTP ${res.status}: ${body.slice(0, 500)}`);
  }
}

export type HandleResult =
  | { ok: true; replyText: string }
  | { ok: false; reason: string };

/**
 * نقطة الدخول الوحيدة من الـ webhook. ترجع نتيجة بدل void حتى يقدر الـ route يعرض
 * سبب التوقف في وضع التشخيص (X-Debug-Rasayily) من غير ما يأثر على الرد العادي
 * لرسائلي (دايماً 200 {received:true}).
 */
export async function handleIncomingRasayilyMessage(rawPayload: unknown): Promise<HandleResult> {
  if (process.env.WHATSAPP_BOT_ENABLED?.trim().toLowerCase() !== "true") {
    return { ok: false, reason: "WHATSAPP_BOT_ENABLED مش مضبوط بـ true" };
  }

  const incoming = extractIncomingMessage(rawPayload);
  if (!incoming) {
    console.warn("[whatsapp-chatbot] تعذّر استخراج رسالة نصية من حمولة الـ webhook.");
    return { ok: false, reason: "تعذّر استخراج رقم/نص الرسالة من الحمولة الواردة" };
  }

  if (!isOpenRouterConfigured()) {
    console.error("[whatsapp-chatbot] OPENROUTER_API_KEY غير مضبوط — تخطّي الرد.");
    return { ok: false, reason: "OPENROUTER_API_KEY غير مضبوط" };
  }

  const secret = process.env.RASAYILY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return { ok: false, reason: "RASAYILY_WEBHOOK_SECRET غير مضبوط" };
  }

  let companyId: number | string | null = incoming.companyId;
  if (companyId === null) {
    const cfgCompanyId = (await getWhatsappOtpConfig()).rasayilyCompanyId;
    const n = Number(cfgCompanyId);
    companyId = !cfgCompanyId ? null : Number.isFinite(n) ? n : cfgCompanyId;
  }
  if (companyId === null) {
    console.error("[whatsapp-chatbot] معرّف شركة رسائلي غير متاح (لا في الحمولة ولا في الإعدادات) — تخطّي الرد.");
    return { ok: false, reason: "معرّف شركة رسائلي غير متاح" };
  }

  const grounding = await buildGroundingContext();
  const systemPrompt = buildSystemPrompt({ language: incoming.language, grounding });

  let rawReply: string;
  try {
    rawReply = await getOpenRouterReply({ systemPrompt, userMessage: incoming.text, jsonMode: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[whatsapp-chatbot] فشل استدعاء OpenRouter:", e);
    return { ok: false, reason: `فشل استدعاء OpenRouter: ${msg}` };
  }

  const structured =
    parseStructuredReply(rawReply) ?? { reply_text: rawReply.trim(), intent_tags: [], escalate_to_human: false };

  try {
    await sendRasayilyCallback({ secret, phone: incoming.phone, reply: structured, companyId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[whatsapp-chatbot] فشل إرسال n8n-callback:", e);
    return { ok: false, reason: `فشل إرسال n8n-callback: ${msg}` };
  }

  return { ok: true, replyText: structured.reply_text };
}
