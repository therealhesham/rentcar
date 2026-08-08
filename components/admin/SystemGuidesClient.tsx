"use client";

import {
  ChevronDown,
  Download,
  FileText,
  FolderPlus,
  Image as ImageIcon,
  Pencil,
  Plus,
  PlayCircle,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createGuideSection,
  deleteGuideSection,
  deleteSystemGuide,
  type GuideFormState,
  updateGuideSection,
  updateSystemGuide,
} from "@/app/admin/system-guide-actions";
import {
  formatFileSize,
  SYSTEM_GUIDE_ACCEPT,
  SYSTEM_GUIDE_MAX_BYTES,
  type SystemGuideKindValue,
} from "@/lib/system-guides";

export type GuideRow = {
  id: number;
  sectionId: number;
  title: string;
  description: string | null;
  kind: SystemGuideKindValue;
  fileUrl: string;
  originalFileName: string;
  sizeBytes: number;
  sortOrder: number;
  isActive: boolean;
};

export type GuideSectionRow = {
  id: number;
  title: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  guides: GuideRow[];
};

const KIND_LABEL: Record<SystemGuideKindValue, string> = {
  VIDEO: "فيديو",
  IMAGE: "صورة",
  PDF: "ملف PDF",
};

function KindIcon({ kind, className }: { kind: SystemGuideKindValue; className?: string }) {
  if (kind === "VIDEO") return <PlayCircle className={className} aria-hidden />;
  if (kind === "IMAGE") return <ImageIcon className={className} aria-hidden />;
  return <FileText className={className} aria-hidden />;
}

const BTN_PRIMARY =
  "inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-on-primary shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60";
const BTN_GHOST =
  "inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low";
const FIELD =
  "w-full rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary";
const LABEL = "mb-1 block text-xs font-bold text-on-surface-variant";

// ─── معاينة الشرح ────────────────────────────────────────────────────────────

function GuidePreview({ guide }: { guide: GuideRow }) {
  if (guide.kind === "VIDEO") {
    return (
      <video
        controls
        preload="metadata"
        className="w-full rounded-xl bg-black"
        src={guide.fileUrl}
      >
        متصفحك لا يدعم تشغيل الفيديو.
      </video>
    );
  }

  if (guide.kind === "IMAGE") {
    return (
      <a href={guide.fileUrl} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={guide.fileUrl}
          alt={guide.title}
          className="w-full rounded-xl border border-outline-variant/40"
        />
      </a>
    );
  }

  return (
    <object
      data={guide.fileUrl}
      type="application/pdf"
      className="h-[70vh] w-full rounded-xl border border-outline-variant/40"
    >
      <p className="p-4 text-sm text-on-surface-variant">
        تعذّر عرض الملف داخل الصفحة —{" "}
        <a href={guide.fileUrl} target="_blank" rel="noreferrer" className="font-bold text-primary">
          افتحه في تبويب جديد
        </a>
        .
      </p>
    </object>
  );
}

// ─── بطاقة شرح ───────────────────────────────────────────────────────────────

