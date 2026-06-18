"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Search } from "lucide-react";

export function FinancialsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [date, setDate] = useState(searchParams.get("date") || "");

  const handleApply = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (q) params.set("q", q);
    else params.delete("q");
    
    if (date) params.set("date", date);
    else params.delete("date");

    router.push(`?${params.toString()}`);
  }, [q, date, router, searchParams]);

  const handleReset = () => {
    setQ("");
    setDate("");
    router.push("?");
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface-container-low p-4 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-bold text-on-surface-variant">بحث برقم الحجز أو اسم العميل</label>
        <div className="relative">
          <input 
            type="text" 
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ادخل رقم الحجز أو الاسم..." 
            className="w-full rounded-xl border border-outline-variant/40 bg-white py-2.5 pl-4 pr-10 text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/50" />
        </div>
      </div>
      
      <div className="w-full sm:w-40">
        <label className="mb-1 block text-xs font-bold text-on-surface-variant">تاريخ الاستلام</label>
        <input 
          type="date" 
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-outline-variant/40 bg-white px-4 py-2.5 text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        />
      </div>

      <div className="flex gap-2 sm:flex-row">
        <button 
          onClick={handleApply}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90"
        >
          بحث
        </button>
        <button 
          onClick={handleReset}
          className="rounded-xl border border-outline-variant/40 bg-white px-4 py-2.5 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
