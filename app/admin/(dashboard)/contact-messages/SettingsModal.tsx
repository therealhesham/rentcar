"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings, X, Save, AlertCircle } from "lucide-react";
import { updateContactNotificationEmails } from "./actions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SettingsModal({ initialEmails }: { initialEmails: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [emailList, setEmailList] = useState<string[]>(() =>
    initialEmails.split(",").map((e) => e.trim()).filter(Boolean),
  );
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const addEmail = (val: string) => {
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) return;
    if (!EMAIL_RE.test(trimmed)) {
      setError(`البريد الإلكتروني غير صالح: ${trimmed}`);
      return;
    }
    if (!emailList.includes(trimmed)) {
      setEmailList([...emailList, trimmed]);
    }
    setInputValue("");
    setError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addEmail(inputValue);
    } else if (e.key === "Backspace" && !inputValue && emailList.length > 0) {
      setEmailList(emailList.slice(0, -1));
    }
  };

  const removeEmail = (emailToRemove: string) => {
    setEmailList(emailList.filter((e) => e !== emailToRemove));
  };

  const handleSave = () => {
    setError("");
    // إيميل مكتوب في الحقل ولسه ما اتضافش كـ chip — نضمّه قبل الحفظ بدل ما يضيع.
    const pending = inputValue.trim().toLowerCase();
    const finalList =
      pending && EMAIL_RE.test(pending) && !emailList.includes(pending)
        ? [...emailList, pending]
        : emailList;

    startTransition(async () => {
      const res = await updateContactNotificationEmails(finalList.join(","));
      if (!res.ok) {
        setError(res.error || "حدث خطأ غير متوقع.");
        return;
      }
      setEmailList(finalList);
      setInputValue("");
      setIsOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="group flex items-center gap-2 rounded-xl bg-surface-container-high px-5 py-3 text-sm font-semibold text-primary transition-all hover:bg-primary hover:text-on-primary hover:shadow-md border border-outline-variant/30"
      >
        <Settings className="w-4 h-4 transition-transform group-hover:rotate-90" />
        إعدادات الإشعارات
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface-container rounded-3xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20 bg-surface-container-high">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  <Settings className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-on-surface">إعدادات الإشعارات</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-on-surface-variant hover:text-error hover:bg-error/10 p-2 rounded-full transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-on-surface-variant leading-relaxed">
                الإيميلات اللي هتستقبل إشعاراً فور وصول رسالة جديدة من صفحة «تواصل معنا». اضغط
                <kbd className="bg-surface-container-highest px-1.5 py-0.5 rounded text-xs mx-1">Enter</kbd>
                أو مسافة لإضافة البريد.
              </p>

              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-error bg-error/10 rounded-xl border border-error/20">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface">
                  البريد الإلكتروني للإشعارات
                </label>
                <div
                  className="w-full min-h-[100px] p-3 rounded-xl border border-outline-variant/30 bg-surface focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all flex flex-wrap gap-2 items-start"
                  dir="ltr"
                  onClick={() => document.getElementById("contact-email-input")?.focus()}
                >
                  {emailList.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEmail(email);
                        }}
                        className="hover:bg-primary/20 p-0.5 rounded-full transition-colors focus:outline-none"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    id="contact-email-input"
                    type="email"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => addEmail(inputValue)}
                    placeholder={emailList.length === 0 ? "admin@example.com" : "أضف المزيد..."}
                    className="flex-1 min-w-[150px] bg-transparent outline-none py-1.5 text-on-surface font-medium placeholder:text-on-surface-variant/40"
                  />
                </div>
                {emailList.length === 0 && (
                  <p className="text-xs text-on-surface-variant/70">
                    بدون إيميلات هنا، الرسائل هتتسجّل في الجدول من غير ما يوصل إشعار لحد.
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-outline-variant/20 bg-surface-container-high flex justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 rounded-xl font-semibold text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {isPending ? (
                  <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
