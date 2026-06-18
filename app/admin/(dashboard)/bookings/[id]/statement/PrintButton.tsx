"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-sm hover:opacity-95 print:hidden"
    >
      <Printer className="size-4" aria-hidden />
      طباعة الكشف
    </button>
  );
}
