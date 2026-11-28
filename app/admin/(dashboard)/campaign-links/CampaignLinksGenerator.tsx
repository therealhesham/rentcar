"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { GowebSourceInfo } from "@/lib/goweb-crm";

const LANDING_PAGES = [
  { value: "/", label: "الصفحة الرئيسية" },
  { value: "/fleet", label: "الأسطول" },
  { value: "/contact", label: "تواصل معنا" },
  { value: "/about", label: "نبذة عنا" },
] as const;

const FIELD_CLASS =
  "w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function buildLink(baseUrl: string, path: string, identifier: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!base) return "";
  const joiner = path.includes("?") ? "&" : "?";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}${joiner}_source=${encodeURIComponent(identifier.toLowerCase())}`;
}

export function CampaignLinksGenerator({
  sources,
  initialBaseUrl,
}: {
  sources: GowebSourceInfo[];
  initialBaseUrl: string;
}) {
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [landing, setLanding] = useState<string>("/");
  const [custom, setCustom] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const path = landing === "__custom" ? custom.trim() || "/" : landing;
  const baseOk = /^https?:\/\/[^\s/]+/i.test(baseUrl.trim());

  const rows = useMemo(
    () =>
      sources.map((s) => ({
        ...s,
        link: baseOk ? buildLink(baseUrl, path, s.identifier) : "",
      })),
    [sources, baseUrl, path, baseOk],
  );

  async function copy(identifier: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // متصفح قديم أو بدون صلاحية — نحدد النص للنسخ اليدوي
      const el = document.getElementById(`link-${identifier}`) as HTMLInputElement | null;
      el?.select();
      return;
    }
    setCopied(identifier);
    setTimeout(() => setCopied((c) => (c === identifier ? null : c)), 1800);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-outline-variant/30 bg-surface-container p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2 md:col-span-2">
            <label htmlFor="cl-base" className="text-sm font-bold text-on-surface">
              رابط الموقع
            </label>
            <input
              id="cl-base"
              dir="ltr"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://rent.rawaes.com"
              className={`${FIELD_CLASS} text-start`}
            />
            {!baseOk && (
              <p className="text-xs text-red-600">اكتب الرابط كامل مع https:// عشان الروابط تتولّد.</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="cl-landing" className="text-sm font-bold text-on-surface">
              الصفحة اللي الإعلان يفتحها
            </label>
            <select
              id="cl-landing"
              value={landing}
              onChange={(e) => setLanding(e.target.value)}
              className={FIELD_CLASS}
            >
              {LANDING_PAGES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              <option value="__custom">مسار آخر…</option>
            </select>
          </div>

          {landing === "__custom" && (
            <div className="flex flex-col gap-2">
              <label htmlFor="cl-custom" className="text-sm font-bold text-on-surface">
                المسار
              </label>
              <input
                id="cl-custom"
                dir="ltr"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="/fleet?city=madinah"
                className={`${FIELD_CLASS} text-start`}
              />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-outline-variant/30 bg-surface-container shadow-sm overflow-hidden">
        <ul className="divide-y divide-outline-variant/20">
          {rows.map((r) => {
            const isGoogle = r.identifier.toLowerCase() === "google";
            return (
              <li key={`${r.id}-${r.identifier}`} className="p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-base font-extrabold text-on-surface">{r.name}</span>
                  <code className="rounded-md bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant" dir="ltr">
                    {r.identifier}
                  </code>
                  {isGoogle && (
                    <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
                      تلقائي — مش محتاج رابط خاص (بيتعرف من gclid)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id={`link-${r.identifier}`}
                    readOnly
                    dir="ltr"
                    value={r.link}
                    placeholder="—"
                    onFocus={(e) => e.currentTarget.select()}
                    className={`${FIELD_CLASS} text-start font-mono text-xs`}
                  />
                  <button
                    type="button"
                    disabled={!r.link}
                    onClick={() => copy(r.identifier, r.link)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {copied === r.identifier ? (
                      <>
                        <Check className="h-4 w-4" /> تم النسخ
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> نسخ
                      </>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-xs leading-relaxed text-on-surface-variant">
        الروابط بتتولّد من المصادر المسجّلة في GoWeb. لو عايز مصدر جديد (مثلاً QR على مطبوعات)
        ضيفه الأول في لوحة GoWeb وهيظهر هنا تلقائيًا. زيارة من غير رابط خاص بتتحسب «website».
      </p>
    </div>
  );
}
