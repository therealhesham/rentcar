"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  resetDeliveryDriverPassword,
  setDeliveryDriverActive,
} from "@/app/admin/delivery-driver-actions";

export function DeliveryDriverRowActions({
  driverId,
  isActive,
}: {
  driverId: number;
  isActive: boolean;
}) {
  const [toggleState, toggleAction, togglePending] = useActionState(setDeliveryDriverActive, null);
  const [pwState, pwAction, pwPending] = useActionState(resetDeliveryDriverPassword, null);
  const pwRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (pwState?.ok) pwRef.current?.reset();
  }, [pwState]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={toggleAction}>
        <input type="hidden" name="driverId" value={driverId} />
        <input type="hidden" name="isActive" value={String(!isActive)} />
        <button
          type="submit"
          disabled={togglePending}
          className="rounded-xl border border-outline-variant px-3 py-2 text-xs font-bold text-primary hover:bg-surface-container-low disabled:opacity-60"
        >
          {isActive ? "تعطيل" : "تفعيل"}
        </button>
      </form>

      <form ref={pwRef} action={pwAction} className="flex items-center gap-2">
        <input type="hidden" name="driverId" value={driverId} />
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="كلمة مرور جديدة"
          className="w-40 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs outline-none ring-primary/30 focus:ring-2"
        />
        <button
          type="submit"
          disabled={pwPending}
          className="rounded-xl border border-outline-variant px-3 py-2 text-xs font-bold text-primary hover:bg-surface-container-low disabled:opacity-60"
        >
          تغيير
        </button>
      </form>

      {toggleState?.error ? (
        <p className="w-full text-xs font-bold text-error">{toggleState.error}</p>
      ) : null}
      {pwState?.error ? <p className="w-full text-xs font-bold text-error">{pwState.error}</p> : null}
      {pwState?.ok ? (
        <p className="w-full text-xs font-bold text-primary">تم تغيير كلمة المرور.</p>
      ) : null}
    </div>
  );
}
