import type { Prisma } from "@prisma/client";

/**
 * أرشفة الحجوزات (`BookingRequest.isHidden`).
 *
 * الحجز المؤرشف يختفي عن العميل وعن لوحة الإدارة وعن كل الأقسام المالية، لكنه لا
 * يُحذف: سجله ودفتر حركاته يبقيان كما هما، ويظهر في تبويب «مؤرشفة» لمدير النظام.
 *
 * مصدر واحد للشرط حتى لا يفترق موضع عن آخر — تكراره يدوياً في كل استعلام هو ما
 * يجعل حجزاً مؤرشفاً يسقط من قائمة ويبقى في مجموع مالي، فتتناقض الأرقام.
 */
export const VISIBLE_BOOKINGS_WHERE = {
  isHidden: false,
} satisfies Prisma.BookingRequestWhereInput;

export const ARCHIVED_BOOKINGS_WHERE = {
  isHidden: true,
} satisfies Prisma.BookingRequestWhereInput;

/** شرط الرؤية حسب التبويب: «مؤرشفة» يعرض المخفي وحده، وما عداه يستبعده. */
export function bookingVisibilityWhere(archived: boolean): Prisma.BookingRequestWhereInput {
  return archived ? ARCHIVED_BOOKINGS_WHERE : VISIBLE_BOOKINGS_WHERE;
}
