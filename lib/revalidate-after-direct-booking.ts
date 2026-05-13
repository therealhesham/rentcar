import { revalidatePath } from "next/cache";

export function revalidateAfterDirectBooking(): void {
  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath("/fleet");
  revalidatePath("/fleet/checkout");
  revalidatePath("/fleet/checkout/otp");
  revalidatePath("/account");
}
