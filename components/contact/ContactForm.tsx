"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, AlertCircle, Send } from "lucide-react";
import { submitContactMessage } from "@/app/contact-actions";

const TEAL = "#003749";
const GOLD = "#dbb878";

const FIELD_CLASS =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-[#dbb878] focus:ring-2 focus:ring-[#dbb878]/30";

export function ContactForm() {
  const t = useTranslations("ContactPage.form");
  const locale = useLocale();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const fd = new FormData();
    fd.set("name", name);
    fd.set("email", email);
    fd.set("phone", phone);
    fd.set("subject", subject);
    fd.set("message", message);
    fd.set("company", company);
    fd.set("locale", locale);

    startTransition(async () => {
      const res = await submitContactMessage(null, fd);
      if (!res.ok) {
        setError(res.error ?? t("genericError"));
        return;
      }
      setSuccess(true);
      setName("");
      setEmail("");
      setPhone("");
      setSubject("");
      setMessage("");
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative rounded-3xl border border-[#dbb878]/40 bg-white p-6 shadow-sm sm:p-8"
      noValidate
    >
      <h2 className="text-xl font-extrabold sm:text-2xl" style={{ color: TEAL }}>
        {t("title")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">{t("subtitle")}</p>

      {success && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p className="leading-relaxed">{t("success")}</p>
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="contact-name" className="text-sm font-bold" style={{ color: TEAL }}>
            {t("name")}
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={255}
            autoComplete="name"
            className={FIELD_CLASS}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="contact-phone" className="text-sm font-bold" style={{ color: TEAL }}>
            {t("phone")}
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("phonePlaceholder")}
            maxLength={32}
            autoComplete="tel"
            className={`${FIELD_CLASS} text-start`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="contact-email" className="text-sm font-bold" style={{ color: TEAL }}>
            {t("email")}
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            maxLength={255}
            autoComplete="email"
            className={`${FIELD_CLASS} text-start`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="contact-subject" className="text-sm font-bold" style={{ color: TEAL }}>
            {t("subject")}
          </label>
          <input
            id="contact-subject"
            name="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("subjectPlaceholder")}
            maxLength={255}
            className={FIELD_CLASS}
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor="contact-message" className="text-sm font-bold" style={{ color: TEAL }}>
            {t("message")}
          </label>
          <textarea
            id="contact-message"
            name="message"
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("messagePlaceholder")}
            maxLength={8000}
            className={`${FIELD_CLASS} resize-y`}
          />
        </div>
      </div>

      {/* مصيدة بوتات — خارج الشاشة بدل display:none عشان البوتات اللي بتتجاهل الحقول المخفية تملاها */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
        <input
          type="text"
          name="company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-extrabold text-[#003749] shadow-sm transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        style={{ backgroundColor: GOLD }}
      >
        {isPending ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#003749]/30 border-t-[#003749]" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {isPending ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
