"use server";

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin-access";
import { adminScope } from "@/lib/admin-scope";
import { confirmInterBranchReturn } from "@/lib/branch-return-transfer";
import { logBookingEvent } from "@/lib/booking-audit";

export async function confirmInterBranchReturnAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingRequestId = Number(formData.get("bookingRequestId"));
  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "رقم الطلب غير صالح." };
  }

  try {
    const result = await confirmInterBranchReturn({
      bookingRequestId,
      scope: adminScope(auth.session),
    });
    if (!result.ok) return result;
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_CONFIRMED") {
      return { ok: false, error: "تم التأكيد مسبقاً." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر تأكيد الاستلام." };
  }

  await logBookingEvent({
    bookingId: bookingRequestId,
    event: "INTER_BRANCH_RETURN",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    notes: auth.session.branchName ?? undefined,
  });

  revalidatePath("/admin/branch-returns");
  revalidatePath("/admin/vehicles");
  revalidatePath("/admin/fleet-availability");
  return { ok: true };
}
