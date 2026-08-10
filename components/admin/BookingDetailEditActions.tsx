"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EditBookingRequestForm } from "@/components/admin/EditBookingRequestForm";
import type { BookableModelOption } from "@/components/admin/ConvertInquiryToDirectForm";
import type { EditableBookingRow } from "@/lib/admin-booking-edit-types";

type CategoryOption = { slug: string; title: string };
type BranchOption = { slug: string; name: string };

type Props = {
  request: EditableBookingRow;
  categories: CategoryOption[];
  models: BookableModelOption[];
  branches?: BranchOption[];
};

export function BookingDetailEditActions({ request, categories, models, branches }: Props) {
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
      branches={branches}
      defaultOpen={openFromQuery}
      showTrigger={false}
      hideDetailLink
      onModalClose={clearEditQuery}
    />
  );
}
