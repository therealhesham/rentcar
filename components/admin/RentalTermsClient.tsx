"use client";

import { useActionState, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createRentalTerm,
  deleteRentalTerm,
  type TermFormState,
  updateRentalTerm,
} from "@/app/admin/rental-terms-actions";

export type TermRow = {
  id: number;
  titleAr: string;
  titleEn: string | null;
  bodyAr: string;
  bodyEn: string | null;
  sortOrder: number;
  isActive: boolean;
};

// ─── Shared Field ──────────────────────────────────────────────────────────

function TermFields({ term }: { term?: TermRow }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold text-on-surface-variant mb-1">
            العنوان (عربي) *
          </label>
          <input
            name="titleAr"
            required
            defaultValue={term?.titleAr ?? ""}
            className="w-full rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            placeholder="مثال: شروط الاستخدام"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-on-surface-variant mb-1">
            العنوان (English)
          </label>
          <input
            name="titleEn"
            defaultValue={term?.titleEn ?? ""}
            className="w-full rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            placeholder="Example: Terms of Use"
            dir="ltr"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold text-on-surface-variant mb-1">
            النص (عربي) *
          </label>
          <textarea
            name="bodyAr"
            required
            rows={5}
            defaultValue={term?.bodyAr ?? ""}
            className="w-full rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary resize-y"
            placeholder="اكتب نص الشرط هنا…"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-on-surface-variant mb-1">
            النص (English)
          </label>
          <textarea
            name="bodyEn"
            rows={5}
            defaultValue={term?.bodyEn ?? ""}
            className="w-full rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary resize-y"
            placeholder="Write the term text here…"
            dir="ltr"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-32">
          <label className="block text-xs font-bold text-on-surface-variant mb-1">
            الترتيب
          </label>
          <input
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={term?.sortOrder ?? 0}
            className="w-full rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            dir="ltr"
          />
        </div>

        {term && (
          <div className="flex items-center gap-2">
            <input
              type="hidden"
              name="isActive"
              value="0"
            />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                name="isActive"
                type="checkbox"
                value="1"
                defaultChecked={term.isActive}
                className="size-4 rounded border-outline-variant accent-primary"
              />
              <span className="text-sm font-semibold text-on-surface">مفعّل</span>
            </label>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Create Form ───────────────────────────────────────────────────────────

export function CreateTermForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createRentalTerm, null as TermFormState);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-extrabold text-on-primary shadow-sm hover:opacity-90 transition-opacity"
      >
        <Plus className="size-4" aria-hidden />
        إضافة شرط جديد
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-extrabold text-on-surface">إضافة شرط جديد</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-on-surface-variant hover:text-on-surface">
          <X className="size-5" />
        </button>
      </div>

      <form action={formAction} className="space-y-4">
        <TermFields />

        {state?.ok === false && (
          <p className="text-sm font-bold text-red-700" role="alert">{state.error}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-extrabold text-on-primary shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {pending ? "جاري الحفظ…" : "حفظ"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-container-low"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Edit Form (inline row) ────────────────────────────────────────────────

function EditTermForm({ term, onClose }: { term: TermRow; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(updateRentalTerm, null as TermFormState);

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <form action={formAction} className="space-y-4 pt-4 border-t border-outline-variant/30">
      <input type="hidden" name="id" value={term.id} />
      <TermFields term={term} />

      {state?.ok === false && (
        <p className="text-sm font-bold text-red-700" role="alert">{state.error}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-extrabold text-on-primary shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ التعديلات"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-container-low"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}

// ─── Delete Button ─────────────────────────────────────────────────────────

function DeleteTermButton({ id }: { id: number }) {
  const [state, formAction, pending] = useActionState(deleteRentalTerm, null as TermFormState);
  const [confirm, setConfirm] = useState(false);

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors"
      >
        <Trash2 className="size-3.5" aria-hidden />
        حذف
      </button>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {state?.ok === false && <span className="text-xs text-red-700">{state.error}</span>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "جاري الحذف…" : "تأكيد الحذف"}
      </button>
      <button
        type="button"
        onClick={() => setConfirm(false)}
        className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-low"
      >
        إلغاء
      </button>
    </form>
  );
}

// ─── Terms Table ───────────────────────────────────────────────────────────

export function RentalTermsTable({ terms }: { terms: TermRow[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (terms.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-low/30 py-12 text-center">
        <p className="text-sm font-semibold text-on-surface-variant">لا توجد شروط بعد — أضف أول شرط من الزر أعلاه.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-outline-variant/30 bg-surface-container-low/60">
            <th className="px-5 py-3.5 text-right text-xs font-extrabold uppercase tracking-wide text-on-surface-variant">#</th>
            <th className="px-5 py-3.5 text-right text-xs font-extrabold uppercase tracking-wide text-on-surface-variant">العنوان</th>
            <th className="hidden md:table-cell px-5 py-3.5 text-right text-xs font-extrabold uppercase tracking-wide text-on-surface-variant">الحالة</th>
            <th className="hidden sm:table-cell px-5 py-3.5 text-right text-xs font-extrabold uppercase tracking-wide text-on-surface-variant">الترتيب</th>
            <th className="px-5 py-3.5 text-right text-xs font-extrabold uppercase tracking-wide text-on-surface-variant">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/20">
          {terms.map((term) => (
            <>
              <tr key={term.id} className={`transition-colors hover:bg-surface-container-low/30 ${!term.isActive ? "opacity-60" : ""}`}>
                <td className="px-5 py-4 text-xs font-bold tabular-nums text-on-surface-variant">{term.id}</td>
                <td className="px-5 py-4">
                  <div className="font-bold text-on-surface">{term.titleAr}</div>
                  {term.titleEn && (
                    <div className="text-xs text-on-surface-variant mt-0.5" dir="ltr">{term.titleEn}</div>
                  )}
                </td>
                <td className="hidden md:table-cell px-5 py-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    term.isActive
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {term.isActive ? "مفعّل" : "معطّل"}
                  </span>
                </td>
                <td className="hidden sm:table-cell px-5 py-4 tabular-nums text-on-surface-variant text-xs font-semibold">{term.sortOrder}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Expand/collapse body preview */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === term.id ? null : term.id)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors"
                    >
                      {expandedId === term.id ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      {expandedId === term.id ? "إخفاء" : "عرض"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(editingId === term.id ? null : term.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      تعديل
                    </button>
                    <DeleteTermButton id={term.id} />
                  </div>
                </td>
              </tr>

              {/* Expanded body preview */}
              {expandedId === term.id && (
                <tr key={`${term.id}-preview`}>
                  <td colSpan={5} className="bg-surface-container-low/40 px-8 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-wide text-on-surface-variant mb-1">عربي</p>
                        <p className="text-sm leading-relaxed text-on-surface whitespace-pre-wrap">{term.bodyAr}</p>
                      </div>
                      {term.bodyEn && (
                        <div dir="ltr">
                          <p className="text-[11px] font-extrabold uppercase tracking-wide text-on-surface-variant mb-1">English</p>
                          <p className="text-sm leading-relaxed text-on-surface whitespace-pre-wrap">{term.bodyEn}</p>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {/* Inline edit form */}
              {editingId === term.id && (
                <tr key={`${term.id}-edit`}>
                  <td colSpan={5} className="bg-surface-container-low/40 px-8 py-4">
                    <EditTermForm term={term} onClose={() => setEditingId(null)} />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
