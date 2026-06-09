"use client";

import { useState, useTransition } from "react";
import { Settings, X, Save, AlertCircle } from "lucide-react";
import { updateCorporateLeadsEmailsSetting } from "./settings-actions";
import { useRouter } from "next/navigation";

export function SettingsModal({ initialEmails }: { initialEmails: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [emails, setEmails] = useState(initialEmails);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSave = () => {
    setError("");
    startTransition(async () => {
      const res = await updateCorporateLeadsEmailsSetting(emails);
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
                أدخل البريد الإلكتروني (أو أكثر من بريد مفصولين بفاصلة <code className="bg-surface-container-highest px-1 py-0.5 rounded text-primary">,</code>) الذي سيستقبل إشعارات عند إرسال طلب حجز شركات جديد.
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
                <textarea
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="admin@example.com, sales@example.com"
                  dir="ltr"
                  rows={3}
                  className="w-full p-4 rounded-xl border border-outline-variant/30 bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none resize-none font-medium placeholder:text-on-surface-variant/40"
                />
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
