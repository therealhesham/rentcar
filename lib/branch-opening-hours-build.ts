import type { BranchDayHoursRow } from "@/lib/branch-opening-hours";

const DAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;

/** مواعيد ٨ ص – ١٢ ص (منتصف الليل ≈ 23:59)، الجمعة ٤ م – ١٢ ص */
export function buildBranchHours0800ToMidnightJson(): string {
  const days: Record<string, BranchDayHoursRow> = {};
  for (const k of DAY_KEYS) {
    if (k === "5") {
      days[k] = { open: "16:00", close: "23:59" };
    } else {
      days[k] = { open: "08:00", close: "23:59" };
    }
  }
  return JSON.stringify({ days });
}

/** 24/7 — null = بدون تقييد في الواجهة والحجز */
export function buildBranchHours24x7Json(): null {
  return null;
}

export const BRANCH_OPENING_HOURS_SHEET_RULES: {
  label: string;
  match: (b: { name: string; slug: string }) => boolean;
  openingHoursJson: string | null;
}[] = [
  {
    label: "الرياض (الفرع الرئيسي)",
    match: (b) =>
      b.slug === "main" || /الرئيسي/i.test(b.name) || /رياض/i.test(b.name),
    openingHoursJson: buildBranchHours24x7Json(),
  },
  {
    label: "العزيزية",
    match: (b) => b.slug === "aziziyah" || /العزيزية/i.test(b.name),
    openingHoursJson: buildBranchHours0800ToMidnightJson(),
  },
  {
    label: "العنبرية",
    match: (b) =>
      b.slug === "anbryiah" || /العنبرية|عنبرية/i.test(b.name),
    openingHoursJson: buildBranchHours0800ToMidnightJson(),
  },
  {
    label: "ينبع — طريق الملك عبد العزيز",
    match: (b) =>
      b.slug === "king-abdelziz-rd" ||
      /الملك عبد|عبدالعزيز|عبد العزيز/i.test(b.name),
    openingHoursJson: buildBranchHours0800ToMidnightJson(),
  },
  {
    label: "تبوك",
    match: (b) => b.slug === "tabuk" || /^تبوك$/i.test(b.name.trim()),
    openingHoursJson: buildBranchHours0800ToMidnightJson(),
  },
  {
    label: "فلسطين الصحافة",
    match: (b) =>
      b.slug === "palastine-sehaba" || /فلسطين|الصحافة/i.test(b.name),
    openingHoursJson: buildBranchHours0800ToMidnightJson(),
  },
  {
    label: "الاجاويد",
    match: (b) => b.slug === "ajawed" || /الاجاويد|أجاويد/i.test(b.name),
    openingHoursJson: buildBranchHours0800ToMidnightJson(),
  },
];
