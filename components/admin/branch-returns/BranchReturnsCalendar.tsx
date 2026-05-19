"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  buildCalendarMonthGrid,
  formatMonthTitleAr,
  shiftYearMonth,
} from "@/lib/calendar-month-grid";

const WEEKDAYS_AR = ["أحد", "إثن", "ثلث", "أرب", "خمي", "جمع", "سبت"] as const;

type ViewMode = "day" | "month";

type Props = {
  yearMonth: string;
  selectedYmd: string;
  todayYmd: string;
  viewMode: ViewMode;
  returnCounts: Record<string, number>;
  branchQuery: string;
};

function buildHref(
  basePath: string,
  params: { view: ViewMode; date: string; month: string; branchQuery: string },
): string {
  const sp = new URLSearchParams();
  sp.set("view", params.view);
  sp.set("date", params.date);
  sp.set("month", params.month);
  if (params.branchQuery) sp.set("branch", params.branchQuery);
  return `${basePath}?${sp.toString()}`;
}

export function BranchReturnsCalendar({
  yearMonth,
  selectedYmd,
  todayYmd,
  viewMode,
  returnCounts,
  branchQuery,
}: Props) {
  const router = useRouter();
  const basePath = "/admin/branch-returns";
  const cells = useMemo(() => buildCalendarMonthGrid(yearMonth), [yearMonth]);
  const monthTotal = useMemo(
    () => Object.values(returnCounts).reduce((s, n) => s + n, 0),
    [returnCounts],
  );

  function navigate(href: string) {
    router.push(href);
  }

  const todayHref = buildHref(basePath, {
    view: "day",
    date: todayYmd,
    month: todayYmd.slice(0, 7),
    branchQuery,
  });

  const monthHref = buildHref(basePath, {
    view: "month",
    date: selectedYmd,
    month: yearMonth,
    branchQuery,
  });

  const prevMonth = shiftYearMonth(yearMonth, -1);
  const nextMonth = shiftYearMonth(yearMonth, 1);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e8dcc8]/50 bg-gradient-to-br from-white via-[#faf8f5] to-[#f3ebe0] shadow-[0_8px_40px_-12px_rgba(0,55,73,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8dcc8]/40 bg-[#003749]/[0.03] px-3 py-2.5 sm:px-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a7f6e]">
            تقويم المرتجعات
          </p>
          <p className="text-base font-extrabold leading-tight tracking-tight text-[#003749]">
            {formatMonthTitleAr(yearMonth)}
          </p>
          <p className="text-[11px] font-medium text-on-surface-variant">
            <span className="font-bold tabular-nums text-[#003749]">{monthTotal}</span> مرتجع
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate(todayHref)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
              viewMode === "day" && selectedYmd === todayYmd
                ? "bg-[#003749] text-white shadow-md shadow-[#003749]/20"
                : "border border-[#c9a356]/40 bg-white/90 text-[#003749] hover:border-[#dbb878]/60 hover:bg-[#fff9f0]"
            }`}
          >
            اليوم
          </button>
          <button
            type="button"
            onClick={() => navigate(monthHref)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
              viewMode === "month"
                ? "bg-[#dbb878] text-[#1c1b1b] shadow-md shadow-[#dbb878]/30"
                : "border border-[#c9a356]/40 bg-white/90 text-[#003749] hover:border-[#dbb878]/60 hover:bg-[#fff9f0]"
            }`}
          >
            الشهر
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 px-2.5 py-1.5 sm:px-3">
        <button
          type="button"
          onClick={() =>
            navigate(
              buildHref(basePath, {
                view: viewMode,
                date: selectedYmd,
                month: prevMonth,
                branchQuery,
              }),
            )
          }
          className="flex size-7 items-center justify-center rounded-lg border border-outline-variant/25 bg-white/80 text-[#003749] transition-colors hover:bg-[#003749]/5"
          aria-label="الشهر السابق"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() =>
            navigate(
              buildHref(basePath, {
                view: viewMode,
                date: todayYmd,
                month: yearMonth,
                branchQuery,
              }),
            )
          }
          className="text-[11px] font-bold text-primary underline-offset-2 hover:underline"
        >
          هذا الشهر
        </button>
        <button
          type="button"
          onClick={() =>
            navigate(
              buildHref(basePath, {
                view: viewMode,
                date: selectedYmd,
                month: nextMonth,
                branchQuery,
              }),
            )
          }
          className="flex size-7 items-center justify-center rounded-lg border border-outline-variant/25 bg-white/80 text-[#003749] transition-colors hover:bg-[#003749]/5"
          aria-label="الشهر التالي"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 px-2.5 pb-0.5 sm:px-3">
        {WEEKDAYS_AR.map((d) => (
          <div
            key={d}
            className="py-0.5 text-center text-[9px] font-bold text-[#8a7f6e]"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 px-2.5 pb-2.5 sm:px-3">
        {cells.map((cell) => {
          const count = returnCounts[cell.ymd] ?? 0;
          const isSelected = cell.ymd === selectedYmd && viewMode === "day";
          const isToday = cell.ymd === todayYmd;
          const dayNum = Number(cell.ymd.slice(8, 10));

          return (
            <button
              key={cell.ymd}
              type="button"
              disabled={!cell.inMonth}
              onClick={() => {
                if (!cell.inMonth) return;
                navigate(
                  buildHref(basePath, {
                    view: "day",
                    date: cell.ymd,
                    month: cell.ymd.slice(0, 7),
                    branchQuery,
                  }),
                );
              }}
              className={[
                "group relative flex min-h-[2.35rem] flex-col items-center justify-center gap-0.5 rounded-lg py-0.5 text-xs transition-all sm:min-h-[2.5rem]",
                cell.inMonth
                  ? "cursor-pointer hover:bg-white/90 hover:shadow-sm"
                  : "cursor-default opacity-0",
                isSelected
                  ? "bg-[#003749] text-white shadow-md shadow-[#003749]/20 ring-1 ring-[#dbb878]/80"
                  : isToday
                    ? "bg-[#fff9f0] ring-1 ring-[#dbb878]/50"
                    : count > 0
                      ? "bg-white/70"
                      : "bg-transparent",
              ].join(" ")}
            >
              <span
                className={[
                  "font-bold tabular-nums leading-none",
                  isSelected ? "text-white" : isToday ? "text-[#003749]" : "text-on-surface",
                  !cell.inMonth ? "invisible" : "",
                ].join(" ")}
              >
                {dayNum}
              </span>
              {cell.inMonth && count > 0 ? (
                <span
                  className={[
                    "flex min-w-[1.1rem] items-center justify-center rounded-full px-0.5 text-[9px] font-extrabold tabular-nums leading-none",
                    isSelected
                      ? "bg-[#dbb878] text-[#1c1b1b]"
                      : "bg-[#003749]/10 text-[#003749] group-hover:bg-[#003749]/15",
                  ].join(" ")}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
