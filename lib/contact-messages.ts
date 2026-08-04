/** مفتاح SiteSetting لقائمة إيميلات إشعارات «تواصل معنا» (مفصولة بفاصلة). */
export const CONTACT_MESSAGES_EMAILS_KEY = "contact_messages_emails";

export type ContactMessageStatus = "NEW" | "READ" | "ARCHIVED";

export const CONTACT_MESSAGE_STATUS_LABELS: Record<ContactMessageStatus, string> = {
  NEW: "جديدة",
  READ: "مقروءة",
  ARCHIVED: "مؤرشفة",
};

export function isContactMessageStatus(v: string): v is ContactMessageStatus {
  return v === "NEW" || v === "READ" || v === "ARCHIVED";
}
