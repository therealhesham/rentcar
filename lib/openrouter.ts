const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * عميل OpenRouter لعقل الشات بوت. المفاتيح:
 * - OPENROUTER_API_KEY (مطلوب)
 * - OPENROUTER_MODEL (اختياري، افتراضي openai/gpt-4o-mini)
 */
export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function getOpenRouterReply(opts: {
  systemPrompt: string;
  userMessage: string;
  /** يفرض رداً بصيغة JSON object واحد — مطلوب لعقد رد الشات بوت المنظّم (reply_text/intent_tags/escalate_to_human). */
  jsonMode?: boolean;
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY غير مضبوط.");
  const model = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini";

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userMessage },
      ],
      temperature: 0.4,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter HTTP ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("OpenRouter رجع رداً فاضياً.");
  return reply;
}
