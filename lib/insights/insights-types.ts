/** أنواع صفحة «إحصائيات» (/admin/insights) — مشتركة بين طبقة الاستعلام والعرض. */

export const INSIGHTS_RANGES = [7, 30, 90] as const;
export type InsightsRange = (typeof INSIGHTS_RANGES)[number];

export const DEFAULT_INSIGHTS_RANGE: InsightsRange = 30;

/**
 * القسم الإداري الوحيد في الصفحة: من يفتح النظام أكثر. باقي الصفحة عن العملاء.
 * مصدره جدول `AdminPageView` لا `ActivityLog`.
 */
export type EmployeeUsageRow = {
  employeeId: number | null;
  label: string;
  isSuperAdmin: boolean;
  /** عدد فتحات الصفحات */
  views: number;
  /** عدد الجلسات (فاصل خمول ٣٠ دقيقة) */
  sessions: number;
  /** كم يوماً مختلفاً دخل فيه خلال الفترة */
  activeDays: number;
  /** كم صفحة مختلفة فتح */
  distinctPages: number;
  lastSeenAt: Date;
  topPageLabel: string;
  topPageViews: number;
  /** أوصاف الأجهزة التي دخل منها، الأكثر أولاً */
  devices: string[];
};

export type EmployeeUsage = {
  rows: EmployeeUsageRow[];
  totalViews: number;
  activeEmployees: number;
};

export type BreakdownRow = {
  label: string;
  count: number;
  /** نسبة من الإجمالي، 0–1 */
  share: number;
};

export type PeakHours = {
  /** 7×24 — الخلية [يوم][ساعة] بعدد الزيارات */
  grid: number[][];
  /** إجمالي كل ساعة عبر الأسبوع، 24 عنصراً */
  byHour: number[];
  /** أعلى قيمة خلية — مرجع تدرّج اللون */
  maxCell: number;
  /** أكثر ساعة ازدحاماً عبر كل الأيام */
  peakHour: number | null;
  peakHourCount: number;
  /** أكثر خلية (يوم + ساعة) ازدحاماً */
  peakWeekday: number | null;
  peakWeekdayHour: number | null;
  peakCellCount: number;
  /** أهدأ ساعة لها زيارات — مفيدة لجدولة الصيانة */
  quietHour: number | null;
};

export type PageUsageRow = {
  /** القالب المُجمَّع عليه، مثل `/fleet/:slug` */
  template: string;
  label: string;
  /** مسار حقيقي شوهد فعلاً — هذا ما يُفتح في المعاينة */
  sampleUrl: string;
  views: number;
  /** عدد الزوّار المختلفين */
  visitors: number;
  share: number;
};

export type ExitPageRow = {
  template: string;
  label: string;
  sampleUrl: string;
  /** عدد الجلسات التي انتهت عند هذه الصفحة */
  exits: number;
  views: number;
  /** exits ÷ views — كم مرة من كل زيارة كانت هي المحطة الأخيرة، 0–1 */
  exitRate: number;
  /** جلسات صفحة واحدة فقط انتهت هنا (دخل وخرج فوراً) */
  bounces: number;
};

/** إحصاءات زوّار الموقع العام — جسم الصفحة. */
export type VisitorInsights = {
  isEmpty: boolean;
  /** تجاوز عدد الصفوف السقف فاقتُصر التحليل على الأحدث */
  truncated: boolean;
  totalViews: number;
  totalSessions: number;
  uniqueVisitors: number;
  /** متوسط عدد الصفحات في الجلسة */
  pagesPerSession: number;
  devices: BreakdownRow[];
  operatingSystems: BreakdownRow[];
  browsers: BreakdownRow[];
  peak: PeakHours;
  topPages: PageUsageRow[];
  exitPages: ExitPageRow[];
};
