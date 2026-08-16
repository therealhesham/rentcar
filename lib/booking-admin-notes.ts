export type BookingAdminNoteItem = {
  id: string;
  text: string;
  createdBy: string;
  createdAt: string;
};

function normalizeAuthorEmail(raw?: string | null): string {
  const trimmed = String(raw ?? "").trim();
  if (trimmed && trimmed.includes("@")) return trimmed;
  return process.env.ADMIN_EMAIL?.trim() || "admin@rentcar.com";
}

/** تحليل حقل adminNotes من داتابيز إلى مصفوفة ملاحظات متسلسلة */
export function parseAdminNotes(raw?: string | null): BookingAdminNoteItem[] {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (item): item is BookingAdminNoteItem =>
            item != null && typeof item === "object" && typeof item.text === "string",
        )
        .map((item) => ({
          id: String(item.id || Math.random()),
          text: String(item.text).trim(),
          createdBy: normalizeAuthorEmail(item.createdBy),
          createdAt: String(item.createdAt || new Date().toISOString()),
        }));
    }
  } catch {
    // تحويل أي نص قديم عادي إلى ملاحظة مفردة للتوافق
    return [
      {
        id: "legacy-1",
        text: trimmed,
        createdBy: normalizeAuthorEmail(),
        createdAt: new Date().toISOString(),
      },
    ];
  }
  return [];
}

/** إضافة ملاحظة جديدة لقائمة الملاحظات وإعادة تحويلها لـ JSON */
export function appendAdminNote(
  existingRaw: string | null | undefined,
  text: string,
  createdBy: string,
): string {
  const existing = parseAdminNotes(existingRaw);
  const newNote: BookingAdminNoteItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: text.trim(),
    createdBy: normalizeAuthorEmail(createdBy),
    createdAt: new Date().toISOString(),
  };
  // الحفظ الأحدث في البداية
  const updated = [newNote, ...existing];
  return JSON.stringify(updated);
}

/** حذف ملاحظة من قائمة الملاحظات وإعادة تحويلها لـ JSON */
export function deleteAdminNote(
  existingRaw: string | null | undefined,
  noteId: string,
): string {
  const existing = parseAdminNotes(existingRaw);
  const updated = existing.filter((item) => item.id !== noteId);
  return JSON.stringify(updated);
}