function GuideCard({
  guide,
  sections,
  canManage,
}: {
  guide: GuideRow;
  sections: GuideSectionRow[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <li
      className={`rounded-xl border border-outline-variant/40 bg-white ${
        guide.isActive ? "" : "opacity-60"
      }`}
    >
      <div className="flex flex-wrap items-start gap-3 p-4">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <KindIcon kind={guide.kind} className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-right text-sm font-extrabold text-on-surface hover:text-primary"
          >
            {guide.title}
          </button>
          {guide.description ? (
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-on-surface-variant">
              {guide.description}
            </p>
          ) : null}
          <p className="mt-1.5 text-xs font-semibold text-on-surface-variant">
            {KIND_LABEL[guide.kind]} · {formatFileSize(guide.sizeBytes)}
            {canManage ? ` · ترتيب ${guide.sortOrder}` : ""}
            {canManage && !guide.isActive ? " · مخفي" : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-low"
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
            {open ? "إخفاء" : "عرض"}
          </button>
          <a
            href={guide.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-low"
          >
            <Download className="size-3.5" aria-hidden />
            تنزيل
          </a>
          {canManage ? (
            <>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-low"
              >
                <Pencil className="size-3.5" aria-hidden />
                تعديل
              </button>
              <DeleteButton
                action={deleteSystemGuide}
                id={guide.id}
                label="حذف"
                confirmLabel="تأكيد حذف الشرح"
              />
            </>
          ) : null}
        </div>
      </div>

      {open ? <div className="px-4 pb-4">{<GuidePreview guide={guide} />}</div> : null}

      {canManage && editing ? (
        <EditGuideForm
          guide={guide}
          sections={sections}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </li>
  );
}

// ─── نموذج تعديل شرح ─────────────────────────────────────────────────────────

function EditGuideForm({
  guide,
  sections,
  onClose,
}: {
  guide: GuideRow;
  sections: GuideSectionRow[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateSystemGuide,
    null as GuideFormState,
  );

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <form
      action={formAction}
      className="space-y-4 border-t border-outline-variant/30 p-4"
    >
      <input type="hidden" name="id" value={guide.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL}>عنوان الشرح *</label>
          <input name="title" required defaultValue={guide.title} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>القسم</label>
          <select name="sectionId" defaultValue={guide.sectionId} className={FIELD}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={LABEL}>الوصف</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={guide.description ?? ""}
          className={`${FIELD} resize-y leading-relaxed`}
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-32">
          <label className={LABEL}>الترتيب</label>
          <input
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={guide.sortOrder}
            className={FIELD}
            dir="ltr"
          />
        </div>
        <input type="hidden" name="isActive" value="0" />
        <label className="flex cursor-pointer select-none items-center gap-2 pb-2.5">
          <input
            name="isActive"
            type="checkbox"
            value="1"
            defaultChecked={guide.isActive}
            className="size-4 rounded border-outline-variant accent-primary"
          />
          <span className="text-sm font-semibold text-on-surface">ظاهر للموظفين</span>
        </label>
      </div>

      {state?.ok === false ? (
        <p className="text-sm font-bold text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={BTN_PRIMARY}>
          {pending ? "جاري الحفظ…" : "حفظ التعديلات"}
        </button>
        <button type="button" onClick={onClose} className={BTN_GHOST}>
          إلغاء
        </button>
      </div>
    </form>
  );
}

// ─── زر حذف بتأكيد ───────────────────────────────────────────────────────────

function DeleteButton({
  action,
  id,
  label,
  confirmLabel,
}: {
  action: (prev: GuideFormState, formData: FormData) => Promise<GuideFormState>;
  id: number;
  label: string;
  confirmLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null as GuideFormState);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
      >
        <Trash2 className="size-3.5" aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {state?.ok === false ? (
        <span className="text-xs font-bold text-red-700">{state.error}</span>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "جاري الحذف…" : confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-low"
      >
        إلغاء
      </button>
    </form>
  );
}

// ─── رفع شرح جديد ────────────────────────────────────────────────────────────

const MAX_ANY_BYTES = Math.max(...Object.values(SYSTEM_GUIDE_MAX_BYTES));

function UploadGuideForm({
  sectionId,
  onDone,
}: {
  sectionId: number;
  onDone: () => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("اختر ملفاً للرفع.");
      return;
    }
    if (file.size > MAX_ANY_BYTES) {
      setError(`حجم الملف يتجاوز الحد المسموح (${formatFileSize(MAX_ANY_BYTES)}).`);
      return;
    }

    setError(null);
    setProgress(0);

    // XHR وليس fetch: هو الطريق الوحيد لقراءة تقدّم الرفع، ومهم لفيديو بعشرات الميجابايت.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/system-guides/upload");
    xhr.upload.addEventListener("progress", (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    });
    xhr.addEventListener("load", () => {
      setProgress(null);
      let payload: { error?: string } = {};
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        /* رد غير JSON — نقع على الرسالة العامة أدناه */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        form.reset();
        onDone();
        router.refresh();
        return;
      }
      setError(payload.error ?? "فشل رفع الملف.");
    });
    xhr.addEventListener("error", () => {
      setProgress(null);
      setError("انقطع الاتصال أثناء الرفع.");
    });
    xhr.send(data);
  }

  const uploading = progress !== null;

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low/30 p-4"
    >
      <input type="hidden" name="sectionId" value={sectionId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL}>عنوان الشرح *</label>
          <input name="title" required className={FIELD} placeholder="مثال: كيفية إنشاء حجز مباشر" />
        </div>
        <div>
          <label className={LABEL}>الملف *</label>
          <input
            name="file"
            type="file"
            required
            accept={SYSTEM_GUIDE_ACCEPT}
            className="w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm file:ml-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-on-primary"
          />
          <p className="mt-1 text-xs text-on-surface-variant">
            فيديو حتى {formatFileSize(SYSTEM_GUIDE_MAX_BYTES.VIDEO)}، PDF حتى{" "}
            {formatFileSize(SYSTEM_GUIDE_MAX_BYTES.PDF)}، صورة حتى{" "}
            {formatFileSize(SYSTEM_GUIDE_MAX_BYTES.IMAGE)}.
          </p>
        </div>
      </div>

      <div>
        <label className={LABEL}>الوصف</label>
        <textarea
          name="description"
          rows={2}
          className={`${FIELD} resize-y leading-relaxed`}
          placeholder="نبذة قصيرة عن محتوى الشرح…"
        />
      </div>

      <div className="w-32">
        <label className={LABEL}>الترتيب</label>
        <input
          name="sortOrder"
          type="number"
          min={0}
          max={999}
          defaultValue={0}
          className={FIELD}
          dir="ltr"
        />
      </div>

      {uploading ? (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-outline-variant/30">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs font-bold text-on-surface-variant">
            جاري الرفع… {progress}%
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm font-bold text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={uploading} className={BTN_PRIMARY}>
          <Upload className="size-4" aria-hidden />
          {uploading ? "جاري الرفع…" : "رفع الشرح"}
        </button>
        <button type="button" onClick={onDone} disabled={uploading} className={BTN_GHOST}>
          إلغاء
        </button>
      </div>
    </form>
  );
}

// ─── نموذج قسم (إضافة/تعديل) ─────────────────────────────────────────────────

function SectionForm({
  section,
  onClose,
}: {
  section?: GuideSectionRow;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    section ? updateGuideSection : createGuideSection,
    null as GuideFormState,
  );

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5"
    >
      {section ? <input type="hidden" name="id" value={section.id} /> : null}

      <div className="flex items-center justify-between">
        <h3 className="text-base font-extrabold text-on-surface">
          {section ? "تعديل القسم" : "قسم جديد"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-on-surface-variant hover:text-on-surface"
        >
          <X className="size-5" />
        </button>
      </div>

      <div>
        <label className={LABEL}>عنوان القسم *</label>
        <input
          name="title"
          required
          defaultValue={section?.title ?? ""}
          className={FIELD}
          placeholder="مثال: الحجوزات"
        />
      </div>

      <div>
        <label className={LABEL}>الوصف</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={section?.description ?? ""}
          className={`${FIELD} resize-y leading-relaxed`}
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-32">
          <label className={LABEL}>الترتيب</label>
          <input
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={section?.sortOrder ?? 0}
            className={FIELD}
            dir="ltr"
          />
        </div>
        {section ? (
          <>
            <input type="hidden" name="isActive" value="0" />
            <label className="flex cursor-pointer select-none items-center gap-2 pb-2.5">
              <input
                name="isActive"
                type="checkbox"
                value="1"
                defaultChecked={section.isActive}
                className="size-4 rounded border-outline-variant accent-primary"
              />
              <span className="text-sm font-semibold text-on-surface">ظاهر للموظفين</span>
            </label>
          </>
        ) : null}
      </div>

      {state?.ok === false ? (
        <p className="text-sm font-bold text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={BTN_PRIMARY}>
          {pending ? "جاري الحفظ…" : section ? "حفظ التعديلات" : "إضافة القسم"}
        </button>
        <button type="button" onClick={onClose} className={BTN_GHOST}>
          إلغاء
        </button>
      </div>
    </form>
  );
}

// ─── قسم واحد ────────────────────────────────────────────────────────────────

function SectionCard({
  section,
  allSections,
  canManage,
  defaultOpen,
}: {
  section: GuideSectionRow;
  allSections: GuideSectionRow[];
  canManage: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // البحث يفتح الأقسام المطابقة تلقائياً بدل ما المستخدم يفتحها واحداً واحداً — ضبط
  // الحالة أثناء الرسم عند تغيّر الـ prop (وليس داخل effect) تفادياً لرسمة زائدة.
  const [prevDefaultOpen, setPrevDefaultOpen] = useState(defaultOpen);
  if (prevDefaultOpen !== defaultOpen) {
    setPrevDefaultOpen(defaultOpen);
    setOpen(defaultOpen);
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-sm ${
        section.isActive ? "" : "opacity-70"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-outline-variant/20 bg-surface-container-low/40 px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-right"
        >
          <ChevronDown
            className={`size-5 shrink-0 text-on-surface-variant transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block text-base font-extrabold text-on-surface">
              {section.title}
              {canManage && !section.isActive ? (
                <span className="mr-2 text-xs font-bold text-on-surface-variant">(مخفي)</span>
              ) : null}
            </span>
            {section.description ? (
              <span className="mt-0.5 block text-sm text-on-surface-variant">
                {section.description}
              </span>
            ) : null}
          </span>
        </button>

        <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-extrabold text-primary">
          {section.guides.length} شرح
        </span>

        {canManage ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setUploading((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-low"
            >
              <Plus className="size-3.5" aria-hidden />
              شرح جديد
            </button>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-low"
            >
              <Pencil className="size-3.5" aria-hidden />
              تعديل
            </button>
            <DeleteButton
              action={deleteGuideSection}
              id={section.id}
              label="حذف القسم"
              confirmLabel="تأكيد حذف القسم وشروحاته"
            />
          </div>
        ) : null}
      </div>

      {canManage && editing ? (
        <div className="p-5 pb-0">
          <SectionForm section={section} onClose={() => setEditing(false)} />
        </div>
      ) : null}

      {open ? (
        <div className="space-y-4 p-5">
          {canManage && uploading ? (
            <UploadGuideForm sectionId={section.id} onDone={() => setUploading(false)} />
          ) : null}

          {section.guides.length === 0 ? (
            <p className="py-6 text-center text-sm font-semibold text-on-surface-variant">
              لا توجد شروحات في هذا القسم بعد.
            </p>
          ) : (
            <ul className="space-y-3">
              {section.guides.map((guide) => (
                <GuideCard
                  key={guide.id}
                  guide={guide}
                  sections={allSections}
                  canManage={canManage}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}

// ─── الجذر ───────────────────────────────────────────────────────────────────

export function SystemGuidesClient({
  sections,
  canManage,
  guidesCount,
}: {
  sections: GuideSectionRow[];
  canManage: boolean;
  guidesCount: number;
}) {
  const [query, setQuery] = useState("");
  const [addingSection, setAddingSection] = useState(false);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return sections;
    const hit = (text: string | null) => (text ?? "").toLowerCase().includes(q);
    return sections
      .map((s) => {
        // مطابقة عنوان القسم تُبقي كل شروحاته؛ غير كده نعرض الشروحات المطابقة وحدها.
        if (hit(s.title) || hit(s.description)) return s;
        return { ...s, guides: s.guides.filter((g) => hit(g.title) || hit(g.description)) };
      })
      .filter((s) => s.guides.length > 0);
  }, [sections, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في الشروحات…"
            className={`${FIELD} pr-10`}
          />
        </div>
        <span className="text-sm font-semibold text-on-surface-variant">
          {sections.length} قسم · {guidesCount} شرح
        </span>
        {canManage && !addingSection ? (
          <button type="button" onClick={() => setAddingSection(true)} className={BTN_PRIMARY}>
            <FolderPlus className="size-4" aria-hidden />
            قسم جديد
          </button>
        ) : null}
      </div>

      {canManage && addingSection ? (
        <SectionForm onClose={() => setAddingSection(false)} />
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-low/30 py-14 text-center">
          <p className="text-sm font-semibold text-on-surface-variant">
            {q
              ? "لا توجد نتائج مطابقة لبحثك."
              : canManage
                ? "لا توجد شروحات بعد — ابدأ بإضافة قسم ثم ارفع الشروحات بداخله."
                : "لم يُضف أي شرح بعد."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((section, i) => (
            <SectionCard
              key={section.id}
              section={section}
              allSections={sections}
              canManage={canManage}
              defaultOpen={q.length > 0 || i === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
