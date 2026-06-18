"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { markBookingAsPaid } from "./actions";

export function RegisterBookingPaymentModal({ bookingId }: { bookingId: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(markBookingAsPaid, null);
  
  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <button 
        type="button" 
        onClick={() => setOpen(true)}
        className="rounded bg-[#003749] px-3 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-[#002735]"
      >
        تسجيل الدفع
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-outline-variant/20 bg-surface-container-low px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#003749]">تسجيل الدفع</h3>
                <p className="text-xs text-on-surface-variant">حجز رقم #{bookingId}</p>
              </div>
            </div>
            
            <form action={formAction} className="p-6">
              <input type="hidden" name="bookingId" value={bookingId} />
              
              <div className="space-y-4">
                <label className="block text-sm font-bold text-on-surface">
                  طريقة الدفع
                  <select name="paymentMethod" className="mt-2 w-full rounded-xl border border-outline-variant/40 bg-white px-4 py-3 text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/15" required>
                    <option value="CASH">كاش</option>
                    <option value="CARD">بطاقة</option>
                    <option value="MADA">مدى</option>
                    <option value="TABBY">تابي</option>
                    <option value="TAMARA">تمارا</option>
                  </select>
                </label>
              </div>

              {state?.error && (
                <p className="mt-4 text-xs font-bold text-red-600">{state.error}</p>
              )}

              <div className="mt-8 flex gap-3">
                <button type="submit" disabled={pending} className="flex-1 rounded-xl bg-[#003749] py-3 text-sm font-bold text-white transition-colors hover:bg-[#002735] disabled:opacity-50">
                  {pending ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "تأكيد الدفع"}
                </button>
                <button type="button" onClick={() => setOpen(false)} disabled={pending} className="flex-1 rounded-xl border border-outline-variant/40 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
