import { addDaysToYmd } from "@/lib/booking-calendar-ymd";

export type CalendarMonthCell = {
  ymd: string;
  inMonth: boolean;
};

/** أول يوم في الشهر بصيغة YYYY-MM */
export function yearMonthFromYmd(ymd: string): string {
  return ymd.slice(0, 7);
}

export function daysInCalendarMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

/** شبكة 6 أسابيع — الأحد أول عمود */
export function buildCalendarMonthGrid(yearMonth: string): CalendarMonthCell[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const firstYmd = `${yearMonth}-01`;
  const dim = daysInCalendarMonth(yearMonth);
  const lastYmd = `${yearMonth}-${String(dim).padStart(2, "0")}`;
  const startPad = new Date(`${firstYmd}T12:00:00.000Z`).getUTCDay();
  const cells: CalendarMonthCell[] = [];
  let cursor = addDaysToYmd(firstYmd, -startPad);
  for (let i = 0; i < 42; i++) {
    cells.push({
      ymd: cursor,
      inMonth: cursor >= firstYmd && cursor <= lastYmd,
    });
    cursor = addDaysToYmd(cursor, 1);
  }
  return cells;
}

export function formatMonthTitleAr(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("ar-SA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
