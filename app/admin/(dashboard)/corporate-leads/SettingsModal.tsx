"use client";

import { useState, useTransition } from "react";
import { Settings, X, Save, AlertCircle } from "lucide-react";
import { updateNotificationSettings } from "./settings-actions";
import { useRouter } from "next/navigation";

export function SettingsModal({ initialSettings }: { initialSettings: { emails: string; whatsapp: string } }) {
  const [isOpen, setIsOpen] = useState(false);
  const [emailList, setEmailList] = useState<string[]>(() => {
    return initialSettings.emails.split(",").map(e => e.trim()).filter(Boolean);
  });
  const [whatsappList, setWhatsappList] = useState<string[]>(() => {
    return initialSettings.whatsapp.split(",").map(w => w.trim()).filter(Boolean);
  });
  const [inputValue, setInputValue] = useState("");
  const [whatsappInput, setWhatsappInput] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const addEmail = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
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
    setEmailList(emailList.filter(e => e !== emailToRemove));
  };

  const addWhatsapp = (val: string) => {
    const trimmed = val.replace(/\s/g, "").replace(/\+/g, "").replace(/^00/, "").trim();
    if (!trimmed) return;

    if (!/^\d{9,15}$/.test(trimmed)) {
      setError(`رقم الواتساب غير صالح: ${trimmed}`);
      return;
    }

    if (!whatsappList.includes(trimmed)) {
      setWhatsappList([...whatsappList, trimmed]);
    }
    setWhatsappInput("");
    setError("");
  };

  const handleWhatsappKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addWhatsapp(whatsappInput);
    } else if (e.key === "Backspace" && !whatsappInput && whatsappList.length > 0) {
      setWhatsappList(whatsappList.slice(0, -1));
    }
  };

  const removeWhatsapp = (numToRemove: string) => {
    setWhatsappList(whatsappList.filter(w => w !== numToRemove));
  };

  const handleSave = () => {
    setError("");
    startTransition(async () => {
      // If there's something in the inputs, try to add it first
      if (inputValue.trim()) {
        const trimmed = inputValue.trim();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && !emailList.includes(trimmed)) {
          emailList.push(trimmed);
        }
      }

      if (whatsappInput.trim()) {
        const trimmedW = whatsappInput.replace(/\s/g, "").replace(/\+/g, "").replace(/^00/, "").trim();
        if (/^\d{9,15}$/.test(trimmedW) && !whatsappList.includes(trimmedW)) {
          whatsappList.push(trimmedW);
        }
      }

      const res = await updateNotificationSettings(emailList.join(","), whatsappList.join(","));
      if (!res.ok) {
        setError(res.error || "حدث خطأ غير متوقع.");
      } else {
        setIsOpen(false);
        router.refresh();
      }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm transition-all duration-300">
          <div
            className="w-full max-w-lg bg-surface-container rounded-3xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
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
                أضف البريد الإلكتروني الذي سيستقبل إشعارات عند إرسال طلب حجز شركات جديد. (اضغط <kbd className="bg-surface-container-highest px-1.5 py-0.5 rounded text-xs mx-1">Enter</kbd> أو مسافة لإضافة البريد).
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
                  onClick={() => document.getElementById("email-input")?.focus()}
                >
                  {emailList.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium animate-in fade-in zoom-in-95 duration-200"
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
                    id="email-input"
                    type="email"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => addEmail(inputValue)}
                    placeholder={emailList.length === 0 ? "admin@example.com" : "أضف المزيد..."}
                    className="flex-1 min-w-[150px] bg-transparent outline-none py-1.5 text-on-surface font-medium placeholder:text-on-surface-variant/40"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-outline-variant/10">
                <label className="block text-sm font-semibold text-on-surface">
                  أرقام الواتساب (لطلبات الشركات)
                </label>
                <div
                  className="w-full min-h-[100px] p-3 rounded-xl border border-outline-variant/30 bg-surface focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all flex flex-wrap gap-2 items-start"
                  dir="ltr"
                  onClick={() => document.getElementById("whatsapp-input")?.focus()}
                >
                  {whatsappList.map((num) => (
                    <span
                      key={num}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-sm font-medium animate-in fade-in zoom-in-95 duration-200"
                    >
                      {num}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeWhatsapp(num);
                        }}
                        className="hover:bg-emerald-500/20 p-0.5 rounded-full transition-colors focus:outline-none"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    id="whatsapp-input"
                    type="tel"
                    value={whatsappInput}
                    onChange={(e) => setWhatsappInput(e.target.value)}
                    onKeyDown={handleWhatsappKeyDown}
                    onBlur={() => addWhatsapp(whatsappInput)}
                    placeholder={whatsappList.length === 0 ? "9665xxxxxxxx" : "أضف المزيد..."}
                    className="flex-1 min-w-[150px] bg-transparent outline-none py-1.5 text-on-surface font-medium placeholder:text-on-surface-variant/40"
                  />
                </div>
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
