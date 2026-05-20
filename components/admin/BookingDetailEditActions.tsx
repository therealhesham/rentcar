"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EditBookingRequestForm } from "@/components/admin/EditBookingRequestForm";
import type { BookableModelOption } from "@/components/admin/ConvertInquiryToDirectForm";
import type { EditableBookingRow } from "@/lib/admin-booking-edit-types";

type CategoryOption = { slug: string; title: string };

type Props = {
  request: EditableBookingRow;
  categories: CategoryOption[];
  models: BookableModelOption[];
};

export function BookingDetailEditActions({ request, categories, models }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wantEdit = searchParams.get("edit") === "1";
  const [openFromQuery, setOpenFromQuery] = useState(wantEdit);

  useEffect(() => {
    if (wantEdit) setOpenFromQuery(true);
  }, [wantEdit]);

  const clearEditQuery = useCallback(() => {
    if (searchParams.get("edit") === "1") {
      router.replace(`/admin/bookings/${request.id}`, { scroll: false });
    }
    setOpenFromQuery(false);
  }, [request.id, router, searchParams]);

  if (request.kind === "INQUIRY" && categories.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant">لا توجد فئات أسطول لتعديل هذا الاستفسار.</p>
    );
  }

  return (
    <EditBookingRequestForm
      request={request}
      categories={categories}
      models={models}
      defaultOpen={openFromQuery}
      hideDetailLink
      onModalClose={clearEditQuery}
      triggerLabel="تعديل الطلب"
      triggerClassName="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary-container/40 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary-container/60"
    />
  );
}
