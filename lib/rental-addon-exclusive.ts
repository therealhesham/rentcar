/** صف إضافة للتحقق من التعارض (مجموعة «إما/أو»). */
export type RentalAddonExclusiveRow = {
  id: number;
  titleAr: string;
  exclusiveGroup: string | null;
};

const EXCLUSIVE_GROUP_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeRentalAddonExclusiveGroup(raw: string): string | null {
  const v = raw.trim().toLowerCase().slice(0, 64);
  if (!v) return null;
  if (!EXCLUSIVE_GROUP_RE.test(v)) return null;
  return v;
}

/**
 * لا يُسمح باختيار أكثر من إضافة واحدة لكل `exclusiveGroup` غير فارغ.
 */
export function validateRentalAddonExclusiveSelection(
  addons: RentalAddonExclusiveRow[],
): { ok: true } | { ok: false; error: string } {
  const byGroup = new Map<string, RentalAddonExclusiveRow[]>();
  for (const a of addons) {
    const g = a.exclusiveGroup?.trim();
    if (!g) continue;
    const list = byGroup.get(g) ?? [];
    list.push(a);
    byGroup.set(g, list);
  }
  for (const list of byGroup.values()) {
    if (list.length <= 1) continue;
    const names = list.map((x) => x.titleAr).join(" أو ");
    return {
      ok: false,
      error: `لا يمكن اختيار أكثر من خيار واحد من: ${names}.`,
    };
  }
  return { ok: true };
}
