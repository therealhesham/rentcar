"use server";

import { getActiveRentalTerms, type RentalTermDTO } from "@/lib/rental-terms-data";

export async function fetchActiveRentalTerms(locale: string = "ar"): Promise<RentalTermDTO[]> {
  return await getActiveRentalTerms(locale);
}
