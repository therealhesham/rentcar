import { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getWhatsappTemplatesState } from "./actions";
import { WhatsappTemplatesForm } from "./WhatsappTemplatesForm";

export const metadata: Metadata = {
  title: "قوالب الواتساب | الإدارة",
};

export default async function WhatsappTemplatesPage() {
  const initialState = await getWhatsappTemplatesState();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AdminPageHeader
        title="قوالب رسائل الواتساب"
        description="تعديل محتوى الرسائل النصية التي يتم إرسالها للعملاء أو الإدارة عبر الواتساب."
        backHref="/admin"
      />

      <WhatsappTemplatesForm initialState={initialState} />
    </div>
  );
}
