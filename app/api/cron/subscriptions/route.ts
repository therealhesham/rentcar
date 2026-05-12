import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runSubscriptionCronJobs } from "@/lib/subscriptions/lifecycle";

/** وظائف خلفية: انتهاء الاشتراكات، تنبيهات، تعليق تلقائي عند تأخر السداد. اتصل بجدولة خارجية أو Vercel Cron. */
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET_NOT_SET" }, { status: 501 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(cronSecret, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await runSubscriptionCronJobs();

  return NextResponse.json({ ok: true });
}
