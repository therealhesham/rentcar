import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getSocialLinks } from "@/lib/site-settings";
import { SocialLinksEditForm } from "./SocialLinksEditForm";

export const dynamic = "force-dynamic";

export default async function AdminSocialLinksPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const socialLinks = await getSocialLinks();

  return (
    <>
      <AdminPageHeader
        title="روابط التواصل الاجتماعي"
        description="إدارة وتفعيل روابط وسائل التواصل الاجتماعي (انستقرام، تيك توك، سناب شات، واتساب، إكس، يوتيوب، فيسبوك، لينكد إن) المعروضة في فوتر الموقع."
        backHref="/admin"
      />

      <SocialLinksEditForm initialLinks={socialLinks} />
    </>
  );
}
