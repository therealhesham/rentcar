"use client";

import { useState, useTransition } from "react";
import { Settings, X, Save, AlertCircle } from "lucide-react";
import { updateCarBookingsNotificationSettings } from "./car-bookings-settings-actions";

export function CarBookingsSettingsModal({ initialSettings }: { initialSettings: { emails: string; whatsapp: string } }) {
  const [isOpen, setIsOpen] = useState(false);
  const [emailList, setEmailList] = useState<string[]>(() => {
    return initialSettings.emails.split(",").map(e => e.trim()).filter(Boolean);
  });
  const [whatsappList, setWhatsappList] = useState<string[]>(() => {
    return initialSettings.whatsapp.split(",").map(w => w.trim()).filter(Boolean);
  });
  const [emailInput, setEmailInput] = useState("");
  const [whatsappInput, setWhatsappInput] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addEmail(emailInput);
    } else if (e.key === "Backspace" && !emailInput && emailList.length > 0) {
      setEmailList(emailList.slice(0, -1));
    }
  };

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
    setEmailInput("");
    setError("");
  };

  const removeEmail = (emailToRemove: string) => {
    setEmailList(emailList.filter(e => e !== emailToRemove));
  };

  const handleWhatsappKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addWhatsapp(whatsappInput);
    } else if (e.key === "Backspace" && !whatsappInput && whatsappList.length > 0) {
      setWhatsappList(whatsappList.slice(0, -1));
    }
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

  const removeWhatsapp = (numToRemove: string) => {
    setWhatsappList(whatsappList.filter(w => w !== numToRemove));
  };

  const handleSave = () => {
    setError("");
    startTransition(async () => {
      if (emailInput.trim()) {
        const trimmedE = emailInput.trim();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedE) && !emailList.includes(trimmedE)) {
          emailList.push(trimmedE);
        }
      }

      if (whatsappInput.trim()) {
        const trimmedW = whatsappInput.replace(/\s/g, "").replace(/\+/g, "").replace(/^00/, "").trim();
        if (/^\d{9,15}$/.test(trimmedW) && !whatsappList.includes(trimmedW)) {
          whatsappList.push(trimmedW);
        }
      }
      
      const res = await updateCarBookingsNotificationSettings(emailList.join(","), whatsappList.join(","));
      if (!res.ok) {
        setError(res.error || "حدث خطأ غير متوقع.");
      } else {
        setIsOpen(false);
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-surface-container px-4 py-2.5 text-xs font-bold text-on-surface shadow-sm transition-opacity hover:bg-surface-container-high"
      >
        <Settings className="size-4" aria-hidden />
        إعدادات الإشعارات
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm transition-all duration-300">
          <div
            className="w-full max-w-lg bg-surface-container rounded-3xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20 bg-surface/50">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-xl">
                  <Settings className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">إعدادات الإشعارات (حجوزات الأفراد)</h3>
                  <p className="text-sm font-medium text-on-surface-variant">
                    إدارة أرقام قسم التأجير
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full hover:bg-outline-variant/20 transition-colors text-on-surface-variant focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {error && (
                <div className="p-3 bg-error/10 border border-error/20 rounded-xl flex gap-2 items-start animate-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-error/90 leading-relaxed">{error}</p>
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
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={handleEmailKeyDown}
                    onBlur={() => addEmail(emailInput)}
                    placeholder={emailList.length === 0 ? "admin@example.com" : "أضف المزيد..."}
                    className="flex-1 min-w-[150px] bg-transparent outline-none py-1.5 text-on-surface font-medium placeholder:text-on-surface-variant/40"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-outline-variant/10">
                <label className="block text-sm font-semibold text-on-surface">
                  أرقام الواتساب (للحجوزات العادية)
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
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-on-surface-variant hover:bg-outline-variant/20 transition-colors focus:outline-none"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold shadow-md hover:bg-primary/90 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                حفظ الإعدادات
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
