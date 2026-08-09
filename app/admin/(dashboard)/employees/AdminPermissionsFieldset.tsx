"use client";

import {
  ADMIN_CAPABILITY_PERMISSIONS,
  ADMIN_PAGE_PERMISSIONS,
  ADMIN_PERMISSION_LABELS,
} from "@/lib/admin-permissions";

type Props = {
  /** الصلاحيات المفعّلة حاليًا (فورم التعديل) — فارغة افتراضيًا لفورم الإضافة. */
  currentPermissions?: Set<string>;
};

/** تجميع صلاحيات الصفحات حسب قسم القائمة الجانبية — بترتيب أول ظهور. */
function groupPermissions() {
  const groups = new Map<string, typeof ADMIN_PAGE_PERMISSIONS>();
  for (const perm of ADMIN_PAGE_PERMISSIONS) {
    const list = groups.get(perm.groupLabel) ?? [];
    list.push(perm);
    groups.set(perm.groupLabel, list);
  }
  return [...groups.entries()];
}

const checkboxCls =
  "flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant/40 bg-white p-2.5 text-sm hover:bg-surface-container-low";

export function AdminPermissionsFieldset({ currentPermissions }: Props) {
  const current = currentPermissions ?? new Set<string>();
  const groups = groupPermissions();

  return (
    <div className="space-y-3">
      {groups.map(([groupLabel, perms]) => (
        <details key={groupLabel} className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest" open={groupLabel === "الرئيسية"}>
          <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-bold text-on-surface">
            {groupLabel} <span className="font-normal text-on-surface-variant">({perms.length})</span>
          </summary>
          <div className="grid gap-2 border-t border-outline-variant/30 p-3 sm:grid-cols-2">
            {perms.map((perm) => (
              <label key={perm.href} className={checkboxCls}>
                <input
                  type="checkbox"
                  name="permissions"
                  value={perm.href}
                  defaultChecked={current.has(perm.href)}
                  className="h-4 w-4 rounded border-outline text-primary focus:ring-primary"
                />
                <span className="font-medium text-on-surface">{perm.label}</span>
              </label>
            ))}
          </div>
        </details>
      ))}

      <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
        <p className="mb-2 px-1 text-sm font-bold text-on-surface">قدرات خاصة</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ADMIN_CAPABILITY_PERMISSIONS.map((capability) => (
            <label key={capability} className={checkboxCls}>
              <input
                type="checkbox"
                name="permissions"
                value={capability}
                defaultChecked={current.has(capability)}
                className="h-4 w-4 rounded border-outline text-primary focus:ring-primary"
              />
              <span className="font-medium text-on-surface">
                {ADMIN_PERMISSION_LABELS[capability]}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
