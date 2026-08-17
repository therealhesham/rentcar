import { WEEKDAY_LABELS, hourLabel, hourRangeLabel } from "@/lib/insights/insights-time";
import type { PeakHours } from "@/lib/insights/insights-types";
import { InsightsEmpty } from "@/components/admin/insights/InsightsShell";

/**
 * تدرّج اللون بالجذر التربيعي لا خطّياً: الحركة عبر ساعات اليوم موزّعة بذيل طويل،
 * والتدرّج الخطّي يجعل كل الخلايا شبه بيضاء عدا خلية الذروة وحدها.
 */
function cellStyle(count: number, max: number): React.CSSProperties {
  if (count === 0) return { backgroundColor: "rgb(244 244 245)" };
  const intensity = Math.sqrt(count / max);
  return {
    backgroundColor: `rgba(0, 55, 73, ${0.12 + intensity * 0.78})`,
    color: intensity > 0.55 ? "#fff" : "#1c1b1b",
  };
}

/** ساعات العرض: نبدأ من ٦ صباحاً وندور ٢٤ ساعة — الليل في الطرف حيث ينتمي. */
const HOURS = Array.from({ length: 24 }, (_, i) => (i + 6) % 24);

export function InsightsPeakHours({ peak }: { peak: PeakHours }) {
  if (peak.maxCell === 0) {
    return <InsightsEmpty>لا توجد زيارات في هذه الفترة لرسم أوقات الذروة.</InsightsEmpty>;
  }

  const maxHourTotal = Math.max(...peak.byHour);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-container-low/60 p-3">
          <p className="text-xs font-bold text-on-surface-variant">أكثر ساعة ازدحاماً</p>
          <p className="mt-1 text-lg font-extrabold text-on-surface">
            {peak.peakHour != null ? hourRangeLabel(peak.peakHour) : "—"}
          </p>
          <p className="text-xs text-on-surface-variant">{peak.peakHourCount} زيارة</p>
        </div>
        <div className="rounded-xl bg-surface-container-low/60 p-3">
          <p className="text-xs font-bold text-on-surface-variant">أعلى وقت في الأسبوع</p>
          <p className="mt-1 text-lg font-extrabold text-on-surface">
            {peak.peakWeekday != null && peak.peakWeekdayHour != null
              ? `${WEEKDAY_LABELS[peak.peakWeekday]} — ${hourRangeLabel(peak.peakWeekdayHour)}`
              : "—"}
          </p>
          <p className="text-xs text-on-surface-variant">{peak.peakCellCount} زيارة</p>
        </div>
        <div className="rounded-xl bg-surface-container-low/60 p-3">
          <p className="text-xs font-bold text-on-surface-variant">أهدأ ساعة (بها حركة)</p>
          <p className="mt-1 text-lg font-extrabold text-on-surface">
            {peak.quietHour != null ? hourRangeLabel(peak.quietHour) : "—"}
          </p>
          <p className="text-xs text-on-surface-variant">مناسبة للصيانة والتحديثات</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-on-surface">الإجمالي حسب الساعة</p>
        <div className="flex items-end gap-1" dir="ltr">
          {HOURS.map((h) => {
            const count = peak.byHour[h]!;
            return (
              <div key={h} className="group flex flex-1 flex-col items-center gap-1">
                <div className="flex h-24 w-full items-end">
                  <div
                    className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
                    style={{
                      height: `${maxHourTotal > 0 ? Math.max((count / maxHourTotal) * 100, count > 0 ? 3 : 0) : 0}%`,
                    }}
                    title={`${hourRangeLabel(h)} — ${count} زيارة`}
                  />
                </div>
                {/* كل ثالث عمود فقط: ٢٤ تسمية متجاورة تتراكب على شاشة الجوال */}
                <span className="h-3 text-[9px] font-medium text-on-surface-variant">
                  {h % 3 === 0 ? hourLabel(h) : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-on-surface">خريطة الأسبوع (يوم × ساعة)</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-[2px]" dir="ltr">
            <thead>
              <tr>
                <th className="w-14" />
                {HOURS.map((h) => (
                  <th
                    key={h}
                    className="text-[9px] font-medium text-on-surface-variant"
                    scope="col"
                  >
                    {h % 3 === 0 ? hourLabel(h) : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {peak.grid.map((row, weekday) => (
                <tr key={weekday}>
                  <th
                    scope="row"
                    className="whitespace-nowrap pe-2 text-end text-[11px] font-bold text-on-surface-variant"
                    dir="rtl"
                  >
                    {WEEKDAY_LABELS[weekday]}
                  </th>
                  {HOURS.map((h) => (
                    <td
                      key={h}
                      className="h-7 rounded text-center text-[10px] font-bold tabular-nums"
                      style={cellStyle(row[h]!, peak.maxCell)}
                      title={`${WEEKDAY_LABELS[weekday]} ${hourRangeLabel(h)} — ${row[h]!} زيارة`}
                    >
                      {row[h]! > 0 ? row[h]! : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">كل الأوقات بتوقيت الرياض.</p>
      </div>
    </div>
  );
}
